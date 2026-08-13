// The ship roster: which hulls fly which role, and how tough each one is.
//
// Pure data tables, in the spirit of the 1984 originals.
//
// EVERY NUMBER IN THIS FILE IS HARMLESS'S. The rows say colour, cruise, turn
// rate, bounty and racks — presentation, motion and selection policy. Not one
// source combat field is copied in: energy, defence, laser power and the
// released bounty live in the catalogue and are reached through `profileId`, so
// re-importing the pack cannot leave a stale twin here. The one source number
// the rows DO consume is a released top speed, and it arrives converted
// (`cruise`), never copied. A row's toughness is the released bank its
// `profileId` resolves to, and nothing else.
//
// Nothing here decides anything: `ship-roles.ts` says which designs a role may
// fly at all, population.ts chooses how many, contracts.ts chooses the threat
// tier, spawning.ts puts them in the sky.

import { ACCEL_FRACTION } from '../constants/hull-motion.ts';
import { PLAYER_FLIGHT } from '../constants/player-flight.ts';
import { eliteADesign } from './elite-a/catalogue.ts';
import { hullThreatTier } from './threat.ts';
import { roleCombatProfileId } from './role-variants.ts';
import type { NpcRole } from './ship-roles.ts';
import {
  COBRA_MK_3_HULL_ID, eliteAShipIdentity, HARMLESS_OVERLAYS, playerHull, shipDesignIdOf,
  type HarmlessOverlay, type NpcCombatProfileId, type ShipDesignId, type ShipIdentity,
} from './ship-identity.ts';

/**
 * Which source design each roster hull IS, stated once.
 *
 * Written down rather than inferred because inferring it is the failure
 * ship-identity.ts exists to prevent: `spec.def === COBRA_MK3` makes the
 * geometry table the identity table, and a hull reused for two ships would
 * silently change what a ship is. These are the pack's own design ids, each
 * validated by `eliteAShipIdentity` as the table below is built.
 */
const SOURCE_DESIGN = {
  shuttle: 8, transporter: 9, cobraMk3: 10, python: 11, boa: 12, anaconda: 13,
  worm: 14, viper: 16, sidewinder: 17, mamba: 18, krait: 19, adder: 20,
  gecko: 21, cobraMk1: 22, asp: 23, ferDeLance: 24, moray: 25, thargoid: 26,
  thargon: 27, constrictor: 28, dragon: 29, monitor: 30, ophidian: 31,
  ghavial: 32, bushmaster: 33, rattler: 34, iguana: 35, shuttleMk2: 36,
  chameleon: 37,
  /** The source roster's own rock — the one design whose mesh Harmless generates. */
  asteroid: 6,
} as const;

/**
 * The ids a roster row states: which design, and which exact build of it.
 *
 * THE ROLE IS AN ARGUMENT because the build depends on the job. A pirate flies
 * the hardest released build of its hull that the source ever filed as a pirate;
 * a trader flies the pack's recommended default. Both are exact released
 * variants of the same design — the rule, and why it is not a balance change,
 * is `game/role-variants.ts`.
 */
const flying = (role: NpcRole, sourceDesignId: number): ShipIdentity => {
  const designId = shipDesignIdOf(sourceDesignId);
  return { designId, profileId: roleCombatProfileId(role, designId) };
};

/** The same, for one of the two Harmless inventions — the ids alone, not the note. */
const own = (o: HarmlessOverlay): ShipIdentity =>
  ({ designId: o.designId, profileId: o.profileId });

/**
 * What an asteroid is. The `asteroid` role has no `NpcSpec` — its size is
 * rolled from the seed — so its identity lives here beside the roster.
 *
 * The IDS only: a rock is generated (`buildAsteroid`) at a size drawn from its
 * seed, so it is the one design whose mesh and radius do not come from the
 * registry. A Harmless deviation (the released asteroid is one fixed 20-unit
 * lump), stated here rather than left silent: a field where every rock is
 * identical is worse to fly through, and the size variety is what makes one
 * worth aiming at. The three exact designs stay registered and viewable — the
 * deviation is which mesh the `asteroid` role spawns, not which designs exist.
 */
export const ASTEROID_IDENTITY: ShipIdentity = eliteAShipIdentity(SOURCE_DESIGN.asteroid);

// --- the one source-speed conversion ----------------------------------------

/**
 * World units per second for one unit of released top speed.
 *
 * Anchored on the Cobra Mk III, the way the geometry is: the released player
 * Cobra tops out at 42 source units and the Harmless player ship at 400, so one
 * source unit is 400/42 ≈ 9.52 units/s. Read from both tables rather than
 * written down, so neither can drift from it quietly.
 *
 * Not in `src/constants/`: half of it is `PLAYER_FLIGHT`, which is there, but
 * the other half is a released hull, and reaching one means a chain of imports
 * that directory may not make. So the expression stays here where both halves
 * are in scope.
 */
export const WORLD_SPEED_PER_SOURCE_SPEED =
  PLAYER_FLIGHT.maxSpeed / playerHull(COBRA_MK_3_HULL_ID).maxSpeed;

/** A released top speed in world units/second. The only conversion there is. */
export function sourceSpeedToWorld(sourceSpeed: number): number {
  return Math.round(sourceSpeed * WORLD_SPEED_PER_SOURCE_SPEED);
}

/**
 * The cruise for a hull Harmless has never chosen one for.
 *
 * Used by the designs this phase brought into the roster. The ones already
 * flying keep the speeds they were tuned and trained at — those numbers are the
 * world the shipped brains were fitted in — so the conversion applies only
 * where there was nothing, which is why a Shuttle cruises at 180 and a
 * converted Shuttle Mk II at 86.
 */
const cruise = (sourceDesignId: number): number =>
  sourceSpeedToWorld(eliteADesign(sourceDesignId).maxSpeed);

export interface NpcSpec extends ShipIdentity {
  /** which catalogue design this hull is — see ship-identity.ts */
  designId: ShipDesignId;
  /** the exact released build it flies as, resolved from the recommended default */
  profileId: NpcCombatProfileId;
  color: number;
  // No hull points: how tough a ship is comes through `profileId`.
  maxSpeed: number;
  /**
   * Radians/second of yaw authority — and OURS.
   *
   * The Harmless motion overlay, with `accel`: the pack has a top speed per
   * design and nothing else, because the original's handling is a table of
   * per-frame rotation bytes for a 2 MHz 6502, not a number this flight model
   * could take. So every turn rate below is a browser-game constant chosen for
   * feel. The per-hull half is data; the shared multipliers `TURN` and
   * `ACCEL_FRACTION` are `constants/hull-motion.ts`.
   */
  turnRate: number;
  bounty: number; // tenths of a credit
  /**
   * Units/s of thrust. Omitted means ACCEL_FRACTION of top speed, which is
   * what every hull wants unless it is deliberately sluggish or brisk — use
   * `shipAccel()` rather than reading this field. Also part of the motion
   * overlay: the pack does not define it.
   */
  accel?: number;
  missiles?: number;
  ecmChance?: number;
  cargoDrop?: number; // max canisters dropped on destruction
  armed?: boolean; // turns and fights back (the defensive attack run, npc.ts) when attacked
}

/** How hard this hull can throttle, units/s. See ACCEL_FRACTION. */
export function shipAccel(spec: NpcSpec): number {
  return spec.accel ?? spec.maxSpeed * ACCEL_FRACTION;
}

/** The roster, by role — every row a ship of that role may fly. */
export type RosterSpecs = Record<Exclude<NpcRole, 'asteroid'>, readonly NpcSpec[]>;

/**
 * The roster with NO blueprint set in force — every row Harmless has.
 *
 * Which designs each role MAY contain is `ship-roles.ts`'s answer, read off the
 * released blueprint slots, and `test/ship-roles.test.ts` holds every row below
 * to it — so a hull cannot be filed as a trader because it looked like one.
 * Which of the permitted designs a role actually flies is a choice, and this is
 * where it is made.
 *
 * A system narrows this to the designs its own set files (`specsForSet`). This
 * table is what is left when nothing narrows it, and it has three callers that
 * want exactly that: the training world, which must not move under a trained
 * brain (invariant 5); the viewer and the combat exercises, which are about the
 * catalogue rather than about a place; and `specForDesign`, which looks a
 * RESTORED ship up by the design its snapshot recorded and so may not be
 * narrowed by where the commander happens to be now.
 */
export const SPECS: Record<Exclude<NpcRole, 'asteroid'>, NpcSpec[]> = {
  trader: [
    { ...flying('trader', SOURCE_DESIGN.cobraMk3), color: 0xffffff, maxSpeed: 220, turnRate: 0.5, bounty: 0, ecmChance: 0.4, cargoDrop: 3, armed: true },
    { ...flying('trader', SOURCE_DESIGN.python), color: 0xd9e8ff, maxSpeed: 160, turnRate: 0.35, bounty: 0, ecmChance: 0.5, cargoDrop: 5, armed: true },
    { ...flying('trader', SOURCE_DESIGN.anaconda), color: 0xcfe0d8, maxSpeed: 120, turnRate: 0.25, bounty: 0, ecmChance: 0.7, cargoDrop: 6, armed: true },
    { ...flying('trader', SOURCE_DESIGN.adder), color: 0xffe28a, maxSpeed: 260, turnRate: 0.8, bounty: 0, cargoDrop: 1 },
    { ...flying('trader', SOURCE_DESIGN.worm), color: 0xbfd8bf, maxSpeed: 200, turnRate: 0.9, bounty: 0, cargoDrop: 1 },
    { ...flying('trader', SOURCE_DESIGN.boa), color: 0xd8d8c0, maxSpeed: 140, turnRate: 0.3, bounty: 0, ecmChance: 0.6, cargoDrop: 5, armed: true },
    { ...flying('trader', SOURCE_DESIGN.shuttle), color: 0xc8e8c8, maxSpeed: 180, turnRate: 0.7, bounty: 0, cargoDrop: 1 },
    { ...flying('trader', SOURCE_DESIGN.transporter), color: 0xc0d0e0, maxSpeed: 160, turnRate: 0.5, bounty: 0, cargoDrop: 2 },
    // --- cruise converted, turn ours ----------------------------------------
    { ...flying('trader', SOURCE_DESIGN.cobraMk1), color: 0xe8e8ff, maxSpeed: cruise(SOURCE_DESIGN.cobraMk1), turnRate: 0.85, bounty: 0, ecmChance: 0.3, cargoDrop: 2, armed: true },
    { ...flying('trader', SOURCE_DESIGN.dragon), color: 0xcfd8e8, maxSpeed: cruise(SOURCE_DESIGN.dragon), turnRate: 0.22, bounty: 0, ecmChance: 0.7, cargoDrop: 6, armed: true },
    { ...flying('trader', SOURCE_DESIGN.monitor), color: 0xd0d0c8, maxSpeed: cruise(SOURCE_DESIGN.monitor), turnRate: 0.35, bounty: 0, ecmChance: 0.5, cargoDrop: 4, armed: true },
    { ...flying('trader', SOURCE_DESIGN.ophidian), color: 0xdfe8ff, maxSpeed: cruise(SOURCE_DESIGN.ophidian), turnRate: 1.05, bounty: 0, cargoDrop: 1 },
    { ...flying('trader', SOURCE_DESIGN.ghavial), color: 0xd8e0d0, maxSpeed: cruise(SOURCE_DESIGN.ghavial), turnRate: 0.35, bounty: 0, ecmChance: 0.4, cargoDrop: 4, armed: true },
    { ...flying('trader', SOURCE_DESIGN.rattler), color: 0xe0d8c8, maxSpeed: cruise(SOURCE_DESIGN.rattler), turnRate: 0.95, bounty: 0, cargoDrop: 2, armed: true },
    { ...flying('trader', SOURCE_DESIGN.iguana), color: 0xd8e8c8, maxSpeed: cruise(SOURCE_DESIGN.iguana), turnRate: 1.0, bounty: 0, cargoDrop: 1 },
    { ...flying('trader', SOURCE_DESIGN.shuttleMk2), color: 0xc8e8d8, maxSpeed: cruise(SOURCE_DESIGN.shuttleMk2), turnRate: 0.6, bounty: 0, cargoDrop: 1 },
    { ...flying('trader', SOURCE_DESIGN.chameleon), color: 0xd8d8e8, maxSpeed: cruise(SOURCE_DESIGN.chameleon), turnRate: 0.9, bounty: 0, ecmChance: 0.4, cargoDrop: 3, armed: true },
  ],
  // The pirate roster is ALSO the threat-tier table — see PIRATE_TIERS below.
  pirate: [
    { ...flying('pirate', SOURCE_DESIGN.sidewinder), color: 0xff9a5c, maxSpeed: 300, turnRate: 1.1, bounty: 50 },
    { ...flying('pirate', SOURCE_DESIGN.krait), color: 0xffb36c, maxSpeed: 290, turnRate: 1.0, bounty: 80 },
    { ...flying('pirate', SOURCE_DESIGN.mamba), color: 0xff8a4c, maxSpeed: 310, turnRate: 1.05, bounty: 70 },
    { ...flying('pirate', SOURCE_DESIGN.gecko), color: 0xffa050, maxSpeed: 290, turnRate: 1.0, bounty: 60 },
    { ...flying('pirate', SOURCE_DESIGN.moray), color: 0xff9a70, maxSpeed: 280, turnRate: 1.0, bounty: 65 },
    { ...flying('pirate', SOURCE_DESIGN.cobraMk3), color: 0xffc46c, maxSpeed: 260, turnRate: 0.8, bounty: 100, missiles: 1, cargoDrop: 2 },
    { ...flying('pirate', SOURCE_DESIGN.worm), color: 0xffbb80, maxSpeed: 200, turnRate: 0.9, bounty: 40 },
    { ...flying('pirate', SOURCE_DESIGN.ferDeLance), color: 0xff7a4c, maxSpeed: 330, turnRate: 1.1, bounty: 180, missiles: 1, ecmChance: 0.5, cargoDrop: 2 },
    { ...flying('pirate', SOURCE_DESIGN.python), color: 0xffa878, maxSpeed: 160, turnRate: 0.35, bounty: 200, missiles: 2, ecmChance: 0.6, cargoDrop: 4 },
    // --- cruise converted, turn ours ----------------------------------------
    { ...flying('pirate', SOURCE_DESIGN.cobraMk1), color: 0xffb066, maxSpeed: cruise(SOURCE_DESIGN.cobraMk1), turnRate: 0.85, bounty: 90, cargoDrop: 2 },
    { ...flying('pirate', SOURCE_DESIGN.ophidian), color: 0xffc07a, maxSpeed: cruise(SOURCE_DESIGN.ophidian), turnRate: 1.05, bounty: 55 },
    { ...flying('pirate', SOURCE_DESIGN.bushmaster), color: 0xff8f5c, maxSpeed: cruise(SOURCE_DESIGN.bushmaster), turnRate: 1.1, bounty: 110, missiles: 1 },
    { ...flying('pirate', SOURCE_DESIGN.rattler), color: 0xffa060, maxSpeed: cruise(SOURCE_DESIGN.rattler), turnRate: 0.95, bounty: 120, cargoDrop: 1 },
    { ...flying('pirate', SOURCE_DESIGN.iguana), color: 0xffb078, maxSpeed: cruise(SOURCE_DESIGN.iguana), turnRate: 1.0, bounty: 110 },
    { ...flying('pirate', SOURCE_DESIGN.chameleon), color: 0xff9a80, maxSpeed: cruise(SOURCE_DESIGN.chameleon), turnRate: 0.9, bounty: 190, missiles: 1, ecmChance: 0.4, cargoDrop: 2 },
    { ...flying('pirate', SOURCE_DESIGN.monitor), color: 0xff7a5c, maxSpeed: cruise(SOURCE_DESIGN.monitor), turnRate: 0.35, bounty: 220, missiles: 2, ecmChance: 0.6, cargoDrop: 4 },
    // The Asp Mk II. Its byte, 73, is laser power NINE: 36 before armour, 29 to
    // a Cobra Mk III, one of the hardest guns any pirate carries. The source
    // filed it as a pirate (I:23, N:23, T:23), so this is released permission,
    // and it is fast: source speed 40, the quickest of the fighters.
    { ...flying('pirate', SOURCE_DESIGN.asp), color: 0xff6a48, maxSpeed: cruise(SOURCE_DESIGN.asp), turnRate: 1.1, bounty: 200, missiles: 1, ecmChance: 0.5, cargoDrop: 2 },
  ],
  police: [
    { ...flying('police', SOURCE_DESIGN.viper), color: 0x9ad9ff, maxSpeed: 320, turnRate: 1.3, bounty: 0, ecmChance: 1 },
  ],
  hunter: [
    { ...flying('hunter', SOURCE_DESIGN.ferDeLance), color: 0xd8c8ff, maxSpeed: 330, turnRate: 1.1, bounty: 0, ecmChance: 0.6 },
    // The Asp Mk II is a bounty hunter too — the source filed it under this job
    // as well (I:23, T:23).
    { ...flying('hunter', SOURCE_DESIGN.asp), color: 0xccc0ff, maxSpeed: cruise(SOURCE_DESIGN.asp), turnRate: 1.1, bounty: 0, ecmChance: 0.5 },
    // --- cruise converted, turn ours ----------------------------------------
    { ...flying('hunter', SOURCE_DESIGN.cobraMk1), color: 0xc8c8ff, maxSpeed: cruise(SOURCE_DESIGN.cobraMk1), turnRate: 0.85, bounty: 0, ecmChance: 0.3 },
    { ...flying('hunter', SOURCE_DESIGN.monitor), color: 0xc0c8e0, maxSpeed: cruise(SOURCE_DESIGN.monitor), turnRate: 0.35, bounty: 0, ecmChance: 0.6 },
    { ...flying('hunter', SOURCE_DESIGN.ophidian), color: 0xd0c8ff, maxSpeed: cruise(SOURCE_DESIGN.ophidian), turnRate: 1.05, bounty: 0, ecmChance: 0.3 },
    { ...flying('hunter', SOURCE_DESIGN.ghavial), color: 0xc8d0e8, maxSpeed: cruise(SOURCE_DESIGN.ghavial), turnRate: 0.35, bounty: 0, ecmChance: 0.5 },
    { ...flying('hunter', SOURCE_DESIGN.bushmaster), color: 0xd8c0ff, maxSpeed: cruise(SOURCE_DESIGN.bushmaster), turnRate: 1.1, bounty: 0, ecmChance: 0.4 },
    { ...flying('hunter', SOURCE_DESIGN.rattler), color: 0xccc8f0, maxSpeed: cruise(SOURCE_DESIGN.rattler), turnRate: 0.95, bounty: 0, ecmChance: 0.4 },
    { ...flying('hunter', SOURCE_DESIGN.iguana), color: 0xd0d8f0, maxSpeed: cruise(SOURCE_DESIGN.iguana), turnRate: 1.0, bounty: 0, ecmChance: 0.35 },
    { ...flying('hunter', SOURCE_DESIGN.chameleon), color: 0xd4c8f8, maxSpeed: cruise(SOURCE_DESIGN.chameleon), turnRate: 0.9, bounty: 0, ecmChance: 0.45 },
  ],
  thargoid: [
    { ...flying('thargoid', SOURCE_DESIGN.thargoid), color: 0x7cff9a, maxSpeed: 300, turnRate: 0.7, bounty: 500, ecmChance: 1 },
  ],
  thargon: [
    { ...flying('thargon', SOURCE_DESIGN.thargon), color: 0x9cffb0, maxSpeed: 350, turnRate: 1.8, bounty: 50 },
  ],
  // a hollowed asteroid trading post — inert, but you can dock with it. OURS,
  // not a source station, and its `harmless:` ids say so.
  hermit: [
    { ...own(HARMLESS_OVERLAYS.rockHermit), color: 0x9a9a8a, maxSpeed: 0, turnRate: 0, bounty: 0 },
  ],
  // derelict colony vessel: vast, slow, defenceless — also ours
  generation: [
    { ...own(HARMLESS_OVERLAYS.generationShip), color: 0xbfc8d8, maxSpeed: 25, turnRate: 0.05, bounty: 0, cargoDrop: 8 },
  ],
};

/**
 * Pirate hulls by threat tier (see pirateThreat() in threat.ts). Tier is
 * decided by how attractive a target the player looks — a poor Cobra full of
 * food draws opportunists in Sidewinders; a fat, notorious one draws a gang in
 * Fer-de-Lances. Passed to spawnNpc as a specOverride, so these stay ordinary
 * pirates for every other purpose (bounty, legality, police response).
 *
 * DERIVED from `hullThreatTier` — energy, defence and laser power off the exact
 * released build — so a hull moves tier only when the pack says it got tougher.
 * Order within a tier is roster order, so a given seed always picks the same
 * hull.
 *
 * These are `SPECS`'s tiers, so they are the tiers with NO set in force. A
 * system's own are `pirateTiersFor`, and this is also what they fall back to.
 */
export const PIRATE_TIERS: NpcSpec[][] = tiersOf(SPECS);

function tiersOf(roster: RosterSpecs): NpcSpec[][] {
  return [0, 1, 2].map(
    (tier) => roster.pirate.filter((s) => hullThreatTier(s.designId, s.profileId) === tier));
}

const tiersBySet = new Map<RosterSpecs, NpcSpec[][]>();

/**
 * The same three tiers, inside the set in force.
 *
 * EVERY PIRATE THE GAME SPAWNS COMES THROUGH HERE, not through `rosterSpec`:
 * `spawnPopulation` picks a tier from how attractive a target the commander
 * looks and hands the hull in as an override. So this is the seam the pirate
 * band actually turns on, and narrowing `SPECS.pirate` alone would have left the
 * one band docs/TODO/138 is about untouched.
 */
export function pirateTiersFor(roster: RosterSpecs): NpcSpec[][] {
  if (roster === SPECS) return PIRATE_TIERS;
  const known = tiersBySet.get(roster);
  if (known !== undefined) return known;
  const tiers = tiersOf(roster);
  tiersBySet.set(roster, tiers);
  return tiers;
}

/**
 * Pick a hull for a pirate of the given threat tier.
 *
 * A NARROWED SET CAN EMPTY A TIER, and twelve of the 23 do: sets D, G, H and R
 * file no pirate design tough enough to be tier 2, and eight others file none
 * soft enough to be tier 0. The full roster's tier answers there, which is the
 * SAME rule `specsForSet` states for a band the set leaves empty, one level
 * down — where the set files nothing for this job, the roster does.
 *
 * IT IS THE THREAT RULE THAT MAY NOT BE VETOED. The tier is what the commander
 * LOOKS worth: fat, notorious and far from help draws an organised gang
 * (`pirateThreat` in threat.ts). Letting a local blueprint file downgrade that
 * would mean notoriety quietly stopped mattering wherever the file was thin,
 * and the measurement says by how much — a tier-2 hit falls from 17.5 points to
 * 15.8 on the mean under a downgrade, against 17.5 under this rule.
 */
export function pirateSpecForTier(
  tier: number, variantSeed: number, roster: RosterSpecs = SPECS,
): NpcSpec {
  const asked = Math.max(0, Math.min(PIRATE_TIERS.length - 1, tier));
  const inForce = pirateTiersFor(roster)[asked];
  const tiers = inForce.length > 0 ? inForce : PIRATE_TIERS[asked];
  return tiers[Math.abs(variantSeed) % tiers.length];
}

export const CONSTRICTOR_SPEC: NpcSpec = {
  // `pirate` is the role it flies with, and its released slot 31 is in no
  // pirate band — so `role-variants.ts` leaves it on the pack's recommended
  // build, `G:28`, which is the only one there is.
  ...flying('pirate', SOURCE_DESIGN.constrictor), color: 0xffd24d, maxSpeed: 370, turnRate: 1.2,
  bounty: 2500, missiles: 2, ecmChance: 1,
};

/**
 * The roster row for a design a ship ALREADY knows it is.
 *
 * Restoring a save is the caller (persistence.ts): a snapshot carries the
 * ship's `designId`, and looking the row up by design cannot disagree with the
 * saved identity the way rebuilding from a tier table could.
 *
 * The Constrictor is included under `pirate` because that is the role it flies
 * with; it is not in `SPECS.pirate` for the reason `ship-roles.ts` gives.
 *
 * `KEY_SEP` joins the two halves of a key, written as an ESCAPE: a raw NUL byte
 * made this file `data` to file(1), which both grep and ripgrep skip in
 * silence. test/ship-roles.test.ts fails if a raw one comes back.
 */
const KEY_SEP = '\u0000';

const BY_ROLE_AND_DESIGN = new Map<string, NpcSpec>(
  [
    ...Object.entries(SPECS).flatMap(
      ([role, list]) => list.map((s) => [`${role}${KEY_SEP}${s.designId}`, s] as const)),
    [`pirate${KEY_SEP}${CONSTRICTOR_SPEC.designId}`, CONSTRICTOR_SPEC] as const,
  ],
);

/**
 * The roster row a ship of this role and seed flies — the rule the NpcShip
 * constructor applies, as a function.
 *
 * `roster` is the set in force. It defaults to `SPECS` because a ship built
 * without a world — an arena, a trainer, a test — is not in a system, and
 * `World.spawn` is what hands in a narrowed one.
 *
 * `null` for a rock: its size is rolled from the seed, so it has no row.
 */
export function rosterSpec(
  role: NpcRole, variantSeed: number, override?: NpcSpec, roster: RosterSpecs = SPECS,
): NpcSpec | null {
  if (role === 'asteroid') return null;
  return override ?? roster[role][variantSeed % roster[role].length];
}

export function specForDesign(
  role: NpcRole, designId: ShipDesignId,
): NpcSpec | undefined {
  // A snapshot that names no design is refused (ship-identity.ts), so the only
  // miss left is a design this role has no roster row for.
  return BY_ROLE_AND_DESIGN.get(`${role}${KEY_SEP}${designId}`);
}
