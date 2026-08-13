// What `train/roster-probe.ts` may never report — docs/TODO/138 M1.
//
// The probe is the baseline the whole item is scored against, so it carries
// 134's risk: a measuring tool that is quietly wrong scores the change by a
// column that cannot see it. These are the bounds a row cannot cross whatever
// the chooser does later — not a snapshot of today's numbers, which are the
// thing M3 moves.
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
  GALAXIES, RECEPTION_ROLES, bandRow, bandRows, census, perHitOf, sample,
} from '../train/roster-probe.ts';
import { bestCasePerSecond } from '../src/game/gunnery.ts';
import { roleAllowsDesign, roleCandidateDesigns } from '../src/game/ship-roles.ts';

console.log('\nthe roster probe (docs/TODO/138 M1)');

const rows = census();
const bands = bandRows(rows);

check('the census walks every system of every galaxy',
  rows.length === GALAXIES.length * 256
  && GALAXIES.every((g) => rows.filter((r) => r.galaxy === g).length === 256));

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
  check(`a ${total}-system sample takes what it was asked for`,
    sampled.length === total);
  check(`a ${total}-system sample meets no more than the galaxy holds`,
    band.designs <= whole.designs && band.builds <= whole.builds
    && band.perHit.max <= whole.perHit.max && band.perHit.min >= whole.perHit.min);
}

// Damage comes through the runtime, so a spec's per-hit reading is the pack's
// answer for that exact build and not a roster field.
check('a per-hit reading is never negative and never fractional',
  rows[0].specs.pirate.every((spec) => {
    const hit = perHitOf(spec);
    return hit >= 0 && Number.isInteger(hit);
  }));
