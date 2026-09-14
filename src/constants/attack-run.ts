// The attack run, as ranges:
//
//   1. how close a hostile gets before it turns away;
//   2. how far it runs out;
//   3. how slowly it flies in order to turn.
//
// The phase machine that spends these is `game/break-off.ts`.
//
// There is no brain-handover range here any more. `BRAIN_HANDOVER_RANGE` (150)
// was the distance at which a trained pirate stopped to fly its policy, and gave
// the ship to the scripted run. Its only reader was `pirateBrainFor`, which went
// with the trained pirate policies on 2026-08-05. No shipped pilot hands over
// now. It named a rule that nothing executed, so docs/TODO/119 deleted it.
// The alternative was a catalogue that asserts a handover the game never makes.

/**
 * A ship this close to what it fights stops the closure and turns away.
 * It is a STEERING rule only: the ship keeps shooting.
 */
export const BREAK_OFF_RANGE = 220;

/**
 * The band that a ship's own turn-back range is rolled from, each time it
 * extends. It is a band, and it is rolled per extend, so a gang does not turn as
 * one metronomic wave.
 */
export const EXTEND_RANGE_MIN = 500;
export const EXTEND_RANGE_MAX = 850;

/** Default turn-back range for a caller that rolled none — mid-band. */
export const EXTEND_RANGE = (EXTEND_RANGE_MIN + EXTEND_RANGE_MAX) / 2;

/**
 * How long a ship keeps to evasive flight after the last hit. It is a decay, not
 * a latch: the ship goes back to the fight once you stop landing them.
 */
export const UNDER_FIRE_SECONDS = 1.2;

/**
 * How long a trader keeps to its run after the last hit it took: twenty
 * seconds. After that, with no live attacker, it goes back to work.
 *
 * A trader that took a hit ran for the rest of its life until docs/TODO/213
 * M1. An escort's charge that a pirate grazed then flew from the station
 * for ever. So did one that the commander's own course bumped. The escort
 * could not end. The clock is the same shape as `UNDER_FIRE_SECONDS`: a decay from
 * the last hit, not a latch. It is much longer, because a trader that turns
 * back into a fight it just fled is a trader that dies. Twenty seconds is a
 * pirate wave's approach, so a wave that is still there keeps it running.
 *
 * @rule trader.calmSeconds
 */
export const TRADER_CALM_SECONDS = 20;

/**
 * The fraction of its energy under which a hunt's target runs for the edge
 * of the system: a quarter (docs/TODO/214 M4). A ship that ran at half would
 * leave most fights. A ship that ran at a tenth would die in the turn. So
 * the commander sees a fight, and then a chase, and the chase is short.
 *
 * It is the target's rule alone. A trader runs on the first hit, and it
 * comes back to work once calm (`TRADER_CALM_SECONDS`). A wingman fights to
 * the end. The world step stamps `canFlee` on the target of a hunt that
 * `canEscape`, and `NpcShip.takeDamage` reads the fraction. The Constrictor
 * cannot escape, so it never runs.
 *
 * @domain attack-run
 * @rule hunt.fleeFraction
 */
export const HUNT_FLEE_FRACTION = 0.25;

/**
 * The slowest that an attacking ship throttles back to in order to turn. There
 * are two literals on purpose. This one sits just above `MIN_CRUISE_FRACTION`, so
 * the flying rule and the backstop never argue. An expression would drag one when
 * the other moves.
 */
export const CLOSING_THROTTLE_MIN = 0.45;

/**
 * A hostile cannot throttle below this fraction of its top speed. A fighter that
 * can stop dead becomes a turret. A trader and a hauler may come to rest. The
 * brains pin it too: `pirate-attack-g3` was fitted where a stop does not exist.
 */
export const MIN_CRUISE_FRACTION = 0.43;
