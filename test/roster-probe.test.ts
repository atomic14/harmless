// What `train/roster-probe.ts` may never report — docs/TODO/138 M1 and M3.
//
// The probe is the baseline the whole item is scored against, so it carries
// 134's risk: a measuring tool that is quietly wrong scores the change by a
// column that cannot see it. These are the bounds a row cannot cross whatever
// the chooser does — not a snapshot of today's numbers, which are the thing M3
// moved.
//
//   - A ROLE NEVER WIDENS. Every ship in a band is a design the source itself
//     filed under that job. A chooser that picked a set's slot 19 without
//     checking the band would show up here and nowhere else.
//   - THE CEILING IS THE GAME'S, NOT THE PROBE'S. The best-case column must be
//     `bestCasePerSecond` of the per-hit column, so a probe that divided by its
//     own reload could not agree with it.
//   - A SAMPLE MEETS NO MORE THAN THE GALAXY HOLDS. The variety claim is read
//     off a sample, and a sample richer than the census means the two are
//     walking different systems.
//   - THE TWO HARMLESS INVENTIONS HAVE NO BAND. The rock hermit and the
//     generation ship must not acquire one, which is `ship-roles.ts`'s rule and
//     is why the probe derives its roles rather than listing them.

import { check } from './harness.ts';
import {
  GALAXIES, RANDOM_BITS, RECEPTION_ROLES, bandRow, bandRows, census, perHitOf, sample,
  tierPath,
} from '../train/roster-census.ts';
import { bestCasePerSecond } from '../src/game/gunnery.ts';
import { roleAllowsDesign, roleCandidateDesigns } from '../src/game/ship-roles.ts';
import { SPECS } from '../src/game/ship-specs.ts';
import { SHIELD_REGEN } from '../src/constants/recharge.ts';

console.log('\nthe roster probe (docs/TODO/138 M1 and M3)');

const rows = census();
const bands = bandRows(rows);
const ARRIVALS_PER_GALAXY = 256 * RANDOM_BITS.length;

check('the census walks every arrival of every galaxy',
  rows.length === GALAXIES.length * ARRIVALS_PER_GALAXY
  && GALAXIES.every((g) => rows.filter((r) => r.galaxy === g).length === ARRIVALS_PER_GALAXY));

// The four bit values are the whole field, so a census that walked one of them
// would report a quarter of the receptions and look complete doing it.
check('every arrival names the set it flies, at all four bit values',
  rows.every((r) => typeof r.set === 'string' && r.set.length === 1)
  && RANDOM_BITS.every((b) => rows.some((r) => r.randomBits === b)));

check('no band holds a design the source never filed under that job',
  rows.every((row) => RECEPTION_ROLES.every(
    (role) => row.specs[role].every((spec) => roleAllowsDesign(role, spec.designId)))));

check('no band reports more designs than the role may ever fly',
  bands.every((band) => band.designs <= roleCandidateDesigns(band.role).length));

check('every band measured something',
  bands.every((band) => band.designs > 0 && band.builds >= band.designs));

// The mean is a float sum over thousands of readings, so a band whose ships all
// hit alike lands a whole 1e-15 above its own maximum. The tolerance is that,
// and it is the same one the ceiling check below uses.
const ordered = (s: { min: number; mean: number; max: number }): boolean =>
  s.min <= s.mean + 1e-9 && s.mean <= s.max + 1e-9;

check('every spread is ordered',
  bands.every((band) => ordered(band.perHit) && ordered(band.best)));

// The ceiling is a linear function of the per-hit damage, so the hardest hit in
// a band owns the highest ceiling in it. That is what makes this an equality
// rather than a bound, and what would catch a second opinion about the reload.
check('the best case is the game\'s own ceiling on the hardest hit in the band',
  bands.every((band) =>
    Math.abs(band.best.max - bestCasePerSecond(band.perHit.max)) < 1e-9
    && Math.abs(band.best.min - bestCasePerSecond(band.perHit.min)) < 1e-9));

check('the two Harmless inventions have no band',
  !RECEPTION_ROLES.includes('hermit' as never)
  && !RECEPTION_ROLES.includes('generation' as never));

// The sampled number, at both sizes it is read at.
for (const total of [80, 240]) {
  const sampled = sample(total);
  const band = bandRow(sampled, 'pirate');
  const whole = bandRow(rows, 'pirate');
  check(`a ${total}-arrival sample takes what it was asked for`,
    sampled.length === total);
  check(`a ${total}-arrival sample meets no more than the galaxy holds`,
    band.designs <= whole.designs && band.builds <= whole.builds
    && band.perHit.max <= whole.perHit.max && band.perHit.min >= whole.perHit.min);
}

// --- the guard that binds (M3) ------------------------------------------------
//
// The band mean is the POOL a system could send. What it DOES send comes off
// `pirateSpecForTier`, so that is where "the damage must not fall" is read, and
// the collapsed roster is the before-picture taken by this same run.
//
// THE PRINCIPLED GATE IS THE FLOOR, not the mean. docs/TODO/139 asked one
// question — can the opposition out-damage the shield it is shooting at — and
// `constants/recharge.ts` states the bound in as many words. M1 warned that a
// set filling its pirate band with light designs only would breach it. It
// cannot, and the reason is structural rather than lucky: M3 narrows WHICH
// DESIGNS turn up and never touches a build, so the softest pirate any tier can
// send is the same ship it always was. That is what the three checks below
// prove, and they are exact rather than a tolerance.
//
// The mean is a MIX, so it moved: tier 0 by -7.3%, tier 1 by +2.7%, tier 2 by
// -2.9%, measured on 2026-08-13.
//
// THE TWO TIERS THAT CARRY A REAL FIGHT ARE HELD TIGHT and tier 0 is not. Tier 0
// is the opportunist a poor commander draws, and it is meant to be beatable, so
// a softer one is the narrowing working. Tiers 1 and 2 are the fight docs/TODO/139
// measured, and a fall there is the weakening this guard exists to refuse.
//
// The two bounds are what make this discriminate rather than merely record. The
// alternative rule M3 rejected — let a set that files no heavy pirate downgrade
// the tier — costs tier 2 9.5%, so it passes a tenth and fails a twentieth.
const DRIFT = { 0: 0.9, 1: 0.95, 2: 0.95 } as const;

for (const tier of [0, 1, 2] as const) {
  const here = tierPath(rows, tier);
  const flat = tierPath(rows, tier, SPECS);
  check(`tier ${tier} sends neither a harder nor a softer pirate than it could`,
    here.perHit.max === flat.perHit.max && here.perHit.min === flat.perHit.min);
  check(`tier ${tier}'s softest pirate still out-damages one shield face`,
    bestCasePerSecond(here.perHit.min) > SHIELD_REGEN);
  check(`tier ${tier} has not drifted softer than the collapsed roster`,
    here.perHit.mean >= flat.perHit.mean * DRIFT[tier]
    && here.best.mean >= flat.best.mean * DRIFT[tier]);
}

// Not vacuous, and this is the part that would catch a downgrade: a set that
// got to answer a tier it cannot fill with a softer one would land here.
check('the threat tiers stay ordered under every set',
  tierPath(rows, 2).perHit.mean > tierPath(rows, 1).perHit.mean
  && tierPath(rows, 1).perHit.mean > tierPath(rows, 0).perHit.mean);

// Damage comes through the runtime, so a spec's per-hit reading is the pack's
// answer for that exact build and not a roster field.
check('a per-hit reading is never negative and never fractional',
  rows[0].specs.pirate.every((spec) => {
    const hit = perHitOf(spec);
    return hit >= 0 && Number.isInteger(hit);
  }));
