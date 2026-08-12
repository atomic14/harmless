// The reach for a scoop of drifting cargo.
//
// One number, because collection is one rule: fly this close to a canister or to
// an escape capsule, and it is aboard. What that MEANS is the Game's business.
// game/cargo.ts reports, and the Game decides. A scoop of FUEL off the sun is a
// different rule at a different scale: `SUN_SCOOP_RANGE` and `SCOOP_RATE` in
// sun.ts.

/**
 * How close the commander must fly to scoop a drifting object, in world units.
 * It is under twice the commander's contact radius (25, collision.ts). A scoop
 * therefore reads as a flight THROUGH a 12-unit canister, rather than as a
 * vacuum from a distance. It is a deliberate act, which is why the fuel-scoops
 * fitting is what makes it safe. A hit on one without them is
 * `IMPACT.canisterOnHull`.
 */
export const SCOOP_RANGE = 45;
