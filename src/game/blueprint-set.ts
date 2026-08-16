// Which of the 23 released blueprint sets a system flies.
//
// Elite-A did not ship one roster. It shipped 23, the files `S.A` to `S.W`. It
// chose between them on arrival, in `LOMOD`, at a launch from a station, and on
// a jump into a new system.
//
// Each file is 31 numbered slots. A slot is a job. A file fills those slots
// with its own designs and its own stat blocks. So where you were decided both
// who jumped you and how hard they hit.
//
// This is that choice, as a pure function. It decides nothing else. What a set
// then means for the roster is `game/ship-specs.ts`. Which BUILD of a design a
// job flies inside the chosen set stays `game/role-variants.ts`.
//
// ## The rule, and where it came from
//
// docs/TODO/138 recovers it from bbcelite's deep dives, which are a fourth
// source. The vendored pack has the sets, their slots and their variants, and
// no selection metadata at all. It is a number 0-15, built bitwise:
//
//     bit 0    1 for a high-tech system, 0 for the rest
//     bit 1    0 for anarchy, feudal and multi-government; 1 for everything safer
//     bits 2-3 random
//     bits 4-7 zero
//
// Elite-A then ADDS the galaxy number, 0-7, which is what spreads 16 numbers
// across all 23 files.
//
// ## Three things this file does not do
//
// IT DOES NOT DRAW THE DICE. Bits 2-3 are a coin the source flipped on arrival,
// and here they are an argument. Invariant 11 puts all world chance on the one
// seeded stream. `role-variants.ts` records the standing rule: nothing that
// decides a future frame draws rng at resolve time. The caller draws once, on
// entry, and saves what it drew (invariant 12).
//
// IT DOES NOT RESTATE BIT 0. That test already picks the Dodo station over the
// Coriolis, and `galaxy/tech.ts` is its one home. In the released game one bit
// did both jobs. Here, half of it ran since long before the catalogue arrived.
//
// IT DOES NOT KNOW WHEN AN OVERRIDE APPLIES. Two of them exist, and both are
// released rules. Whether the commander holds the plans is the mission's fact
// rather than this file's. So the caller names the override.

import { eliteABlueprintSets } from './elite-a/catalogue.ts';
import { isHighTechSystem } from '../galaxy/tech.ts';
import type { StarSystem } from '../galaxy/galaxy.ts';
import {
  CONSTRICTOR_BLUEPRINT_SET, THARGOID_BLUEPRINT_SET_HIGH_TECH,
  THARGOID_BLUEPRINT_SET_LOW_TECH, UNSETTLED_GOVERNMENT,
} from '../constants/blueprint-set.ts';

/** The 23 letters, read from the pack once. */
const sets = eliteABlueprintSets();

/**
 * A released blueprint set, by its letter. `A` to `W`.
 *
 * A plain string rather than a union of 23 letters, because the count is the
 * pack's. `eliteABlueprintSets` reads it off the slot table, and a re-import
 * may change it.
 */
export type BlueprintSet = string;

/**
 * The two released overrides. Neither is decided here — see the header.
 *
 *   `constrictor` mission 1's target system, which always flies set G.
 *   `thargoid`    the commander carries the plans, or this is witch-space.
 */
export type BlueprintOverride = 'constrictor' | 'thargoid';

/** Every set the game can choose, in source order. A copy: the table is ours. */
export function blueprintSets(): BlueprintSet[] {
  return [...sets];
}

/**
 * The two random bits, from one draw of the seeded stream.
 *
 * The caller passes a roll in [0, 1) and never has to know how wide the field
 * is. Two bits is the source's rule, and it is spelled once, here.
 */
export function blueprintRandomBits(roll: number): number {
  return Math.min(3, Math.max(0, Math.floor(roll * 4)));
}

/**
 * The base number, 0-15 — the system's own half of the choice.
 *
 * `government <= UNSETTLED_GOVERNMENT` is the bit-1 test, and it is NOT the
 * `government <= 1` that sits three lines from it in `galaxy.ts`. That one
 * denies a rich economy to anarchies and feudal states. Two rules, adjacent,
 * one off by one.
 */
export function blueprintSetBaseNumber(system: StarSystem, randomBits: number): number {
  const highTech = isHighTechSystem(system.techLevel) ? 1 : 0;
  const settled = system.government > UNSETTLED_GOVERNMENT ? 1 : 0;
  return highTech + settled * 2 + (randomBits & 3) * 4;
}

/**
 * The base number plus the galaxy, 0-22 — the index of the set in force.
 *
 * GALAXY IS 1-BASED HERE, as `CommanderData` holds it, and 0-based in the source
 * as `GCNT`. The subtraction is the whole of that conversion.
 */
export function blueprintSetNumber(
  system: StarSystem, galaxy: number, randomBits: number,
): number {
  const index = blueprintSetBaseNumber(system, randomBits) + galaxy - 1;
  if (!Number.isInteger(index) || index < 0 || index >= sets.length) {
    // A galaxy outside 1-8 is the only way here, and a clamp would fly the wrong
    // roster in silence. This is a BACKSTOP and not the gate: `snapshot.ts`
    // refuses a saved galaxy that is not 1..8, which is where a bad one dies.
    // A wrong galaxy whose number still lands on the table is a set like any
    // other, and nothing here can tell.
    throw new Error(
      `blueprint-set: galaxy ${galaxy} asks for set ${index} of ${sets.length}`);
  }
  return index;
}

/**
 * The set a system flies. An override answers on its own, and the number is not
 * consulted at all — which is the released behaviour.
 */
export function blueprintSetFor(
  system: StarSystem, galaxy: number, randomBits: number,
  override: BlueprintOverride | null = null,
): BlueprintSet {
  if (override === 'constrictor') return CONSTRICTOR_BLUEPRINT_SET;
  if (override === 'thargoid') {
    return isHighTechSystem(system.techLevel)
      ? THARGOID_BLUEPRINT_SET_HIGH_TECH : THARGOID_BLUEPRINT_SET_LOW_TECH;
  }
  return sets[blueprintSetNumber(system, galaxy, randomBits)];
}
