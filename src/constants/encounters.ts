// What turns up while you fly, and how long you wait for it.
//
// There are three clocks: a trader that arrives from deep space, a pirate wave in
// lawless space, and a Thargon that peels off a mothership. Beside them are the
// conditions that decide whether a clock that strikes produces anything.
// Together, they are how dangerous every system FEELS.
//
// Who is here when you arrive is `population.ts`. Where any of it is put is
// `spawn-placement.ts`. The rule that spends these is `stepEncounters` in
// game/encounters.ts, which reports what should appear and never places it.
//
// Every gap below is in SECONDS of flight. Every one is a base plus a jitter, so
// no lane runs to a metronome that a player can count.

/**
 * The gap between trader arrivals in a system with no economy to speak of. It is
 * the ceiling of the range: productivity only ever subtracts
 * (`TRADER_GAP_BUSY_MAX`), so this is the slowest lane in the galaxy.
 */
export const TRADER_GAP = 100;

/** ...and the jitter on top, drawn flat, so the lane never runs to a metronome. */
export const TRADER_GAP_JITTER = 60;

/**
 * The most that a busy economy can discount off `TRADER_GAP`.
 *
 * It is a GUARD rather than a live rung. Over all 2,048 systems the discount runs
 * 0.6s to 46.9s, and no system reaches this cap. What it stops is a change
 * elsewhere — a re-scaled productivity, a smaller `PRODUCTIVITY_PER_SECOND` —
 * that turns one rich system into a continuous trader stream, held back only by
 * `MAX_TRADERS`. Live, a median system runs its lane at about 90s plus jitter,
 * and the richest at about 53s plus jitter.
 */
export const TRADER_GAP_BUSY_MAX = 50;

/**
 * How much 1984 productivity buys one second off that gap.
 *
 * `productivity` is the source's own
 * `((economy ^ 7) + 3) * (government + 4) * population * 8` (galaxy/galaxy.ts).
 * This is therefore the exchange rate between the 1984 figure and a Harmless
 * clock. It is the only place the two scales meet, and that is why neither can be
 * re-based without the other.
 */
export const PRODUCTIVITY_PER_SECOND = 1200;

/**
 * How long after a system's clocks start the first trader may appear.
 *
 * It is well short of the steady-state gap, on purpose. The lane should look
 * alive before you finish the cruise in from the witchpoint, which is about 28s
 * clean (see `TORUS_MULTIPLIER`). `freshTimers` restarts the clocks on every
 * hyperspace arrival, so this is the wait that a player actually experiences on
 * landing.
 */
export const TRADER_GAP_FIRST = 20;

/** ...and its jitter, so two arrivals in one system are not the same arrival. */
export const TRADER_GAP_FIRST_JITTER = 40;

/**
 * The gap between pirate waves in the most organised system that still breeds
 * them. It is also the first wave's countdown when you arrive. It is one number,
 * because the first wave is the ladder's bottom rung, with no government term and
 * no jitter.
 */
export const PIRATE_WAVE_GAP = 60;

/**
 * ...and how much longer the wait grows for every step up the government ladder.
 *
 * Piracy pressure scales with lawlessness. An anarchy (0) therefore waits the
 * base alone, and a corporate state waits nearly five minutes. By that point
 * `LAWLESS_GOVERNMENT` has refused the wave anyway. The ladder still runs the
 * whole way up, because the timer is a clock and not a gate. It keeps refused
 * systems from all coming due at once, if that line ever moves.
 */
export const PIRATE_WAVE_GAP_PER_GOVERNMENT = 40;

/** ...and the jitter. It is wider than the trader lane's, because nobody should
 *  be able to time an ambush. */
export const PIRATE_WAVE_GAP_JITTER = 90;

/**
 * A government at or below this breeds pirate waves at all.
 *
 * 3 is a dictatorship on the 1984 ladder, so waves stop at communist (4) and
 * above. That is the line between policed space and space where you are on your
 * own. It is the same line that the player weighs when a rich cargo is only worth
 * the carry through an anarchy.
 */
export const LAWLESS_GOVERNMENT = 3;

/**
 * ...and a government at or below THIS sends them two at a time: anarchy (0) and
 * feudal (1).
 *
 * It is not the same rule as `policeFor`'s ladder (game/population.ts), which
 * puts the line between 0 and 1. The two lines are a step apart deliberately. A
 * feudal system has exactly one patrol and pairs of pirates, which makes it the
 * most dangerous place that still has a police force.
 */
export const ANARCHY_GOVERNMENT = 1;

/**
 * How many drones one Thargoid mothership keeps in the sky. It is the same number
 * as `MAX_TRADERS`, and NOT the same rule. This is how much a single mothership
 * can put in front of you at once.
 */
export const MAX_THARGONS = 4;

/**
 * Seconds between one drone and the next, and the wait for the first.
 *
 * A mothership keeps deployment up while it lives, so this is the pressure that
 * makes a kill of the mother the objective. At 5 seconds it replaces a drone
 * faster than most commanders kill one.
 */
export const THARGON_REDEPLOY = 5;
