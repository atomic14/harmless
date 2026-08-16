// The combat ladder: what a commander's combat score adds up to being CALLED.
//
// It is the 1984 ladder, with Below Average in the place the original had it.
// That makes ten rungs, not nine. The functions that read it (`rating`,
// `ratingLadder`) are in game/rating.ts. The manual renders the chart from the
// same table. That is the fix for the day the manual listed the nine ranks it
// could remember. A commander could read her own rating off the status screen,
// and then fail to find it on the chart.
//
// The score that climbs the ladder is `combatScore`: kills weighted by threat
// tier (`killValue` in game/commander.ts). It is a deliberate deviation from
// the original's flat body count. So the fastest route to E L I T E is not a
// farm of the weakest thing you can find.

/**
 * Score thresholds and the name that each one earns, lowest first.
 *
 * The Dangerous rung doubles as the threat model's fame saturation.
 * `threat.ts`'s `FAME_FULL` is an expression over this table. "Your name fully
 * precedes you" and "the ladder calls you Dangerous" therefore cannot drift
 * apart. `test/economy.test.ts` still bisects both out of the real functions.
 */
export const RATINGS: readonly (readonly [number, string])[] = [
  [0, 'Harmless'],
  [8, 'Mostly Harmless'],
  [16, 'Poor'],
  [32, 'Below Average'],
  [64, 'Average'],
  [128, 'Above Average'],
  [512, 'Competent'],
  [2560, 'Dangerous'],
  [6400, 'Deadly'],
  [25600, 'E L I T E'],
];
