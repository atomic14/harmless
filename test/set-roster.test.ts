// What a blueprint set means for the roster — docs/TODO/138 M3.
//
// `blueprint-set.ts` says WHICH set a system flies and `test/blueprint-set.test.ts`
// pins that. This is the other half: what the chosen set then narrows, and what
// it is never allowed to narrow.
//
//   - SELECTION NEVER WIDENS PERMISSION. A narrowed band is a subset of the
//     roster it came from, and every row in it is still a design the source
//     filed under that job. `ship-roles.ts` stays the one home for the second
//     claim, and a set that got to add a row would break the first.
//   - NO BUILD MOVES. The set narrows WHICH DESIGNS turn up and nothing else,
//     which is the decision docs/TODO/138 records and the reason the damage
//     guard can be read on the mix alone. A row keeps the exact `profileId`
//     `role-variants.ts` chose for it.
//   - THE TWO HARMLESS INVENTIONS ARE NEVER NARROWED. The rock hermit and the
//     generation ship occupy no released slot, so no set has an opinion about
//     them, and a narrowing that read their empty band would delete them.
//   - AN EMPTY BAND KEEPS THE FULL ROSTER, and so does an empty threat tier.
//     It is one rule at two levels, it is not rare, and the assertions below
//     name the sets it fires on so that a re-import that changed them shows up.
//   - A SET MAY NOT DOWNGRADE THE THREAT RULE. The tier is what the commander
//     looks worth; a thin blueprint file does not get a vote on it.

import { check, dismissBriefing } from './harness.ts';
import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { withoutSaving } from '../src/game/storage.ts';
import {
  PIRATE_TIERS, SPECS, pirateSpecForTier, pirateTiersFor, rosterSpec, type RosterSpecs,
} from '../src/game/ship-specs.ts';
import { emptyBandsForSet, specsForSet } from '../src/game/set-roster.ts';
import { blueprintSets } from '../src/game/blueprint-set.ts';
import { roleAllowsDesign, roleSourceBands, type NpcRole } from '../src/game/ship-roles.ts';
import { hullThreatTier } from '../src/game/threat.ts';

console.log('\nwhat a blueprint set means for the roster (docs/TODO/138 M3)');

const SETS = blueprintSets();
const ROLES = Object.keys(SPECS) as (keyof RosterSpecs)[];

check('every one of the 23 sets narrows to a usable roster',
  SETS.length === 23 && SETS.every((set) => {
    const roster = specsForSet(set);
    return ROLES.every((role) => roster[role].length > 0);
  }));

check('no set in force is the collapsed roster',
  specsForSet(null) === SPECS);

// --- selection never widens permission ---------------------------------------

check('a narrowed band is a subset of the roster it came from',
  SETS.every((set) => ROLES.every((role) =>
    specsForSet(set)[role].every((spec) => SPECS[role].includes(spec)))));

check('every row a set files is still a design the source filed under that job',
  SETS.every((set) => ROLES.every((role) => {
    if (roleSourceBands(role).length === 0) return true;
    return specsForSet(set)[role].every(
      (spec) => roleAllowsDesign(role as NpcRole, spec.designId));
  })));

check('no set adds a design the collapsed roster does not fly',
  SETS.every((set) => ROLES.every((role) =>
    specsForSet(set)[role].length <= SPECS[role].length)));

// --- no build moves ----------------------------------------------------------

// This is the whole of why the damage guard is a claim about the MIX. If a set
// were allowed to hand back its own build of a design, this would go red and the
// per-hit columns would be measuring two changes at once.
check('a row keeps the exact build role-variants.ts chose for it',
  SETS.every((set) => ROLES.every((role) => specsForSet(set)[role].every((spec) => {
    const original = SPECS[role].find((s) => s.designId === spec.designId);
    return original !== undefined && original.profileId === spec.profileId;
  }))));

// --- the two Harmless inventions ---------------------------------------------

check('the rock hermit and the generation ship are never narrowed',
  SETS.every((set) =>
    specsForSet(set).hermit === SPECS.hermit
    && specsForSet(set).generation === SPECS.generation));

check('...and neither ever appears in a set\'s empty-band list',
  SETS.every((set) => !emptyBandsForSet(set).some(
    (role) => role === 'hermit' || role === 'generation')));

// --- the empty band, and that the rule is not vacuous -------------------------

// Named sets, because "some set somewhere" would pass on a narrowing that had
// quietly stopped narrowing. These are the sets the slot table leaves empty for
// a Harmless band, measured on 2026-08-13.
check('set J files no trader design Harmless flies, and keeps all 17',
  emptyBandsForSet('J').includes('trader')
  && specsForSet('J').trader === SPECS.trader);

check('sets L, O and U file no bounty hunter, and keep all 10',
  ['L', 'O', 'U'].every((set) => emptyBandsForSet(set).includes('hunter')
    && specsForSet(set).hunter === SPECS.hunter));

check('21 of the 23 sets file no Thargoid — C and D are the two that do',
  SETS.filter((set) => !emptyBandsForSet(set).includes('thargoid')).join('') === 'CD');

// The fallback must be a fallback and not the ordinary answer: if narrowing
// silently failed everywhere, every band would be "empty" and the check above
// would still pass. The pirate band never falls back, and that is the proof.
check('the pirate band is narrowed in every set and never falls back',
  SETS.every((set) => !emptyBandsForSet(set).includes('pirate')
    && specsForSet(set).pirate.length < SPECS.pirate.length));

// --- the threat tier, which is how every in-game pirate is picked -------------

check('twelve sets empty a threat tier, which is why the rule exists',
  SETS.filter((set) => pirateTiersFor(specsForSet(set)).some((t) => t.length === 0))
    .join('') === 'BCDEGHNOQRTU');

check('a tier a set cannot fill answers with the collapsed roster\'s tier',
  SETS.every((set) => [0, 1, 2].every((tier) => {
    const roster = specsForSet(set);
    const chosen = pirateSpecForTier(tier, 0, roster);
    const filled = pirateTiersFor(roster)[tier];
    return filled.length === 0 ? PIRATE_TIERS[tier].includes(chosen) : filled.includes(chosen);
  })));

check('a set never downgrades the tier the threat rule asked for',
  SETS.every((set) => [0, 1, 2].every((tier) => {
    const spec = pirateSpecForTier(tier, 3, specsForSet(set));
    return hullThreatTier(spec.designId, spec.profileId) === tier;
  })));

// --- what a spawn resolves to -------------------------------------------------

check('rosterSpec picks inside the roster it is handed',
  SETS.every((set) => {
    const roster = specsForSet(set);
    return ROLES.every((role) => [0, 1, 5, 17].every(
      (seed) => roster[role].includes(rosterSpec(role, seed, undefined, roster)!)));
  }));

check('rosterSpec still answers with the collapsed roster when handed nothing',
  SPECS.pirate.includes(rosterSpec('pirate', 5)!)
  && rosterSpec('asteroid', 5) === null);

// --- determinism --------------------------------------------------------------

check('the same set gives the same roster object every time',
  SETS.every((set) => specsForSet(set) === specsForSet(set)));

check('every narrowed roster is a different narrowing',
  new Set(SETS.map((set) => specsForSet(set).pirate.map((s) => s.designId).join(','))).size
  === SETS.length);

// --- the set survives a save and a reload (invariants 3 and 12) ---------------
//
// The two random bits are drawn ONCE, on arrival, from the seeded stream. So the
// set cannot be re-derived on a reload — the draws are gone — and a save that
// dropped it would land the commander in a system flying a different reception
// from the one she saved in. `session` is walked generically, which is what
// carries it; this is the check that the WORLD is then built with what came back.
{
  const g = withoutSaving(() => new Game(() => headlessShell())).value;
  dismissBriefing(g);
  withoutSaving(() => g.launch());
  const chosen = g.state.session.blueprintSet;
  const flying = g.state.world.roster;

  check('a flying commander is in a system that chose one of the 23 sets',
    SETS.includes(chosen) && flying === specsForSet(chosen));

  const snap = withoutSaving(() => g.captureSnapshot()).value;
  // Move it somewhere else first, so a restore that did nothing at all would
  // leave the wrong set behind rather than accidentally the right one.
  const other = SETS.find((set) => set !== chosen)!;
  g.state.session.blueprintSet = other;
  withoutSaving(() => g.buildWorld());
  check('...and the control moves it: another set is another roster',
    g.state.world.roster === specsForSet(other) && specsForSet(other) !== flying);

  withoutSaving(() => g.restoreSnapshot(snap));
  check('...and a reload comes back to the same set, flying the same roster',
    g.state.session.blueprintSet === chosen && g.state.world.roster === flying);
}
