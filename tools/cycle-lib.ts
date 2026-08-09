// The cycle orchestrator's state machine (docs/TODO/105) — library half, so
// test/cycle.test.ts can drive every transition against a fake claude binary
// in a temporary repo. tools/cycle.ts is the CLI shell over runCycle().
//
// Enforcement is mechanical, not advisory (audit rework, 2026-08-09):
// implementers get a closed tool list and no session persistence; the
// verifier gets read-only tools and the diff in its prompt so it needs no
// Bash at all; scope and targeted tests come from the plan doc's Milestones
// block and are checked deterministically; gate tiers follow docs/PROCESS.md
// step 3 from what the diff actually touched; rework rounds are consumed
// only by a fixer that ran to completion.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface CycleConfig {
  root: string;
  claudeBin: string;      // injectable for tests (CLAUDE_BIN)
  maxRework: number;
  maxBudgetUsd: number;   // per worker invocation
  dryRun: boolean;
  log: (line: string) => void;
}

export interface Milestone {
  title: string;
  criteria: string;
  scope: string[];        // path prefixes; empty = whole-repo (warned, not failed)
  tests: string[];        // shell commands run in the worktree
}

export interface RunState {
  todo: string;
  base: string;           // the item's base on main
  branch: string;
  worktree: string;
  milestones: Milestone[];
  mi: number;             // current milestone index
  mBase: string;          // commit the current milestone builds on
  phase: 'idle' | 'accepted' | 'blocked';
  rounds: number;         // rework rounds consumed by the current milestone
  accepted?: string;
}

export class CycleError extends Error {}

const FORBIDDEN = ['.claude/', '.cycle/'];
const IMPLEMENTER_TOOLS = 'Read,Grep,Glob,Bash,Edit,Write';
const VERIFIER_TOOLS = 'Read,Grep,Glob';
const DIFF_CAP = 50_000; // chars of diff embedded in the verifier prompt

// --- plumbing ----------------------------------------------------------------

function sh(cmd: string, args: string[], cwd: string): string {
  return execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function git(cfg: CycleConfig, args: string[], cwd?: string): string {
  return sh('git', args, cwd ?? cfg.root).trim();
}

function statePath(cfg: CycleConfig, todo: string): string {
  return join(cfg.root, '.cycle', `${todo}.json`);
}

export function loadState(cfg: CycleConfig, todo: string): RunState | null {
  const p = statePath(cfg, todo);
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) as RunState : null;
}

function saveState(cfg: CycleConfig, s: RunState): void {
  mkdirSync(join(cfg.root, '.cycle'), { recursive: true });
  writeFileSync(statePath(cfg, s.todo), JSON.stringify(s, null, 2));
}

// --- plan-doc parsing --------------------------------------------------------

/**
 * An optional `## Milestones` block turns one plan doc into several fresh
 * workers. Each numbered line is a milestone; `[scope: a, b]` and
 * `[tests: cmd; cmd]` tags are enforced mechanically; indented lines under it
 * are its acceptance criteria. No block = one milestone covering the doc.
 */
export function parseMilestones(planText: string, planDoc: string): Milestone[] {
  const section = planText.split(/^## Milestones\s*$/m)[1]?.split(/^## /m)[0];
  if (!section) {
    return [{ title: `the whole of ${planDoc}`, criteria: 'the plan doc in full', scope: [], tests: [] }];
  }
  const out: Milestone[] = [];
  for (const line of section.split('\n')) {
    const head = line.match(/^\d+\.\s+(.*)$/);
    if (head) {
      let title = head[1];
      const scope = title.match(/\[scope:\s*([^\]]+)\]/)?.[1].split(',').map((s) => s.trim()) ?? [];
      const tests = title.match(/\[tests:\s*([^\]]+)\]/)?.[1].split(';').map((s) => s.trim()) ?? [];
      title = title.replace(/\[(scope|tests):[^\]]+\]/g, '').trim();
      out.push({ title, criteria: '', scope, tests });
    } else if (out.length && line.trim()) {
      out[out.length - 1].criteria += `${line.trim()}\n`;
    }
  }
  if (!out.length) throw new CycleError(`empty ## Milestones section in ${planDoc}`);
  return out;
}

// --- gate tiers (docs/PROCESS.md step 3) -------------------------------------

/** Which gates a diff owes, from what it touched. The flown check cannot be
 *  scripted; gameplay tiers get a printed reminder instead. */
export function gateTier(changed: string[]): { name: string; cmds: string[][]; flown: boolean } {
  const gameplay = changed.some((f) =>
    /^src\/(game|constants|ai-training)\//.test(f) || f.startsWith('src/ships/'));
  if (gameplay) {
    return {
      name: 'gameplay', flown: true,
      cmds: [['npm', 'run', 'build'], ['npm', 'run', 'elite-a'], ['npm', 'run', 'campaign']],
    };
  }
  if (changed.some((f) => f.startsWith('src/'))) {
    return { name: 'src', cmds: [['npm', 'run', 'build'], ['npm', 'run', 'elite-a']], flown: false };
  }
  if (changed.every((f) => f.startsWith('docs/') || f.endsWith('.md'))) {
    return { name: 'docs', cmds: [['npm', 'run', 'lint']], flown: false };
  }
  return { name: 'tooling', cmds: [['npm', 'run', 'build']], flown: false };
}

// --- deterministic checks ----------------------------------------------------

export function deterministicChecks(cfg: CycleConfig, s: RunState): { ok: boolean; summary: string } {
  const m = s.milestones[s.mi];
  const lines: string[] = [];
  let ok = true;
  const fail = (msg: string): void => { ok = false; lines.push(`FAIL ${msg}`); };

  if (git(cfg, ['rev-parse', 'HEAD'], s.worktree) === s.mBase) fail('no new commit');
  if (git(cfg, ['status', '--porcelain'], s.worktree)) fail('worktree not clean');
  if (git(cfg, ['merge-base', s.mBase, 'HEAD'], s.worktree) !== s.mBase) {
    fail(`branch not based on ${s.mBase.slice(0, 7)}`);
  }
  const changed = git(cfg, ['diff', '--name-only', `${s.mBase}...HEAD`], s.worktree)
    .split('\n').filter(Boolean);
  for (const f of changed) {
    if (FORBIDDEN.some((p) => f.startsWith(p))) fail(`forbidden path changed: ${f}`);
    // The plan doc itself is always in scope: outcomes and decisions land there.
    if (m.scope.length && !f.startsWith('docs/TODO/')
      && !m.scope.some((p) => f.startsWith(p))) fail(`out of scope: ${f}`);
  }
  if (!m.scope.length && changed.length) lines.push('note scope unset — all paths permitted');

  for (const t of m.tests) {
    try { sh('sh', ['-c', t], s.worktree); lines.push(`ok   targeted: ${t}`); }
    catch { fail(`targeted test: ${t}`); }
  }
  const tier = gateTier(changed);
  lines.push(`tier ${tier.name}${tier.flown ? ' (flown check owed at landing)' : ''}`);
  for (const cmd of tier.cmds) {
    const name = cmd.slice(1).join(' ');
    try { sh(cmd[0], cmd.slice(1), s.worktree); lines.push(`ok   ${name}`); }
    catch (e) {
      const out = e as { stdout?: string; stderr?: string };
      fail(`${name}\n${(out.stdout ?? '').slice(-1500)}${(out.stderr ?? '').slice(-500)}`);
    }
  }
  return { ok, summary: lines.join('\n') };
}

// --- workers -----------------------------------------------------------------

const CO_AUTHOR = 'Co-Authored-By: Claude (cycle orchestrator, docs/TODO/105) <noreply@anthropic.com>';

function runWorker(cfg: CycleConfig, prompt: string, cwd: string, role: 'implementer' | 'verifier'): string {
  const args = ['-p', prompt, '--no-session-persistence', '--no-chrome',
    '--autocompact', '100000', '--max-budget-usd', String(cfg.maxBudgetUsd),
    ...(role === 'verifier'
      ? ['--tools', VERIFIER_TOOLS, '--permission-mode', 'plan']
      : ['--tools', IMPLEMENTER_TOOLS, '--permission-mode', 'bypassPermissions'])];
  if (cfg.dryRun) {
    cfg.log(`[dry] claude (${role}) ${args.filter((a) => a !== prompt).join(' ')}`);
    cfg.log(`--- ${role} prompt ---\n${prompt}\n---`);
    return '';
  }
  return sh(cfg.claudeBin, args, cwd);
}

export function implementerPrompt(s: RunState, planDoc: string, findings: string | null): string {
  const m = s.milestones[s.mi];
  const rework = findings
    ? `This is a REWORK round. Address ONLY these findings, nothing else:\n${findings}\n` : '';
  return `You are one disposable implementation worker in the HARMLESS repo's cycle loop.
Work ONLY in this directory (worktree, branch ${s.branch}, based on ${s.mBase.slice(0, 7)}).
${rework}Contract: ${planDoc} — milestone ${s.mi + 1}/${s.milestones.length}: ${m.title}
Acceptance criteria:\n${m.criteria || 'the plan doc section for this milestone'}
${m.scope.length ? `Allowed paths (mechanically enforced): ${m.scope.join(', ')} and docs/TODO/` : ''}
Read docs/PROCESS.md step 2 and the contract, then implement THIS milestone only.
Do not push or merge. Use targeted tests while working; the orchestrator runs the gates.
Stop after at most 50 tool calls; commit what is complete (checkpoint note if unfinished).
End every commit message with:\n${CO_AUTHOR}\nFinal output: a report under 300 words.`;
}

export function verifierPrompt(s: RunState, planDoc: string, checksSummary: string, diff: string): string {
  const m = s.milestones[s.mi];
  return `You are a read-only verifier (no Bash, no edits, no agents — your tools are
Read/Grep/Glob only). Judge whether this diff satisfies milestone ${s.mi + 1}/${s.milestones.length}
("${m.title}") of ${planDoc} — read that file; criteria:\n${m.criteria || '(whole doc)'}
Deterministic checks already ran:\n${checksSummary}
The complete diff (${s.mBase.slice(0, 7)}...HEAD${diff.length >= DIFF_CAP ? ', TRUNCATED' : ''}):
${diff.slice(0, DIFF_CAP)}
Your ENTIRE final output must be one JSON object, nothing else:
{"status":"PASS|REWORK|BLOCKED","findings":[{"severity":"high|medium|low","file":"path",
"line":0,"problem":"...","required_fix":"..."}]}
REWORK only for contract or repo-rule failures; BLOCKED only if the contract itself cannot
be satisfied. Style preferences are not findings.`;
}

export function parseVerdict(raw: string): { status: string; findings: unknown[] } | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const v = JSON.parse(match[0]) as { status?: string; findings?: unknown[] };
    return v.status && ['PASS', 'REWORK', 'BLOCKED'].includes(v.status)
      ? { status: v.status, findings: v.findings ?? [] } : null;
  } catch { return null; }
}

// --- the machine -------------------------------------------------------------

export function prepare(cfg: CycleConfig, num: string): RunState {
  const todoDir = join(cfg.root, 'docs/TODO');
  const matches = readdirSync(todoDir).filter((f) => f.startsWith(`${num}-`) && f.endsWith('.md'));
  if (matches.length !== 1) {
    throw new CycleError(`expected one docs/TODO/${num}-*.md, found ${matches.length}`);
  }
  const planDoc = `docs/TODO/${matches[0]}`;
  if (git(cfg, ['status', '--porcelain'])) throw new CycleError('main working tree is not clean');
  const base = git(cfg, ['rev-parse', 'HEAD']);

  let s = loadState(cfg, num);
  if (s && s.base !== base && s.phase !== 'accepted') {
    throw new CycleError(`stale state (base ${s.base.slice(0, 7)} vs HEAD ${base.slice(0, 7)}); ` +
      `delete .cycle/${num}.json to restart`);
  }
  if (s?.phase === 'accepted') throw new CycleError(`already accepted at ${s.accepted?.slice(0, 7)}`);
  if (s?.phase === 'blocked') throw new CycleError(`BLOCKED — needs a human; see .cycle/${num}.json`);
  if (!s) {
    const milestones = parseMilestones(readFileSync(join(cfg.root, planDoc), 'utf8'), planDoc);
    s = {
      todo: num, base, branch: `cycle/${num}`,
      worktree: join(cfg.root, '.claude/worktrees', `cycle-${num}`),
      milestones, mi: 0, mBase: base, phase: 'idle', rounds: 0,
    };
  }
  if (!existsSync(s.worktree)) {
    if (cfg.dryRun) cfg.log(`[dry] git worktree add -b ${s.branch} ${s.worktree}`);
    else git(cfg, ['worktree', 'add', '-b', s.branch, s.worktree, base]);
  }
  if (!cfg.dryRun) saveState(cfg, s);
  return s;
}

/** Drive the current milestone to accepted/blocked; returns the state. */
export function runCycle(cfg: CycleConfig, num: string): RunState {
  const s = prepare(cfg, num);
  const planDoc = `docs/TODO/${readdirSync(join(cfg.root, 'docs/TODO'))
    .find((f) => f.startsWith(`${num}-`) && f.endsWith('.md'))}`;

  while (s.mi < s.milestones.length) {
    // Interrupted-run recovery: commits already on the branch mean the
    // implementer ran; go straight to checks rather than paying for another.
    const hasWork = !cfg.dryRun && git(cfg, ['rev-parse', 'HEAD'], s.worktree) !== s.mBase;
    if (!hasWork) {
      cfg.log(`cycle ${num}: milestone ${s.mi + 1}/${s.milestones.length} — implementing`);
      const report = runWorker(cfg, implementerPrompt(s, planDoc, null), s.worktree, 'implementer');
      if (!cfg.dryRun) cfg.log(`--- implementer ---\n${report.slice(0, 2000)}\n---`);
    } else cfg.log(`cycle ${num}: found existing commits; skipping to checks`);

    if (cfg.dryRun) {
      cfg.log('[dry] deterministic checks, then:');
      runWorker(cfg, verifierPrompt(s, planDoc, '(checks summary)', '(diff)'), s.worktree, 'verifier');
      runWorker(cfg, implementerPrompt(s, planDoc, '(example findings)'), s.worktree, 'implementer');
      const sample = parseVerdict('{"status":"PASS","findings":[]}');
      cfg.log(`[dry] verdict parser self-check: ${sample?.status === 'PASS' ? 'ok' : 'BROKEN'}`);
      return s;
    }

    for (; ;) {
      const checks = deterministicChecks(cfg, s);
      cfg.log(`--- checks ---\n${checks.summary}\n---`);
      let findingsText: string;
      if (checks.ok) {
        const diff = git(cfg, ['diff', `${s.mBase}...HEAD`], s.worktree);
        const raw = runWorker(cfg, verifierPrompt(s, planDoc, checks.summary, diff), s.worktree, 'verifier');
        const verdict = parseVerdict(raw);
        if (!verdict) throw new CycleError(`unparsable verdict:\n${raw.slice(0, 1000)}`);
        cfg.log(`--- verdict: ${verdict.status} (${verdict.findings.length} findings) ---`);
        if (verdict.status === 'PASS') {
          s.mBase = git(cfg, ['rev-parse', 'HEAD'], s.worktree);
          s.mi += 1; s.rounds = 0;
          saveState(cfg, s);
          break;
        }
        if (verdict.status === 'BLOCKED') { s.phase = 'blocked'; saveState(cfg, s); return s; }
        findingsText = JSON.stringify(verdict.findings, null, 1);
      } else findingsText = `Deterministic checks failed:\n${checks.summary}`;

      if (s.rounds >= cfg.maxRework) { s.phase = 'blocked'; saveState(cfg, s); return s; }
      cfg.log(`cycle ${num}: rework round ${s.rounds + 1}/${cfg.maxRework}`);
      const report = runWorker(cfg, implementerPrompt(s, planDoc, findingsText), s.worktree, 'implementer');
      s.rounds += 1; // consumed only after the fixer ran to completion
      saveState(cfg, s);
      cfg.log(`--- fixer ---\n${report.slice(0, 1500)}\n---`);
    }
  }
  s.phase = 'accepted';
  s.accepted = git(cfg, ['rev-parse', 'HEAD'], s.worktree);
  saveState(cfg, s);
  return s;
}
