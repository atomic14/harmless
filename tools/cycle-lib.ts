// Cycle orchestrator: the state machine (docs/TODO/105). Queue-driven, safe,
// resumable: select → prepare → fresh worker per milestone → deterministic
// checks → fresh verifier → bounded rework → whole-item verification → close
// the docs → land. Chris (or a stop hook) never has to remember the active
// item, milestone, branch or retry count — `.cycle/` and git carry it all.
//
// tools/cycle-state.ts holds state/queue/status; tools/cycle-plan.ts the
// structured preparation; tools/cycle-workers.ts the worker safety rails.
// test/cycle.test.ts drives every transition with a fake claude and stubbed
// gates in throwaway repos.

import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import {
  archiveTodo, completedTodoDocFor, CycleError, CycleStop, findActive, git, loadQueue,
  loadState, planPath, saveState, sh, statePath, todoDocFor, atomicWrite,
  type CycleConfig, type CyclePlan, type RunState, type Tier,
} from './cycle-state.ts';
import { preparePlan } from './cycle-plan.ts';
import {
  closerPrompt, implementerPrompt, runWorker, verdictOf, verifierPrompt,
} from './cycle-workers.ts';

const FORBIDDEN = ['.claude/', '.cycle/'];
const TIER_ORDER: Tier[] = ['docs', 'tooling', 'src', 'gameplay'];

// --- gates -------------------------------------------------------------------

/** Path inference is only a SAFETY FLOOR under the plan's declared tier. */
export function inferredTier(changed: string[]): Tier {
  if (changed.some((f) => /^src\/(game|constants|ai-training|ships)\//.test(f))) return 'gameplay';
  if (changed.some((f) => f.startsWith('src/'))) return 'src';
  if (changed.every((f) => f.startsWith('docs/') || f.endsWith('.md'))) return 'docs';
  return 'tooling';
}

export function effectiveTier(declared: Tier, changed: string[]): Tier {
  const inferred = inferredTier(changed);
  return TIER_ORDER[Math.max(TIER_ORDER.indexOf(declared), TIER_ORDER.indexOf(inferred))];
}

export function gateCmds(tier: Tier): string[][] {
  if (tier === 'docs') return [['npm', 'run', 'lint']];
  if (tier === 'tooling') return [['npm', 'run', 'build']];
  if (tier === 'src') return [['npm', 'run', 'build'], ['npm', 'run', 'elite-a']];
  return [['npm', 'run', 'build'], ['npm', 'run', 'elite-a'], ['npm', 'run', 'campaign']];
}

// --- deterministic checks ----------------------------------------------------

interface Checks { ok: boolean; summary: string }

function changedFiles(s: RunState, base: string): string[] {
  return git(['diff', '--name-only', `${base}...HEAD`], s.worktree).split('\n').filter(Boolean);
}

/** A single file's diff larger than this is summarised by stat in the review
 *  diff, named as such — generated artifacts (the constants catalogue) would
 *  otherwise blow the item cap while carrying nothing a verifier can judge
 *  that the deterministic checks have not already pinned. */
const PER_FILE_DIFF_CAP = 8_000;

export interface ReviewDiff { text: string; summarised: string[] }

/** The diff a verifier reviews: complete per file, except that oversized
 *  per-file diffs become their --stat line with an explicit label — the
 *  prompt never calls a summarised diff complete. */
export function buildReviewDiff(s: RunState, base: string): ReviewDiff {
  const parts: string[] = [];
  const summarised: string[] = [];
  for (const f of changedFiles(s, base)) {
    const d = git(['diff', `${base}...HEAD`, '--', f], s.worktree);
    if (d.length > PER_FILE_DIFF_CAP) {
      summarised.push(f);
      parts.push(`--- ${f}: ${d.length} chars, SUMMARISED BY STAT (contents not shown) ---\n`
        + git(['diff', '--stat', `${base}...HEAD`, '--', f], s.worktree));
    } else parts.push(d);
  }
  return { text: parts.join('\n'), summarised };
}

export function deterministicChecks(
  cfg: CycleConfig, s: RunState, plan: CyclePlan, base: string, withGates: boolean,
): Checks {
  const exec = cfg.exec ?? sh;
  // At the whole-item stage the scope is every milestone's union and every
  // declared targeted test runs again.
  const m = s.currentMilestone < plan.milestones.length
    ? plan.milestones[s.currentMilestone]
    : {
      id: 'final', title: 'whole item',
      acceptance: [],
      scope: [...new Set(plan.milestones.flatMap((x) => x.scope))],
      tests: plan.milestones.flatMap((x) => x.tests),
    };
  const lines: string[] = [];
  let ok = true;
  const fail = (msg: string): void => { ok = false; lines.push(`FAIL ${msg}`); };

  if (git(['rev-parse', 'HEAD'], s.worktree) === base) fail('no new commit');
  if (git(['status', '--porcelain'], s.worktree)) fail('worktree not clean');
  if (git(['merge-base', base, 'HEAD'], s.worktree) !== base) {
    fail(`branch not based on ${base.slice(0, 7)}`);
  }
  const changed = changedFiles(s, base);
  for (const f of changed) {
    if (FORBIDDEN.some((p) => f.startsWith(p))) fail(`forbidden path changed: ${f}`);
    if (m.scope.length && !f.startsWith('docs/TODO/')
      && !m.scope.some((p) => f.startsWith(p))) fail(`out of scope: ${f}`);
  }
  for (const t of m.tests) {
    try { exec(t.cmd, t.args, s.worktree); lines.push(`ok   targeted: ${t.cmd} ${t.args.join(' ')}`); }
    catch { fail(`targeted test: ${t.cmd} ${t.args.join(' ')}`); }
  }
  if (withGates) {
    const tier = effectiveTier(s.declaredTier, changed);
    lines.push(`tier ${tier} (declared ${s.declaredTier})`);
    for (const cmd of gateCmds(tier)) {
      try { exec(cmd[0], cmd.slice(1), s.worktree); lines.push(`ok   ${cmd.slice(1).join(' ')}`); }
      catch (e) {
        const out = e as { stdout?: string; stderr?: string };
        fail(`${cmd.slice(1).join(' ')}\n${(out.stdout ?? '').slice(-1200)}${(out.stderr ?? '').slice(-400)}`);
      }
    }
  }
  return { ok, summary: lines.join('\n') };
}

// --- the machine -------------------------------------------------------------

function ensureWorktree(cfg: CycleConfig, s: RunState): void {
  if (existsSync(s.worktree)) return;
  if (git(['branch', '--list', s.branch], cfg.root)) {
    git(['worktree', 'add', s.worktree, s.branch], cfg.root);
  } else if (cfg.dryRun) cfg.log(`[dry] git worktree add -b ${s.branch} ${s.worktree}`);
  else git(['worktree', 'add', '-b', s.branch, s.worktree, s.itemBase], cfg.root);
}

function validateResume(cfg: CycleConfig, s: RunState): void {
  ensureWorktree(cfg, s);
  if (cfg.dryRun && !existsSync(s.worktree)) return;
  const head = git(['rev-parse', 'HEAD'], s.worktree);
  if (git(['merge-base', s.itemBase, 'HEAD'], s.worktree) !== s.itemBase) {
    throw new CycleError(`branch ${s.branch} is not based on ${s.itemBase.slice(0, 7)}`);
  }
  // Commits produced before an interruption: skip the implementer, go to checks.
  if (s.phase === 'implementing' && head !== s.milestoneBase) s.phase = 'checking';
}

function freshState(cfg: CycleConfig, num: string): RunState {
  if (git(['status', '--porcelain'], cfg.root)) {
    throw new CycleError('main working tree is not clean');
  }
  const base = git(['rev-parse', 'HEAD'], cfg.root);
  return {
    todo: num, branch: `cycle/${num}`,
    worktree: join(cfg.root, '.claude/worktrees', `cycle-${num}`),
    itemBase: base, phase: 'preparing', currentMilestone: 0, milestoneBase: base,
    branchHead: base, milestoneRounds: 0, finalRounds: 0, workerInvocations: [],
    lastError: null, lastSuccessfulPhase: null, declaredTier: 'tooling',
    flownCheckOwed: false, planChecksum: '', lastFindings: null,
  } as RunState;
}

function landing(cfg: CycleConfig, s: RunState, planDoc: string): void {
  const exec = cfg.exec ?? sh;
  if (s.phase === 'ready_to_land') {
    const preCloser = git(['rev-parse', 'HEAD'], s.worktree);
    const gateSummary = `effective tier ${effectiveTier(s.declaredTier, changedFiles(s, s.itemBase))}` +
      `; all gates green at final verification` +
      (s.flownEvidence ? `; flown: ${s.flownEvidence}` : '');
    runWorker(cfg, s, 'closer', closerPrompt(s, planDoc, gateSummary), s.worktree);
    if (!cfg.dryRun) {
      const closerChanged = git(['diff', '--name-only', `${preCloser}...HEAD`], s.worktree)
        .split('\n').filter(Boolean);
      if (git(['status', '--porcelain'], s.worktree) || closerChanged.some((f) => !f.startsWith('docs/TODO/'))) {
        s.phase = 'blocked'; s.lastError = 'closer changed files outside docs/TODO/';
        saveState(cfg, s); return;
      }
      archiveTodo(s.worktree, s.todo, planDoc);
      const queuePath = join(s.worktree, 'docs/TODO/QUEUE.json');
      const q = JSON.parse(readFileSync(queuePath, 'utf8')) as { version: 1; items: number[] };
      q.items = q.items.filter((n) => n !== Number(s.todo));
      atomicWrite(queuePath, `${JSON.stringify(q, null, 2)}\n`);
      git(['add', 'docs/TODO'], s.worktree);
      git(['commit', '-q', '-m', `docs/TODO: land ${s.todo} — index and queue\n\n` +
        'Co-Authored-By: Claude (cycle orchestrator, docs/TODO/105) <noreply@anthropic.com>'], s.worktree);
      exec('npm', ['run', 'lint'], s.worktree);
      // Main must be clean, at the expected base, and fast-forwardable.
      if (git(['status', '--porcelain'], cfg.root)) throw new CycleError('main tree dirty at landing');
      if (git(['rev-parse', 'HEAD'], cfg.root) !== s.itemBase) {
        s.phase = 'blocked'; s.lastError = 'main moved past itemBase — rebase needed';
        saveState(cfg, s); return;
      }
      git(['merge', '--ff-only', s.branch], cfg.root);
    } else cfg.log('[dry] finalize docs, lint, verify main at base, git merge --ff-only');
    s.phase = 'landed_local';
    if (!cfg.dryRun) saveState(cfg, s);
  }
  if (s.phase === 'landed_local') {
    if (cfg.push && !cfg.dryRun) {
      try { git(['push', 'origin', 'main'], cfg.root); } catch (e) {
        s.lastError = `push failed: ${String((e as Error).message).slice(0, 200)}`;
        saveState(cfg, s);
        throw new CycleStop('push failed — state is landed_local; rerun with --push to retry');
      }
    } else if (cfg.dryRun) cfg.log('[dry] git push origin main (with --push)');
    else cfg.log(`landed locally; push is the supervisor's (or rerun with --land --push)`);
    s.phase = 'complete';
    if (!cfg.dryRun) {
      saveState(cfg, s);
      git(['worktree', 'remove', '--force', s.worktree], cfg.root);
      git(['branch', '-D', s.branch], cfg.root);
    }
  }
}

/** Drive one item as far as configuration allows; always resumable. */
export function runItem(cfg: CycleConfig, num: string): RunState {
  let s = loadState(cfg, num);
  if (s?.phase === 'complete') throw new CycleError(`${num} is already complete`);
  const planDoc = s?.phase === 'landed_local'
    ? completedTodoDocFor(cfg, num)
    : todoDocFor(cfg, num);
  if (!s) s = freshState(cfg, num);
  ensureWorktree(cfg, s);
  validateResume(cfg, s);
  // Landing phases must not re-prepare: the closer edits the plan doc, which
  // would churn the checksum and re-invoke the planner for nothing.
  if (['ready_to_land', 'landed_local'].includes(s.phase)) {
    if (cfg.land || s.phase === 'landed_local') landing(cfg, s, planDoc);
    if (!cfg.dryRun) saveState(cfg, s);
    return s;
  }
  if (s.phase === 'awaiting_flown' || s.phase === 'blocked') return s;
  const plan = preparePlan(cfg, s, planDoc);
  if (s.phase === 'preparing') s.phase = 'implementing';
  if (!cfg.dryRun) saveState(cfg, s);

  try {
    while (s.currentMilestone < plan.milestones.length
      && !['blocked', 'awaiting_flown', 'ready_to_land', 'landed_local', 'complete'].includes(s.phase)) {
      if (s.phase === 'implementing') {
        cfg.log(`cycle ${num}: milestone ${s.currentMilestone + 1}/${plan.milestones.length}`);
        const r = runWorker(cfg, s, 'implementer',
          implementerPrompt(s, plan, planDoc, null), s.worktree);
        if (!cfg.dryRun) cfg.log(`--- implementer ---\n${r.text.slice(0, 1500)}\n---`);
        s.phase = 'checking';
      } else if (s.phase === 'checking') {
        if (cfg.dryRun) {
          cfg.log('[dry] deterministic checks: commit/clean/base/scope/targeted tests');
          dryRunTail(cfg, s, plan, planDoc);
          return s;
        }
        const c = deterministicChecks(cfg, s, plan, s.milestoneBase, false);
        cfg.log(`--- checks ---\n${c.summary || '(all ok)'}\n---`);
        if (c.ok) s.phase = 'verifying';
        else { s.lastFindings = `Deterministic checks failed:\n${c.summary}`; s.phase = 'reworking'; }
      } else if (s.phase === 'verifying') {
        const diff = buildReviewDiff(s, s.milestoneBase);
        if (diff.text.length > cfg.diffCap) {
          s.phase = 'blocked'; s.lastError = 'milestone too large; split required';
        } else {
          const c = deterministicChecks(cfg, s, plan, s.milestoneBase, false);
          const v = verdictOf(runWorker(cfg, s, 'verifier',
            verifierPrompt(s, plan, planDoc, c.summary, diff, false), s.worktree));
          cfg.log(`--- verdict: ${v.status} (${v.findings.length}) ---`);
          if (v.status === 'PASS') {
            s.milestoneBase = git(['rev-parse', 'HEAD'], s.worktree);
            s.currentMilestone += 1; s.milestoneRounds = 0; s.lastFindings = null;
            s.phase = s.currentMilestone < plan.milestones.length ? 'implementing' : 'final_verifying';
          } else if (v.status === 'BLOCKED') {
            s.phase = 'blocked'; s.lastError = 'verifier: BLOCKED';
          } else { s.lastFindings = JSON.stringify(v.findings, null, 1); s.phase = 'reworking'; }
        }
      } else if (s.phase === 'reworking') {
        if (s.milestoneRounds >= cfg.maxRework) {
          s.phase = 'blocked'; s.lastError = 'rework cap reached with a surviving finding';
        } else {
          const r = runWorker(cfg, s, 'implementer',
            implementerPrompt(s, plan, planDoc, s.lastFindings), s.worktree);
          s.milestoneRounds += 1; // consumed only after the fixer ran to completion
          cfg.log(`--- fixer (round ${s.milestoneRounds}) ---\n${r.text.slice(0, 1000)}\n---`);
          s.phase = 'checking';
        }
      }
      s.lastSuccessfulPhase = s.phase;
      if (!cfg.dryRun) saveState(cfg, s);
    }

    while (s.phase === 'final_verifying') {
      const c = deterministicChecks(cfg, s, plan, s.itemBase, true);
      cfg.log(`--- final gates ---\n${c.summary}\n---`);
      const diff = buildReviewDiff(s, s.itemBase);
      if (diff.text.length > cfg.diffCap) {
        s.phase = 'blocked'; s.lastError = 'item diff too large'; break;
      }
      let verdictOk = false;
      if (c.ok) {
        const v = verdictOf(runWorker(cfg, s, 'verifier',
          verifierPrompt(s, plan, planDoc, c.summary, diff, true), s.worktree));
        cfg.log(`--- whole-item verdict: ${v.status} (${v.findings.length}) ---`);
        if (v.status === 'PASS') verdictOk = true;
        else if (v.status === 'BLOCKED') { s.phase = 'blocked'; s.lastError = 'final verifier: BLOCKED'; break; }
        else s.lastFindings = JSON.stringify(v.findings, null, 1);
      } else s.lastFindings = `Final gates failed:\n${c.summary}`;
      if (verdictOk) {
        s.phase = s.flownCheckOwed && !s.flownEvidence ? 'awaiting_flown' : 'ready_to_land';
      } else if (s.finalRounds >= cfg.maxFinalRework) {
        s.phase = 'blocked'; s.lastError = 'final rework cap reached';
      } else {
        const r = runWorker(cfg, s, 'implementer',
          implementerPrompt(s, plan, planDoc, s.lastFindings), s.worktree);
        s.finalRounds += 1;
        cfg.log(`--- final fixer (round ${s.finalRounds}) ---\n${r.text.slice(0, 1000)}\n---`);
      }
      if (!cfg.dryRun) saveState(cfg, s);
    }

    if (s.phase === 'ready_to_land' && cfg.land) landing(cfg, s, planDoc);
  } catch (e) {
    if (e instanceof CycleStop) {
      s.lastError = e.message;
      if (!cfg.dryRun) saveState(cfg, s);
    }
    throw e;
  }
  if (!cfg.dryRun) saveState(cfg, s);
  return s;
}

function dryRunTail(cfg: CycleConfig, s: RunState, plan: CyclePlan, planDoc: string): void {
  const dry = { text: '(diff)', summarised: [] as string[] };
  runWorker(cfg, s, 'verifier', verifierPrompt(s, plan, planDoc, '(checks)', dry, false), s.worktree);
  runWorker(cfg, s, 'implementer', implementerPrompt(s, plan, planDoc, '(example findings)'), s.worktree);
  runWorker(cfg, s, 'verifier', verifierPrompt(s, plan, planDoc, '(final gates)', dry, true), s.worktree);
  runWorker(cfg, s, 'closer', closerPrompt(s, planDoc, '(gate summary)'), s.worktree);
  cfg.log('[dry] then: finalize index+queue, lint, ff-merge, push with --push');
}

// --- queue driving and commands ----------------------------------------------

export function runNext(cfg: CycleConfig): RunState {
  const current = findActive(cfg);
  if (current) {
    if (current.phase === 'blocked') {
      throw new CycleError(`item ${current.todo} is BLOCKED and prevents the queue: ${current.lastError}`);
    }
    return runItem(cfg, current.todo);
  }
  const queue = loadQueue(cfg);
  if (!queue.length) throw new CycleError('queue is empty');
  return runItem(cfg, String(queue[0]));
}

export function markFlown(cfg: CycleConfig, num: string, evidence: string): RunState {
  const s = loadState(cfg, num);
  if (!s) throw new CycleError(`no state for ${num}`);
  if (s.phase !== 'awaiting_flown') throw new CycleError(`${num} is ${s.phase}, not awaiting_flown`);
  if (!evidence.trim()) throw new CycleError('flown evidence must not be empty');
  s.flownEvidence = evidence; s.phase = 'ready_to_land';
  saveState(cfg, s);
  return s;
}

export function abort(cfg: CycleConfig, num: string, force: boolean): string {
  const s = loadState(cfg, num);
  if (!s) throw new CycleError(`no state for ${num}`);
  const report = [
    `abort ${num} would remove: worktree ${s.worktree}, branch ${s.branch} ` +
    `(${s.branchHead.slice(0, 7)} — commits are LOST unless merged elsewhere), ` +
    `state ${statePath(cfg, num)} and its plan.`,
    'preserved: main, the plan doc, the queue.',
  ].join('\n');
  if (!force) return `${report}\nRerun with --force to do it.`;
  if (existsSync(s.worktree)) git(['worktree', 'remove', '--force', s.worktree], cfg.root);
  try { git(['branch', '-D', s.branch], cfg.root); } catch { /* already gone */ }
  rmSync(statePath(cfg, num), { force: true });
  rmSync(planPath(cfg, num), { force: true });
  return `${report}\nDone.`;
}
