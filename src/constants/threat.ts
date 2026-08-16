// Who is worth a raid, as numbers. Three questions live here:
//
//   1. what makes a commander look like a prize;
//   2. what makes one look like trouble;
//   3. which tier of hull comes to collect.
//
// `pirateThreat`, `sourceThreatScore` and `hullThreatTier` in game/threat.ts
// spend these. `npm run campaign`'s 33 balance rows are the measurement that a
// change here has to answer to.

import { RATINGS } from './rating.ts';
import { CHARACTER } from './character.ts';
import { SALE_NOTORIETY_MAX } from './market.ts';

/**
 * The combat score at which fame is fully "worth coming for". It is the rating
 * ladder's Dangerous rung, so a move to the rung moves the fame curve with it. It
 * is an expression, not a literal, to keep the one home in constants/rating.ts.
 */
export const FAME_FULL = RATINGS.find(([, name]) => name === 'Dangerous')![0];

/**
 * The share of receptions that are challengers, at full fame. It is an occasional
 * challenge, not a permanent tax. A fold of fame straight into the tier made
 * about 99% of receptions gangs at Dangerous, and it erased the tier ladder.
 *
 * It has its own rule id. It shares the value 0.35 with two steering angles, a
 * lane alpha, a spawn chance and the docking follower's lookahead. Six unrelated
 * 0.35s, and this is the only one that is a share of a population.
 *
 * @rule threat.challengeRate
 */
export const CHALLENGE_RATE = 0.35;

/**
 * The disrepute at which your CHARACTER is as bad as it needs to get for a
 * pirate. It is the character ladder's Notorious rung, so a move to the rung
 * moves this with it. It is an expression rather than a typed number: the same
 * trick, and the same reason, as `FAME_FULL` above. The one home for the ladder
 * stays constants/character.ts.
 *
 * It is Notorious rather than the ceiling (`DISREPUTE_MAX`, a little past
 * Cutthroat). A pirate does not grade you finely at the top end. One hermit
 * kill puts you halfway up this curve, and two put you at the top. That is the
 * resolution the reception really needs (docs/TODO/96).
 *
 * What the saturated curve is then WORTH is the two weights below: as regional
 * heat, and as a draw.
 */
export const DISREPUTE_FULL = CHARACTER.find(([, name]) => name === 'Notorious')![0];

/**
 * What a fully notorious name is worth as HEAT. It is the same channel that a
 * region's memory of your last big sale feeds (`Mark.notoriety`). To a pirate
 * the two are the same fact: how visibly known you are.
 *
 * Compare two pilots. A Notorious one flies clean through a quiet system. An
 * honest one just sold a fat cargo here. Each is about as much of a draw as the
 * other. It folds in, rather
 * than adds a fourth independent term. The plan records that decision: one
 * "how you are seen" model, not two.
 *
 * **EXPRESSED, NOT TYPED** (docs/TODO/132). That sentence names a number the
 * game already has. `SALE_NOTORIETY_MAX` is the most a sale can put on this
 * exact channel. So "as much of a draw as the fattest sale" IS that constant,
 * and `infamy` is already normalised to 1 at Notorious.
 *
 * Written out as 0.5, the two were free to drift, and the reasoning above would
 * quietly become false. It is the same trick as `FAME_FULL` and
 * `DISREPUTE_FULL` beside it. 96 shipped this as a start value nobody flew, and
 * there is nothing left to fly. It is not a knob. It is an equivalence.
 *
 * The owner is confirmed as the threat model rather than character.ts. The ladder
 * and what moves a commander up it belong there. What a rung is WORTH to a pirate
 * who sizes up a reception is this file's business, beside the fame weight it
 * sits next to.
 */
export const DISREPUTE_HEAT = SALE_NOTORIETY_MAX;

/**
 * How much a criminal name draws challengers, against combat fame's 1. It is
 * half. People come for a Dangerous commander because a kill is worth something,
 * and for a Cutthroat because a robbery is safe. The second is a real draw, and
 * the weaker one.
 *
 * It has its own rule id, for the reason given on `DISREPUTE_HEAT` above. It is
 * the same value against a different question, and the two must stay free to
 * move apart.
 *
 * @rule threat.disreputeDraw
 */
export const DISREPUTE_DRAW = 0.5;

/**
 * Professional courtesy: the share of receptions that never form at all,
 * because somebody recognised a commander they would rather not cross. It is
 * the carrot half of a criminal reputation.
 *
 * It is also the reason infamy is NOT folded into `deter` as well. A term in
 * appeal and a term in deterrence would partly cancel into one coefficient.
 * That is the same rule written twice.
 *
 * This is a distinct event with a distinct texture. More of them want you, and
 * occasionally one calls it off.
 *
 * It is rolled only when there is a name to recognise. An honest commander
 * therefore draws exactly the numbers off the world stream that they drew before
 * this existed (invariant 11).
 */
export const COURTESY_RATE = 0.15;

/**
 * The cargo value at which the prize term saturates, in tenths of a credit:
 * 25,000, which is 2,500 Cr. It saturates high, which preserves the gap between a
 * good load and a fat one. The tier thresholds set gang frequency, and the prize
 * curve does not.
 */
export const PRIZE_SATURATION = 25000;

/**
 * The weights on the three fields of `sourceThreatScore`:
 *
 *   1. how much fire a hull survives (`maxEnergy`, weight 1, the base);
 *   2. how much of each hit it shrugs off (`perHitDefence`, a subtraction);
 *   3. how hard it hits back (`laserPower`).
 *
 * Speed is deliberately absent: a fast hull is harder to catch,
 * not harder to beat. The weights are Harmless's. The numbers they multiply are
 * the source's.
 */
export const DEFENCE_WEIGHT = 12;
export const LASER_WEIGHT = 8;

/**
 * The tier ladder over `sourceThreatScore`. Below PROFESSIONAL_SCORE a hull is an
 * opportunist's. At it, a professional's. At GANG_SCORE, a gang ringleader's.
 */
export const PROFESSIONAL_SCORE = 110;
export const GANG_SCORE = 160;

/** The ladder's top rung. Threat tiers run 0..MAX_TIER everywhere a tier is a
 *  number: `PirateThreat.tier`, `memberTier`, the trainer and the wave ramp. */
export const MAX_TIER = 2;

/**
 * Hulls held at a tier that the score alone would not give them. There is one
 * curated exception. The Sidewinder and Krait pirate builds are identical in
 * every scored field: energy 82, defence 2, laser 5, score 146. So no
 * classifier can separate them. The Sidewinder is the opportunist's hull, and
 * the Krait is what turns up when somebody means it. It is keyed on the design-id
 * string that `hullThreatTier` is handed. `test/ship-roles.test.ts` pins it.
 */
export const CURATED_TIER: Record<string, 0 | 1 | 2> = {
  'elite-a:design:17': 0, // Sidewinder — see above
};
