// What turns up while you are flying, and how long you wait for it.
//
// Three clocks — a trader arriving from deep space, a pirate wave in lawless
// space, a Thargon peeling off a mothership — plus the conditions that decide
// whether the clock striking produces anything. Together they are how
// dangerous every system FEELS.
//
// Who is here when you arrive is `population.ts`; where any of it is put is
// `spawn-placement.ts`. The rule that spends these is `stepEncounters` in
// game/encounters.ts, which reports what should appear and never places it.
//
// Every gap below is in SECONDS of flight, and every one is a base plus a
// jitter, so no lane runs to a metronome a player can count.

/**
 * The gap between trader arrivals in a system with no economy to speak of...
 * The ceiling of the range: productivity only ever subtracts
 * (`TRADER_GAP_BUSY_MAX`), so this is the slowest lane in the galaxy.
 */
export const TRADER_GAP = 100;

/** ...and the jitter on top, drawn flat, so the lane never runs to a metronome. */
export const TRADER_GAP_JITTER = 60;

/**
 * The most a busy economy can discount off `TRADER_GAP`.
 *
 * A GUARD rather than a live rung: over all 2,048 systems the discount runs
 * 0.6s to 46.9s and no system reaches this cap. What it stops is a change
 * elsewhere (a re-scaled productivity, a smaller `PRODUCTIVITY_PER_SECOND`)
 * turning one rich system into a continuous trader stream held back only by
 * `MAX_TRADERS`. Live, a median system runs its lane at ~90s + jitter and the
 * richest at ~53s + jitter.
 */
export const TRADER_GAP_BUSY_MAX = 50;

/**
 * How much 1984 productivity buys one second off that gap.
 *
 * `productivity` is the source's own `((economy ^ 7) + 3) * (government + 4) *
 * population * 8` (galaxy/galaxy.ts), so this is the exchange rate between the
 * 1984 figure and a Harmless clock — the only place the two scales meet, and
 * why neither can be re-based without the other.
 */
export const PRODUCTIVITY_PER_SECOND = 1200;

/**
 * How long after a system's clocks start the first trader may appear...
 *
 * Well short of the steady-state gap on purpose: the lane should look alive
 * before you finish the cruise in from the witchpoint (~28s clean, see
 * `TORUS_MULTIPLIER`). `freshTimers` restarts the clocks on every hyperspace
 * arrival, so this is the wait a player actually experiences on landing.
 */
export const TRADER_GAP_FIRST = 20;

/** ...and its jitter, so two arrivals in the same system are not the same arrival. */
export const TRADER_GAP_FIRST_JITTER = 40;

/**
 * The gap between pirate waves in the most organised system that still breeds
 * them, and the first wave's countdown when you arrive — one number: the first
 * wave is the ladder's bottom rung with no government term and no jitter.
 */
export const PIRATE_WAVE_GAP = 60;

/**
 * ...and how much longer the wait grows for every step up the government
 * ladder.
 *
 * Piracy pressure scales with lawlessness, so an anarchy (0) waits the base
 * alone and a corporate state waits nearly five minutes — by which point
 * `LAWLESS_GOVERNMENT` has refused the wave anyway. The ladder still runs the
 * whole way up because the timer is a clock not a gate: it keeps refused
 * systems from all coming due at once if that line ever moves.
 */
export const PIRATE_WAVE_GAP_PER_GOVERNMENT = 40;

/** ...and the jitter, wider than the trader lane's because an ambush should not be timeable. */
export const PIRATE_WAVE_GAP_JITTER = 90;

/**
 * Governments at or below this breed pirate waves at all.
 *
 * 3 is a dictatorship on the 1984 ladder, so waves stop at communist (4) and
 * above — the line between policed space and space where you are on your own,
 * the same line the player weighs when a rich cargo is only worth carrying
 * through an anarchy.
 */
export const LAWLESS_GOVERNMENT = 3;

/**
 * ...and governments at or below THIS send them two at a time: anarchy (0) and
 * feudal (1).
 *
 * Not the same rule as `policeFor`'s ladder (game/population.ts), which puts
 * the line between 0 and 1. The two lines are a step apart deliberately: a
 * feudal system has exactly one patrol and pairs of pirates, the most
 * dangerous place that still has a police force.
 */
export const ANARCHY_GOVERNMENT = 1;

/**
 * A commander closer than this to the station is not worth ambushing: the
 * station's Vipers start a fight the pirate cannot finish, and it keeps the
 * one place a player can catch their breath. Well outside the station's mass
 * lock (5,000, `torus.ts`), so the safe zone is bigger than the mass-lock zone.
 *
 * The same number as `npc.ts`'s 7,000 give-up range for NPC-on-NPC hunts,
 * which is a different rule.
 */
export const AMBUSH_STANDOFF = 7000;

/**
 * How many drones one Thargoid mothership keeps in the sky. The same number as
 * `MAX_TRADERS` and NOT the same rule — this is how much a single mothership
 * can put in front of you at once.
 */
export const MAX_THARGONS = 4;

/**
 * Seconds between one drone and the next, and the wait for the first.
 *
 * A mothership keeps deploying while it lives, so this is the pressure that
 * makes killing the mother the objective: at 5 seconds it replaces a drone
 * faster than most commanders kill one.
 */
export const THARGON_REDEPLOY = 5;
