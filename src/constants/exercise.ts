// The docked exercise: where a training fight opens, how it starts you, how
// long it may run, and the sky it empties first.
//
// The plans that spend the opening are `game/combat-sim-opening.ts` (per
// scenario, over `spawnOpposition`'s scatter — whose four spread fractions are
// ./opposition-ring.ts and are NOT overridable), and the exercise itself is
// `game/combat-sim.ts`.

import { PASS_FAR } from './combat-record.ts';

/**
 * The opening range for a fight you are meant to see coming. Every term is
 * load-bearing:
 *
 *  * **Outside their gun.** `NPC_LASER_RANGE` is 3,500 and a spawned ship is
 *    pointed at you, so anything closer than 3,500 / 0.85 = 4,118
 *    (`OPPOSITION_RING_NEAR` being the closest the scatter lands a ship) lets
 *    the nearest open fire on frame one — being shot before you see it.
 *  * **Inside their interest.** `PLAYER_INTEREST_RANGE` is 9,000 — beyond it an
 *    NPC does not care about you — so a longer opening buys a stare, not a run.
 *  * **Clear of the attack-run thresholds.** A pass is closing inside
 *    `PASS_CLOSE` and opening back past `PASS_FAR` (./combat-record.ts), so
 *    where a fight STARTS decides whether the first run is counted honestly.
 *    The nearest ship starts at 0.85 x 4,500 = 3,825, over six times `PASS_FAR`,
 *    so every run in the record is one somebody actually flew.
 *
 * At a quarter throttle (`ENTRY_THROTTLE`) against a pirate's speed this is ten
 * seconds of approach — the ten seconds the trainer exists to show.
 */
export const OPENING_RANGE = 4500;

/**
 * An ambush opens INSIDE their gun, because that is what an ambush is. Still
 * well clear of `PASS_FAR` (0.85 x 2,400 = 2,040), so even a fight that starts
 * behind you counts its attack runs from a clean standing start.
 */
export const AMBUSH_RANGE = 2400;

/**
 * No opening may be closer than this. Twice `PASS_FAR`, which after the
 * spawner's -15% scatter still leaves the nearest ship well outside it. Stated
 * as a rule because the coupling is invisible: a range picked for how a fight
 * FEELS would silently change what the attack-run count MEANS. `npm test`
 * holds every plan to it.
 */
export const MIN_OPENING_RANGE = 2 * PASS_FAR;

/**
 * The cone a visible opening is scattered through, half-angle in degrees. 8, so
 * the widest a ship lands is 1.45 x 8 = 11.6 degrees off the nose and the
 * nearest 4.4 — inside the canopy, off-centre enough that a gang is a spread
 * not a stack. (The 1.45 is `OPPOSITION_CONE_FAR`, the spawner's widest fraction.)
 */
export const OPENING_CONE_DEG = 8;

/** An ambush spreads wide behind you: 16 to 43 degrees off your tail. */
export const AMBUSH_CONE_DEG = 30;

/**
 * How far off the nose still counts as "the pilot can see it". The trainer's
 * own number, because the game has no notion of a canopy, only a camera: a
 * 60-degree vertical field of view (`engine/render-stack.ts`) has 30 degrees a
 * side, the console eats the bottom, so 20 is the arc a contact is genuinely IN.
 */
export const IN_VIEW_DEG = 20;

/** Where the exercise starts you, as a fraction of the ship's top speed. */
export const ENTRY_THROTTLE = 0.25;

/** Seconds a scenario exercise may run before it times out. */
export const SCENARIO_TIMEOUT = 120;

/**
 * How far out the encounter timers are pushed while an exercise runs.
 *
 * Without this `stepEncounters` keeps working — traders warp in, a lawless
 * system throws a pirate wave — and the arena fills with ships the scenario
 * never asked for. A big finite number rather than `Infinity`, because the
 * timers live in the SAVE and `JSON.stringify(Infinity)` is `null`.
 */
export const NO_AMBIENT_TRAFFIC = 1e9;
