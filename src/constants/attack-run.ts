// The attack run, as ranges: how close a hostile gets before it turns away,
// how far it runs out, how slowly it flies to turn, and where a trained pilot
// hands over to the script. The phase machine that spends these is
// `game/break-off.ts`.

/**
 * A ship this close to what it is fighting stops closing and turns away.
 * A STEERING rule only — it keeps shooting.
 */
export const BREAK_OFF_RANGE = 220;

/**
 * Range at which a trained pilot stops flying its own policy and hands the ship
 * over to the scripted break-off — the policies were fitted without collisions
 * and otherwise close to zero range and ram.
 */
export const BRAIN_HANDOVER_RANGE = 150;

/**
 * The band a ship's own turn-back range is rolled from, each time it extends.
 * A band, and rolled per extend, so a gang does not turn as one metronomic wave.
 */
export const EXTEND_RANGE_MIN = 500;
export const EXTEND_RANGE_MAX = 850;

/** Default turn-back range for a caller that has not rolled one — mid-band. */
export const EXTEND_RANGE = (EXTEND_RANGE_MIN + EXTEND_RANGE_MAX) / 2;

/**
 * How long a ship keeps flying evasively after the last hit. A decay, not a
 * latch: it goes back to fighting once you stop landing them.
 */
export const UNDER_FIRE_SECONDS = 1.2;

/**
 * The slowest an attacking ship throttles back to in order to turn. Two literals
 * on purpose: kept just above `MIN_CRUISE_FRACTION` so the flying rule and the
 * backstop never argue, and an expression would drag one when the other moves.
 */
export const CLOSING_THROTTLE_MIN = 0.45;

/**
 * Hostiles cannot throttle below this fraction of their top speed — a fighter
 * that can stop dead becomes a turret. Traders and haulers may come to rest.
 * Pinned by the brains too: `pirate-attack-g3` was fitted where stopping does
 * not exist.
 */
export const MIN_CRUISE_FRACTION = 0.43;
