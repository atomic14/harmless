// An NPC's energy bank: how big it is, what a player laser is worth against
// it, and how it comes back.
//
// The arithmetic is `elite-a/combat-math.ts` and this file must never restate a
// line of it. What this owns is the step between an id and that arithmetic, and
// three decisions kept out of the call sites:
//
//   1. IMMUNITY AND THE CONSTRICTOR ARE THE TARGET'S OWN PROPERTIES. A station
//      shrugs off a laser. The Constrictor halves one BEFORE defence. Both
//      arrive as fields of the profile, so `Combat.fire` never learns which
//      ship is in front of it.
//   2. REGENERATION IS A PROPERTY OF THE DESIGN, not of the frame rate. It
//      accumulates as whole sub-ticks (see ELITE_A_REGEN_TICKS_PER_SECOND). So
//      the same elapsed time gives the same points at any Hz, and a paused tab
//      buys no catch-up burst.
//   3. WHAT ONE SHIP'S GUN IS WORTH AGAINST ANOTHER'S BANK —
//      `npcCrossfireDamage`. The pack does not tabulate this direction, so it
//      is composed from the two source rules that do apply.
//
// Energy is an INTEGER count of source points, and a BRANDED one
// (damage-units.ts) so a number from any other scale cannot be spent as one.
// Every non-laser source — a ram, a warhead, the energy bomb — is
// `constants/impact.ts`, which states its numbers in these same points. There is
// no conversion function here and there must never be one.

import {
  eliteADamageToNpc, eliteAEnergyAfterDamage, eliteAIsDestroyed, eliteANpcDefence,
  eliteANpcLaserStrength, eliteARegenerate, ELITE_A_DEFAULT_REGEN_PER_SECOND,
  type EliteALaserTarget, type EliteARegenState,
} from './elite-a/combat-math.ts';
import { npcEnergyPoints, type NpcEnergyPoints } from './damage-units.ts';
import { recommendedNpcProfile } from './elite-a/catalogue.ts';
import {
  HARMLESS_OVERLAYS, npcCombatProfileById, type NpcCombatProfileId,
} from './ship-identity.ts';

/**
 * Everything live combat needs to know about one ship's bank.
 *
 * `EliteALaserTarget` is the structural half the pure rule reads; the rate is
 * ours to supply because WHICH ships recover is a roster question.
 */
export interface NpcEnergyPolicy extends EliteALaserTarget {
  readonly maxEnergy: number;
  readonly laserImmune: boolean;
  readonly playerLaserMultiplier: number;
  /** Energy points a second. 0 for stations, missiles, cargo and rocks. */
  readonly regenPerSecond: number;
}

/**
 * The designs the fidelity contract says do not recover: "stations, missiles,
 * cargo and rocks".
 *
 * They are written as the pack's own design ids, so that the phrase lands on
 * something checkable:
 *
 *   - the stations, 0-1;
 *   - the escape pod, the alloy plate and the canister, 2-4;
 *   - the three rocks, 5-7;
 *   - the common missile, 15.
 *
 * Everything else is an AI ship with a generator that runs.
 */
const NON_REGENERATING_DESIGNS: ReadonlySet<number> =
  new Set([0, 1, 2, 3, 4, 5, 6, 7, 15]);

/**
 * The Cobra Mk III's design id, and the bank every Harmless impact number is
 * anchored on (`constants/impact.ts`). `SOURCE_DESIGN.cobraMk3` in ship-specs.ts is
 * the same number; `test/damage-paths.test.ts` holds the two together by name
 * and re-derives the anchor from the catalogue.
 */
export const COBRA_MK_3_DESIGN = 10;

/** The representative NPC's released bank — 98 points. */
export const ANCHOR_NPC_MAX_ENERGY =
  recommendedNpcProfile(COBRA_MK_3_DESIGN).maxEnergy;

// --- the two Harmless inventions --------------------------------------------

/**
 * Explicit policy for the ships the pack has no record of.
 *
 * They are OURS, and every claim of source parity excludes them. That is the
 * same separation `ship-identity.ts` keeps for their ids. A released variant's
 * numbers on them would put invented figures inside a matrix the oracle is
 * checked against.
 */
const HARMLESS_POLICY: Readonly<Record<string, NpcEnergyPolicy>> = {
  /**
   * The rock hermit is a hollowed asteroid outpost you dock with, and one you
   * can blast open. It is NOT laser-immune like the two source stations. 300
   * is tougher than the heaviest hull, the 255 Dragon. So a smuggler's den
   * cracked open is a deliberate job, and it sheds its contraband as it goes
   * (combat.ts). A hollowed rock has no generator, so it recovers nothing.
   */
  [HARMLESS_OVERLAYS.rockHermit.profileId]: {
    maxEnergy: 300, laserImmune: false, playerLaserMultiplier: 1, regenPerSecond: 0,
  },
  /**
   * The derelict generation ship is the largest hull in the sky, and it is
   * dead. 252 is the Anaconda's bank, which is the heaviest hull on the trader
   * roster. It is not the heaviest in the catalogue: that is the `W:29` Dragon
   * at 255. Its reactors went cold centuries ago, so it recovers nothing.
   */
  [HARMLESS_OVERLAYS.generationShip.profileId]: {
    maxEnergy: 252, laserImmune: false, playerLaserMultiplier: 1, regenPerSecond: 0,
  },
};

// --- one ship's policy, resolved ---------------------------------------------

const cache = new Map<NpcCombatProfileId, NpcEnergyPolicy>();

/**
 * The bank one exact build flies with. Resolved once per profile and shared —
 * every field is immutable, and a ship holds the answer rather than the id.
 */
export function npcEnergyPolicy(profileId: NpcCombatProfileId): NpcEnergyPolicy {
  const known = cache.get(profileId);
  if (known) return known;
  const own = HARMLESS_POLICY[profileId];
  const record = own ? null : npcCombatProfileById(profileId);
  const policy: NpcEnergyPolicy = own ?? (record!.source === 'elite-a'
    ? {
      maxEnergy: record!.profile.maxEnergy,
      laserImmune: record!.profile.laserImmune,
      playerLaserMultiplier: record!.profile.playerLaserMultiplier,
      regenPerSecond: NON_REGENERATING_DESIGNS.has(record!.profile.designId)
        ? 0 : ELITE_A_DEFAULT_REGEN_PER_SECOND,
    }
    // An overlay id with no policy above is a Harmless invention that somebody
    // added and never said what it is made of. That is a decision, not a
    // default.
    : missingPolicy(profileId));
  cache.set(profileId, policy);
  return policy;
}

function missingPolicy(profileId: NpcCombatProfileId): never {
  throw new Error(`npc-energy: no energy policy for the Harmless profile ${profileId}`);
}

/** The bank a fresh ship of this build starts with. */
export function npcMaxEnergy(profileId: NpcCombatProfileId): number {
  return npcEnergyPolicy(profileId).maxEnergy;
}

// --- what a hit is worth -----------------------------------------------------

/**
 * Energy a registered player-laser hit of `hit` strength removes.
 *
 * The whole rule is the oracle's. Immunity, and the Constrictor's half, are
 * both inside `policy`. That is why no caller of this ever names a ship.
 */
export function playerLaserDamage(policy: NpcEnergyPolicy, hit: number): NpcEnergyPoints {
  return npcEnergyPoints(eliteADamageToNpc(hit, policy));
}

/**
 * Energy one ship's registered laser hit removes from ANOTHER ship's bank.
 *
 * The pack does not tabulate this direction. So it is COMPOSED from the two
 * source rules each half does have. It takes the laser strength of the
 * attacker's own build (`laserPower << 2`), less the target's own per-hit
 * defence (`maxEnergy & 7`). Both come from `elite-a/combat-math.ts`.
 *
 * So a crossfire kill and a player kill agree about what a Krait's gun is worth
 * against an Adder.
 *
 * IT IS NOT A PLAYER LASER. Two fields deliberately do not apply here.
 * `playerLaserMultiplier` is the Constrictor's half, which hardens it against
 * the commander's guns in particular. `laserImmune` is a station that shrugs
 * the commander off. See `test/damage-paths.test.ts`, which asserts both.
 *
 * @param attackerWeaponByte the ATTACKER's packed byte (`npcWeaponByte`)
 * @param target the ship that takes the hit — its own bank, and nothing else's
 */
export function npcCrossfireDamage(
  attackerWeaponByte: number, target: NpcEnergyPolicy,
): NpcEnergyPoints {
  return npcEnergyPoints(Math.max(0,
    eliteANpcLaserStrength(attackerWeaponByte) - eliteANpcDefence(target.maxEnergy)));
}

/** The bank once `damage` comes off. Floored at zero, so destruction reads 0. */
export function energyAfterDamage(energy: number, damage: NpcEnergyPoints): number {
  return eliteAEnergyAfterDamage(energy, damage);
}

/** Destroyed at zero — the released survival quirk is deliberately gone. */
export function isDestroyed(energy: number): boolean {
  return eliteAIsDestroyed(energy);
}

// --- recovery -------------------------------------------------------------

/**
 * Advance one ship's bank by a frame of elapsed time.
 *
 * Nothing is mutated: it returns the new value and the new sub-tick carry, and
 * the ship writes both into its own state. A negative or absurd `dt` — a paused
 * tab, a rewound clock — contributes nothing, so there is no catch-up burst.
 */
export function regeneratedEnergy(
  state: EliteARegenState, policy: NpcEnergyPolicy, dt: number,
): EliteARegenState {
  return eliteARegenerate(state, policy.maxEnergy, policy.regenPerSecond, dt);
}
