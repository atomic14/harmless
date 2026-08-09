// The cycle orchestrator's CLI (docs/TODO/105).
//
//   node --experimental-strip-types tools/cycle.ts <todo-number> [--dry-run]
//
// The state machine lives in tools/cycle-lib.ts (where test/cycle.test.ts can
// drive it against a fake claude in a temp repo); this file only wires the
// real environment: repo root, the claude binary (CLAUDE_BIN overrides, for
// tests and for pointing at a specific build), and console logging.
//
// One invocation drives ONE queue item through: prepare → fresh implementer
// per milestone → deterministic checks (scope, targeted tests, PROCESS.md's
// gate tier) → read-only verifier → capped rework → accept or BLOCKED.
// Acceptance leaves the branch for the supervisor to merge after any owed
// flown check; a killed run resumes by rerunning the same command.

import { CycleError, runCycle } from './cycle-lib.ts';

const num = process.argv[2];
if (!num || !/^\d+$/.test(num)) {
  console.error('usage: cycle.ts <todo-number> [--dry-run]');
  process.exit(1);
}

try {
  const s = runCycle({
    root: new URL('..', import.meta.url).pathname.replace(/\/$/, ''),
    claudeBin: process.env.CLAUDE_BIN ?? 'claude',
    maxRework: 2,
    maxBudgetUsd: Number(process.env.CYCLE_BUDGET_USD ?? 10),
    dryRun: process.argv.includes('--dry-run'),
    log: (line) => console.log(line),
  }, num);
  if (s.phase === 'accepted') {
    console.log(`ACCEPTED ${num} at ${s.accepted?.slice(0, 7)}.\nNext (supervisor):` +
      `\n  git merge --ff-only ${s.branch}   # then any owed flown check, then push` +
      `\n  git worktree remove ${s.worktree} && git branch -d ${s.branch}`);
  } else if (s.phase === 'blocked') {
    console.error(`${num} BLOCKED — needs a human. State: .cycle/${num}.json; ` +
      `branch ${s.branch} kept for inspection.`);
    process.exit(2);
  }
} catch (e) {
  if (e instanceof CycleError) { console.error(`cycle: ${e.message}`); process.exit(1); }
  throw e;
}
