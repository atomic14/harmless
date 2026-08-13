// Which set a system flies — docs/TODO/138 M2.
//
// The chooser is a recovered rule, and the pack cannot check it: the vendored
// data has the 23 sets and no selection metadata at all. So the assertions here
// are hand-computed cases against the bit table in the plan doc, plus the three
// claims that are structural and would survive a correction to the table.
//
//   - BIT 0 HAS ONE HOME. The set moves with `DODO_TECH_LEVEL`, because the
//     released game spent one bit on the station hull and the blueprint file
//     together. The threshold is never named as a literal below, so a re-inlined
//     10 in `blueprint-set.ts` goes red however the constant moves.
//   - THE NUMBER NEVER LEAVES THE TABLE. Sixteen base numbers plus eight
//     galaxies is exactly the 23 sets the pack ships, so both ends have to land
//     and nothing may fall off either.
//   - NOTHING IS DRAWN HERE. The two random bits are an argument, so the same
//     system in the same galaxy with the same bits is the same set for ever
//     (invariants 3 and 11).

import { check } from './harness.ts';
import {
  blueprintRandomBits, blueprintSetBaseNumber, blueprintSetFor, blueprintSetNumber, blueprintSets,
} from '../src/game/blueprint-set.ts';
import {
  CONSTRICTOR_BLUEPRINT_SET, THARGOID_BLUEPRINT_SET_HIGH_TECH,
  THARGOID_BLUEPRINT_SET_LOW_TECH, UNSETTLED_GOVERNMENT,
} from '../src/constants/blueprint-set.ts';
import { DODO_TECH_LEVEL } from '../src/constants/station.ts';
import { generateGalaxy, type StarSystem } from '../src/galaxy/galaxy.ts';
import { eliteASlotsForSet } from '../src/game/elite-a/catalogue.ts';

console.log('\nwhich blueprint set a system flies (docs/TODO/138 M2)');

/** A system is two fields to this rule. Shown tech level, so the test reads as the table does. */
const sysAt = (shownTech: number, government: number): StarSystem =>
  ({ techLevel: shownTech - 1, government }) as StarSystem;

const LOW = DODO_TECH_LEVEL - 1;
const HIGH = DODO_TECH_LEVEL;

check('there are 23 sets, A to W', blueprintSets().length === 23
  && blueprintSets()[0] === 'A' && blueprintSets()[22] === 'W');

// --- the bit table, hand-computed --------------------------------------------

// bit 0 low, bit 1 low, no random bits, galaxy 1 -> 0 -> A.
check('a low-tech anarchy in galaxy 1 with no random bits flies A',
  blueprintSetBaseNumber(sysAt(LOW, 0), 0) === 0
  && blueprintSetFor(sysAt(LOW, 0), 1, 0) === 'A');

check('tech alone sets bit 0', blueprintSetBaseNumber(sysAt(HIGH, 0), 0) === 1);

check('a settled government alone sets bit 1',
  blueprintSetBaseNumber(sysAt(LOW, UNSETTLED_GOVERNMENT + 1), 0) === 2);

check('both together make 3',
  blueprintSetBaseNumber(sysAt(HIGH, UNSETTLED_GOVERNMENT + 1), 0) === 3);

check('the three unsettled governments all leave bit 1 clear',
  [0, 1, UNSETTLED_GOVERNMENT].every(
    (g) => blueprintSetBaseNumber(sysAt(LOW, g), 0) === 0));

check('every government above them sets it',
  [UNSETTLED_GOVERNMENT + 1, 5, 7].every(
    (g) => blueprintSetBaseNumber(sysAt(LOW, g), 0) === 2));

check('the two random bits weigh 4 each',
  [0, 1, 2, 3].every((bits) => blueprintSetBaseNumber(sysAt(LOW, 0), bits) === bits * 4)
  && blueprintSetBaseNumber(sysAt(HIGH, 7), 3) === 15);

check('a random field wider than two bits is masked, not trusted',
  blueprintSetBaseNumber(sysAt(LOW, 0), 4) === 0
  && blueprintSetBaseNumber(sysAt(LOW, 0), 7) === 12);

check('a roll in [0,1) becomes exactly the four bit values',
  [0, 0.24, 0.25, 0.49, 0.5, 0.74, 0.75, 0.999].map(blueprintRandomBits)
    .join('') === '00112233');

// --- the galaxy addition, at both ends ---------------------------------------

check('galaxy 1 adds nothing and galaxy 8 adds seven',
  blueprintSetNumber(sysAt(LOW, 0), 1, 0) === 0
  && blueprintSetNumber(sysAt(LOW, 0), 8, 0) === 7);

check('the top of the table is the last set',
  blueprintSetNumber(sysAt(HIGH, 7), 8, 3) === 22
  && blueprintSetFor(sysAt(HIGH, 7), 8, 3) === 'W');

check('no real system in any galaxy can leave the table',
  [1, 2, 3, 4, 5, 6, 7, 8].every((galaxy) => generateGalaxy(galaxy).every(
    (system) => [0, 1, 2, 3].every((bits) => {
      const n = blueprintSetNumber(system, galaxy, bits);
      return n >= 0 && n < 23 && blueprintSets().includes(blueprintSetFor(system, galaxy, bits));
    }))));

// The backstop, and only the backstop: a galaxy that pushes the number off the
// table throws instead of clamping. One that lands ON the table is a set like
// any other, and `snapshot.ts` is where a saved galaxy outside 1..8 dies.
const refuses = (galaxy: number, base: StarSystem, bits: number): boolean => {
  try {
    blueprintSetNumber(base, galaxy, bits);
    return false;
  } catch {
    return true;
  }
};

check('a number off the table is refused rather than clamped',
  refuses(9, sysAt(HIGH, 7), 3) && refuses(0, sysAt(LOW, 0), 0)
  && refuses(1.5, sysAt(HIGH, 7), 3) && !refuses(1, sysAt(LOW, 0), 0));

// --- bit 0 has one home -------------------------------------------------------

// The set number moves at DODO_TECH_LEVEL and nowhere else, so this fails if
// `blueprint-set.ts` ever spells the threshold itself.
check('the set follows the Dodo rule across the threshold',
  [DODO_TECH_LEVEL - 2, DODO_TECH_LEVEL - 1, DODO_TECH_LEVEL, DODO_TECH_LEVEL + 1].every(
    (shown) => blueprintSetBaseNumber(sysAt(shown, 0), 0) === (shown >= DODO_TECH_LEVEL ? 1 : 0)));

// --- the two overrides --------------------------------------------------------

check('the Constrictor\'s system always flies its own set, whatever the number',
  [1, 8].every((galaxy) => [0, 3].every(
    (bits) => blueprintSetFor(sysAt(HIGH, 7), galaxy, bits, 'constrictor')
      === CONSTRICTOR_BLUEPRINT_SET)));

// The pack corroborates the recovered rule: slot 31 is the Constrictor's own
// slot, and exactly one set fills it.
check('...and that set is the only one the pack ever filed a slot 31 in',
  blueprintSets().filter((set) => eliteASlotsForSet(set)
    .some((slot) => slot.slot === 31 && slot.designId !== null))
    .join('') === CONSTRICTOR_BLUEPRINT_SET);

check('the plans and witch-space pick by tech level and ignore the galaxy',
  blueprintSetFor(sysAt(LOW, 0), 3, 2, 'thargoid') === THARGOID_BLUEPRINT_SET_LOW_TECH
  && blueprintSetFor(sysAt(HIGH, 0), 3, 2, 'thargoid') === THARGOID_BLUEPRINT_SET_HIGH_TECH);

check('...and both of those sets carry Thargoids',
  [THARGOID_BLUEPRINT_SET_LOW_TECH, THARGOID_BLUEPRINT_SET_HIGH_TECH].every(
    (set) => eliteASlotsForSet(set).some(
      (slot) => (slot.slot === 29 || slot.slot === 30) && slot.designId !== null)));

// --- determinism --------------------------------------------------------------

check('the same system, galaxy and bits give the same set every time',
  generateGalaxy(2).every(
    (system) => blueprintSetFor(system, 2, 1) === blueprintSetFor(system, 2, 1)));

check('the chooser draws no dice — it never reads Math.random',
  !/Math\s*\.\s*random/.test(
    // the source, not a mock: a chooser that rolled would break the save
    await import('node:fs').then(
      (fs) => fs.readFileSync(new URL('../src/game/blueprint-set.ts', import.meta.url), 'utf8'))));
