// Which released BUILD of a design a role flies — the selection policy.
//
// `ship-roles.ts` says which DESIGNS a role may fly at all. This file says
// which of that design's exact S.A-S.W variants it turns up in. That is the
// whole of the decision: combat never asks who chose, only what the profile
// says.
//
// ## Why it exists
//
// Every roster row used to fly `recommendedNpcProfile(designId)`. That is the
// pack's own suggested default for a design, resolved to a real released build.
// It is the right answer for a ship you look at, and the wrong one for a ship
// that shoots at you.
//
// The default is the ordinary build, and an ordinary build barely bites. The
// fidelity contract's clean laser rule is `laserPower << 2`, less the flyable
// hull's per-hit armour. So a default pirate does 9 points to a Cobra Mk III's
// 510-point front-face pool, and it takes 57 hits.
//
// The released sets contain harder builds of the SAME ships. A Sidewinder is
// `D:17` in one set and `V:17` in another: same hull, same geometry, same name,
// one more point of laser power. A choice of `V:17` for a pirate is still one
// hundred per cent released data. It is a different released build of the same
// ship, not a tuned number. So SELECTION restores the threat, and the oracle,
// the parity matrices and every fixture stay exactly as they were.
//
// ## The rule
//
//   * A COMBAT role — pirate, police, hunter, thargoid, thargon — flies the
//     hardest build of its design that the source itself ever filed under that
//     job. The role's own slot bands permit it. The rank is by clean laser
//     strength, then by energy, then by A-W source order.
//   * Everything else keeps the recommended default: a trader, a rock, and the
//     two Harmless overlays. A freighter means nobody any harm.
//   * A design with no permitted build in the role's bands keeps the
//     recommended default too. That is not a fallback for convenience. It is
//     the answer for the Constrictor, which flies with the `pirate` role and
//     sits in slot 31, a band no ordinary pirate draws from.
//
// PERMISSION IS READ FROM WHAT THE SETS DID, exactly as `ship-roles.ts` reads
// design membership. A variant qualifies when one of the slots it really
// occupies in its own set is a slot for this job. Nothing is synthesised. No
// stat is ever averaged or invented. Every candidate is a real row of the
// vendored pack.
//
// ## Determinism, and the save
//
// The choice is a pure function of (role, design) over generated data. So it is
// the same in every session, on every machine, before and after a reload.
//
// A ship's `profileId` is in its snapshot (`ship-identity.ts`), so a restored
// ship keeps the exact build it had. A snapshot that carries no id is refused
// rather than re-derived (2026-08-04).
//
// Nothing here is a save path any more. Every call is a LIVE one, from
// `ship-specs.ts`, and it asks what a roster row flies. No rng is drawn, which
// is the rule for anything that decides a future frame.

import { eliteAVariantsOf } from './elite-a/catalogue.ts';
import { eliteANpcLaserStrength } from './elite-a/combat-math.ts';
import type { EliteAVariant } from './elite-a/types.ts';
import { roleBandContainsSlot, type NpcRole } from './ship-roles.ts';
import {
  npcCombatProfileIdOf, recommendedProfileIdFor, shipDesign,
  type NpcCombatProfileId, type ShipDesignId,
} from './ship-identity.ts';

/**
 * The roles that mean somebody harm.
 *
 * Stated as a set rather than inferred from "has a laser", because a trader
 * Cobra has one too and is still not a combat ship. These are the roles whose
 * whole job is the fight, and the only ones whose build selection is allowed to
 * ask which build hits hardest.
 */
export const COMBAT_ROLES: ReadonlySet<NpcRole> =
  new Set<NpcRole>(['pirate', 'police', 'hunter', 'thargoid', 'thargon']);

/** Is this a role whose build is chosen for its gun? */
export function isCombatRole(role: NpcRole): boolean {
  return COMBAT_ROLES.has(role);
}

/**
 * Every released build of this design the source ever filed under this job.
 *
 * Empty is a real answer — see the header on the Constrictor.
 */
export function roleCandidateVariants(
  role: NpcRole, sourceDesignId: number,
): readonly EliteAVariant[] {
  return eliteAVariantsOf(sourceDesignId)
    .filter((v) => v.presentInSlots.some((slot) => roleBandContainsSlot(role, slot)));
}

/**
 * Rank two permitted builds. Hardest gun first, then the bigger bank, then the
 * earlier blueprint set — so the answer is total and never depends on array
 * order.
 *
 * The gun is `eliteANpcLaserStrength`, which is the oracle's own clean rule. It
 * is not the raw `laserPower` column. One rule, one home. A change to the
 * encoding then moves this too, rather than leaves the two at odds.
 */
function harder(a: EliteAVariant, b: EliteAVariant): number {
  const gun = eliteANpcLaserStrength(b.weaponByte) - eliteANpcLaserStrength(a.weaponByte);
  if (gun !== 0) return gun;
  if (b.maxEnergy !== a.maxEnergy) return b.maxEnergy - a.maxEnergy;
  return a.variantId < b.variantId ? -1 : 1;
}

const cache = new Map<string, NpcCombatProfileId>();

/**
 * The exact build a ship of this role and design flies.
 *
 * Deterministic, cached, and the ONLY place the choice is made. `ship-specs.ts`
 * calls it once per roster row at load, and is now its only caller. A restore
 * reads the build out of the snapshot rather than asks a second time.
 */
export function roleCombatProfileId(
  role: NpcRole, designId: ShipDesignId,
): NpcCombatProfileId {
  const key = `${role} ${designId}`;
  const known = cache.get(key);
  if (known !== undefined) return known;
  const chosen = choose(role, designId);
  cache.set(key, chosen);
  return chosen;
}

function choose(role: NpcRole, designId: ShipDesignId): NpcCombatProfileId {
  const record = shipDesign(designId);
  if (record.source !== 'elite-a' || !isCombatRole(role)) {
    return recommendedProfileIdFor(designId);
  }
  const permitted = [...roleCandidateVariants(role, record.design.designId)].sort(harder);
  return permitted.length === 0
    ? recommendedProfileIdFor(designId)
    : npcCombatProfileIdOf(permitted[0].variantId);
}
