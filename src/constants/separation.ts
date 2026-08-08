// Keeping wingmen out of each other's way: how near is near enough to care, and
// how hard to bend the line when it is. `game/separation.ts` is the vector.

/**
 * How near a wingman has to be before a ship cares, in world units. Higher
 * costs pack aggression; must stay below `BREAK_OFF_RANGE`.
 */
export const SEPARATION_RANGE = 200;

/**
 * How hard a closing ship bends its aim to avoid a mate, in units of offset,
 * scaled by how close the mate is. Sits a shade above `PASS_MISS_DISTANCE`.
 */
export const SEPARATION_PUSH = 120;
