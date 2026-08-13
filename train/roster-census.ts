// The census the roster probe measures — docs/TODO/138.
//
// One arrival is a system, a galaxy and a value of the two random bits, and this
// walks them. It is the half of `train/roster-probe.ts` that can be WRONG in a
// way a test can catch, which is why it is the half `test/roster-probe.test.ts`
// imports: a measuring tool that disagrees with the game scores the change by a
// column that cannot see it (134's lesson, and 136's).
//
// Every number comes through the runtime functions — `npcWeaponByte`,
// `npcLaserDamageToPlayer`, `npcBestCasePerSecond` and `pirateSpecForTier` — so
// the probe cannot hold a second opinion about what a hit is worth or about
// which pirate a threat tier sends. `train/roster-probe.ts` prints what this
// measures and holds the argument about which table answers which claim.

import { generateGalaxy, type StarSystem } from '../src/galaxy/galaxy.ts';
import {
  pirateSpecForTier, SPECS, type NpcSpec, type RosterSpecs,
} from '../src/game/ship-specs.ts';
import { specsForSet } from '../src/game/set-roster.ts';
import { blueprintSetFor } from '../src/game/blueprint-set.ts';
import {
  npcBestCasePerSecond, npcLaserDamageToPlayer, npcWeaponByte,
} from '../src/game/gunnery.ts';
import { COBRA_MK_3_HULL_ID } from '../src/game/ship-identity.ts';
import { roleSourceBands, type NpcRole } from '../src/game/ship-roles.ts';
import { SHIELD_REGEN } from '../src/constants/recharge.ts';

/** The released galaxies. The eighth wraps back to the first, so eight is all there are. */
export const GALAXIES: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8];

/** Systems in one galaxy — the generator's own count. */
export const SYSTEMS_PER_GALAXY = 256;

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

/**
 * The two random bits, enumerated rather than drawn.
 *
 * The source flipped a two-bit coin on arrival, so ONE SYSTEM HAS FOUR
 * RECEPTIONS and a commander who comes back meets a different one. A probe may
 * not draw from the world stream, and it does not have to: four values is the
 * whole field, so it walks them.
 */
export const RANDOM_BITS: readonly number[] = [0, 1, 2, 3];

/**
 * One arrival: a system, in a galaxy, with one value of the two random bits.
 *
 * A ROW IS AN ARRIVAL AND NOT A SYSTEM, which is the one shape change M3 makes
 * to the M1 baseline. Under the baseline the distinction did not exist, because
 * every arrival anywhere met the same roster. It exists now, and counting
 * systems would have hidden three quarters of what a commander can meet.
 */
export interface SystemRoster {
  readonly galaxy: number;
  readonly system: StarSystem;
  readonly randomBits: number;
  /** The set letter, or null where nothing chooses. */
  readonly set: string | null;
  readonly specs: Record<ReceptionRole, readonly NpcSpec[]>;
}

/**
 * THE SEAM M1 LEFT, now wired.
 *
 * `blueprintSetFor` answers which of the 23 sets this arrival flies, and
 * `specsForSet` says what that set files. No override is passed: the Constrictor
 * system and witch-space are docs/TODO/138 M4, and neither is an ordinary
 * arrival.
 */
export function rosterInForce(system: StarSystem, galaxy: number, randomBits: number): {
  set: string | null; specs: Record<ReceptionRole, readonly NpcSpec[]>;
} {
  const set = blueprintSetFor(system, galaxy, randomBits);
  return { set, specs: specsForSet(set) };
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
export function spread(values: readonly number[]): Spread {
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

/** Every arrival there is: every system of every galaxy, at all four bit values. */
export function census(): SystemRoster[] {
  return GALAXIES.flatMap((galaxy) => generateGalaxy(galaxy).flatMap(
    (system) => RANDOM_BITS.map((randomBits) => ({
      galaxy, system, randomBits, ...rosterInForce(system, galaxy, randomBits),
    }))));
}

/**
 * A sample of arrivals spread evenly across all eight galaxies.
 *
 * A stride rather than a draw, because a probe that rolled dice would need a
 * seed to be reproducible and there is nothing here for chance to measure. The
 * bits cycle through all four values for the same reason. The sample is what a
 * career's worth of arrivals meets; the census above is what the galaxy holds.
 */
export function sample(total: number): SystemRoster[] {
  const perGalaxy = Math.max(1, Math.floor(total / GALAXIES.length));
  const stride = Math.max(1, Math.floor(SYSTEMS_PER_GALAXY / perGalaxy));
  return GALAXIES.flatMap((galaxy) => {
    const systems = generateGalaxy(galaxy);
    const taken: SystemRoster[] = [];
    for (let i = 0; taken.length < perGalaxy && i < systems.length; i += stride) {
      const randomBits = RANDOM_BITS[taken.length % RANDOM_BITS.length];
      taken.push({
        galaxy, system: systems[i], randomBits,
        ...rosterInForce(systems[i], galaxy, randomBits),
      });
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

/**
 * The pirate band as the GAME picks it — one row per (arrival, tier, seed).
 *
 * THE GUARD THAT BINDS. `spawnPopulation` never draws from the band uniformly:
 * it reads a threat tier off how attractive a target the commander looks and
 * asks `pirateSpecForTier` for a hull. So this walks the same call, at the same
 * three tiers, over every arrival — and `roster` is the only thing that varies,
 * which makes the collapsed roster its own before-picture.
 *
 * `SEEDS` is how many variant seeds each (arrival, tier) is read at. A tier's
 * pool is at most eight hulls, so eight seeds walks every one of them and the
 * mean is the pool's own mean rather than a sample of it.
 */
const SEEDS = 8;

export function tierPath(
  rows: readonly SystemRoster[], tier: number, roster?: RosterSpecs,
): { perHit: Spread; best: Spread } {
  const perHit: number[] = [];
  const best: number[] = [];
  for (const row of rows) {
    const inForce = roster ?? (row.specs as unknown as RosterSpecs);
    for (let seed = 0; seed < SEEDS; seed++) {
      const spec = pirateSpecForTier(tier, seed, inForce);
      perHit.push(perHitOf(spec));
      best.push(bestCaseOf(spec));
    }
  }
  return { perHit: spread(perHit), best: spread(best) };
}

/** The distinct set letters these systems chose. Empty while none chooses. */
export function setsChosen(rows: readonly SystemRoster[]): string[] {
  return [...new Set(rows.map((r) => r.set).filter((s): s is string => s !== null))].sort();
}

