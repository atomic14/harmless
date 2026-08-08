// The jump, as numbers: the warning before the drive engages, what a jump costs
// in days, what it costs to climb back out of a mis-jump, and how often one
// happens. Spent by game/hyperspace.ts. A jump's FARE is the chart distance in
// tenths of a light year (`chart-metric.ts`), which is also what the fuel gauge
// holds, so there is no fuel-per-light-year constant and there must not be one.

/**
 * Seconds of warning before the drive engages.
 *
 * `audio.ts`'s countdown blip is pitched at `700 + (COUNTDOWN - n) * 100`, so
 * the first blip is 700 Hz whatever this is and each second climbs 100 Hz;
 * `test/audio.test.ts` asserts the climb, so the pitch tracks this value.
 */
export const COUNTDOWN = 5;

/**
 * A jump takes this many days, plus one more per `TENTHS_PER_JUMP_DAY`.
 *
 * The base day is the jump itself — even the shortest hop puts a day on the
 * calendar, which is what makes contract deadlines bite on a chain of short legs.
 */
export const JUMP_DAYS_BASE = 1;

/**
 * ...and that "one more per": 20 tenths, which is 2.0 light years a day.
 *
 * A CEILING, not a rate — `daysForJump` (in galaxy/navigation.ts, the one home
 * for the arithmetic) rounds up — so 2.1 LY costs the same as 4.0.
 */
export const TENTHS_PER_JUMP_DAY = 20;

/**
 * Flat fuel cost, in tenths of a LY, of escaping a mis-jump.
 *
 * Flat because witch-space is nowhere: there is no chart distance from it, so the
 * fare cannot be the metric's. It is ALSO what "enough fuel to jump clear" means
 * in the two places that decide whether you are stranded — the distress beacon is
 * offered below it and a rescue tops the tank up TO it — so all three move together.
 */
export const WITCHSPACE_ESCAPE_COST = 10;

/**
 * Chance a jump drops you into witch-space instead of at your destination.
 *
 * The original's cruelty, kept: the fare is charged either way, so a mis-jump
 * costs the fuel and leaves you nowhere.
 */
export const MISJUMP_CHANCE = 0.09;

/**
 * ...and the raised chance while carrying the Constrictor plans (mission stage
 * 3, per `game/missions.ts`). The ambush is the point of that leg, so it should
 * not depend on luck alone.
 */
export const MISJUMP_CHANCE_PLANS = 0.22;
