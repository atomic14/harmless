// The whole world, as plain data.
//
// This is what makes a save anywhere possible. A station save is the commander
// alone. Mid-flight there is a great deal more that matters:
//
// - where you are;
// - which ships have you under fire;
// - what your shields are down to;
// - which way the random stream was about to break.
//
// Everything here is JSON: no THREE objects, no class instances, no functions.
// That is the point — `structuredClone` gives you a save, a replay checkpoint
// and a test fixture from the same call.
//
// A SNAPSHOT DELIBERATELY DOES NOT SAY WHOSE IT IS (docs/TODO/43). A world is a
// place and a moment. Which CAREER's autosave group it belongs to is the
// shelf's question. `SaveRecord.career` (save-file.ts) answers it, and
// `save:auto:<CAREER>:*` is keyed by that field. One home: the record.
//
// This file owns what a snapshot IS. That is four things:
//
// - the shape;
// - the version;
// - the `MIGRATIONS` table that climbs it;
// - the codec that turns live vectors into arrays and back.
//
// What makes one TRUSTWORTHY is `snapshot-parse.ts`, which split off on
// 2026-08-16. Nothing here validates anything.

import type { CommanderData } from './commander.ts';
import type { ShipSystems } from './systems.ts';
import type { EncounterTimers } from './encounters.ts';
import type { BrainSelection } from './brain-names.ts';

/**
 * Bump when the shape changes so stale snapshots are refused, not misread.
 *
 * 2 adds `occupant` and `grace` to a canister (GitHub #28). A version 1 save
 * holds capsules that cannot say who was inside, and a guess would decide a
 * commander's record for them.
 *
 * 3 adds `atonement` to the commander (GitHub #32).
 *
 * A BUMP IS NOT A REFUSAL ANY MORE (docs/TODO/161). `MIGRATIONS` below says how
 * to climb each step, and a stored save is raised on its way through the door.
 * A bump therefore costs one entry in that table. A version left out of that
 * table still cannot be loaded. That is a decision, not an oversight.
 */
export const SNAPSHOT_VERSION = 3;

/**
 * A plain object rather than an array or a null.
 *
 * It sits above both halves of this file because both need it. A migration asks
 * it of a snapshot it is about to raise. The parse boundary asks it of every
 * record it validates.
 */
export const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

/** One step up the version ladder: what to add, and where it starts. */
interface Migration {
  /** the version this raises, matched by strict equality */
  readonly from: number;
  /** fill in what the NEXT version added. It must not read anything else. */
  readonly up: (snap: Record<string, unknown>) => void;
}

/**
 * How a stored snapshot climbs to `SNAPSHOT_VERSION`.
 *
 * It sits beside the version because the constant's doc says what each number
 * ADDED and this says how to add it. Written apart, one of them would rot.
 *
 * **A save that will not load costs a career** (Chris, 2026-08-16). That is
 * what makes this the right trade, even where the raised value is a guess.
 *
 * What a step may guess is bounded. It fills in what a version did not have. It
 * never repairs a field that version was supposed to carry. That second half is
 * still junk, and the parser below still refuses it whole.
 *
 * Version 1 is deliberately absent. Its step is one entry, and docs/TODO/161
 * holds the argument.
 */
const MIGRATIONS: readonly Migration[] = [
  {
    // 2 → 3. `commander.atonement` is WRITTEN rather than left to a default.
    // `Persistence.restore` clones the commander straight in. So an absent
    // field reaches `recordWorkedOff` as undefined, and the ledger runs at NaN.
    // A commander in that state can never work a record off again, and nothing
    // says so. 0 costs a pilot up to `KILLS_PER_RUNG - 1` kills of credit, once
    // (docs/TODO/161).
    from: 2,
    up: (snap) => {
      const commander = snap.commander;
      if (isRecord(commander) && commander.atonement === undefined) {
        commander.atonement = 0;
      }
    },
  },
];

/**
 * Raise `raw` to `SNAPSHOT_VERSION`, or hand it back exactly as it arrived.
 *
 * It COPIES before it changes anything, and only when it has a step to run. So
 * a current snapshot is not cloned at all. A snapshot this cannot raise leaves
 * the caller's bytes byte for byte as they were. That is the same promise
 * `parseSnapshot` makes about the live session.
 *
 * A version it does not know matches nothing. An absent version, a string, and
 * a version NEWER than this build are all of that kind. Each falls through
 * unchanged, to the check that refuses it. Each step raises the version by
 * exactly one, so the loop cannot spin.
 */
export function migrateSnapshot(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  let step = MIGRATIONS.find((m) => m.from === raw.version);
  if (!step) return raw;
  const snap = structuredClone(raw);
  while (step) {
    step.up(snap);
    snap.version = step.from + 1;
    step = MIGRATIONS.find((m) => m.from === snap.version);
  }
  return snap;
}

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
   * What it IS — see ship-identity.ts. It is immutable, so it sits beside the
   * state rather than in it. It is also REQUIRED: a ship that does not say what
   * it is makes the snapshot unreadable. That is old junk rather than a world.
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
 * It recurses because nested state (e.g. `NpcState.dockPlan`) holds live vector
 * identities. So the state stays plain JSON, and the codec never needs its
 * field names.
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
 * Restore one value. It recurses into an object that is already there, where
 * possible.
 *
 * A write through an object that is already there preserves the mesh transform
 * and the docking plan's scratch-vector identities. A target that is absent
 * (for example a nullable cached brain decision) is still replaced as before.
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

/** ...and back. It writes INTO live vectors and nested reusable objects. */
export function restoreState(state: Record<string, unknown>, saved: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(saved)) state[k] = restoreValue(state[k], v);
}

export interface MissileSnapshot {
  pos: [number, number, number];
  quat: [number, number, number, number];
  /** index into `npcs`, or -1 for a hostile missile that flies at the player */
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
   * What is left of its released bank (TODO 28). A canister that was shot at,
   * and not destroyed, comes back wounded. REQUIRED, like every field here.
   */
  energy: number;
  /** who is inside a capsule, and `''` for a canister — see `Canister` */
  occupant: string;
  /** seconds of launch grace left, so a capsule saved fresh comes back safe */
  grace: number;
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
  /** every flight-session flag and timer, walked generically — see SessionState */
  session: Record<string, unknown>;
  /**
   * Generator state, not just the seed.
   *
   * A restore of the seed alone would rewind the stream to the moment you
   * entered the system. The next pirate wave and every damage roll after a
   * reload would then differ from the run you saved. This is the distinction
   * between a snapshot and an approximation.
   */
  rng: { seed: number; state: number };
  /** hyperspace target, so the chart still points at the world you chose */
  chartTarget: number | null;
  /** missiles in flight — a save taken mid-launch keeps them on their way */
  missiles: MissileSnapshot[];
  /**
   * The market and the work on offer.
   *
   * Not cosmetic and not optional. Both are rolled fresh when the ship enters a
   * station. So a save that dropped them would let you reload, and reroll
   * prices and contracts until you liked them. A save that keeps them is what
   * makes "save anywhere" a convenience rather than an exploit.
   */
  market: unknown[];
  hermitMarket: unknown[];
  contractOffers: unknown[];
  /** index into `npcs` of the missile-locked ship, or -1 */
  targetLock: number;
  /**
   * Whether a missile is armed. It is a live behaviour gate: `updateLock()`
   * returns immediately when it is false. So it must survive a reload.
   * Otherwise the pylon cools, and the lock is lost.
   */
  missileArmed: boolean;
  /** where the chart cursor was left */
  chartCursor: [number, number];
  /**
   * The station's orientation. It is not cosmetic: the slot normal, the docking
   * box and the bounce in `npcsVsStation` are all computed from it. So a
   * station rebuilt at its initial angle changes what every ship near it does.
   */
  stationQuat: [number, number, number, number];
}

export const v3 = (v: { x: number; y: number; z: number }): [number, number, number] =>
  [v.x, v.y, v.z];

export const q4 = (q: { x: number; y: number; z: number; w: number }):
[number, number, number, number] => [q.x, q.y, q.z, q.w];
