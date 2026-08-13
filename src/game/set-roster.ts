// What a blueprint set narrows the roster to.
//
// Three files divide this question and each answers one part of it:
//
//   ship-roles.ts     which designs a role may EVER fly, read off all 23 sets at
//                     once. Permission, and it does not narrow.
//   blueprint-set.ts  WHICH of the 23 sets a system flies. The choice, as a pure
//                     function of the system, the galaxy and two random bits.
//   this file         what that one set then files under each job. Selection.
//
// A design must pass permission and selection both. Keeping them apart is what
// stops a set filing a hull under a job the source never gave it — a set's slot
// table is data, and `roleBandContainsSlot` is the rule about what a slot number
// MEANS.
//
// ## Two decisions live here, and docs/TODO/138 records the measurement for each
//
// THE SET NARROWS THE POOL; THE BUILD DOES NOT MOVE. A surviving row keeps the
// exact `profileId` `role-variants.ts` chose for it, which is the hardest build
// the source ever filed under that job. The faithful alternative — take whatever
// build the set itself filed — is measurably a weakening of an opposition that
// already struggles to out-damage a shield face (docs/TODO/139). So the variety
// this buys is WHICH DESIGNS turn up, which is the half a player can see, and it
// is why the damage guard can be read on the mix alone.
//
// A BAND THE SET LEAVES EMPTY KEEPS THE FULL ROSTER. That is a decision and not
// a fallback for convenience, and it is not rare: 21 of the 23 sets file no
// Thargoid, set J files no trader design Harmless flies, and sets L, O and U file
// no bounty hunter. The game decides that a trader or a policeman belongs here;
// the set decides which one; where the set has no answer the sky still needs a
// ship. It is reported rather than silent — `emptyBandsForSet` names them and
// `npm run roster-probe` prints the count.

import { eliteASlotsForSet } from './elite-a/catalogue.ts';
import type { BlueprintSet } from './blueprint-set.ts';
import { roleBandContainsSlot, roleSourceBands, type NpcRole } from './ship-roles.ts';
import { shipDesignIdOf, type ShipDesignId } from './ship-identity.ts';
import { SPECS, type NpcSpec, type RosterSpecs } from './ship-specs.ts';

/**
 * The designs one released set files under one role's job.
 *
 * The slot table is asked directly, because a set fills a slot or it does not.
 * `eliteADesignsInSlotRange` is the same question over all 23 sets at once, and
 * it is what `ship-roles.ts` turns into permission.
 */
function designsFiledInSet(set: BlueprintSet, role: NpcRole): ReadonlySet<ShipDesignId> {
  const filed = new Set<ShipDesignId>();
  for (const slot of eliteASlotsForSet(set)) {
    if (slot.designId === null) continue;
    if (!roleBandContainsSlot(role, slot.slot)) continue;
    filed.add(shipDesignIdOf(slot.designId));
  }
  return filed;
}

const specsBySet = new Map<BlueprintSet, RosterSpecs>();

/**
 * What each role flies where this set is in force. `null` is no set at all.
 *
 * TWO ROLES ARE NEVER NARROWED, and it is the same emptiness `ship-roles.ts`
 * guards: the rock hermit and the generation ship are Harmless's, they occupy no
 * released slot, and a set has no opinion about them. `roleSourceBands` is where
 * that is already written down, so this reads it rather than listing them again.
 *
 * The answer is cached and returned by identity, which is what lets
 * `pirateTiersFor` key its own table on it.
 */
export function specsForSet(set: BlueprintSet | null): RosterSpecs {
  if (set === null) return SPECS;
  const known = specsBySet.get(set);
  if (known !== undefined) return known;
  const narrowed = { ...SPECS } as unknown as Record<keyof RosterSpecs, readonly NpcSpec[]>;
  for (const role of Object.keys(SPECS) as (keyof RosterSpecs)[]) {
    if (roleSourceBands(role).length === 0) continue;
    const filed = designsFiledInSet(set, role);
    const kept = SPECS[role].filter((spec) => filed.has(spec.designId));
    if (kept.length > 0) narrowed[role] = kept;
  }
  specsBySet.set(set, narrowed);
  return narrowed;
}

/**
 * The roles this set files nothing Harmless flies under — the fallback above,
 * as a list. Empty is the ordinary answer for the bands that matter.
 */
export function emptyBandsForSet(set: BlueprintSet): Exclude<NpcRole, 'asteroid'>[] {
  return (Object.keys(SPECS) as (keyof RosterSpecs)[]).filter((role) => {
    if (roleSourceBands(role).length === 0) return false;
    const filed = designsFiledInSet(set, role);
    return !SPECS[role].some((spec) => filed.has(spec.designId));
  });
}
