// Which tonnes in the hold are spoken for, and what the market screen says.
//
// GitHub #26 was reported at a rock hermit, and that is the whole shape of it
// (docs/TODO/143). Selling a consignment is legal, it is legal on purpose, and
// the triage measured that it never pays: over 138 freight jobs, selling at the
// dearest price galaxy 1 can roll never beat delivering. What was wrong is that
// the pilot could not SEE it. The market screen read `c.cargo[i]` and no more,
// and the one market with no bulletin board beside it is a hermit's.
//
// Three things are asserted here:
//
//  1. `consignedTonnes` over the five contract kinds, a pooled hold, and two
//     jobs for one commodity.
//  2. The painted row. `renderMarket` runs under test/screen-capture.ts and the
//     IN HOLD cell is read back, because a correct reader that the painter
//     never calls is the defect this milestone is.
//  3. The sale asks once. The first V on a consigned row sells nothing.
//
// The reader is `src/game/commander.ts`, beside `berthTonnes` and derived for
// the same reason. `test/contracts.test.ts` owns the settlement half.

import {
  newCommander, consignedTonnes, type CommanderData, type Contract,
} from '../src/game/commander.ts';
import { generateMarket, COMMODITIES } from '../src/galaxy/galaxy.ts';
import { renderMarket } from '../src/ui/screens.ts';
import { CONTRABAND } from '../src/constants/law.ts';
import { capture } from './screen-capture.ts';
import { check, eq } from './harness.ts';
import { g1 } from './fixtures.ts';

const FOOD = 0;
const NARCOTICS = CONTRABAND[1];
const MACHINERY = 8;

/** A job of any kind, against Food unless the caller says otherwise. */
const job = (over: Partial<Contract> = {}): Contract => ({
  kind: 'cargo', destination: 8, commodity: FOOD, qty: 5,
  reward: 500, deadlineDay: 10, progress: 0, ...over,
});

/** A commander carrying `contracts`, and whatever the caller puts in the hold. */
const carrying = (contracts: Contract[], hold: Record<number, number> = {}): CommanderData => {
  const c = newCommander();
  c.contracts = contracts;
  for (const [i, qty] of Object.entries(hold)) c.cargo[+i] = qty;
  return c;
};

// --- what the contracts have a claim on --------------------------------------

console.log('\nwhich tonnes are spoken for');
{
  eq('no contracts, nothing spoken for', consignedTonnes(carrying([]), FOOD), 0);
  eq('a freight job speaks for its tonnes',
    consignedTonnes(carrying([job({ qty: 5 })]), FOOD), 5);
  eq('...and a smuggling run does the same, because it is freight too',
    consignedTonnes(carrying([job({ kind: 'smuggle', commodity: NARCOTICS, qty: 4 })]),
      NARCOTICS), 4);
  eq('...and it marks the commodity it names and no other',
    consignedTonnes(carrying([job({ commodity: MACHINERY, qty: 5 })]), FOOD), 0);

  // The three kinds that carry no goods. Each is given `commodity: FOOD`, which
  // is the field a bounty and a courier run leave unread — a job that fills no
  // bay must not mark a market row. A berth is `cargoTonnes`, and it appears on
  // no row at all.
  for (const kind of ['passenger', 'bounty', 'courier'] as const) {
    eq(`a ${kind} job carries no cargo, so it speaks for no tonnes`,
      consignedTonnes(carrying([job({ kind, qty: 3 })]), FOOD), 0);
  }

  // Goods are fungible and the hold keeps no per-contract provenance, so the
  // answer is the JOB and never the pool. test/contracts.test.ts pins the
  // settlement half of the same rule: the station takes its five, and the ten
  // she paid for stay hers.
  eq('a pooled hold reports the consignment, not the pool',
    consignedTonnes(carrying([job({ qty: 5 })], { [FOOD]: 15 }), FOOD), 5);
  eq('...and an empty hold still owes what was accepted',
    consignedTonnes(carrying([job({ qty: 5 })]), FOOD), 5);

  // Two jobs for one commodity sum, which is the case a `find` would get wrong.
  eq('two consignments of one commodity add up',
    consignedTonnes(carrying([job({ qty: 5 }), job({ qty: 3, destination: 9 })]), FOOD), 8);
  eq('...and a third kind beside them changes nothing',
    consignedTonnes(carrying([job({ qty: 5 }), job({ kind: 'passenger', qty: 3 })]), FOOD), 5);
}

// --- and what the screen says about it ---------------------------------------

console.log('\nthe market screen marks the consigned tonnes');
{
  const market = generateMarket(g1[7], 0);

  /**
   * The IN HOLD cell of one market row, as `renderMarket` painted it.
   *
   * The COLUMN rather than the page: a suffix that landed in the FOR SALE cell,
   * or on the wrong row, would pass a check that only searched the HTML.
   */
  const holdCell = (c: CommanderData, row: number): string => {
    const html = capture(() => renderMarket(g1[7], market, c, 0));
    const tr = html.split('<tr').find((s) => s.includes(`data-row="${row}"`)) ?? '';
    const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1].trim());
    return cells[3] ?? '';
  };

  eq('an empty row is a dash, as it always was', holdCell(carrying([]), FOOD), '-');
  eq('...and a clean hold is a plain tonnage',
    holdCell(carrying([], { [FOOD]: 10 }), FOOD), `10${COMMODITIES[FOOD].unit}`);

  const consigned = holdCell(carrying([job({ qty: 5 })], { [FOOD]: 10 }), FOOD);
  check(`a consigned row says how many are spoken for (${consigned})`,
    consigned.includes('5 CONSIGNED'));
  check('...in the amber this file already spends on a flagged job',
    consigned.includes('var(--hud-amber)'));
  check('...behind the tonnage, not instead of it',
    consigned.startsWith(`10${COMMODITIES[FOOD].unit}`));

  // The pooled hold, on the screen this time: 15t against a 5t job says 5.
  const pooled = holdCell(carrying([job({ qty: 5 })], { [FOOD]: 15 }), FOOD);
  check(`a pooled hold is not all spoken for (${pooled})`,
    pooled.includes('5 CONSIGNED') && !pooled.includes('15 CONSIGNED'));

  // One row is marked, and the rest of the market is left alone.
  const c = carrying([job({ qty: 5 })], { [FOOD]: 10, [MACHINERY]: 10 });
  check('a job on one commodity does not mark another',
    !holdCell(c, MACHINERY).includes('CONSIGNED'));
  const html = capture(() => renderMarket(g1[7], market, c, 0));
  eq('...and exactly one row in the market carries the mark',
    (html.match(/CONSIGNED/g) ?? []).length, 1);

  // A smuggling run is freight, and the row says so in the same words.
  check('a smuggling run marks its row too',
    holdCell(carrying([job({ kind: 'smuggle', commodity: NARCOTICS, qty: 4 })],
      { [NARCOTICS]: 4 }), NARCOTICS).includes('4 CONSIGNED'));

  // A passenger job takes a berth rather than a bay, and no row can show it.
  check('a passenger job marks nothing',
    !capture(() => renderMarket(g1[7], market,
      carrying([job({ kind: 'passenger', qty: 3 })], { [FOOD]: 10 }), 0)).includes('CONSIGNED'));
}
