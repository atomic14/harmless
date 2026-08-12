// How to keep wingmen out of each other's way. It takes two numbers: how near is
// near enough to care, and how hard to bend the line when it is.
// `game/separation.ts` is the vector.

/**
 * How near a wingman has to be before a ship cares, in world units. A higher
 * value costs pack aggression. It must stay below `BREAK_OFF_RANGE`.
 */
export const SEPARATION_RANGE = 200;

/**
 * How hard a ship that closes bends its aim to avoid a mate, in units of offset.
 * How close the mate is scales it. It sits a shade above `PASS_MISS_DISTANCE`.
 */
export const SEPARATION_PUSH = 120;
