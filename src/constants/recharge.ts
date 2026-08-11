// How fast the commander's pools refill: the rate the whole model is anchored
// on, and the one fitting that changes it. (Capacities are `pools.ts`; this file
// owns refill RATES.) Separate because the two have different provenance — a
// pool's size is the released game's byte, but the source gives each hull only
// an `energyRechargeRating` and no clock, so what a rating is worth in seconds
// is Harmless policy and stated here.
//
// The rule that spends these is `energyRegenPerSecond` in game/systems.ts, which
// divides a hull's rating by the Cobra's (the anchor lives there because it must
// read the Elite-A catalogue, which this directory may not import).

import { MAX_SHIELD } from './pools.ts';

/**
 * The fraction of a full pool a Cobra Mk III recovers each second — the anchor
 * for the whole recharge model. 2.5% and 1.2% of a pool a second: a 40-second
 * energy bank and an 83-second shield face, which `test/systems.test.ts` times
 * through the real `regenerate`.
 *
 * THE SHIELD WAS 3.5% until docs/TODO/139, and at that rate a face put points
 * back faster than fourteen of the seventeen pirate builds could ever take them
 * off — not slowly: never, at their own BEST case, so a fight with one had no
 * end state. `test/role-variants.test.ts` pins the relationship that replaced
 * it: no build the galaxy sends may be one a face simply outruns. The bound is
 * the lightest gun in the roster (the Worm and the Ophidian, 3.27 points a
 * second at point blank), so this is the highest rate that clears it with room,
 * and the measured outcomes are already flat here — `npm run aim-probe` moves
 * by two or three points between 0.014 and 0.010 on either seed grid, so this
 * is the knee and not the floor.
 *
 * THE BANK DID NOT MOVE, and that is a measurement rather than an oversight:
 * the gate 139 states — an organised tier-2 gang must be able to drive her to
 * `LOW_ENERGY` in a fight she would sit through — is met by the shield alone
 * (28% of fights before, 50% after, three attackers). The bank is the pool that
 * keeps her alive, cutting it compounds a lethality the item did not ask for,
 * and 40 seconds is the figure a Cobra flew before the pools grew.
 */
export const ENERGY_REGEN_FRACTION = 0.025;

/** The shield's half of the pair above, and the one docs/TODO/139 moved. */
export const SHIELD_REGEN_FRACTION = 0.012;

/**
 * Shield points a second, per face — and only while energy is above
 * `LOW_ENERGY`, which is `regenerate`'s rule rather than this number's. An
 * absolute rate rather than a fraction because `recharge` counts whole points:
 * 255 x 0.012 is 3.06 a second, so a flattened face is back in ~83s.
 *
 * It is compared with a GUN in `gunnery.ts` (`npcBestCasePerSecond`) and in the
 * roster's own test, which is what the rate is for: a shield that outruns every
 * gun in the galaxy is not defence, it is immunity.
 */
export const SHIELD_REGEN = MAX_SHIELD * SHIELD_REGEN_FRACTION;

/**
 * An energy unit doubles the bank's recharge. Applied once, in
 * `energyRegenPerSecond`, so no caller can helpfully double it a second time.
 */
export const ENERGY_UNIT_MULTIPLIER = 2;
