// Mis-jump limbo: where the scenery goes, and what waits for you there.
// Witch-space is nowhere. It has no planet, no station and no sun, only
// Thargoids. The code reuses the system scene and throws its furniture out of
// reach of every distance check. The alternative was a whole world that is
// nullable.
//
// The exit cost is `jump.ts`'s `WITCHSPACE_ESCAPE_COST`. The drones that the
// mothership deploys are `encounters.ts`. This file is only the place itself.

/**
 * Where the planet, the station and the sun go while you are in witch-space. It
 * is a SENTINEL, not a distance. The code uses it as a per-axis coordinate. So
 * the furniture ends up about 1.4e8 units out, and every distance check reads
 * "not here" with no witch-space branch. It is big enough to leave no doubt,
 * and small enough to stay exact in a double.
 */
export const BANISHED = 1e8;

/**
 * Speed on arrival in witch-space. It is half top speed, and slower than an
 * ordinary hyperspace arrival (250). The ambush opens immediately, so an arrival
 * at cruise would fly you into the Thargoids before the console finishes the
 * report.
 *
 * @rule witchspace.entrySpeed
 */
export const WITCHSPACE_ENTRY_SPEED = 200;

/**
 * The fewest Thargoids that wait. Never one: a single Thargoid is a duel, and
 * this is an ambush. To be outnumbered from the first frame is what makes a
 * mis-jump read as the worst thing that can happen to a jump.
 *
 * It has its own rule id, because thirteen constants share the value 2
 * (docs/TODO/188), and each is free to move alone.
 *
 * @rule witchspace.thargoidAmbushMin
 */
export const THARGOID_AMBUSH_MIN = 2;

/** ...and the chance of a third. */
export const THARGOID_AMBUSH_EXTRA_CHANCE = 0.3;

/**
 * How far out they wait. It is well inside `PLAYER_INTEREST_RANGE`, so they are
 * already on their way to you when the screen finishes the fade in.
 */
export const THARGOID_AMBUSH_RANGE = 3500;

/**
 * ...and the width of that band, so they do not all arrive at one distance.
 *
 * It has its own rule id. It shares the value 2,500 with `PIRATE_SCATTER`
 * (spawn-placement.ts) and `AMBLE_SPAN` (constants/amble.ts). This one is the
 * width of an ambush in limbo, where there is no station and no reception.
 *
 * @rule witchspace.thargoidAmbushRangeSpan
 */
export const THARGOID_AMBUSH_RANGE_SPAN = 2500;

// Two constants used to end this file: STRANDED_HINT_FIRST and
// STRANDED_HINT_REPEAT. They were the cadence of a console message that told
// you to press B, and they went with that message (docs/TODO/128). To be stranded is a situation, not an event. The cockpit's
// prompt line now carries the offer for as long as it is true. So there is no
// repeat to time, and no letter to hard-code. The condition itself
// (`WITCHSPACE_ESCAPE_COST` in the tank) is `game/prompts.ts`.
