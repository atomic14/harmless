// The station bulletin board: how much work you may hold, how far away a job may
// send you, what a berth costs the hold, and what notoriety a delivery of illicit
// freight leaves behind at the far end.
//
// The board itself is game/contract-offers.ts, which owns the pay and the
// deadlines. Its reward formula stays there, pinned in aggregate by
// `npm run campaign`. Settlement is game/contracts.ts.

import { MAX_FUEL } from './commander.ts';

/** The most work you may hold at once. It is the single home for a threshold
 *  that game.ts and the balance harness both read, so they play the same-sized
 *  board. */
export const MAX_CONTRACTS = 3;

/**
 * How far away a contract may send you, in tenths of a light year: exactly as far
 * as a full tank reaches. It reads the tank, so the two cannot drift.
 * `test/contracts.test.ts` holds the offer generator to this bound on both sides.
 */
export const CONTRACT_RANGE = MAX_FUEL;

/**
 * What one passenger costs the hold, in tonnes.
 *
 * A berth is bigger than the person in it: a bunk, air, water, and the bulkhead
 * around them. They are struck out of the same bays that would otherwise hold
 * freight. That competition is the point of passenger work. At 2 t, a three-berth
 * job takes 6 of a standard 20 t hold, which is a bite you feel, and one that the
 * 35 t Large Cargo Bay visibly relieves. 1 t would make the trade-off invisible.
 * 4 t would price passengers out of a small hold entirely.
 *
 * It is derived, never stored. `commander.ts`'s `cargoTonnes` counts the berths
 * of the passenger contracts already on the commander. The buy cap, the board
 * footer and `acceptContract`'s refusal therefore all agree, without a second
 * field to keep in step. That is the lesson docs/TODO/88 records.
 *
 * It has its own rule id, because it shares the value 2 with unrelated numbers
 * and must stay free to move on its own.
 *
 * @rule contracts.passengerBerthTonnes
 */
export const PASSENGER_BERTH_TONNES = 2;

/**
 * How loudly a delivered smuggling run is talked about, per tonne landed.
 *
 * A hand-over of illicit freight at the far end is noticed the way a dirty market
 * sale is: game/screens/trade.ts adds `0.04` a tonne. It is noticed rather more
 * loudly. A market sale is one hold that empties into a legitimate exchange. A
 * consignment delivered with no questions asked is a working arrangement that
 * somebody remembers. At 0.06, a two-tonne job costs 0.12 heat, and a five-tonne
 * job costs 0.30. That is a whole grade of the 0..1 scale for the biggest run, so
 * the reward has bought you something that the *next* arrival pays for.
 * galaxy/living.ts spreads it to the neighbours, and `HEAT_DECAY` takes a
 * fortnight to forget it.
 *
 * It is regional heat, NOT character. The deed also marks the name, and that half
 * is `DISREPUTE_CONTRABAND_SALE` (constants/character.ts). Two consequences, two
 * owners: the pure settlement applies the disrepute, and the orchestrators apply
 * this (invariant 15). That is why it is a rate here, rather than a literal at
 * either call site.
 *
 * It lives with the board rather than beside the disrepute deeds, because it is a
 * property of the JOB, like `PASSENGER_BERTH_TONNES` above. character.ts is
 * explicitly not about the Government or the regions.
 *
 * It has its own rule id: it shares no meaning with any other small fraction.
 *
 * @rule contracts.smuggleDeliveryNotoriety
 */
export const SMUGGLE_DELIVERY_NOTORIETY = 0.06;
