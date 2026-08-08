// Who is worth robbing, as numbers: what makes a commander look like a prize,
// what makes one look like trouble, and which tier of hull comes to collect.
// Spent by `pirateThreat`, `sourceThreatScore` and `hullThreatTier` in
// game/threat.ts; `npm run campaign`'s 33 balance rows are the measurement a
// change here has to answer to.

import { RATINGS } from './rating.ts';

/**
 * Combat score at which fame is fully "worth coming for" — the rating ladder's
 * Dangerous rung, so moving the rung moves the fame curve with it. Expressed,
 * not a literal, to keep the one home in constants/rating.ts.
 */
export const FAME_FULL = RATINGS.find(([, name]) => name === 'Dangerous')![0];

/**
 * Share of receptions that are challengers, at full fame. An occasional
 * challenge, not a permanent tax — folding fame straight into the tier made
 * ~99% of receptions gangs at Dangerous and erased the tier ladder.
 */
export const CHALLENGE_RATE = 0.35;

/**
 * Cargo value, in tenths of a credit, at which the prize term saturates
 * (25,000 = 2,500 Cr). Saturating high preserves the gap between a good load
 * and a fat one; the tier thresholds, not the prize curve, set gang frequency.
 */
export const PRIZE_SATURATION = 25000;

/**
 * Weights on the three fields of `sourceThreatScore`: how much shooting a hull
 * survives (`maxEnergy`, weight 1, the base), how much of each hit it shrugs
 * off (`perHitDefence`, a subtraction) and how hard it hits back (`laserPower`).
 * Speed is deliberately absent: a fast hull is harder to catch, not to beat.
 * Weights are Harmless's; the numbers they multiply are the source's.
 */
export const DEFENCE_WEIGHT = 12;
export const LASER_WEIGHT = 8;

/**
 * The tier ladder over `sourceThreatScore`: below PROFESSIONAL_SCORE a hull is
 * an opportunist's, at it a professional's, at GANG_SCORE a gang ringleader's.
 */
export const PROFESSIONAL_SCORE = 110;
export const GANG_SCORE = 160;

/** The ladder's top rung: threat tiers run 0..MAX_TIER everywhere a tier is a
 *  number — `PirateThreat.tier`, `memberTier`, the trainer and the wave ramp. */
export const MAX_TIER = 2;

/**
 * Hulls held at a tier the score alone would not give them. One curated
 * exception: the Sidewinder and Krait pirate builds are identical in every
 * scored field (energy 82, defence 2, laser 5, score 146), so no classifier can
 * separate them — but the Sidewinder is the opportunist's hull and the Krait is
 * what turns up when someone means it. Keyed on the design-id string
 * `hullThreatTier` is handed; `test/ship-roles.test.ts` pins it.
 */
export const CURATED_TIER: Record<string, 0 | 1 | 2> = {
  'elite-a:design:17': 0, // Sidewinder — see above
};
