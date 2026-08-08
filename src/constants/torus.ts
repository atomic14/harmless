// The torus jump drive: how much faster it is, and what makes it let go.
// The manual: "torus jump drive (8x; cuts out when something massive is near)".
// The multiplier is what the drive buys; the three radii are its price.
// Spent by `flyPlayer` and `massLocked` in game/world-step.ts; its look at
// speed is world/starfield.ts, sized against the top speed this produces.

/**
 * How much faster the torus drive travels than ordinary flight — the TOTAL,
 * the single home for the "8x" the manual, briefing, dust streaks and step all
 * mean. The step adds `TORUS_MULTIPLIER - 1` because the plain first multiple
 * is already in the ship's position by the time it runs.
 *
 * At the commander's 400 this is 3,200 units/s — the figure the starfield's
 * streaks are faded against, roughly a 28-second run from the witchpoint.
 */
export const TORUS_MULTIPLIER = 8;

/**
 * How near the station holds the drive down — the largest of the three radii,
 * measured to the station's CENTRE so you cannot torus past the slot you are
 * threading. `test/arena.test.ts` holds the combat arena clear of it in all
 * 256 systems of two galaxies.
 *
 * The three radii are ONE rule with three answers — `massLocked()` is true if
 * any holds — separate because the three things are different sizes.
 */
export const MASS_LOCK_STATION = 5000;

/**
 * ...and how near the planet, as an ALTITUDE above the surface, not a centre
 * distance: a planet's radius varies with the seed. Far above
 * `PLANET_CRASH_ALTITUDE`, so the drive lets go long before the ground is a
 * danger and the last of an approach is a flown descent.
 */
export const MASS_LOCK_PLANET_ALTITUDE = 4000;

/**
 * ...and how near another ship — any live one that is not a rock. Asteroids are
 * excluded deliberately: a drive that cut out on every rock would strand you.
 * What it buys is that a pirate who has come to meet you gets to keep you.
 */
export const MASS_LOCK_SHIP = 4500;
