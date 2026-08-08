// The planet as a distance: how far out a jump leaves you, and where the
// ground is. Both are measured in planet radii, drawn from the system seed and
// differing everywhere. What the planet LOOKS like is world/planet.ts.

/**
 * How far out of the planet you drop from witch-space, in planet radii. Puts
 * the planet at 7.2 degrees and a clean torus run to the station at ~28s.
 *
 * The trainer's arena sits at the same 16 radii anti-sunward (`ARENA_RADII` in
 * game/combat-sim-opening.ts) — a SEPARATE rule at the same number, measured
 * for its own margins, and it stays separate.
 */
export const WITCHPOINT_RADII = 16;

/**
 * Altitude above the surface at which the ship is destroyed — a hard floor,
 * since Harmless has no surface to land on. Checked in `checkHazards` beside
 * the sun's kill radius (`constants/sun.ts`). Three times the commander's
 * contact radius (`COMMANDER_HULL_RADIUS`), close enough to read as touching.
 */
export const PLANET_CRASH_ALTITUDE = 80;
