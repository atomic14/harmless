// Cycle orchestrator: durable state, the queue, and status (docs/TODO/105).
// State is written atomically (tmp + rename) and validated on resume; the
// pending execution order lives in docs/TODO/QUEUE.json, which owns ORDER
// only — docs/TODO/README.md stays the human index.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type Tier = 'docs' | 'tooling' | 'src' | 'gameplay';
export type Phase =
  | 'preparing' | 'implementing' | 'checking' | 'verifying' | 'reworking'
  | 'final_verifying' | 'awaiting_flown' | 'ready_to_land' | 'landed_local'
  | 'complete' | 'blocked';

export interface MilestoneTest { cmd: string; args: string[] }
export interface Milestone {
  id: string; title: string; acceptance: string[]; scope: string[];
  scopeReason?: string; tests: MilestoneTest[];
}
export interface CyclePlan {
  version: 1; todo: number; declaredTier: Tier; milestones: Milestone[];
}

export interface WorkerRecord { role: string; costUsd: number }

export interface RunState {
  todo: string;
  branch: string;
  worktree: string;
  itemBase: string;
  phase: Phase;
  currentMilestone: number;
  milestoneBase: string;
  branchHead: string;
  milestoneRounds: number;
  finalRounds: number;
  workerInvocations: WorkerRecord[];
  lastError: string | null;
  lastSuccessfulPhase: Phase | null;
  declaredTier: Tier;
  flownCheckOwed: boolean;
  flownEvidence?: string;
  planChecksum: string;
  /** the brief a resumed rework round continues from */
  lastFindings: string | null;
}

export interface CycleConfig {
  root: string;
  claudeBin: string;
  maxRework: number;
  maxFinalRework: number;
  maxMilestones: number;
  diffCap: number;            // chars; a larger milestone diff is BLOCKED, never truncated
  maxBudgetUsd: number;       // per worker
  maxWorkers: number;         // per orchestrator invocation
  maxTotalBudgetUsd: number;  // per orchestrator invocation
  maxItems: number;
  dryRun: boolean;
  land: boolean;
  push: boolean;
  log: (line: string) => void;
  /** injectable command runner for gates/targeted tests (tests stub this) */
  exec?: (cmd: string, args: string[], cwd: string) => string;
}

export class CycleError extends Error {}
/** a resumable stop (budget, rate limit, worker death) — NOT a defect */
export class CycleStop extends Error {}

export function sh(cmd: string, args: string[], cwd: string): string {
  return execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
export function git(args: string[], cwd: string): string { return sh('git', args, cwd).trim(); }

export function atomicWrite(path: string, content: string): void {
  mkdirSync(join(path, '..'), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, content);
  renameSync(tmp, path);
}

export function statePath(cfg: CycleConfig, todo: string): string {
  return join(cfg.root, '.cycle', `${todo}.json`);
}
export function planPath(cfg: CycleConfig, todo: string): string {
  return join(cfg.root, '.cycle', `${todo}.plan.json`);
}

export function loadState(cfg: CycleConfig, todo: string): RunState | null {
  const p = statePath(cfg, todo);
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) as RunState : null;
}

export function saveState(cfg: CycleConfig, s: RunState): void {
  mkdirSync(join(cfg.root, '.cycle'), { recursive: true });
  if (existsSync(s.worktree)) s.branchHead = git(['rev-parse', 'HEAD'], s.worktree);
  atomicWrite(statePath(cfg, s.todo), JSON.stringify(s, null, 2));
}

// --- the queue ---------------------------------------------------------------

export function todoDocFor(cfg: CycleConfig, num: string | number): string {
  const dir = join(cfg.root, 'docs/TODO');
  const m = readdirSync(dir).filter((f) => f.startsWith(`${num}-`) && f.endsWith('.md'));
  if (m.length !== 1) throw new CycleError(`expected one docs/TODO/${num}-*.md, found ${m.length}`);
  return `docs/TODO/${m[0]}`;
}

export function loadQueue(cfg: CycleConfig): number[] {
  const p = join(cfg.root, 'docs/TODO/QUEUE.json');
  if (!existsSync(p)) throw new CycleError('docs/TODO/QUEUE.json is missing');
  const q = JSON.parse(readFileSync(p, 'utf8')) as { version: number; items: number[] };
  if (q.version !== 1 || !Array.isArray(q.items)) throw new CycleError('QUEUE.json: bad shape');
  if (new Set(q.items).size !== q.items.length) throw new CycleError('QUEUE.json: duplicates');
  for (const n of q.items) todoDocFor(cfg, n); // each must resolve to exactly one doc
  return q.items;
}

export function removeFromQueue(cfg: CycleConfig, num: number): void {
  const items = loadQueue(cfg).filter((n) => n !== num);
  atomicWrite(join(cfg.root, 'docs/TODO/QUEUE.json'),
    `${JSON.stringify({ version: 1, items }, null, 2)}\n`);
}

/** The one active item, if any: state exists and is not complete. */
export function findActive(cfg: CycleConfig): RunState | null {
  const dir = join(cfg.root, '.cycle');
  if (!existsSync(dir)) return null;
  const active = readdirSync(dir).filter((f) => /^\d+\.json$/.test(f))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as RunState)
    .filter((s) => s.phase !== 'complete');
  if (active.length > 1) {
    throw new CycleError(`more than one active item (${active.map((s) => s.todo).join(', ')})`);
  }
  return active[0] ?? null;
}

// --- status ------------------------------------------------------------------

export function statusReport(cfg: CycleConfig): string {
  const s = findActive(cfg);
  const queue = loadQueue(cfg);
  if (!s) return `no active item; next queued: ${queue[0] ?? 'nothing — queue empty'}`;
  const total = s.workerInvocations.reduce((a, w) => a + w.costUsd, 0);
  const human = s.phase === 'blocked' ? 'needs a human: see lastError and the branch'
    : s.phase === 'awaiting_flown'
      ? `needs a human: fly the change per the plan doc, then \`cycle.ts flown ${s.todo} "<evidence>"\``
      : s.phase === 'landed_local' ? 'needs a human (or --push): the merge is local, the push failed'
        : 'none';
  return [
    `item ${s.todo} · phase ${s.phase} · milestone ${s.currentMilestone + 1} · branch ${s.branch}`,
    `head ${s.branchHead.slice(0, 7)} · base ${s.itemBase.slice(0, 7)} · rounds ${s.milestoneRounds}` +
    ` (final ${s.finalRounds}) · workers ${s.workerInvocations.length} ($${total.toFixed(2)})`,
    `tier ${s.declaredTier}${s.flownCheckOwed ? ' · flown check owed' : ''}`,
    `last error: ${s.lastError ?? 'none'}`,
    `human action: ${human}`,
    `next queued after this: ${queue.find((n) => String(n) !== s.todo) ?? 'nothing'}`,
  ].join('\n');
}
