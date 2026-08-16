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
