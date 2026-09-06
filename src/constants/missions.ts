// The Navy mission, as numbers: what earns the briefing, how far away each leg
// is laid, and what the Navy pays.
//
// The five-stage machine that spends these is game/missions.ts. Money is in
// tenths of a credit (invariant 8), and distances are in tenths of a light year,
// as everywhere else.

/**
 * Kills before the Navy considers you worth a word: 16, as the original demanded.
 * It is the one gate that this game keeps from the 1984 mission structure.
 */
export const MISSION_KILL_THRESHOLD = 16;

/**
 * The Constrictor hides this far from where you are briefed, in tenths of a
 * light year. That is three to eight jumps of hunt. The name is
 * MISSION_HUNT_RANGE to stay distinct from `hunt-ranges.ts`, where a "hunt
 * range" is in world units.
 */
export const MISSION_HUNT_RANGE = { min: 30, max: 80 } as const;

/** The courier run is longer: the plans matter more than your convenience. */
export const MISSION_COURIER_RANGE = { min: 50, max: 90 } as const;

/** What a kill of the Constrictor pays — 2,500 Cr, in tenths of a credit. */
export const CONSTRICTOR_BOUNTY = 25_000;

/** ...and what a delivery of the plans pays: 1,500 Cr. */
export const COURIER_PAYMENT = 15_000;

/**
 * How many missions a commander can hold open at one time: three.
 *
 * Chris chose three on 2026-09-06 (docs/TODO/190). One slot would make a lead
 * wait for the current mission to end. The bulletin board already offers
 * several contracts at once, and a mission is no rarer than a job. The mission
 * machine (`missions/machine.ts`) refuses a fourth acceptance. A saved lead
 * waits in `MissionState.leads` until a slot frees.
 *
 * It equals `MAX_CONTRACTS`, and that is a coincidence, not a rule. A board
 * job and a mission are separate slots. Each cap moves on its own evidence.
 *
 * @rule missions.liveCap
 */
export const MISSION_LIVE_CAP = 3;
