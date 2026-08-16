// Who is worth robbing: the threat model.
//
// This lived in contracts.ts, which is about the jobs you take on. A pirate who
// sizes you up is not a contract. It is the other half of the economy, and the
// file that owns it should say so in its name. `npm run campaign` tunes against
// these numbers, and a balance change touches these ones.
//
import { COMMODITIES, type StarSystem } from '../galaxy/galaxy.ts';
import { isContraband } from './law.ts';
import { random } from './rng.ts';
import { npcCombatProfileById, type NpcCombatProfileId } from './ship-identity.ts';
import {
  CHALLENGE_RATE, COURTESY_RATE, CURATED_TIER, DEFENCE_WEIGHT, DISREPUTE_DRAW,
  DISREPUTE_FULL, DISREPUTE_HEAT, FAME_FULL, GANG_SCORE, LASER_WEIGHT,
  PRIZE_SATURATION, PROFESSIONAL_SCORE,
} from '../constants/threat.ts';
import { HOLD_TONNES, LARGE_BAY_TONNES } from '../constants/commander.ts';
import { VALUE_PER_TONNE } from '../constants/jettison.ts';

// --- who's worth robbing ----------------------------------------------------
//
// Pirates are businesses. They weigh what you're visibly carrying against what
// you'd visibly cost them, and a poor Cobra full of food is not worth three
// Fer-de-Lances. Two rules keep this from becoming rubber-banding:
//
//   1. Only things a pirate can SEE count. Those are the cargo (they scan, as
//      police do), the hold size, the fitted laser and the reputation. Never
//      your bank balance. A commander who banks the money and flies clean is
//      genuinely a poor target, and that should be a real strategy.
//   2. Threat grows SUB-LINEARLY with the prize. Across a career the player's
//      combat power grows maybe tenfold; this should grow two- or threefold,
//      so upgrades are felt rather than cancelled out.

/** Everything a pirate can observe about you. */
export interface Mark {
  /** what a cargo scanner reads, in tenths of a credit */
  cargoValue: number;
  /** tonnes of contraband aboard */
  contraband: number;
  /** hold capacity — a big bay looks like a fat prize even when empty */
  capacity: number;
  /** combat fame — your kills arrive before you do */
  combatScore: number;
  laser: 'pulse' | 'beam' | 'military';
  /** 0..1 regional heat from your recent big or dirty sales nearby */
  notoriety: number;
  /**
   * Your CHARACTER, raw off the commander (game/character.ts) — the galaxy's
   * memory of what you are, where `notoriety` is one region's memory of what
   * you just did. Raw like `combatScore` and for the same reason: what a pirate
   * observes is a fact. The curve over it (`DISREPUTE_FULL`) is policy, and it
   * belongs in `pirateThreat` with the rest of the policy.
   */
  disrepute: number;
}

/** Read a commander the way a pirate's scanner would. */
export function markOf(
  c: {
    cargo: number[];
    kills: number;
    combatScore?: number;
    disrepute?: number;
    equipment: { laser: string; largeBay: boolean };
  },
  notoriety = 0,
): Mark {
  let cargoValue = 0;
  let contraband = 0;
  for (let i = 0; i < c.cargo.length && i < COMMODITIES.length; i++) {
    const q = c.cargo[i];
    if (!q) continue;
    // VALUE_PER_TONNE is the same rule the jettison toll prices cargo by —
    // the scanner and the ransom must agree about what a hold is worth
    cargoValue += q * COMMODITIES[i].basePrice * VALUE_PER_TONNE;
    if (isContraband(i)) contraband += q;
  }
  return {
    cargoValue,
    contraband,
    capacity: c.equipment.largeBay ? LARGE_BAY_TONNES : HOLD_TONNES,
    combatScore: c.combatScore ?? c.kills,
    laser: (c.equipment.laser as Mark['laser']) ?? 'pulse',
    notoriety,
    // Read off the CAREER commander the caller handed us. That is why the
    // trainer needs no knob for it: `ThreatContext` already carries the real
    // commander. So "as they come" sizes its reception against your real
    // standing, while the clone still flies with no cargo and no reputation.
    disrepute: c.disrepute ?? 0,
  };
}

/**
 * Which tier of hull the Nth member of a group flies.
 *
 * A gang is not five Fer-de-Lances. It is one or two ringleaders who decided
 * you were worth the trouble, plus hangers-on in whatever they could afford.
 * That is more believable, and it is what lets a gang be *common* rather than
 * an overwhelming rarity.
 *
 * It lives here rather than in npc.ts, so the campaign simulator resolves each
 * attacker at the strength the game spawns it at. The hulls belong to npc.ts,
 * and the rule belongs here.
 */
export function memberTier(groupTier: number, memberIndex: number): number {
  const leaders = groupTier >= 2 ? 2 : 1;
  return memberIndex < leaders ? groupTier : Math.max(0, groupTier - 1);
}

// --- which tier a HULL belongs to -------------------------------------------
//
// Threat tiers are a Harmless invention. The source has one pirate band. The
// split into opportunists, professionals and an organised gang is our selection
// policy rather than a recovered rule.
//
// What is NOT ours is how tough each hull is. The tiers used to be three
// hand-written lists that said so again in their own words. So the lists are
// gone, and the tier is read off three NAMED source fields instead. A hull moves
// tier when the pack says it is tougher, and never because somebody retyped a
// table.

/** The threat score of an exact released build. Exported for the tests. */
export function sourceThreatScore(profileId: NpcCombatProfileId): number {
  const record = npcCombatProfileById(profileId);
  if (record.source !== 'elite-a') return 0;
  const p = record.profile;
  return p.maxEnergy + p.perHitDefence * DEFENCE_WEIGHT + p.laserPower * LASER_WEIGHT;
}

/**
 * The tier ladder over a bare score — the two thresholds and nothing else.
 *
 * It is its own function so the thresholds can be measured rather than
 * transcribed. `test/ship-roles.test.ts` bisects both steps out of it, then
 * compares them to `PROFESSIONAL_SCORE` and `GANG_SCORE`. A check that probed
 * the constants themselves could never fail.
 */
export function tierForScore(score: number): 0 | 1 | 2 {
  return score >= GANG_SCORE ? 2 : score >= PROFESSIONAL_SCORE ? 1 : 0;
}

/**
 * Which tier a hull flies in, from what the pack says it is.
 *
 * `designId` is consulted only for the curated exception (`CURATED_TIER`,
 * constants/threat.ts). Everything else comes off the exact build's own combat
 * fields.
 */
export function hullThreatTier(
  designId: string, profileId: NpcCombatProfileId,
): 0 | 1 | 2 {
  const curated = CURATED_TIER[designId];
  if (curated !== undefined) return curated;
  return tierForScore(sourceThreatScore(profileId));
}

export interface PirateThreat {
  count: number;
  /**
   * 0 opportunists · 1 professionals · 2 an organised gang.
   *
   * WHICH hulls land in each is `hullThreatTier` over the pirate roster, and
   * never a list here. It moved when the pirate build moved. The Krait was a
   * tier-0 opportunist against the recommended default. It is a professional in
   * the `W:19` build it flies.
   */
  tier: 0 | 1 | 2;
  /** flies the coordinated pack policy and presses the attack */
  organised: boolean;
  /** 0..1 how attractive you looked — exposed for tuning and tests */
  appeal: number;
  /**
   * 0..1 how much of this reception came for your REPUTATION rather than for
   * your hold. It holds combat fame and a criminal reputation together, because
   * both are reasons to come for the pilot instead of the cargo. It is combat
   * fame alone wherever `disrepute` is 0, which is every lawful commander.
   */
  fame: number;
  /** true when this lot came looking for you specifically, not for your cargo */
  challenged: boolean;
  /**
   * True when somebody recognised the commander and called off a reception that
   * would otherwise form (`COURTESY_RATE`). `count` is then 0, and the tier is
   * meaningless. The Game says so on arrival, because an ambush the player never
   * hears about is a mechanic that does not exist.
   */
  passed: boolean;
}

/**
 * What waits for you on the way in.
 *
 * `place` is the old rule: the lawlessness, plus whatever the living galaxy saw
 * happen here lately. The mark decides the *quality* of the reception more than
 * the quantity.
 */
export function pirateThreat(
  sys: StarSystem,
  danger: number,
  mark: Mark,
  rng: () => number = random,
): PirateThreat {
  const place = (7 - sys.government) / 2 + danger * 3;

  // Saturating: the gap between 200 and 2,000 credits of cargo matters; the
  // gap between 20,000 and 40,000 does not.
  const prize = Math.min(1, mark.cargoValue / PRIZE_SATURATION)
    + Math.min(0.25, mark.contraband * 0.05)
    + (mark.capacity > HOLD_TONNES ? 0.1 : 0);

  // What you look like you'd cost them.
  const deter = Math.min(0.5, mark.combatScore / 150)
    + (mark.laser === 'military' ? 0.3 : mark.laser === 'beam' ? 0.12 : 0);

  // How visibly KNOWN you are: this region's memory of your last big or dirty
  // sale, plus the galaxy's memory of your reputation. One channel, because to
  // a pirate they are one fact. A fourth independent term would also stop this
  // from being a model of how you are SEEN, and start it being a list.
  const infamy = Math.min(1, mark.disrepute / DISREPUTE_FULL);
  const known = Math.min(1, mark.notoriety + DISREPUTE_HEAT * infamy);

  // Deterrence is weighted heavily: looking dangerous is the main lever the
  // player has against this system, and it should visibly work.
  const appeal = Math.max(0, Math.min(1, prize - 0.7 * deter + 0.6 * known));

  // ...but fame cuts both ways. A reputation scares off thieves looking for
  // easy cargo, and simultaneously draws people who want to be the ones who
  // killed you. That draw is an *occasional challenge* rather than a permanent
  // tax. Fame folded straight into the tier made 99% of receptions gangs once a
  // commander reached Dangerous. That is monotonous, and it erases the whole
  // ladder. Instead it rolls — at Dangerous, about a third of receptions are
  // someone coming for the reputation rather than the cargo.
  const fame = Math.max(0, Math.min(1, mark.combatScore / FAME_FULL));
  // A criminal reputation draws them for the other reason: not the kill, the fact
  // that robbing you carries no consequence anyone will chase.
  const renown = Math.min(1, fame + DISREPUTE_DRAW * infamy);
  const challenged = rng() < CHALLENGE_RATE * renown;

  // ...and cuts the other way too. Professional courtesy: occasionally someone
  // recognises the commander and calls the whole thing off. It is rolled only
  // where there IS a reputation. So an honest commander takes exactly the draws
  // off the world stream that they always took. Every seeded outcome after it
  // stands (invariant 11).
  const passed = infamy > 0 && !challenged && rng() < COURTESY_RATE * infamy;

  const draw = challenged ? 1 : appeal;

  // Sub-linear: a fat commander draws about one extra attacker, not five.
  // Reputation adds its own challengers on top. It is `renown` rather than
  // `fame`, so a reception summoned by your reputation arrives with bodies in
  // it.
  const count = Math.max(0, Math.round(place + appeal * 1.5 + renown * 1.2 + rng() * 2 - 1));
  // Thresholds, not the prize curve, set how often each tier appears — keeping
  // saturation high preserves the gap between a good load and a fat one.
  const tier: 0 | 1 | 2 = draw < 0.28 ? 0 : draw < 0.5 ? 1 : 2;
  // A gang needs both a reason and the numbers to bother forming.
  const organised = tier === 2 && count >= 3 && rng() < 0.4 + 0.5 * draw;
  // A reception that was called off is no reception: the numbers above are
  // still computed so the draw order does not depend on the outcome.
  return {
    count: passed ? 0 : count,
    tier: passed ? 0 : tier,
    organised: !passed && organised,
    appeal,
    fame: renown,
    challenged,
    passed,
  };
}
