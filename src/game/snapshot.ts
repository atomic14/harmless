// The whole world, as plain data.
//
// This is what makes saving anywhere possible: a station save is the commander
// alone, but mid-flight there is a great deal more that matters — where you are,
// what is shooting at you, what your shields are down to, and which way the
// random stream was about to break.
//
// Everything here is JSON: no THREE objects, no class instances, no functions.
// That is the point — `structuredClone` gives you a save, a replay checkpoint
// and a test fixture from the same call.
//
// A SNAPSHOT DELIBERATELY DOES NOT SAY WHOSE IT IS (docs/TODO/43). A world is a
// place and a moment; which CAREER's autosave group it belongs to is the
// shelf's question, answered in `SaveRecord.career` (save-file.ts), which is
// what `save:auto:<CAREER>:*` is keyed by. One home: the record.

import type { CommanderData } from './commander.ts';
import type { ShipSystems } from './systems.ts';
import type { EncounterTimers } from './encounters.ts';
import type { BrainSelection } from './brain-names.ts';
import { isNpcRole, type NpcRole } from './ship-roles.ts';
import {
  requirePlayerHullId, requireShipDesignId, requireNpcCombatProfileId,
} from './ship-identity.ts';

/** Bump when the shape changes so stale snapshots are refused, not misread. */
export const SNAPSHOT_VERSION = 1;

/** The part every ship has, player or not. */
export interface ShipSnapshot {
  pos: [number, number, number];
  /** x, y, z, w */
  quat: [number, number, number, number];
  speed: number;
  pitchRate: number;
  rollRate: number;
}

/**
 * A ship's state, serialised.
 *
 * NOT a hand-written field list: it is whatever `NpcState` contains, walked
 * generically — which is the whole reason the state was gathered into one
 * object. Add a field to NpcState and it is saved.
 */
export type NpcSnapshot = {
  role: string;
  seed: number;
  /**
   * What it IS — see ship-identity.ts. Immutable, so it is beside the state
   * rather than in it, and REQUIRED: a ship that does not say what it is makes
   * the snapshot unreadable, which is old junk rather than a world.
   */
  designId: string;
  profileId: string;
  /** index into `npcs` of whatever it is hunting, or -1 */
  targetIndex: number;
  state: Record<string, unknown>;
};

/**
 * Recursively turn vectors and quaternions into arrays.
 *
 * Recurses because nested state (e.g. `NpcState.dockPlan`) holds live vector
 * identities, so it stays plain JSON without the codec knowing its field names.
 */
function serialiseValue(value: unknown): unknown {
  if (value && typeof value === 'object' && 'x' in value && 'y' in value && 'z' in value) {
    const p = value as { x: number; y: number; z: number; w?: number };
    return p.w === undefined ? [p.x, p.y, p.z] : [p.x, p.y, p.z, p.w];
  }
  if (Array.isArray(value)) return value.map(serialiseValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, nested]) => [key, serialiseValue(nested)]),
    );
  }
  return value;
}

export function serialiseState(state: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(state)) out[k] = serialiseValue(v);
  return out;
}

/**
 * Restore one value, recursing into existing objects where possible.
 *
 * Writing through existing objects is what preserves the mesh transform and
 * docking plan's scratch-vector identities. A missing target (for example a
 * nullable cached brain decision) is still replaced as before.
 */
function restoreValue(target: unknown, saved: unknown): unknown {
  if (Array.isArray(saved)
    && target && typeof target === 'object' && 'x' in target && 'y' in target && 'z' in target) {
    const p = target as { x: number; y: number; z: number; w?: number };
    p.x = saved[0] as number; p.y = saved[1] as number; p.z = saved[2] as number;
    if (saved.length > 3) p.w = saved[3] as number;
    return target;
  }
  if (saved && typeof saved === 'object' && !Array.isArray(saved)
    && target && typeof target === 'object' && !Array.isArray(target)) {
    const targetRecord = target as Record<string, unknown>;
    for (const [key, nested] of Object.entries(saved as Record<string, unknown>)) {
      targetRecord[key] = restoreValue(targetRecord[key], nested);
    }
    return target;
  }
  return saved;
}

/** ...and back, writing INTO live vectors and nested reusable objects. */
export function restoreState(state: Record<string, unknown>, saved: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(saved)) state[k] = restoreValue(state[k], v);
}

export interface MissileSnapshot {
  pos: [number, number, number];
  quat: [number, number, number, number];
  /** index into `npcs`, or -1 for a hostile missile homing on the player */
  targetIndex: number;
  life: number;
}

export interface CanisterSnapshot {
  pos: [number, number, number];
  velocity: [number, number, number];
  spinAxis: [number, number, number];
  kind: 'cargo' | 'capsule';
  commodity: number;
  /**
   * What is left of its released bank (TODO 28), so a canister that has been
   * shot at but not destroyed comes back wounded. REQUIRED, like every field
   * here.
   */
  energy: number;
}

export interface WorldSnapshot {
  version: number;
  /** where the ship is: flight or docked. A snapshot of a menu is meaningless. */
  mode: 'flight' | 'docked';
  /** the persistent commander, exactly as a station save holds it */
  commander: CommanderData;
  // NO `career` HERE, and that is the rule rather than an omission — see the
  // header. A world knows where it is, not whose autosave group it is in.
  /** the level-1 galaxy sim, so prices and danger resume too */
  galaxyState: unknown;
  player: ShipSnapshot;
  systems: ShipSystems;
  npcs: NpcSnapshot[];
  canisters: CanisterSnapshot[];
  encounterTimers: EncounterTimers;
  /** the docking computer's approach, mid-manoeuvre — the `phase` latch matters */
  dockPlan: Record<string, unknown>;
  /** the player's autopilot mid-thought — see AutopilotState */
  combatComputer: Record<string, unknown>;
  /** the reception this system laid on */
  lastThreat: Record<string, unknown> | null;
  ecmDetectedTimer: number;
  /** which brains the NPCs fly — see BrainSelection; state, so it is saved */
  brains: BrainSelection;
  /** the playtest fit-anything override — see GameState.cheat */
  cheat: boolean;
  /** which ship test mode's SPAWN key drops — see GameState.cheatRole */
  cheatRole: NpcRole;
  /** every flight-session flag and timer, walked generically — see SessionState */
  session: Record<string, unknown>;
  /**
   * Generator state, not just the seed.
   *
   * Restoring the seed alone would rewind the stream to the moment you entered
   * the system, so the next pirate wave and every damage roll after a reload
   * would differ from the run you saved. The distinction between a snapshot
   * and an approximation.
   */
  rng: { seed: number; state: number };
  /** hyperspace target, so the chart still points where you were going */
  chartTarget: number | null;
  /** missiles in flight — a save taken mid-launch keeps them coming */
  missiles: MissileSnapshot[];
  /**
   * The market and the work on offer.
   *
   * Not cosmetic and not optional: both are rolled fresh when a station is
   * entered, so a save that dropped them would let you reload to reroll
   * prices and contracts until you liked them. Persisting them is what makes
   * "save anywhere" a convenience rather than an exploit.
   */
  market: unknown[];
  hermitMarket: unknown[];
  contractOffers: unknown[];
  /** index into `npcs` of the missile-locked ship, or -1 */
  targetLock: number;
  /**
   * Whether a missile is armed. A live behaviour gate — updateLock() returns
   * immediately when it is false — so it must survive a reload or the pylon
   * cools and the lock is lost.
   */
  missileArmed: boolean;
  /** where the chart cursor was left */
  chartCursor: [number, number];
  /**
   * The station's orientation. Not cosmetic: the slot normal, the docking box
   * and the bounce in npcsVsStation are computed from it, so a station rebuilt
   * at its starting angle changes what every ship near it does.
   */
  stationQuat: [number, number, number, number];
}

// --- the parse boundary -------------------------------------------------------
//
// `parseSnapshot` is THE door: a `WorldSnapshot` is only ever made from
// untrusted bytes here, and `Persistence.restore` consumes nothing that has
// not been through it — so "refused" and "half applied" are different states
// (docs/TODO/94).
//
// WHAT IT CHECKS, AND WHAT IT DELIBERATELY DOES NOT. The parser checks what
// has invariants: the version, the two branded id families, the mode enum,
// the galaxy and system bounds the generator would hang or crash on, array
// arities, finite numbers, and every fleet index. The opaque halves —
// `galaxyState`, `session`, `dockPlan`, `combatComputer`, the market arrays —
// are checked for PRESENCE and container shape only, because they are walked
// generically ON PURPOSE: enumerating their fields here would re-home
// `SessionState` and its kin into the save format, which is worse than no
// validation. The owning modules default and validate their own.
//
// The gate cannot rot: `test/snapshot-parse.test.ts` deletes and corrupts
// every key of a REAL captured snapshot, walked off the object itself rather
// than a written list, so a field `capture()` gains later is covered the day
// it exists — or the sweep finds this parser not checking it.

const bad = (what: string): never => { throw new Error(`snapshot: ${what}`); };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown, what: string): number =>
  (typeof v === 'number' && Number.isFinite(v) ? v : bad(`${what} is not a finite number`));
const finiteArray = (v: unknown, n: number, what: string): void => {
  if (!Array.isArray(v) || v.length !== n) bad(`${what} is not ${n} numbers`);
  for (const x of v as unknown[]) finite(x, what);
};
const record = (v: unknown, what: string): Record<string, unknown> =>
  (isRecord(v) ? v : bad(`${what} is not an object`));
const array = (v: unknown, what: string): unknown[] =>
  (Array.isArray(v) ? v : bad(`${what} is not an array`));
/** An index into the fleet: an integer in range, or -1 for "nobody". */
const fleetIndex = (v: unknown, fleet: number, what: string): void => {
  const n = finite(v, what);
  if (!Number.isInteger(n) || n < -1 || n >= fleet) bad(`${what} is outside the fleet`);
};

/**
 * Validate untrusted bytes as a `WorldSnapshot`, whole, or throw.
 *
 * Returns its input, typed: the interface stays the single declaration of the
 * shape and this is the only place `unknown` becomes one. Nothing is copied
 * and nothing is repaired — an invalid snapshot is old junk, refused whole,
 * and the refusal happens before anything has mutated.
 */
export function parseSnapshot(raw: unknown): WorldSnapshot {
  const s = record(raw, 'snapshot');
  if (s.version !== SNAPSHOT_VERSION) bad(`version ${String(s.version)}, expected ${SNAPSHOT_VERSION}`);
  if (s.mode !== 'flight' && s.mode !== 'docked') bad('mode is neither flight nor docked');

  const commander = record(s.commander, 'commander');
  requirePlayerHullId(commander.shipId);
  // The two numbers the rebuild would otherwise hang or crash on: the galaxy
  // seed loop runs `galaxy` twists, and the scene indexes systems[systemIndex].
  const galaxy = finite(commander.galaxy, 'commander.galaxy');
  if (!Number.isInteger(galaxy) || galaxy < 1 || galaxy > 8) bad('commander.galaxy is not 1..8');
  const sysIndex = finite(commander.systemIndex, 'commander.systemIndex');
  if (!Number.isInteger(sysIndex) || sysIndex < 0 || sysIndex > 255) {
    bad('commander.systemIndex is not 0..255');
  }

  if (!('galaxyState' in s)) bad('galaxyState is missing');   // opaque: presence only

  const player = record(s.player, 'player');
  finiteArray(player.pos, 3, 'player.pos');
  finiteArray(player.quat, 4, 'player.quat');
  finite(player.speed, 'player.speed');
  finite(player.pitchRate, 'player.pitchRate');
  finite(player.rollRate, 'player.rollRate');

  record(s.systems, 'systems');

  const npcs = array(s.npcs, 'npcs');
  for (const [i, n] of npcs.entries()) {
    const npc = record(n, `npcs[${i}]`);
    if (typeof npc.role !== 'string') bad(`npcs[${i}].role is not a string`);
    finite(npc.seed, `npcs[${i}].seed`);
    requireShipDesignId(npc.designId);
    requireNpcCombatProfileId(npc.profileId);
    fleetIndex(npc.targetIndex, npcs.length, `npcs[${i}].targetIndex`);
    record(npc.state, `npcs[${i}].state`);
  }

  for (const [i, c] of array(s.canisters, 'canisters').entries()) {
    const can = record(c, `canisters[${i}]`);
    finiteArray(can.pos, 3, `canisters[${i}].pos`);
    finiteArray(can.velocity, 3, `canisters[${i}].velocity`);
    finiteArray(can.spinAxis, 3, `canisters[${i}].spinAxis`);
    if (can.kind !== 'cargo' && can.kind !== 'capsule') bad(`canisters[${i}].kind`);
    finite(can.commodity, `canisters[${i}].commodity`);
    finite(can.energy, `canisters[${i}].energy`);
  }

  record(s.encounterTimers, 'encounterTimers');
  record(s.dockPlan, 'dockPlan');           // opaque: container shape only
  record(s.combatComputer, 'combatComputer');
  if (s.lastThreat !== null) record(s.lastThreat, 'lastThreat');
  finite(s.ecmDetectedTimer, 'ecmDetectedTimer');
  record(s.brains, 'brains');
  if (typeof s.cheat !== 'boolean') bad('cheat is not a boolean');
  // A role, not any string: the sky is built from it and `SPECS` is keyed on
  // it, so a hand-edited file naming a role that does not exist would spawn
  // nothing and say nothing.
  if (!isNpcRole(s.cheatRole)) bad(`cheatRole '${String(s.cheatRole)}' is not a role`);
  record(s.session, 'session');

  const rng = record(s.rng, 'rng');
  finite(rng.seed, 'rng.seed');
  finite(rng.state, 'rng.state');

  if (s.chartTarget !== null) finite(s.chartTarget, 'chartTarget');
  finiteArray(s.chartCursor, 2, 'chartCursor');
  finiteArray(s.stationQuat, 4, 'stationQuat');

  for (const [i, m] of array(s.missiles, 'missiles').entries()) {
    const mis = record(m, `missiles[${i}]`);
    finiteArray(mis.pos, 3, `missiles[${i}].pos`);
    finiteArray(mis.quat, 4, `missiles[${i}].quat`);
    fleetIndex(mis.targetIndex, npcs.length, `missiles[${i}].targetIndex`);
    finite(mis.life, `missiles[${i}].life`);
  }

  array(s.market, 'market');                // opaque rows: the market owns them
  array(s.hermitMarket, 'hermitMarket');
  array(s.contractOffers, 'contractOffers');
  fleetIndex(s.targetLock, npcs.length, 'targetLock');
  if (typeof s.missileArmed !== 'boolean') bad('missileArmed is not a boolean');

  return raw as WorldSnapshot;
}

export const v3 = (v: { x: number; y: number; z: number }): [number, number, number] =>
  [v.x, v.y, v.z];

export const q4 = (q: { x: number; y: number; z: number; w: number }):
[number, number, number, number] => [q.x, q.y, q.z, q.w];
