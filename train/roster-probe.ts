// What a reception is worth, system by system — docs/TODO/138.
//
//   npm run roster-probe [career arrivals]
//
// Elite-A shipped 23 blueprint sets, `S.A` to `S.W`, and chose between them on
// arrival. Harmless imported all of them and then collapsed the dimension. M3
// gave the choice back to the system you jumped into, and this is the
// measurement that says what changed.
//
// It was a BASELINE first. Run against M1's collapsed roster the tables describe
// one roster; run now, they describe 23. 134's lesson is why the order was that
// way round: docking well and flying well are different claims, and only the
// first had a number.
//
// TWO claims, and the second is the guard on the first:
//
//   variety   how many distinct DESIGNS a player meets in the pirate band. That
//             is the half of the change a player can see.
//   damage    what those designs do to a Cobra Mk III — per hit, and as a
//             ceiling in pool points a second. A set narrows the pool it picks
//             from, so this column can FALL, and a reception that hits softer is
//             a weakening of an opposition that already struggled to out-damage
//             a shield (docs/TODO/139).
//
// M3 FOUND THAT BOTH CLAIMS NEEDED A DIFFERENT TABLE, and both are below.
//
// Variety could not rise where M1 read it. The census is the UNION over every
// arrival, Harmless files 17 pirate designs, and every one of them is filed by
// some set — so the union was already 17 and stayed 17. What the choice buys is
// a NARROWER band per arrival that DIFFERS between systems: 4.4 designs where
// there were 17, over 23 distinct pirate rosters. `printVariety` reads that.
//
// Damage had to be read on the path the game actually spawns on. No pirate in
// the game comes through the band uniformly: `spawnPopulation` picks a threat
// tier from how attractive a target the commander looks, and asks
// `pirateSpecForTier`. The band mean is the POOL; the tier table is the
// RECEPTION. `printTierPath` reads the second, against the collapsed roster as
// its own baseline, and it is the guard that binds.
//
// THE MEASUREMENT IS `train/roster-census.ts` and this is the report of it. The
// split is that line: everything over there can be wrong in a way a test can
// catch, and is what `test/roster-probe.test.ts` imports; everything here is a
// column heading. `train/profile-sweep.ts` holds the same damage rule and sweeps
// the CATALOGUE; this sweeps the GALAXY.

import {
  GALAXIES, RANDOM_BITS, RECEPTION_ROLES, SYSTEMS_PER_GALAXY, bandRow, bandRows, census,
  sample, setsChosen, spread, tierPath, type Spread, type SystemRoster, type ReceptionRole,
} from './roster-census.ts';
import { SPECS } from '../src/game/ship-specs.ts';
import { emptyBandsForSet } from '../src/game/set-roster.ts';
import { SHIELD_REGEN } from '../src/constants/recharge.ts';

/**
 * How many arrivals a career sees. The smaller of the two sample sizes.
 *
 * `test/campaign.ts` flies 80 legs, so 80 arrivals is a career's worth. The
 * variety claim is a sampled number, so it is read at this size and at three
 * times it, and it is believed only where the two agree.
 */
const CAREER_ARRIVALS = 80;

// --- the tables ---------------------------------------------------------------

const pad = (s: string | number, n: number): string => String(s).padEnd(n);
const rpad = (s: string | number, n: number): string => String(s).padStart(n);
const two = (s: Spread): string => `${s.mean.toFixed(1)}/${s.max.toFixed(1)}`;
const three = (s: Spread): string =>
  `${s.min.toFixed(1)}/${s.mean.toFixed(1)}/${s.max.toFixed(1)}`;

const setsLabel = (rows: readonly SystemRoster[]): string => {
  const sets = setsChosen(rows);
  return sets.length === 0 ? '—' : `${sets.length} (${sets.join('')})`;
};

function printByGalaxy(rows: readonly SystemRoster[]): void {
  console.log(`\n## the pirate band by galaxy — all ${GALAXIES.length} galaxies,`
    + ` ${SYSTEMS_PER_GALAXY} systems each, ${RANDOM_BITS.length} arrivals a system\n`);
  console.log('| galaxy | arrivals | sets | designs | builds |'
    + ' per hit mean/max | best case pts/s mean/max |');
  console.log('| --- | --- | --- | --- | --- | --- | --- |');
  for (const galaxy of GALAXIES) {
    const mine = rows.filter((r) => r.galaxy === galaxy);
    const band = bandRow(mine, 'pirate');
    console.log(`| ${rpad(galaxy, 6)} | ${rpad(mine.length, 8)} | ${rpad(setsLabel(mine), 4)} | `
      + `${rpad(band.designs, 7)} | ${rpad(band.builds, 6)} | ${rpad(two(band.perHit), 16)} | `
      + `${rpad(two(band.best), 24)} |`);
  }
}

/**
 * How often a band falls back — the count `specsForSet` promises is not silent.
 *
 * A set that files nothing Harmless flies under a job hands that job the full
 * roster. The Thargoid and Thargon bands do it almost always, and that is the
 * released shape rather than a defect: Thargoids belong to witch-space, which is
 * an override (M4) and not an ordinary arrival.
 */
function printFallbacks(rows: readonly SystemRoster[]): void {
  const sets = setsChosen(rows);
  if (sets.length === 0) return;
  console.log('\n## bands the set leaves empty — where the full roster answers\n');
  console.log('| band | sets that file nothing | of |');
  console.log('| --- | --- | --- |');
  const counts = new Map<string, number>();
  for (const set of sets) for (const band of emptyBandsForSet(set)) {
    counts.set(band, (counts.get(band) ?? 0) + 1);
  }
  for (const role of RECEPTION_ROLES) {
    console.log(`| ${pad(role, 8)} | ${rpad(counts.get(role) ?? 0, 22)} | ${rpad(sets.length, 2)} |`);
  }
}

function printBands(rows: readonly SystemRoster[]): void {
  console.log(`\n## what a reception is worth, by slot band — the same`
    + ` ${rows.length} arrivals\n`);
  console.log('| band | designs | builds | per hit min/mean/max |'
    + ' best case pts/s min/mean/max | beat a face |');
  console.log('| --- | --- | --- | --- | --- | --- |');
  for (const band of bandRows(rows)) {
    console.log(`| ${pad(band.role, 8)} | ${rpad(band.designs, 7)} | ${rpad(band.builds, 6)} | `
      + `${rpad(three(band.perHit), 20)} | ${rpad(three(band.best), 28)} | `
      + `${rpad(`${band.overRegen}/${band.builds}`, 11)} |`);
  }
  console.log(`\nper hit and best case are against a Cobra Mk III · one face`
    + ` regenerates ${SHIELD_REGEN.toFixed(3)} points a second`);
}

/**
 * The reception the game spawns, at all three threat tiers.
 *
 * Two columns, and the second is the collapsed roster on the same call — so the
 * before-picture is taken by this run rather than quoted from an older one.
 */
function printTierPath(rows: readonly SystemRoster[]): void {
  if (setsChosen(rows).length === 0) return;
  console.log(`\n## the pirate the GAME spawns — pirateSpecForTier, over the same`
    + ` ${rows.length} arrivals\n`);
  console.log('| tier | per hit min/mean/max | no set in force |'
    + ' best case pts/s mean | no set in force |');
  console.log('| --- | --- | --- | --- | --- |');
  for (const tier of [0, 1, 2]) {
    const here = tierPath(rows, tier);
    const flat = tierPath(rows, tier, SPECS);
    console.log(`| ${rpad(tier, 4)} | ${rpad(three(here.perHit), 20)} | `
      + `${rpad(three(flat.perHit), 15)} | ${rpad(here.best.mean.toFixed(2), 20)} | `
      + `${rpad(flat.best.mean.toFixed(2), 15)} |`);
  }
  console.log('\nthe tier is what the commander LOOKS worth (threat.ts), so a set that'
    + ' files no pirate at that tier does not get to downgrade it — see pirateSpecForTier');
}

/** How wide one arrival's band is, in designs. The number the choice moved. */
function bandWidth(rows: readonly SystemRoster[], role: ReceptionRole): Spread {
  return spread(rows.map((r) => r.specs[role].length));
}

function printVariety(rows: readonly SystemRoster[], careerArrivals: number): void {
  console.log('\n## variety — the band ONE arrival draws from, over the whole census\n');
  console.log('| band | designs per arrival min/mean/max | distinct rosters |');
  console.log('| --- | --- | --- |');
  for (const role of RECEPTION_ROLES) {
    const distinct = new Set(rows.map(
      (r) => r.specs[role].map((s) => s.designId).join(','))).size;
    console.log(`| ${pad(role, 8)} | ${rpad(three(bandWidth(rows, role)), 32)} | `
      + `${rpad(distinct, 16)} |`);
  }
  console.log(`\n## variety — what a career meets in the pirate band,`
    + ' at two sample sizes\n');
  console.log('| sample | arrivals | sets | designs | builds | per hit mean/max |');
  console.log('| --- | --- | --- | --- | --- | --- |');
  for (const [label, total] of [
    ['a career', careerArrivals], ['three careers', careerArrivals * 3],
  ] as const) {
    const sampled = sample(total);
    const band = bandRow(sampled, 'pirate');
    console.log(`| ${pad(label, 13)} | ${rpad(sampled.length, 8)} | ${rpad(setsLabel(sampled), 4)} | `
      + `${rpad(band.designs, 7)} | ${rpad(band.builds, 6)} | ${rpad(two(band.perHit), 16)} |`);
  }
  console.log('\nthe two rows are a UNION over arrivals, so they measure what a career'
    + ' meets in total — the table above is what any one arrival draws from');
}

export function printRosterProbe(careerSystems = CAREER_ARRIVALS): void {
  const rows = census();
  printByGalaxy(rows);
  printBands(rows);
  printTierPath(rows);
  printFallbacks(rows);
  printVariety(rows, careerSystems);
  if (setsChosen(rows).length === 0) {
    console.log('\nNO SYSTEM CHOOSES A SET YET. Every row above is the one collapsed'
      + ' roster, so the variety columns are its size and the sets column is empty.'
      + ' That is the docs/TODO/138 M1 baseline.');
  }
}

const isMain = process.argv[1]?.endsWith('roster-probe.ts') ?? false;
if (isMain) {
  const asked = Number(process.argv[2] ?? CAREER_ARRIVALS);
  printRosterProbe(Number.isFinite(asked) && asked > 0 ? asked : CAREER_ARRIVALS);
}
