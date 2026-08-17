// The torus jump drive: how much faster it is, and what makes it let go.
// The manual: "torus jump drive (8x; cuts out when something massive is near)".
// The multiplier is what the drive buys. The three radii are its price.
// `flyPlayer` and `massLocked` in game/world-step.ts spend these. Its look at
// speed is world/starfield.ts, sized against the top speed this produces.

/**
 * How much faster the torus drive travels than ordinary flight. It is the TOTAL,
 * and the single home for the "8x" that the manual, the briefing, the dust
 * streaks and the step all mean. The step adds `TORUS_MULTIPLIER - 1`, because
 * the plain first multiple is already in the ship's position by the time it runs.
 *
 * At the commander's 400 this is 3,200 units/s. That is the figure the
 * starfield's streaks are faded against, and roughly a 28-second run from the
 * witchpoint.
 */
export const TORUS_MULTIPLIER = 8;

/**
 * How near the station holds the drive down. It is the largest of the three
 * radii. It is measured to the station's CENTRE, so you cannot torus past the
 * slot you thread. `test/arena.test.ts` holds the combat arena clear of it, in
 * all 256 systems of two galaxies.
 *
 * The three radii are ONE rule with three answers, because `massLocked()` is true
 * if any one of them holds. They are separate because the three things are
 * different sizes.
 */
export const MASS_LOCK_STATION = 5000;

/**
 * ...and how near the planet, as an ALTITUDE above the surface. It is not a
 * centre distance, because a planet's radius varies with the seed. It is far
 * above `PLANET_CRASH_ALTITUDE`. So the drive lets go long before the ground is
 * a danger, and the last of an approach is a flown descent.
 */
export const MASS_LOCK_PLANET_ALTITUDE = 4000;

/**
 * ...and how near another ship — any live one that is not a rock. Asteroids are
 * excluded deliberately: a drive that cut out on every rock would strand you.
 * What it buys is that a pirate who came to meet you gets to keep you.
 *
 * @rule torus.massLockShip
 */
export const MASS_LOCK_SHIP = 4500;
