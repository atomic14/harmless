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
 * for the whole recharge model, and the pair a retune moves. 2.5% and 3.5% of a
 * pool a second: a 40-second energy bank and a 28.6-second shield face, which
 * `test/systems.test.ts` times through the real `regenerate`.
 */
export const ENERGY_REGEN_FRACTION = 0.025;
export const SHIELD_REGEN_FRACTION = 0.035;

/**
 * Shield points a second, per face — and only while energy is above
 * `LOW_ENERGY`, which is `regenerate`'s rule rather than this number's. An
 * absolute rate rather than a fraction because `recharge` counts whole points:
 * 255 x 0.035 is 8.925 a second, so a flattened face is back in ~28.6s.
 */
export const SHIELD_REGEN = MAX_SHIELD * SHIELD_REGEN_FRACTION;

/**
 * An energy unit doubles the bank's recharge. Applied once, in
 * `energyRegenPerSecond`, so no caller can helpfully double it a second time.
 */
export const ENERGY_UNIT_MULTIPLIER = 2;
