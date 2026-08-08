// Scooping drifting cargo: the reach.
//
// One number, because collection is one rule: fly this close to a canister or
// escape capsule and it is aboard — what that MEANS is the Game's business
// (game/cargo.ts reports, the Game decides). Scooping FUEL off the sun is a
// different rule at a different scale: `SUN_SCOOP_RANGE` and `SCOOP_RATE` in sun.ts.

/**
 * How close the commander must fly to scoop a drifting object, in world units.
 * Under twice the commander's contact radius (25, collision.ts), so scooping
 * reads as flying THROUGH a 12-unit canister rather than vacuuming it from a
 * distance — a deliberate act, which is why the fuel-scoops fitting is what
 * makes it safe (hitting one without them is `IMPACT.canisterOnHull`).
 */
export const SCOOP_RANGE = 45;
