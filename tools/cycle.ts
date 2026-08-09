// The cycle orchestrator: a deterministic script runs the loop (docs/TODO/105).
//
//   node --experimental-strip-types tools/cycle.ts <todo-number> [--dry-run]
//
// The script is the durable workflow state machine; git and the plan doc are
// the memory; Claude sessions are disposable workers (docs/PROCESS.md). One
// invocation drives ONE queue item:
//
//   prepare → fresh implementer → deterministic checks → fresh verifier
//     → PASS: accept (leave the branch for the supervisor to merge)
//     → REWORK: fresh fixer with findings only, then verify again (max 2)
//     → BLOCKED: stop for a human
//
// The implementer is confined to a worktree and told its caps in the prompt
// (this CLI build has no turn-cap flag); the verifier is read-only by
// --disallowedTools. Neither may spawn agents. Run state is written to
// .cycle/<todo>.json after every phase, so a killed run resumes by rerunning
// the same command — completed phases are skipped by reading that state.
//
// --dry-run prints every command and prompt without invoking claude, which is
// the cheap structural self-test.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const STATE_DIR = join(ROOT, '.cycle');
const MAX_REWORK = 2; // the audit's hard cap: a surviving finding is BLOCKED

// --- plumbing ----------------------------------------------------------------

function sh(cmd: string, args: string[], cwd: string = ROOT): string {
  return execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function git(args: string[], cwd: string = ROOT): string {
  return sh('git', args, cwd).trim();
}

function die(msg: string): never {
  console.error(`cycle: ${msg}`);
  process.exit(1);
}

interface RunState {
  todo: string;
  base: string;
  branch: string;
  worktree: string;
  phase: 'implemented' | 'accepted' | 'blocked' | null;
  rounds: number;
  accepted?: string;
}

function loadState(todo: string): RunState | null {
  const p = join(STATE_DIR, `${todo}.json`);
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) as RunState : null;
}

function saveState(s: RunState): void {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(join(STATE_DIR, `${s.todo}.json`), JSON.stringify(s, null, 2));
}

// --- 1. prepare (deterministic) ----------------------------------------------

const num = process.argv[2];
const dryRun = process.argv.includes('--dry-run');
if (!num || !/^\d+$/.test(num)) die('usage: cycle.ts <todo-number> [--dry-run]');

const todoDir = join(ROOT, 'docs/TODO');
const matches = readdirSync(todoDir).filter((f) => f.startsWith(`${num}-`) && f.endsWith('.md'));
if (matches.length !== 1) die(`expected exactly one docs/TODO/${num}-*.md, found ${matches.length}`);
// Workers read the plan doc themselves; the orchestrator only needs its path.
const planDoc = `docs/TODO/${matches[0]}`;

if (git(['status', '--porcelain'])) die('main working tree is not clean');
const base = git(['rev-parse', 'HEAD']);
const branch = `cycle/${num}`;
const worktree = join(ROOT, '.claude/worktrees', `cycle-${num}`);

let state = loadState(num);
if (state && state.base !== base && state.phase !== 'accepted') {
  die(`stale state for ${num} (base ${state.base.slice(0, 7)} vs HEAD ${base.slice(0, 7)}); ` +
    `delete .cycle/${num}.json to restart`);
}
if (state?.phase === 'accepted') die(`${num} already accepted at ${state.accepted?.slice(0, 7)}`);
if (!state) state = { todo: num, base, branch, worktree, phase: null, rounds: 0 };

if (!existsSync(worktree)) {
  if (dryRun) console.log(`[dry] git worktree add -b ${branch} ${worktree} ${base.slice(0, 7)}`);
  else git(['worktree', 'add', '-b', branch, worktree, base]);
}

// --- worker invocations ------------------------------------------------------

const CO_AUTHOR = 'Co-Authored-By: Claude (cycle orchestrator, docs/TODO/105) <noreply@anthropic.com>';

function runClaude(prompt: string, cwd: string, extraArgs: string[]): string {
  const args = ['-p', prompt, '--permission-mode', 'acceptEdits', ...extraArgs];
  if (dryRun) {
    console.log(`\n[dry] claude ${extraArgs.join(' ')} (cwd ${cwd})\n--- prompt ---\n${prompt}\n---`);
    return '';
  }
  return sh('claude', args, cwd);
}

function implementerPrompt(findings: string | null): string {
  const rework = findings
    ? `This is a REWORK round. Address ONLY these verifier findings, nothing else:\n${findings}\n`
    : '';
  return `You are one disposable implementation worker in the HARMLESS repo's cycle loop.
Work ONLY in this directory (a git worktree on branch ${branch}, based on ${base.slice(0, 7)}).
${rework}Read docs/PROCESS.md's step-2 rules and your contract: ${planDoc}. Then implement it.
Hard constraints: spawn NO subagents and do not use the Agent tool; do not push or merge;
do not touch files outside what the plan doc's scope implies; use targeted tests while
working (node --experimental-strip-types on the affected test file) and the plan doc's
gate tier once at the end; stop after at most 50 tool calls and commit what is complete
with a checkpoint note in the commit message if unfinished. Commit per milestone; end
every commit message with:\n${CO_AUTHOR}\nFinal output: a report under 300 words —
what landed, gates run with one-line results, anything unfinished.`;
}

function verifierPrompt(diffStat: string, testSummary: string): string {
  return `You are a read-only verifier in the HARMLESS repo's cycle loop. Judge whether the
work on branch ${branch} satisfies its contract, ${planDoc} — read that file and the diff:
run: git diff ${base.slice(0, 7)}...HEAD (stat below). Deterministic checks already ran:
${testSummary}
Diff stat:\n${diffStat}
Do NOT edit anything and spawn NO agents. Read only what you need. Your ENTIRE final
output must be one JSON object, nothing else:
{"status":"PASS|REWORK|BLOCKED","findings":[{"severity":"high|medium|low","file":"path",
"line":0,"problem":"...","required_fix":"..."}]}
REWORK only for findings that fail the contract or the repo's rules; BLOCKED only if the
contract itself cannot be satisfied. Style preferences are not findings.`;
}

// --- 3. deterministic checks -------------------------------------------------

function deterministicChecks(): { ok: boolean; summary: string } {
  const lines: string[] = [];
  let ok = true;
  const head = git(['rev-parse', 'HEAD'], worktree);
  if (head === base) { ok = false; lines.push('FAIL no new commit on the branch'); }
  if (git(['status', '--porcelain'], worktree)) { ok = false; lines.push('FAIL worktree not clean'); }
  if (git(['merge-base', base, 'HEAD'], worktree) !== base) {
    ok = false; lines.push(`FAIL branch not based on ${base.slice(0, 7)}`);
  }
  const changed = git(['diff', '--name-only', `${base}...HEAD`], worktree);
  if (changed.split('\n').some((f) => f.startsWith('.claude/') || f.startsWith('.cycle/'))) {
    ok = false; lines.push('FAIL out-of-scope: orchestrator or agent state files changed');
  }
  // The suite is the cheap universal check (~5s); elite-a joins when src/ moved.
  for (const [name, cmd, args] of [
    ['npm test', 'npm', ['test']],
    ...(changed.split('\n').some((f) => f.startsWith('src/'))
      ? [['elite-a', 'npm', ['run', 'elite-a']] as const] : []),
  ] as const) {
    try { sh(cmd, [...args], worktree); lines.push(`ok   ${name}`); }
    catch (e) {
      ok = false;
      const out = (e as { stdout?: string; stderr?: string });
      lines.push(`FAIL ${name}\n${(out.stdout ?? '').slice(-2000)}${(out.stderr ?? '').slice(-500)}`);
    }
  }
  return { ok, summary: lines.join('\n') };
}

// --- 4/5. verify and rework loop ---------------------------------------------

function parseVerdict(raw: string): { status: string; findings: unknown[] } | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const v = JSON.parse(match[0]) as { status?: string; findings?: unknown[] };
    return v.status && ['PASS', 'REWORK', 'BLOCKED'].includes(v.status)
      ? { status: v.status, findings: v.findings ?? [] } : null;
  } catch { return null; }
}

function main(): void {
  if (state!.phase !== 'implemented') {
    console.log(`cycle ${num}: implementing on ${branch} (base ${base.slice(0, 7)})`);
    const report = runClaude(implementerPrompt(null), worktree, []);
    if (!dryRun) console.log(`--- implementer report ---\n${report.slice(0, 3000)}\n---`);
    state!.phase = 'implemented';
    if (!dryRun) saveState(state!);
  }
  if (dryRun) {
    console.log('\n[dry] deterministic checks: new-commit / clean-tree / merge-base /' +
      ' scope / npm test / elite-a-if-src');
    console.log('[dry] then verifier (read-only, JSON verdict), rework loop capped at ' +
      `${MAX_REWORK}, accept leaves ${branch} for the supervisor to merge`);
    return;
  }

  for (; ;) {
    const checks = deterministicChecks();
    console.log(`--- deterministic checks ---\n${checks.summary}\n---`);
    let findingsText: string;
    if (checks.ok) {
      const diffStat = git(['diff', '--stat', `${base}...HEAD`], worktree);
      const raw = runClaude(verifierPrompt(diffStat, checks.summary), worktree,
        ['--disallowedTools', 'Edit,Write,NotebookEdit,Agent,Task,EnterWorktree']);
      const verdict = parseVerdict(raw);
      if (!verdict) die(`verifier returned no parsable verdict:\n${raw.slice(0, 1500)}`);
      console.log(`--- verdict: ${verdict.status} (${verdict.findings.length} findings) ---`);
      if (verdict.status === 'PASS') {
        state!.phase = 'accepted';
        state!.accepted = git(['rev-parse', 'HEAD'], worktree);
        saveState(state!);
        console.log(`ACCEPTED ${num} at ${state!.accepted.slice(0, 7)}.\nNext (supervisor):` +
          `\n  git merge --ff-only ${branch} && <full gate tier> && git push` +
          `\n  git worktree remove ${worktree} && git branch -d ${branch}`);
        return;
      }
      if (verdict.status === 'BLOCKED') break;
      findingsText = JSON.stringify(verdict.findings, null, 1);
    } else {
      findingsText = `Deterministic checks failed:\n${checks.summary}`;
    }
    if (state!.rounds >= MAX_REWORK) break;
    state!.rounds += 1;
    saveState(state!);
    console.log(`cycle ${num}: rework round ${state!.rounds}/${MAX_REWORK}`);
    const report = runClaude(implementerPrompt(findingsText), worktree, []);
    console.log(`--- fixer report ---\n${report.slice(0, 2000)}\n---`);
  }

  state!.phase = 'blocked';
  saveState(state!);
  die(`${num} BLOCKED after ${state!.rounds} rework round(s) — needs a human. ` +
    `State: .cycle/${num}.json; branch ${branch} kept for inspection.`);
}

main();
