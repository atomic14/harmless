// A save written before the contract union still loads, and still settles.
//
// docs/TODO/185 M1 turned `Contract` from one flat record into a union on
// `kind`. Each kind declares only the fields it uses, so a courier run has no
// `commodity` and a cargo run has no `progress`.
//
// **THE COMPILER HOLDS ALMOST ALL OF THAT, AND THIS FILE DOES NOT REPEAT IT.**
// A test that asserted "a courier has no commodity" would assert the
// implementation against itself (CLAUDE.md). The union makes that impossible
// rather than untested, which is the stronger claim.
//
// **ONE THING THE COMPILER CANNOT SEE: A SAVE ON DISK.** Every contract written
// before this item carries all seven fields. `snapshot-parse.ts` never
// validated a contract, and `Persistence.restore` clones the commander straight
// in. So the old fields arrive, TypeScript never sees them, and nothing reads
// them.
//
// That reasoning is exactly the kind that is right until it is not. The item
// raised no `SNAPSHOT_VERSION` on it, so it is worth a fixture rather than an
// argument.
//
// TWO CLAIMS, AND EACH ONE FAILS ALONE:
//
//  1. AN OLD SAVE LOADS. A snapshot whose courier carries `commodity: 0` and
//     `progress: 0` parses, and the jobs come back.
//  2. ...AND IT STILL SETTLES. The old fields do not change what a job pays.
//     A parse that dropped a field would pass claim 1 and fail this one.
//
// WHAT IS NOT HERE. What a contract PAYS is `test/contracts.test.ts`'s. The
// migration ladder is `test/snapshot-migrate.test.ts`'s.

import { newCommander, type CommanderData, type Contract } from '../src/game/commander.ts';
import { settleContracts } from '../src/game/contracts.ts';
import { parseSnapshot } from '../src/game/snapshot-parse.ts';
import { SNAPSHOT_VERSION } from '../src/game/snapshot.ts';
import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { seedWorld } from '../src/game/rng.ts';
import { check, eq } from './harness.ts';

/** A real captured snapshot, in `test/snapshot-parse.test.ts`'s own shape. */
const captured = (seed: number): Record<string, unknown> => {
  seedWorld(seed);
  const g = new Game(() => headlessShell());
  g.launch();
  for (let i = 0; i < 120; i++) g.update(1 / 60, i / 60);
  return JSON.parse(JSON.stringify(g.captureSnapshot())) as Record<string, unknown>;
};

console.log('\na save written before the contract union still loads');
{
  // THE SHAPE THIS ITEM RETIRED, written out in full. Every field is here,
  // including the two that meant nothing on these kinds. A saved file from
  // before 2026-08-17 holds exactly this.
  const asSavedBefore = [
    {
      kind: 'courier', destination: 11, commodity: 0, qty: 0,
      reward: 5000, deadlineDay: 999, progress: 0,
    },
    {
      kind: 'cargo', destination: 11, commodity: 0, qty: 5,
      reward: 2200, deadlineDay: 999, progress: 0,
    },
    {
      kind: 'bounty', destination: 11, commodity: 0, qty: 2,
      reward: 1700, deadlineDay: 999, progress: 2,
    },
  ];

  const wire = captured(20_260_823);
  (wire.commander as Record<string, unknown>).contracts = asSavedBefore;

  const back = parseSnapshot(wire);
  eq('it parses at the current version', back.version, SNAPSHOT_VERSION);

  const jobs = back.commander.contracts;
  eq('...and the three jobs come back', jobs.length, 3);
  eq('...with their kinds', jobs.map((k) => k.kind).join(','), 'courier,cargo,bounty');

  // The fields each kind DOES own are the ones a settlement reads.
  eq('...and the cargo run keeps its consignment', jobs[1]!.qty, 5);
  const hunt = jobs[2]!;
  check('...and the bounty keeps its kills',
    hunt.kind === 'bounty' && hunt.progress === 2);
}

console.log('...and it still settles for what it always paid');
{
  // CLAIM 2. A parse that quietly dropped a field would leave claim 1 green.
  // This lands two old jobs at their destination, and reads the receipts.
  const wire = captured(20_260_824);
  (wire.commander as Record<string, unknown>).contracts = [
    {
      kind: 'courier', destination: 7, commodity: 0, qty: 0,
      reward: 5000, deadlineDay: 999, progress: 0,
    },
    {
      kind: 'bounty', destination: 7, commodity: 0, qty: 2,
      reward: 1700, deadlineDay: 999, progress: 2,
    },
  ];
  const back = parseSnapshot(wire);

  const c: CommanderData = {
    ...newCommander(), systemIndex: 7, day: 0, credits: 0,
    contracts: back.commander.contracts as Contract[],
  } as CommanderData;

  const events = settleContracts(c);
  eq('both old jobs pay', events.filter((e) => e.kind === 'paid').length, 2);
  eq('...for what they were worth', c.credits, 5000 + 1700);
  eq('...and the board is clear', c.contracts.length, 0);
}
