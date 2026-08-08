// Where an authored exercise starts its opposition.
//
// `spawnOpposition` in game/spawning.ts lays ships on a ring around the
// commander — an even ring, rotated by a random phase, drawn from the world's
// seeded stream so the same seed gives the same sky. These are its defaults and
// bounds. NOT `spawn-placement.ts`, which places a SYSTEM's own traffic: that is
// about where traffic would actually be, this about what the pilot can see and
// how soon the fight starts.
//
// A caller may override the range and the cone but NOT the SPREAD — the four
// fractions at the bottom — so a caller has to size its own cone against a
// product rather than against the angle it asked for.

/**
 * The default ring radius, in units. Far enough to see them coming, close
 * enough to be fighting inside ten seconds, and inside `PLAYER_INTEREST_RANGE`
 * (9,000) where an NPC starts caring about you at all.
 */
export const OPPOSITION_RANGE = 3200;

/**
 * A ceiling on the ring radius, so it cannot put a ship in the planet or
 * station box however the numbers are passed in. `test/arena.test.ts` measures
 * the arena centre's worst-case clearance across 512 systems as the guarantee.
 */
export const OPPOSITION_RANGE_MAX = 20_000;

/**
 * Half-angle of the cone, in radians, when a facing is known and the caller
 * says no more. A FALLBACK NOTHING SHIPPING USES: every scenario states its own
 * cone in degrees. Widened by `OPPOSITION_CONE_FAR` this reaches 41 degrees off
 * the nose — right for a caller that hasn't thought about the canopy, wrong for
 * a trainer, so it stays a default.
 */
export const OPPOSITION_CONE = 0.5;

/**
 * The nearest a ship lands, as a fraction of the ring radius. The ring is
 * scattered rather than exact, so four ships read as four ships near each other
 * rather than a formation the game placed.
 */
export const OPPOSITION_RING_NEAR = 0.85;

/** ...and the width of that band. */
export const OPPOSITION_RING_SPAN = 0.3;

/**
 * ...so the furthest is this. A caller sizing an opening against the ring it
 * asked for wants THIS number rather than 1. Derived, so a change to the scatter
 * cannot leave a transcribed copy asserting the old band.
 */
export const OPPOSITION_RING_FAR = OPPOSITION_RING_NEAR + OPPOSITION_RING_SPAN;

/**
 * The narrowest a ship lands off the cone's axis, as a fraction of the
 * half-angle asked for. The scatter spreads WITHIN the cone and does not start
 * at zero: a ship on the axis is directly ahead of the commander, which looks
 * staged.
 */
export const OPPOSITION_CONE_NEAR = 0.55;

/** ...and the width of that band. */
export const OPPOSITION_CONE_SPAN = 0.9;

/**
 * ...so the widest is this — THIS is the number a caller has to fit inside the
 * canopy (a cone of 8 degrees puts its widest ship 11.6 degrees off the nose).
 * Derived rather than written as 1.45 because `0.55 + 0.9` is 1.4500000000000002
 * in floating point, so a rounded bound would be off by the wrong sign.
 */
export const OPPOSITION_CONE_FAR = OPPOSITION_CONE_NEAR + OPPOSITION_CONE_SPAN;
