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

/**
 * Days before a finished side job is offered again: a week.
 *
 * Failure rule 5 (docs/TODO/190): a side mission comes back after a delay,
 * and an arc never does. The delay is what stops one patron's one job from
 * reading as the only work in the galaxy. `missions/offers.ts` reads it
 * against the day the job last ended.
 *
 * It is a count of DAYS, and the word puts it beside the jump constants. It
 * is a mission's rule: nothing about a jump reads it.
 *
 * @domain missions
 * @rule missions.reofferDays
 */
export const MISSION_REOFFER_DAYS = 7;

/**
 * Inside this many jumps of a lead's world, the station talks about it. The
 * bulletin board carries a rumour, and the DATA ON page carries a line.
 *
 * "About five jumps" is Chris's phrase (docs/TODO/190). An arc's end is two to
 * four jumps from the next arc's start, so a commander who just finished one
 * is always inside it. `missions/hints.ts` counts the jumps on the full-tank
 * graph (galaxy/route.ts).
 *
 * @rule missions.leadRumourJumps
 */
export const LEAD_RUMOUR_JUMPS = 5;

/**
 * Docks with no mission progress before a patron with a lead writes a second
 * time.
 *
 * One further message, not a stream (docs/TODO/190 M3 step 3). Four docks is
 * about a trade loop. A commander who docked four times without touching a
 * mission is trading. One line is a reminder rather than a nag.
 *
 * @rule missions.leadNagDocks
 */
export const LEAD_NAG_DOCKS = 4;
