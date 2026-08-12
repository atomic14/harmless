// The planet as a distance: how far out a jump leaves you, and where the ground
// is. Both are measured in planet radii. Both are drawn from the system seed,
// and they differ everywhere. What the planet LOOKS like is world/planet.ts.

/**
 * How far out of the planet you drop from witch-space, in planet radii. It puts
 * the planet at 7.2 degrees, and a clean torus run to the station at about 28s.
 *
 * The trainer's arena sits at the same 16 radii anti-sunward (`ARENA_RADII` in
 * game/combat-sim-opening.ts). That is a SEPARATE rule at the same number,
 * measured for its own margins, and it stays separate.
 */
export const WITCHPOINT_RADII = 16;

/**
 * The altitude above the surface at which the ship is destroyed. It is a hard
 * floor, because Harmless has no surface to land on. `checkHazards` checks it
 * beside the sun's kill radius (`constants/sun.ts`). It is three times the
 * commander's contact radius (`COMMANDER_HULL_RADIUS`), which is close enough to
 * read as a touch.
 */
export const PLANET_CRASH_ALTITUDE = 80;
