// What a reception is worth, system by system — docs/TODO/138 M1.
//
//   npm run roster-probe [career systems]
//
// Elite-A shipped 23 blueprint sets, `S.A` to `S.W`, and chose between them on
// arrival. Harmless imports all of them and then collapses the dimension:
// `SPECS` resolves every `profileId` at import time, so a Krait is the same
// Krait in all eight galaxies. Item 138 gives the choice back to the system you
// jumped into. This is the measurement that says what changed.
//
// It is a BASELINE first. Run it before the chooser exists, and the tables
// describe today's one roster; run it after, and the same tables describe 23.
// 134's lesson is why the order is that way round: docking well and flying well
// are different claims, and only the first had a number.
//
// TWO claims, and the second is the guard on the first:
//
//   variety   how many distinct DESIGNS a player meets in the pirate band. That
//             is the half of the change a player can see, and it is the number
//             138 exists to raise.
//   damage    what those designs do to a Cobra Mk III — per hit, and as a
//             ceiling in pool points a second. A set narrows the pool it picks
//             from, so this column can FALL, and a reception that hits softer is
//             a weakening of an opposition that already cannot out-damage a
//             shield (docs/TODO/139). It must not fall against the baseline.
//
// Every number comes through the runtime functions — `npcWeaponByte`,
// `npcLaserDamageToPlayer` and `npcBestCasePerSecond` — so the probe cannot
// disagree with the game about what a hit is worth. `train/profile-sweep.ts`
// holds the same rule and sweeps the CATALOGUE; this sweeps the GALAXY.

import { generateGalaxy, type StarSystem } from '../src/galaxy/galaxy.ts';
import { SPECS, type NpcSpec } from '../src/game/ship-specs.ts';
import {
  npcBestCasePerSecond, npcLaserDamageToPlayer, npcWeaponByte,
} from '../src/game/gunnery.ts';
import { COBRA_MK_3_HULL_ID } from '../src/game/ship-identity.ts';
import { roleSourceBands, type NpcRole } from '../src/game/ship-roles.ts';
import { SHIELD_REGEN } from '../src/constants/recharge.ts';

/** The released galaxies. The eighth wraps back to the first, so eight is all there are. */
export const GALAXIES: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8];

/** Systems in one galaxy — the generator's own count. */
const SYSTEMS_PER_GALAXY = 256;

/**
 * How many systems a career sees. The smaller of the two sample sizes.
 *
 * `test/campaign.ts` flies 80 legs, so 80 systems is a career's worth of
 * arrivals. The variety claim is a sampled number, so it is read at this size
 * and at three times it, and it is believed only where the two agree.
 */
const CAREER_SYSTEMS = 80;

/**
 * A role Harmless spawns AND the source filed in a slot band.
 *
 * Derived rather than listed. The rock hermit and the generation ship are ours,
 * they have no band, and `roleSourceBands` is where that is already written
 * down — so they drop out here without this file holding a second opinion.
 */
export type ReceptionRole = Exclude<NpcRole, 'asteroid' | 'hermit' | 'generation'>;

export const RECEPTION_ROLES: readonly ReceptionRole[] =
  (Object.keys(SPECS) as (keyof typeof SPECS)[])
    .filter((role): role is ReceptionRole => roleSourceBands(role).length > 0);

/** The roster one system flies, and which blueprint set chose it. */
export interface SystemRoster {
  readonly galaxy: number;
  readonly system: StarSystem;
  /** The set letter, or null while every system flies the same roster. */
  readonly set: string | null;
  readonly specs: Record<ReceptionRole, readonly NpcSpec[]>;
}

/**
 * THE SEAM, and the whole of what M3 replaces.
 *
 * Today it ignores both arguments and hands back the one module-level roster,
 * which is the fact this baseline records. When `game/blueprint-set.ts` lands,
 * this asks it for the set in force and takes that set's specs. Nothing else in
 * the probe moves, so the tables before and after are the same tables.
 */
export function rosterInForce(_system: StarSystem, _galaxy: number): {
  set: string | null; specs: Record<ReceptionRole, readonly NpcSpec[]>;
} {
  return { set: null, specs: SPECS };
}

// --- what one build is worth -------------------------------------------------

const weaponByteOf = (spec: NpcSpec): number => npcWeaponByte(spec.profileId);

/** Points off the commander's pools per registered hit, her armour already off. */
export const perHitOf = (spec: NpcSpec): number =>
  npcLaserDamageToPlayer(weaponByteOf(spec), COBRA_MK_3_HULL_ID);

/** The most that gun can ever be worth: point blank, capped, never reloading late. */
export const bestCaseOf = (spec: NpcSpec): number =>
  npcBestCasePerSecond(weaponByteOf(spec), COBRA_MK_3_HULL_ID);

export interface Spread {
  min: number;
  mean: number;
  max: number;
}

/**
 * The three readings of a column.
 *
 * An empty band gives three zeroes, and that is not a silent answer: the row
 * beside it reports 0 designs, which is the state the plan warns about — a set
 * that fills none of a band's slots.
 */
function spread(values: readonly number[]): Spread {
  if (values.length === 0) return { min: 0, mean: 0, max: 0 };
  let min = values[0];
  let max = values[0];
  let total = 0;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
    total += v;
  }
  return { min, mean: total / values.length, max };
}

// --- the census ---------------------------------------------------------------

/** Every system of every galaxy, with the roster it flies. */
export function census(): SystemRoster[] {
  return GALAXIES.flatMap((galaxy) => generateGalaxy(galaxy).map((system) => ({
    galaxy, system, ...rosterInForce(system, galaxy),
  })));
}

/**
 * A sample of systems spread evenly across all eight galaxies.
 *
 * A stride rather than a draw, because a probe that rolled dice would need a
 * seed to be reproducible and there is nothing here for chance to measure. The
 * sample is what a career's worth of arrivals meets; the census above is what
 * the galaxy holds.
 */
export function sample(total: number): SystemRoster[] {
  const perGalaxy = Math.max(1, Math.floor(total / GALAXIES.length));
  const stride = Math.max(1, Math.floor(SYSTEMS_PER_GALAXY / perGalaxy));
  return GALAXIES.flatMap((galaxy) => {
    const systems = generateGalaxy(galaxy);
    const taken: SystemRoster[] = [];
    for (let i = 0; taken.length < perGalaxy && i < systems.length; i += stride) {
      taken.push({ galaxy, system: systems[i], ...rosterInForce(systems[i], galaxy) });
    }
    return taken;
  });
}

// --- what a band is worth over a set of systems -------------------------------

export interface BandRow {
  role: ReceptionRole;
  /** distinct designs a player can meet in this band across these systems */
  designs: number;
  /** distinct exact released builds of them */
  builds: number;
  /** per registered hit against a Cobra Mk III, over every (system, ship) pair */
  perHit: Spread;
  /** the same pairs as a ceiling in pool points a second */
  best: Spread;
  /** how many of those builds out-damage one face's regeneration at their best */
  overRegen: number;
}

export function bandRow(rows: readonly SystemRoster[], role: ReceptionRole): BandRow {
  const designs = new Set<string>();
  const builds = new Set<string>();
  const overRegen = new Set<string>();
  const perHit: number[] = [];
  const best: number[] = [];
  for (const row of rows) {
    for (const spec of row.specs[role]) {
      designs.add(spec.designId);
      builds.add(spec.profileId);
      const hit = perHitOf(spec);
      const ceiling = bestCaseOf(spec);
      if (ceiling > SHIELD_REGEN) overRegen.add(spec.profileId);
      perHit.push(hit);
      best.push(ceiling);
    }
  }
  return {
    role,
    designs: designs.size,
    builds: builds.size,
    perHit: spread(perHit),
    best: spread(best),
    overRegen: overRegen.size,
  };
}

export function bandRows(rows: readonly SystemRoster[]): BandRow[] {
  return RECEPTION_ROLES.map((role) => bandRow(rows, role));
}

/** The distinct set letters these systems chose. Empty while none chooses. */
export function setsChosen(rows: readonly SystemRoster[]): string[] {
  return [...new Set(rows.map((r) => r.set).filter((s): s is string => s !== null))].sort();
}

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
    + ` ${SYSTEMS_PER_GALAXY} systems each\n`);
  console.log('| galaxy | systems | sets | designs | builds |'
    + ' per hit mean/max | best case pts/s mean/max |');
  console.log('| --- | --- | --- | --- | --- | --- | --- |');
  for (const galaxy of GALAXIES) {
    const mine = rows.filter((r) => r.galaxy === galaxy);
    const band = bandRow(mine, 'pirate');
    console.log(`| ${rpad(galaxy, 6)} | ${rpad(mine.length, 7)} | ${rpad(setsLabel(mine), 4)} | `
      + `${rpad(band.designs, 7)} | ${rpad(band.builds, 6)} | ${rpad(two(band.perHit), 16)} | `
      + `${rpad(two(band.best), 24)} |`);
  }
}

function printBands(rows: readonly SystemRoster[]): void {
  console.log(`\n## what a reception is worth, by slot band — the same`
    + ` ${rows.length} systems\n`);
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

function printVariety(careerSystems: number): void {
  console.log(`\n## variety — what a career meets in the pirate band,`
    + ' at two sample sizes\n');
  console.log('| sample | systems | sets | designs | builds | per hit mean/max |');
  console.log('| --- | --- | --- | --- | --- | --- |');
  for (const [label, total] of [
    ['a career', careerSystems], ['three careers', careerSystems * 3],
  ] as const) {
    const rows = sample(total);
    const band = bandRow(rows, 'pirate');
    console.log(`| ${pad(label, 13)} | ${rpad(rows.length, 7)} | ${rpad(setsLabel(rows), 4)} | `
      + `${rpad(band.designs, 7)} | ${rpad(band.builds, 6)} | ${rpad(two(band.perHit), 16)} |`);
  }
}

export function printRosterProbe(careerSystems = CAREER_SYSTEMS): void {
  const rows = census();
  printByGalaxy(rows);
  printBands(rows);
  printVariety(careerSystems);
  if (setsChosen(rows).length === 0) {
    console.log('\nNO SYSTEM CHOOSES A SET YET. Every row above is the one collapsed'
      + ' roster, so the variety columns are its size and the sets column is empty.'
      + ' That is the docs/TODO/138 M1 baseline.');
  }
}

const isMain = process.argv[1]?.endsWith('roster-probe.ts') ?? false;
if (isMain) {
  const asked = Number(process.argv[2] ?? CAREER_SYSTEMS);
  printRosterProbe(Number.isFinite(asked) && asked > 0 ? asked : CAREER_SYSTEMS);
}
