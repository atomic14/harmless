// The jump, as numbers. Four of them:
//
//   1. the warning before the drive engages;
//   2. what a jump costs in days;
//   3. what an escape from a mis-jump costs;
//   4. how often one happens.
//
// game/hyperspace.ts spends these.
//
// A jump's FARE is the chart distance
// in tenths of a light year (`chart-metric.ts`), which is also what the fuel
// gauge holds. There is therefore no fuel-per-light-year constant, and there must
// not be one.

/**
 * Seconds of warning before the drive engages.
 *
 * `audio.ts`'s countdown blip is pitched at `700 + (COUNTDOWN - n) * 100`. The
 * first blip is therefore 700 Hz whatever this is, and each second climbs 100 Hz.
 * `test/audio.test.ts` asserts the climb, so the pitch tracks this value.
 *
 * It has its own rule id. It is a duration in SECONDS, and the other constants
 * at 5 are counts, a ratio and a rate.
 *
 * @rule jump.countdown
 */
export const COUNTDOWN = 5;

/**
 * A jump takes this many days, plus one more per `TENTHS_PER_JUMP_DAY`.
 *
 * The base day is the jump itself. Even the shortest hop puts a day on the
 * calendar, which is what makes a contract deadline bite on a chain of short
 * legs.
 *
 * It has its own rule id. It is a count of DAYS on the calendar, and it moves
 * with what a jump should cost a contract deadline.
 *
 * @rule jump.daysBase
 */
export const JUMP_DAYS_BASE = 1;

/**
 * ...and that "one more per": 20 tenths, which is 2.0 light years a day.
 *
 * It is a CEILING, not a rate, because `daysForJump` rounds up. That function is
 * in galaxy/navigation.ts, the one home for the arithmetic. 2.1 LY therefore
 * costs the same as 4.0.
 */
export const TENTHS_PER_JUMP_DAY = 20;

/**
 * Flat fuel cost of an escape from a mis-jump, in tenths of a LY.
 *
 * It is flat because witch-space is nowhere. There is no chart distance from it,
 * so the fare cannot be the metric's.
 *
 * It is ALSO what "enough fuel to jump clear" means, in the two places that
 * decide whether you are stranded. The distress beacon is offered below it, and
 * a rescue tops the tank up TO it. So all three move together.
 */
export const WITCHSPACE_ESCAPE_COST = 10;

/**
 * The chance that a jump drops you into witch-space instead of at your
 * destination.
 *
 * It is the original's cruelty, kept. The fare is charged either way, so a
 * mis-jump costs the fuel and leaves you nowhere.
 */
export const MISJUMP_CHANCE = 0.09;

/**
 * ...and the raised chance while you carry the Constrictor plans (mission stage
 * 3, per `game/missions.ts`). The ambush is the point of that leg, so it should
 * not depend on luck alone.
 */
export const MISJUMP_CHANCE_PLANS = 0.22;
