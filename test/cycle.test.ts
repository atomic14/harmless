// The cycle orchestrator's state machine (docs/TODO/105), driven end to end
// against a FAKE claude and stubbed gate commands in throwaway git repos — no
// real worker, no real npm, no branch of this repo. Covers the audit's rework
// matrix: mechanical worker safety, structured preparation, per-milestone
// workers, scope/test/base/dirty/no-commit checks, non-consuming worker
// death, interruption recovery, oversized diffs, whole-item verification,
// awaiting_flown, queue resume/landing, caps, and dry-run coverage.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { check, eq } from './harness.ts';
import {
  CycleStop, loadQueue, loadState, statusReport,
  type CycleConfig, type CyclePlan, type RunState,
} from '../tools/cycle-state.ts';
import { manifestFromDoc, validatePlan } from '../tools/cycle-plan.ts';
import { parseEnvelope, parseVerdict, verdictOf, workerArgs } from '../tools/cycle-workers.ts';
import { deterministicChecks, effectiveTier, markFlown, runItem, runNext } from '../tools/cycle-lib.ts';
import { calls, freshRepo, goodPlan, harness, setCtrl, tmp } from './cycle-harness.ts';

console.log('\nthe cycle orchestrator (docs/TODO/105)');

// --- worker safety is in the arguments ---------------------------------------

const baseCfg = { maxBudgetUsd: 1 } as CycleConfig;
const impl = workerArgs(baseCfg, 'implementer').join(' ');
check('implementer args carry no Agent tool and no bypassPermissions',
  !impl.includes('Agent') && !impl.includes('bypass') && impl.includes('acceptEdits'));
check('implementer Bash families deny push, merge, -C and worktree',
  ['git push', 'git merge', 'git -C', 'git worktree'].every((c) => impl.includes(`Bash(${c}:*)`)));
const verif = workerArgs(baseCfg, 'verifier').join(' ');
check('verifier has read tools only, plan mode, and a JSON schema',
  verif.includes('--tools Read,Grep,Glob') && verif.includes('plan')
  && verif.includes('--json-schema') && !verif.includes('Bash') && !verif.includes('Edit'));

const refuses = (fn: () => unknown, needle = ''): boolean => {
  try { fn(); return false; } catch (e) { return (e as Error).message.includes(needle); }
};
check('a PASS verdict with findings is refused', refuses(() => parseVerdict(
  { status: 'PASS', findings: [{ severity: 'low', file: 'x', problem: 'p', required_fix: 'f' }] })));
check('a REWORK verdict without an actionable finding is refused',
  refuses(() => parseVerdict({ status: 'REWORK', findings: [] })));
check('a non-object verdict is refused', refuses(() => parseVerdict('PASS')));

// --- the structured-output boundary (the real CLI's envelope protocol) -------

const goodEnv = parseEnvelope(
  '{"result":"","structured_output":{"status":"PASS","findings":[]},"total_cost_usd":0.5}',
  'verifier');
eq('a schema payload rides structured_output', verdictOf(goodEnv).status, 'PASS');
eq('cost is captured even with an empty result', goodEnv.costUsd, 0.5);
check('a verdict smuggled into result alone is refused', refuses(() => verdictOf(parseEnvelope(
  '{"result":"{\\"status\\":\\"PASS\\",\\"findings\\":[]}","total_cost_usd":0.1}', 'verifier')),
'no structured_output'));
check('missing structured_output names itself',
  refuses(() => verdictOf(parseEnvelope('{"result":"done"}', 'verifier')), 'no structured_output'));
check('malformed structured_output is refused', refuses(() => verdictOf(parseEnvelope(
  '{"structured_output":{"status":"YES","findings":[]}}', 'verifier')), 'malformed'));
check('a non-envelope schema output is refused',
  refuses(() => parseEnvelope('plain words', 'verifier'), 'not a JSON envelope'));
eq('a non-schema role keeps its plain text', parseEnvelope('plain words', 'implementer').text,
  'plain words');

// --- structured preparation --------------------------------------------------

const vcfg = { maxMilestones: 6 } as CycleConfig;
validatePlan(goodPlan, vcfg);
const rejects = (mutate: (p: CyclePlan) => void): boolean => {
  const p = JSON.parse(JSON.stringify(goodPlan)) as CyclePlan;
  mutate(p);
  try { validatePlan(p, vcfg); return false; } catch { return true; }
};
check('a plan with no milestones is rejected', rejects((p) => { p.milestones = []; }));
check('empty acceptance is rejected', rejects((p) => { p.milestones[0].acceptance = ['  ']; }));
check('empty scope without a reason is rejected', rejects((p) => { p.milestones[0].scope = []; }));
check('an unknown test command is rejected',
  rejects((p) => { p.milestones[0].tests = [{ cmd: 'curl', args: ['x'] }]; }));
check('path traversal is rejected', rejects((p) => { p.milestones[0].scope = ['../etc/']; }));
check('a manifest fence parses out of a doc',
  manifestFromDoc('x\n```json cycle-manifest\n{"version":1}\n```\ny')?.version === 1);

eq('declared tier is a floor under inference', effectiveTier('docs', ['src/player.ts']), 'src');
eq('inference never lowers a declared gameplay tier', effectiveTier('gameplay', ['docs/x.md']), 'gameplay');

check('the real repo queue resolves every item to one plan doc', (() => {
  const realRoot = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
  return loadQueue({ root: realRoot } as CycleConfig).length > 0;
})());

// --- transitions -------------------------------------------------------------

// Happy path on a checked-in manifest: implement → checks (targeted test runs
// via the stub) → verify → whole-item verify → ready_to_land, planner unused.
{
  const cfg = freshRepo('happy', true);
  setCtrl({ impl: ['good'], verdict: ['PASS'], finalVerdict: ['PASS'] });
  const s = runItem(cfg, '900');
  eq('manifest happy path ends ready_to_land', s.phase, 'ready_to_land');
  check('...without invoking the planner', !calls().includes('planner'));
  check('...running the declared targeted test', harness.execLog.some((l) => l === 'node check.js'));
  check('...and the state file is atomic and parsable',
    existsSync(join(cfg.root, '.cycle/900.json'))
    && !existsSync(join(cfg.root, '.cycle/900.json.tmp'))
    && Boolean(loadState(cfg, '900')));
}

// A missing manifest invokes one planner, whose plan is validated and cached.
{
  const cfg = freshRepo('planner', false);
  setCtrl({ impl: ['good'], verdict: ['PASS'], finalVerdict: ['PASS'] });
  const s = runItem(cfg, '900');
  eq('planner-prepared item ends ready_to_land', s.phase, 'ready_to_land');
  eq('exactly one planner ran', calls().filter((c) => c === 'planner').length, 1);
  check('the plan is cached', existsSync(join(cfg.root, '.cycle/900.plan.json')));
}

// An invalid manifest is rejected before any worker runs.
{
  const cfg = freshRepo('badmanifest', false);
  const bad = JSON.parse(JSON.stringify(goodPlan)) as CyclePlan;
  bad.milestones[0].acceptance = [];
  writeFileSync(join(cfg.root, 'docs/TODO/900-fake-item.md'),
    `# 900\n\`\`\`json cycle-manifest\n${JSON.stringify(bad)}\n\`\`\`\n`);
  execFileSync('sh', ['-c', 'git add -A && git -c user.email=t@t -c user.name=t commit -qm m'],
    { cwd: cfg.root, stdio: 'pipe' });
  setCtrl({});
  let threw = '';
  try { runItem(cfg, '900'); } catch (e) { threw = (e as Error).message; }
  check('an invalid manifest is rejected with the reason', threw.includes('empty acceptance'));
  eq('...before any worker ran', calls().length, 0);
}

// Two milestones use two distinct fresh implementers.
{
  const cfg = freshRepo('multi', false);
  const two = JSON.parse(JSON.stringify(goodPlan)) as CyclePlan;
  two.milestones.push({
    id: 'm2', title: 'second', acceptance: ['also done'], scope: ['src/thing/'], tests: [],
  });
  setCtrl({ plan: two, impl: ['good', 'good2'], verdict: ['PASS', 'PASS'], finalVerdict: ['PASS'] });
  const s = runItem(cfg, '900');
  eq('two milestones end ready_to_land', s.phase, 'ready_to_land');
  eq('...via two fresh implementers', calls().filter((c) => c.startsWith('impl')).length, 2);
}

// Scope alone gates: green targeted test, out-of-scope file, no fixer repair.
{
  const cfg = freshRepo('scope', true);
  setCtrl({ impl: ['oops-plus', 'none', 'none'], verdict: ['PASS'], finalVerdict: [] });
  const s = runItem(cfg, '900');
  eq('a green but out-of-scope diff is refused to the cap', s.phase, 'blocked');
}

// A failing targeted test alone gates (scope is clean).
{
  const cfg = freshRepo('targeted', true);
  harness.execFail.add('node check.js');
  setCtrl({ impl: ['good', 'none', 'none'], verdict: [], finalVerdict: [] });
  const s = runItem(cfg, '900');
  eq('a failing targeted test is refused to the cap', s.phase, 'blocked');
  check('...and the cap consumed exactly the configured rounds', s.milestoneRounds === 2);
}

// Dirty worktree and no-commit are caught by the deterministic checks.
{
  const cfg = freshRepo('dirty', true);
  setCtrl({ impl: ['none'], verdict: [], finalVerdict: [] });
  const s0 = runItem(cfg, '900');
  check('no commit is a failed check, consuming rework', s0.phase === 'blocked'
    || s0.milestoneRounds > 0);
  writeFileSync(join(cfg.root, '.claude/worktrees/cycle-900/junk'), 'x');
  const st = loadState(cfg, '900') as RunState;
  const c = deterministicChecks(cfg, st,
    JSON.parse(readFileSync(join(cfg.root, '.cycle/900.plan.json'), 'utf8')) as CyclePlan,
    st.milestoneBase, false);
  check('a dirty worktree is a failed check', !c.ok && c.summary.includes('not clean'));
  rmSync(join(cfg.root, '.claude/worktrees/cycle-900/junk'));
}

// A worker death pauses without consuming a rework round, and the rerun
// resumes cleanly.
{
  const cfg = freshRepo('death', true);
  setCtrl({ impl: ['die', 'good'], verdict: ['PASS'], finalVerdict: ['PASS'] });
  let stopped = false;
  try { runItem(cfg, '900'); } catch (e) { stopped = e instanceof CycleStop; }
  const mid = loadState(cfg, '900') as RunState;
  check('a worker death is a resumable pause, not a rework round',
    stopped && mid.milestoneRounds === 0 && mid.lastError !== null);
  const s = runItem(cfg, '900');
  eq('...and the rerun completes the item', s.phase, 'ready_to_land');
}

// Commits made before an interruption are found; no second implementer runs.
{
  const cfg = freshRepo('interrupted', true);
  setCtrl({ impl: ['good'], verdict: [], finalVerdict: [] });
  try { runItem(cfg, '900'); } catch { /* die after implement: simulate by stopping ctrl */ }
  // Simulate the interruption: rewind phase to implementing as if state saved
  // before the checks ran, then resume with NO implementer budget in the fake.
  const st = loadState(cfg, '900') as RunState;
  st.phase = 'implementing';
  writeFileSync(join(cfg.root, '.cycle/900.json'), JSON.stringify(st));
  setCtrl({ impl: [], verdict: ['PASS'], finalVerdict: ['PASS'] });
  const s = runItem(cfg, '900');
  eq('an interrupted run resumes at the checks', s.phase, 'ready_to_land');
  eq('...without paying for another implementer', calls().filter((c) => c.startsWith('impl')).length, 0);
}

// A branch not based on the recorded base refuses to resume.
{
  const cfg = freshRepo('wrongbase', true);
  setCtrl({ impl: ['good'], verdict: ['PASS'], finalVerdict: ['PASS'] });
  runItem(cfg, '900');
  execFileSync('sh', ['-c',
    'echo x > drift && git add -A && git -c user.email=t@t -c user.name=t commit -qm drift'],
  { cwd: cfg.root, stdio: 'pipe' });
  const st = loadState(cfg, '900') as RunState;
  st.itemBase = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: cfg.root, encoding: 'utf8' }).trim();
  st.phase = 'implementing';
  writeFileSync(join(cfg.root, '.cycle/900.json'), JSON.stringify(st));
  let threw = '';
  try { runItem(cfg, '900'); } catch (e) { threw = (e as Error).message; }
  check('a wrong base refuses to resume', threw.includes('not based on'));
}

// The whole-item verifier catches a cross-milestone problem and a final fixer
// round repairs it.
{
  const cfg = freshRepo('finalfix', true);
  setCtrl({ impl: ['good', 'good2'], verdict: ['PASS'], finalVerdict: ['REWORK', 'PASS'] });
  const s = runItem(cfg, '900');
  eq('a final REWORK is fixed and re-verified', s.phase, 'ready_to_land');
  eq('...consuming one final round', s.finalRounds, 1);
  check('...with a fresh final verifier each time',
    calls().filter((c) => c === 'final-verifier').length === 2);
}

// A huge GENERATED file does not block review: its per-file diff becomes a
// labelled stat summary (its contents are pinned by deterministic checks),
// while the rest of the diff stays complete — the 104 catalogue case.
{
  const cfg = freshRepo('bigfile', true);
  setCtrl({ impl: ['good-big'], verdict: ['PASS'], finalVerdict: ['PASS'] });
  const s = runItem(cfg, '900');
  eq('a large generated file is summarised, not blocking', s.phase, 'ready_to_land');
  check('...and the verifier really was consulted', calls().includes('verifier'));
}

// An oversized milestone diff is BLOCKED, never sent truncated.
{
  const cfg = freshRepo('bigdiff', true);
  cfg.diffCap = 10;
  setCtrl({ impl: ['good'], verdict: ['PASS'], finalVerdict: [] });
  const s = runItem(cfg, '900');
  eq('an oversized diff blocks for splitting', s.phase, 'blocked');
  check('...before any verifier saw it', !calls().includes('verifier'));
}

// A gameplay item stops at awaiting_flown; flown evidence releases it.
{
  const cfg = freshRepo('flown', false);
  const gp = JSON.parse(JSON.stringify(goodPlan)) as CyclePlan;
  gp.declaredTier = 'gameplay';
  setCtrl({ plan: gp, impl: ['good'], verdict: ['PASS'], finalVerdict: ['PASS'] });
  const s = runItem(cfg, '900');
  eq('a gameplay item stops awaiting the flown check', s.phase, 'awaiting_flown');
  check('...with the campaign gate in its final tier',
    harness.execLog.some((l) => l === 'npm run campaign'));
  check('...and status says what a human owes', statusReport(cfg).includes('fly the change'));
  eq('flown evidence releases it', markFlown(cfg, '900', 'flew it; reads right').phase,
    'ready_to_land');
}

// next resumes the active item before selecting from the queue, and a blocked
// item stops the queue.
{
  const cfg = freshRepo('resume', true);
  setCtrl({ impl: ['good'], verdict: ['PASS'], finalVerdict: ['PASS'] });
  runItem(cfg, '900'); // active at ready_to_land
  setCtrl({ impl: [], verdict: [], finalVerdict: [] });
  const s = runNext(cfg);
  eq('next resumes the active item, not the queue', s.todo, '900');
  const st = loadState(cfg, '900') as RunState;
  st.phase = 'blocked'; st.lastError = 'x';
  writeFileSync(join(cfg.root, '.cycle/900.json'), JSON.stringify(st));
  let threw = '';
  try { runNext(cfg); } catch (e) { threw = (e as Error).message; }
  check('a blocked item prevents the next queued item', threw.includes('BLOCKED'));
}

// Landing: closer fills the Outcome, the checkbox ticks, exactly one queue
// item leaves, main fast-forwards, and the item completes.
{
  const cfg = freshRepo('land', true);
  setCtrl({ impl: ['good'], verdict: ['PASS'], finalVerdict: ['PASS'], closer: ['good'] });
  runItem(cfg, '900');
  cfg.land = true;
  const s = runItem(cfg, '900');
  eq('landing completes the item', s.phase, 'complete');
  const queue = JSON.parse(readFileSync(join(cfg.root, 'docs/TODO/QUEUE.json'), 'utf8')) as { items: number[] };
  eq('exactly one queue item left', queue.items.join(','), '901');
  check('the index checkbox ticked',
    readFileSync(join(cfg.root, 'docs/TODO/README.md'), 'utf8').includes('- [x] 900'));
  check('the outcome landed on main',
    readFileSync(join(cfg.root, 'docs/TODO/900-fake-item.md'), 'utf8').includes('filled by closer'));
  check('the worktree and branch are gone', !existsSync(s.worktree));
}

// A closer that touches anything outside docs/TODO/ blocks the landing.
{
  const cfg = freshRepo('badcloser', true);
  setCtrl({ impl: ['good'], verdict: ['PASS'], finalVerdict: ['PASS'], closer: ['bad'] });
  runItem(cfg, '900');
  cfg.land = true;
  const s = runItem(cfg, '900');
  eq('a closer editing outside docs/TODO blocks', s.phase, 'blocked');
}

// A push failure becomes resumable landed_local, not reimplementation.
{
  const cfg = freshRepo('pushfail', true);
  setCtrl({ impl: ['good'], verdict: ['PASS'], finalVerdict: ['PASS'], closer: ['good'] });
  runItem(cfg, '900');
  cfg.land = true; cfg.push = true; // no origin remote exists → push fails
  let stopped = false;
  try { runItem(cfg, '900'); } catch (e) { stopped = e instanceof CycleStop; }
  const mid = loadState(cfg, '900') as RunState;
  check('a failed push pauses as landed_local', stopped && mid.phase === 'landed_local');
  cfg.push = false;
  const s = runItem(cfg, '900');
  eq('...and the rerun completes without reimplementing', s.phase, 'complete');
  eq('...having never rerun a worker', calls().filter((c) => c.startsWith('impl')).length, 1);
}

// The worker cap stops cleanly mid-item and the rerun continues.
{
  const cfg = freshRepo('caps', true);
  cfg.maxWorkers = 1;
  setCtrl({ impl: ['good'], verdict: ['PASS'], finalVerdict: ['PASS'] });
  let stopped = false;
  try { runItem(cfg, '900'); } catch (e) { stopped = e instanceof CycleStop; }
  check('the worker cap is a clean resumable stop', stopped);
  cfg.maxWorkers = 50;
  eq('...and the rerun finishes the item', runItem(cfg, '900').phase, 'ready_to_land');
}

// Dry-run prints every worker role and the landing actions, invoking nothing.
{
  const cfg = freshRepo('dry', false);
  const lines: string[] = [];
  cfg.dryRun = true; cfg.log = (l) => lines.push(l);
  setCtrl({});
  runItem(cfg, '900');
  const out = lines.join('\n');
  check('dry-run covers planner, implementer, verifier, fixer, final verifier,'
    + ' closer and landing',
  ['(planner)', '(implementer)', '(verifier)', 'example findings', 'WHOLE item',
    '(closer)', 'ff-merge'].every((k) => out.includes(k))
    && calls().length === 0);
}

rmSync(tmp, { recursive: true, force: true });
