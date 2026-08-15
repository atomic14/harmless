// Where an authored exercise starts its opposition.
//
// `spawnOpposition` in game/spawning-arena.ts lays ships on a ring around the
// commander. The ring is even, and a random phase rotates it. The phase is drawn
// from the world's seeded stream, so the same seed gives the same sky. These are
// its defaults and its bounds. They are NOT `spawn-placement.ts`, which places a
// SYSTEM's own traffic. That file is about where traffic would actually be. This
// one is about what the pilot can see, and how soon the fight starts.
//
// A caller may override the range and the cone, but NOT the SPREAD — the four
// fractions at the bottom. A caller therefore has to size its own cone against a
// product, rather than against the angle it asked for.

/**
 * The default ring radius, in units. It is far enough to see them coming, and
 * close enough to be in a fight inside ten seconds. It is inside
 * `PLAYER_INTEREST_RANGE` (9,000), where an NPC starts to care about you at all.
 */
export const OPPOSITION_RANGE = 3200;

/**
 * A ceiling on the ring radius, so it cannot put a ship in the planet box or the
 * station box, however the numbers are passed in. `test/arena.test.ts` measures
 * the arena centre's worst-case clearance across 512 systems, as the guarantee.
 */
export const OPPOSITION_RANGE_MAX = 20_000;

/**
 * Half-angle of the cone, in radians, when a facing is known and the caller says
 * no more. It is A FALLBACK THAT NOTHING SHIPPING USES: every scenario states its
 * own cone in degrees. Widened by `OPPOSITION_CONE_FAR`, this reaches 41 degrees
 * off the nose. That is right for a caller that has not thought about the canopy,
 * and wrong for a trainer, so it stays a default.
 */
export const OPPOSITION_CONE = 0.5;

/**
 * The nearest a ship lands, as a fraction of the ring radius. The ring is
 * scattered rather than exact, so four ships read as four ships near each other,
 * rather than as a formation that the game placed.
 */
export const OPPOSITION_RING_NEAR = 0.85;

/** ...and the width of that band. */
export const OPPOSITION_RING_SPAN = 0.3;

/**
 * ...so the furthest is this. A caller that sizes an opening against the ring it
 * asked for wants THIS number, rather than 1. It is derived, so a change to the
 * scatter cannot leave a transcribed copy that asserts the old band.
 */
export const OPPOSITION_RING_FAR = OPPOSITION_RING_NEAR + OPPOSITION_RING_SPAN;

/**
 * The narrowest a ship lands off the cone's axis, as a fraction of the half-angle
 * asked for. The scatter spreads WITHIN the cone, and it does not start at zero.
 * A ship on the axis is directly ahead of the commander, which looks staged.
 */
export const OPPOSITION_CONE_NEAR = 0.55;

/** ...and the width of that band. */
export const OPPOSITION_CONE_SPAN = 0.9;

/**
 * ...so the widest is this. THIS is the number that a caller has to fit inside
 * the canopy: a cone of 8 degrees puts its widest ship 11.6 degrees off the nose.
 * It is derived rather than written as 1.45, because `0.55 + 0.9` is
 * 1.4500000000000002 in floating point. A rounded bound would be off by the wrong
 * sign.
 */
export const OPPOSITION_CONE_FAR = OPPOSITION_CONE_NEAR + OPPOSITION_CONE_SPAN;
