// Mis-jump limbo: where the scenery goes, and what is waiting for you there.
// Witch-space is nowhere — no planet, station or sun, only Thargoids. The
// system scene is reused and its furniture thrown out of reach of every
// distance check rather than making the whole world nullable.
//
// The exit cost is `jump.ts`'s `WITCHSPACE_ESCAPE_COST`; the drones the
// mothership deploys are `encounters.ts`. This file is only the place itself.

/**
 * Where the planet, station and sun are put while you are in witch-space. A
 * SENTINEL, not a distance: used as a per-axis coordinate, so the furniture
 * ends up ~1.4e8 units out and every distance check reads "not here" without a
 * witch-space branch. Big enough to leave no doubt, small enough to stay exact
 * in a double.
 */
export const BANISHED = 1e8;

/**
 * Speed on arrival in witch-space. Half top speed and slower than an ordinary
 * hyperspace arrival (250): the ambush opens immediately, so arriving at cruise
 * would fly you into the Thargoids before the console has finished saying so.
 */
export const WITCHSPACE_ENTRY_SPEED = 200;

/**
 * The fewest Thargoids waiting. Never one: a single Thargoid is a duel and this
 * is an ambush — being outnumbered from the first frame is what makes a mis-jump
 * read as the worst thing that can happen to a jump.
 */
export const THARGOID_AMBUSH_MIN = 2;

/** ...and the chance of a third. */
export const THARGOID_AMBUSH_EXTRA_CHANCE = 0.3;

/**
 * How far out they are waiting — well inside `PLAYER_INTEREST_RANGE`, so they
 * are already coming for you when the screen finishes fading in.
 */
export const THARGOID_AMBUSH_RANGE = 3500;

/** ...and the width of that band, so they do not all arrive at one distance. */
export const THARGOID_AMBUSH_RANGE_SPAN = 2500;

// What used to end this file — STRANDED_HINT_FIRST and STRANDED_HINT_REPEAT,
// the cadence of a console message that told you to press B — went with the
// message (docs/TODO/128). Being stranded is a situation, not an event: the
// cockpit's prompt line now carries the offer for as long as it is true, so
// there is no repeat to time and no letter to hard-code. The condition itself
// (`WITCHSPACE_ESCAPE_COST` in the tank) is `game/prompts.ts`.
