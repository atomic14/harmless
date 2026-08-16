// The docked exercise: where a training fight opens, how it starts you, how long
// it may run, and the sky it empties first.
//
// The plans that spend the opening are `game/combat-sim-opening.ts`, one per
// scenario, over `spawnOpposition`'s scatter. That scatter's four spread
// fractions are ./opposition-ring.ts, and they are NOT overridable. The exercise
// itself is `game/combat-sim.ts`.

import { PASS_FAR } from './combat-record.ts';

/**
 * The opening range for a fight that you are meant to see coming. Every term is
 * load-bearing:
 *
 *  * **Outside their gun.** `NPC_LASER_RANGE` is 3,500, and a spawned ship is
 *    pointed at you. Anything closer than 3,500 / 0.85 = 4,118 therefore lets
 *    the nearest one open fire on frame one, which is to be shot before you see
 *    it. `OPPOSITION_RING_NEAR` is the closest that the scatter lands a ship.
 *  * **Inside their interest.** `PLAYER_INTEREST_RANGE` is 9,000, and beyond it
 *    an NPC does not care about you. A longer opening therefore buys a stare,
 *    not a run.
 *  * **Clear of the attack-run thresholds.** A pass closes inside `PASS_CLOSE`
 *    and opens back out past `PASS_FAR` (./combat-record.ts). Where a fight
 *    STARTS therefore decides whether the first run is counted honestly. The
 *    nearest ship starts at 0.85 x 4,500 = 3,825, which is over six times
 *    `PASS_FAR`. Every run in the record is one that somebody actually flew.
 *
 * At a quarter throttle (`ENTRY_THROTTLE`), against a pirate's speed, this is ten
 * seconds of approach. Those are the ten seconds the trainer exists to show.
 */
export const OPENING_RANGE = 4500;

/**
 * An ambush opens INSIDE their gun, because that is what an ambush is. It is
 * still well clear of `PASS_FAR` (0.85 x 2,400 = 2,040). Even a fight that starts
 * behind you therefore counts its attack runs from a clean standing start.
 */
export const AMBUSH_RANGE = 2400;

/**
 * No opening may be closer than this. It is twice `PASS_FAR`, which after the
 * spawner's -15% scatter still leaves the nearest ship well outside it. It is
 * stated as a rule because the coupling is invisible. A range picked for how a
 * fight FEELS would silently change what the attack-run count MEANS. `npm test`
 * holds every plan to it.
 */
export const MIN_OPENING_RANGE = 2 * PASS_FAR;

/**
 * The cone that a visible opening is scattered through, as a half-angle in
 * degrees. It is 8, so the widest a ship lands is 1.45 x 8 = 11.6 degrees off the
 * nose, and the nearest is 4.4. That is inside the canopy, and off-centre enough
 * that a gang is a spread rather than a stack. The 1.45 is
 * `OPPOSITION_CONE_FAR`, the spawner's widest fraction.
 */
export const OPENING_CONE_DEG = 8;

/**
 * An ambush spreads wide behind you: 16 to 43 degrees off your tail.
 *
 * It has its own rule id. It shares 30 with a hostile missile's lifetime in
 * seconds, and with the trade a galaxy is given before a career starts
 * (constants/living-galaxy.ts). A spread in degrees follows neither.
 *
 * @rule exercise.ambushCone
 */
export const AMBUSH_CONE_DEG = 30;

/**
 * How far off the nose still counts as "the pilot can see it". It is the
 * trainer's own number, because the game has no notion of a canopy, only a
 * camera. A 60-degree vertical field of view (`engine/render-stack.ts`) has 30
 * degrees a side, and the console eats the bottom. 20 is therefore the arc that a
 * contact is genuinely IN.
 */
export const IN_VIEW_DEG = 20;

/** Where the exercise starts you, as a fraction of the ship's top speed. */
export const ENTRY_THROTTLE = 0.25;

/** Seconds a scenario exercise may run before it times out. */
export const SCENARIO_TIMEOUT = 120;

/**
 * How far out the encounter timers are pushed while an exercise runs.
 *
 * Without this, `stepEncounters` keeps working. Traders warp in, a lawless system
 * throws a pirate wave, and the arena fills with ships that the scenario never
 * asked for. It is a big finite number rather than `Infinity`, because the timers
 * live in the SAVE, and `JSON.stringify(Infinity)` is `null`.
 */
export const NO_AMBIENT_TRAFFIC = 1e9;
