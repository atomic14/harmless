// The cycle orchestrator's CLI (docs/TODO/105).
//
//   node --experimental-strip-types tools/cycle.ts run 103     # explicit item
//   node --experimental-strip-types tools/cycle.ts 103         # same, legacy form
//   node --experimental-strip-types tools/cycle.ts next        # resume active, else next queued
//   node --experimental-strip-types tools/cycle.ts next --max-items 3
//   node --experimental-strip-types tools/cycle.ts status      # durable state, no model calls
//   node --experimental-strip-types tools/cycle.ts flown 96 "flew waves to 12; pacing right"
//   node --experimental-strip-types tools/cycle.ts abort 103 [--force]
//   flags: --dry-run --land --push --max-items N --max-workers N --max-total-budget-usd N
//
// The machine is tools/cycle-lib.ts; state and queue are tools/cycle-state.ts
// (durable under .cycle/ and docs/TODO/QUEUE.json). Exit codes: 0 done for
// now, 1 defect/usage, 2 blocked (needs a human), 3 resumable stop (budget,
// caps, worker death, failed push) — rerun the same command to continue.

import { CycleError, CycleStop, statusReport, type CycleConfig } from './cycle-state.ts';
import { abort, markFlown, runItem, runNext } from './cycle-lib.ts';

const argv = process.argv.slice(2);
const flag = (name: string): boolean => argv.includes(name);
const opt = (name: string, dflt: number): number => {
  const i = argv.indexOf(name);
  return i >= 0 ? Number(argv[i + 1]) : dflt;
};

const cfg: CycleConfig = {
  root: new URL('..', import.meta.url).pathname.replace(/\/$/, ''),
  claudeBin: process.env.CLAUDE_BIN ?? 'claude',
  maxRework: 2,
  maxFinalRework: 2,
  maxMilestones: 6,
  diffCap: 60_000,
  maxBudgetUsd: Number(process.env.CYCLE_BUDGET_USD ?? 10),
  maxWorkers: opt('--max-workers', 12),
  maxTotalBudgetUsd: opt('--max-total-budget-usd', 25),
  maxItems: opt('--max-items', 1),
  dryRun: flag('--dry-run'),
  land: flag('--land'),
  push: flag('--push'),
  log: (line) => console.log(line),
};

const cmd = argv[0];
try {
  if (cmd === 'status') {
    console.log(statusReport(cfg));
  } else if (cmd === 'flown') {
    const s = markFlown(cfg, argv[1], argv[2] ?? '');
    console.log(`item ${s.todo} → ${s.phase}`);
  } else if (cmd === 'abort') {
    console.log(abort(cfg, argv[1], flag('--force')));
  } else if (cmd === 'next') {
    for (let i = 0; i < cfg.maxItems; i++) {
      const s = runNext(cfg);
      report(s);
      if (s.phase !== 'complete' || cfg.dryRun) break;
    }
  } else if (cmd === 'run' || /^\d+$/.test(cmd ?? '')) {
    report(runItem(cfg, cmd === 'run' ? argv[1] : cmd));
  } else {
    console.error('usage: cycle.ts <run N | N | next | status | flown N "evidence" | abort N> [flags]');
    process.exit(1);
  }
} catch (e) {
  if (e instanceof CycleStop) { console.error(`cycle: paused — ${e.message}`); process.exit(3); }
  if (e instanceof CycleError) { console.error(`cycle: ${e.message}`); process.exit(1); }
  throw e;
}

function report(s: { todo: string; phase: string; lastError: string | null }): void {
  console.log(`item ${s.todo}: ${s.phase}${s.lastError ? ` (${s.lastError})` : ''}`);
  if (s.phase === 'blocked') process.exit(2);
  if (s.phase === 'awaiting_flown') {
    console.log(`fly it, then: cycle.ts flown ${s.todo} "<what you saw>"`);
  } else if (s.phase === 'ready_to_land') {
    console.log('rerun with --land (and --push) to land it');
  }
}
