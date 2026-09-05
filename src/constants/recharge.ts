// How fast the commander's pools refill: the rate that the whole model is
// anchored on, and the one fitting that changes it. The capacities are
// `pools.ts`; this file owns the refill RATES. They are separate because the two
// have different provenance. A pool's size is the released game's byte. The
// source gives each hull only an `energyRechargeRating`, and no clock. So what
// a rating is worth in seconds is Harmless policy, and this file states it.
//
// The rule that spends these is `energyRegenPerSecond` in game/systems.ts. It
// divides a hull's rating by the Cobra's. The anchor lives there because it must
// read the Elite-A catalogue, which this directory may not import.

import { MAX_SHIELD } from './pools.ts';

/**
 * The fraction of a full pool that a Cobra Mk III recovers each second. It is the
 * anchor for the whole recharge model. 2.5% and 1.2% of a pool a second gives a
 * 40-second energy bank and an 83-second shield face. `test/systems.test.ts`
 * times both through the real `regenerate`.
 *
 * THE SHIELD WAS 3.5% until docs/TODO/139. At that rate a face put points back
 * faster than fourteen of the seventeen pirate builds could ever take them off.
 * Not slowly: never, at their own BEST case. A fight with one therefore had no
 * end state. `test/role-variants.test.ts` pins the relationship that replaced it:
 * no build the galaxy sends may be one that a face simply outruns.
 *
 * The bound is the lightest gun in the roster: the Worm and the Ophidian, at
 * 3.27 points a second at point blank. So this is the highest rate that clears
 * it with room.
 * The measured outcomes are already flat here. `npm run aim-probe` moves by two
 * or three points between 0.014 and 0.010 on either seed grid, so this is the
 * knee and not the floor.
 *
 * THE BANK DID NOT MOVE, and that is a measurement rather than an oversight. 139
 * states the gate: an organised tier-2 gang must be able to drive her to
 * `LOW_ENERGY` in a fight she would otherwise sit through. The shield alone meets
 * it, at 28% of fights before and 50% after, with three attackers. The bank is
 * the pool that keeps her alive. A cut to it compounds a lethality the item did
 * not ask for. 40 seconds is the figure a Cobra flew before the pools
 * grew.
 */
export const ENERGY_REGEN_FRACTION = 0.025;

/** The shield's half of the pair above, and the one docs/TODO/139 moved. */
export const SHIELD_REGEN_FRACTION = 0.012;

/**
 * Shield points a second, per face. It applies only while the energy is above
 * `LOW_ENERGY`, which is `regenerate`'s rule rather than this number's. It is an
 * absolute rate rather than a fraction, because `recharge` counts whole points.
 * 255 x 0.012 is 3.06 a second, so a flattened face is back in about 83s.
 *
 * It is compared with a GUN in `gunnery.ts` (`npcBestCasePerSecond`), and in the
 * roster's own test. That is what the rate is for: a shield that outruns every
 * gun in the galaxy is not defence, it is immunity.
 */
export const SHIELD_REGEN = MAX_SHIELD * SHIELD_REGEN_FRACTION;

/**
 * An energy unit doubles the bank's recharge. It is applied one time, in
 * `energyRegenPerSecond`, so no caller can helpfully double it a second time.
 *
 * It has its own rule id, because thirteen constants share the value 2
 * (docs/TODO/188), and each is free to move alone.
 *
 * @rule recharge.energyUnitMultiplier
 */
export const ENERGY_UNIT_MULTIPLIER = 2;
