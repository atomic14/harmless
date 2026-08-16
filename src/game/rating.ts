// The combat ladder: what a commander's kills add up to being CALLED.
//
// A leaf but for the ladder itself, and that is deliberate. It imports only
// `constants/rating.ts`, which imports nothing. So a page that wants to print
// the ladder does not drag a commander, a galaxy and the whole Elite-A
// catalogue in behind it.
//
// That is not hypothetical. The manual page listed the nine ranks it could
// remember, and left BELOW AVERAGE out. So a commander could read her own
// rating off the status screen, and fail to find it on the chart.
//
// The page rendered from the table is the fix. It is the same bargain as the
// key tables (invariant 9). The page rendered from `commander.ts` puts 220 kB
// of ship data on a text page.
//
// It lived in commander.ts, which is about the SHAPE of a commander. What you
// are called is a pure function of one number and has nothing to do with that
// shape.

import { RATINGS } from '../constants/rating.ts';

/** What `combatScore` is called. */
export function rating(combatScore: number): string {
  let r = RATINGS[0][1];
  for (const [threshold, name] of RATINGS) {
    if (combatScore >= threshold) r = name;
  }
  return r;
}

/**
 * Every rank in order, lowest first — the ladder as a list.
 *
 * It exists because the ladder had a second and a third home. The manual page
 * printed it by hand. `test/campaign.ts` kept its own copy, to time the
 * climb. Both render from this now.
 */
export function ratingLadder(): readonly string[] {
  return RATINGS.map(([, name]) => name);
}
