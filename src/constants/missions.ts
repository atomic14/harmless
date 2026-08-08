// The Navy mission, as numbers: what earns the briefing, how far away each
// leg is laid, and what the Navy pays.
//
// The five-stage machine that spends these is game/missions.ts. Money is in
// tenths of a credit (invariant 8) and distances in tenths of a light year,
// as everywhere else.

/**
 * Kills before the Navy considers you worth talking to — 16, as the original
 * demanded. The one gate this game keeps from the 1984 mission structure.
 */
export const MISSION_KILL_THRESHOLD = 16;

/**
 * The Constrictor hides this far from where you are briefed, in tenths of a
 * light year — three to eight jumps' worth of hunt. Named MISSION_HUNT_RANGE to
 * stay distinct from `hunt-ranges.ts`, where a "hunt range" is in world units.
 */
export const MISSION_HUNT_RANGE = { min: 30, max: 80 } as const;

/** The courier run is longer: the plans matter more than your convenience. */
export const MISSION_COURIER_RANGE = { min: 50, max: 90 } as const;

/** What killing the Constrictor pays — 2,500 Cr, in tenths of a credit. */
export const CONSTRICTOR_BOUNTY = 25_000;

/** ...and what delivering the plans pays: 1,500 Cr. */
export const COURIER_PAYMENT = 15_000;
