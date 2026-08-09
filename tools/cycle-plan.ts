// Cycle orchestrator: structured preparation (docs/TODO/105). A plan doc may
// carry its own machine-readable manifest in a ```json cycle-manifest fence;
// otherwise ONE fresh read-only planner generates it. Either way the plan is
// validated hard — no silent whole-repository scope, no unknown test
// commands, no path traversal — checksummed against the doc, and cached under
// .cycle/<todo>.plan.json until the doc changes.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  atomicWrite, planPath, CycleError, type CycleConfig, type CyclePlan, type RunState,
} from './cycle-state.ts';
import { plannerPrompt, runWorker } from './cycle-workers.ts';

const SAFE_TEST_CMDS = ['node', 'npm'];

export function docChecksum(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

export function validatePlan(plan: CyclePlan, cfg: CycleConfig): void {
  const bad = (msg: string): never => { throw new CycleError(`plan rejected: ${msg}`); };
  if (plan.version !== 1) bad('unknown version');
  if (!plan.milestones?.length) bad('no milestones');
  if (plan.milestones.length > cfg.maxMilestones) {
    bad(`${plan.milestones.length} milestones exceeds the limit of ${cfg.maxMilestones}`);
  }
  if (!['docs', 'tooling', 'src', 'gameplay'].includes(plan.declaredTier)) bad('unknown tier');
  for (const m of plan.milestones) {
    if (!m.acceptance?.length || m.acceptance.some((a) => !a.trim())) {
      bad(`milestone "${m.title}": empty acceptance criteria`);
    }
    if (!m.scope?.length && !m.scopeReason?.trim()) {
      bad(`milestone "${m.title}": empty scope without an explicit scopeReason`);
    }
    for (const p of [...(m.scope ?? [])]) {
      if (p.startsWith('/') || p.includes('..')) bad(`milestone "${m.title}": unsafe path ${p}`);
    }
    for (const t of m.tests ?? []) {
      if (!SAFE_TEST_CMDS.includes(t.cmd)) bad(`milestone "${m.title}": unsafe test cmd ${t.cmd}`);
      for (const a of t.args) {
        if (a.startsWith('/') || a.includes('..')) bad(`milestone "${m.title}": unsafe arg ${a}`);
      }
    }
  }
}

/** A checked-in manifest: a fenced block opening with ```json cycle-manifest. */
export function manifestFromDoc(text: string): CyclePlan | null {
  const m = text.match(/```json cycle-manifest\n([\s\S]*?)```/);
  if (!m) return null;
  try { return JSON.parse(m[1]) as CyclePlan; } catch {
    throw new CycleError('plan doc has a cycle-manifest fence that is not valid JSON');
  }
}

/** The cached, doc-checksummed plan — manifest first, planner worker second. */
export function preparePlan(cfg: CycleConfig, s: RunState, planDoc: string): CyclePlan {
  const text = readFileSync(join(cfg.root, planDoc), 'utf8');
  const sum = docChecksum(text);
  const cached = planPath(cfg, s.todo);
  if (existsSync(cached) && s.planChecksum === sum) {
    return JSON.parse(readFileSync(cached, 'utf8')) as CyclePlan;
  }
  let plan = manifestFromDoc(text);
  if (!plan) {
    if (cfg.dryRun) {
      runWorker(cfg, s, 'planner', plannerPrompt(planDoc), cfg.root);
      plan = {
        version: 1, todo: Number(s.todo), declaredTier: 'tooling',
        milestones: [{
          id: 'dry', title: '(dry-run placeholder)', acceptance: ['(dry)'],
          scope: ['docs/'], tests: [],
        }],
      };
    } else {
      const out = runWorker(cfg, s, 'planner', plannerPrompt(planDoc), cfg.root);
      try { plan = JSON.parse(out.text.trim()) as CyclePlan; } catch {
        throw new CycleError(`planner output is not JSON: ${out.text.slice(0, 300)}`);
      }
    }
  }
  validatePlan(plan, cfg);
  s.planChecksum = sum;
  s.declaredTier = plan.declaredTier;
  s.flownCheckOwed = plan.declaredTier === 'gameplay';
  if (!cfg.dryRun) atomicWrite(cached, JSON.stringify(plan, null, 2));
  return plan;
}
