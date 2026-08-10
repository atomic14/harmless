// The station bulletin board: how much work you may hold, how far away a job
// may send you, what a berth costs the hold, and what notoriety a delivery of
// illicit freight leaves behind at the far end.
//
// The board itself is game/contract-offers.ts — pay and deadlines, whose reward
// formula stays there, pinned in aggregate by `npm run campaign` — and
// settlement is game/contracts.ts.

import { MAX_FUEL } from './commander.ts';

/** The most work you may hold at once. Single home for a threshold game.ts and
 *  the balance harness both read, so they play the same-sized board. */
export const MAX_CONTRACTS = 3;

/**
 * How far away, in tenths of a light year, a contract may send you: exactly as
 * far as a full tank reaches. Reads the tank so the two cannot drift, and
 * `test/contracts.test.ts` holds the offer generator to this bound both sides.
 */
export const CONTRACT_RANGE = MAX_FUEL;

/**
 * What one passenger costs the hold, in tonnes.
 *
 * A berth is bigger than the person in it: bunk, air, water and the bulkhead
 * around them, struck out of the same bays that would otherwise hold freight.
 * That competition is the point of passenger work — at 2 t a three-berth job
 * takes 6 of a standard 20 t hold, a bite you feel, and one the 35 t Large
 * Cargo Bay visibly relieves. 1 t would make the trade-off invisible; 4 t
 * would price passengers out of a small hold entirely.
 *
 * Derived, never stored: `commander.ts`'s `cargoTonnes` counts the berths of
 * the passenger contracts already on the commander, so the buy cap, the board
 * footer and `acceptContract`'s refusal all agree without a second field to
 * keep in step (the lesson docs/TODO/88 records).
 *
 * Its own rule id because it shares the value 2 with unrelated numbers and
 * must stay free to move on its own.
 *
 * @rule contracts.passengerBerthTonnes
 */
export const PASSENGER_BERTH_TONNES = 2;

/**
 * How loudly a delivered smuggling run is talked about, per tonne landed.
 *
 * Handing illicit freight over at the far end is noticed the way a dirty market
 * sale is (game/screens/trade.ts adds `0.04` a tonne), and rather more loudly:
 * a market sale is one hold emptying into a legitimate exchange, a consignment
 * delivered no-questions-asked is a working arrangement somebody remembers. At
 * 0.06 a two-tonne job costs 0.12 heat and a five-tonne job 0.30 — a whole
 * grade of the 0..1 scale for the biggest run, so the reward has bought you
 * something the *next* arrival pays for (galaxy/living.ts spreads it to the
 * neighbours, and `HEAT_DECAY` takes a fortnight to forget it).
 *
 * Regional heat, NOT character: the deed also marks the name, and that half is
 * `DISREPUTE_CONTRABAND_SALE` (constants/character.ts). Two consequences, two
 * owners — the pure settlement applies the disrepute and the orchestrators
 * apply this (invariant 15), which is why it is a rate here rather than a
 * literal at either call site.
 *
 * Lives with the board rather than beside the disrepute deeds because it is a
 * property of the JOB, like `PASSENGER_BERTH_TONNES` above; character.ts is
 * explicitly not about the Government or the regions.
 *
 * Its own rule id: it shares no meaning with any other small fraction.
 *
 * @rule contracts.smuggleDeliveryNotoriety
 */
export const SMUGGLE_DELIVERY_NOTORIETY = 0.06;
