// THE DOOR: untrusted bytes become a `WorldSnapshot` here, or they do not
// become one at all.
//
// `Persistence.restore` consumes nothing that did not come through
// `parseSnapshot`. So "refused" and "half applied" are different states
// (docs/TODO/94).
//
// It is also where `migrateSnapshot` RAISES a STORED snapshot to the current
// version. One door, two jobs, in that order. What an old version lacked is
// filled in first. Everything is then checked. So a save from an older build
// loads, rather than gets listed and then refused (docs/TODO/161).
//
// `snapshot.ts` owns what a snapshot IS — the shape, the version, the table
// that climbs it, and the codec that turns vectors into arrays. This file owns
// what makes one TRUSTWORTHY, and it split off on 2026-08-16 when the migration
// took the pair over the size ceiling.
//
// WHAT IT CHECKS, AND WHAT IT DELIBERATELY DOES NOT. The parser checks what
// carries an invariant:
//
//   - the version;
//   - the two branded id families;
//   - the mode enum;
//   - the galaxy and system bounds the generator would hang or crash on;
//   - array arities;
//   - finite numbers;
//   - every fleet index.
//
// The opaque halves are checked for PRESENCE and container shape only. Those
// are `galaxyState`, `session`, `dockPlan`, `combatComputer`, and the market
// arrays. A generic walk covers them ON PURPOSE. Their fields enumerated here
// would re-home `SessionState` and its kin into the save format, which is worse
// than no validation. Each owning module defaults and validates its own.
//
// The gate cannot rot. `test/snapshot-parse.test.ts` deletes and corrupts every
// key of a REAL captured snapshot. It walks the object itself, rather than a
// written list. So a field `capture()` gains later is covered the day it
// exists. Otherwise the sweep finds that this parser does not check it.
// `test/snapshot-migrate.test.ts` owns the other half: what is RAISED.

import {
  SNAPSHOT_VERSION, isRecord, migrateSnapshot, type WorldSnapshot,
} from './snapshot.ts';
import {
  requirePlayerHullId, requireShipDesignId, requireNpcCombatProfileId,
} from './ship-identity.ts';

const bad = (what: string): never => { throw new Error(`snapshot: ${what}`); };

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
 * It returns its input, typed. The interface stays the single declaration of
 * the shape, and this is the only place an `unknown` becomes one.
 *
 * AN OLD SNAPSHOT AND AN INVALID ONE ARE DIFFERENT THINGS (docs/TODO/161).
 * `migrateSnapshot` RAISES an old one first. It fills in what that version
 * lacked, and hands back a copy.
 *
 * An invalid one is still refused whole, and repaired never. The refusal still
 * comes before any mutation, of the live session and of the caller's own bytes
 * alike.
 */
export function parseSnapshot(raw: unknown): WorldSnapshot {
  const s = record(migrateSnapshot(raw), 'snapshot');
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
    if (typeof can.occupant !== 'string') bad(`canisters[${i}].occupant`);
    finite(can.grace, `canisters[${i}].grace`);
  }

  record(s.encounterTimers, 'encounterTimers');
  record(s.dockPlan, 'dockPlan');           // opaque: container shape only
  record(s.combatComputer, 'combatComputer');
  if (s.lastThreat !== null) record(s.lastThreat, 'lastThreat');
  finite(s.ecmDetectedTimer, 'ecmDetectedTimer');
  record(s.brains, 'brains');
  if (typeof s.cheat !== 'boolean') bad('cheat is not a boolean');
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

  // `s`, not `raw`. The two are the same object for a current snapshot. For a
  // raised one, `s` is the copy that carries what the migration filled in
  // (docs/TODO/161). A `raw` returned here would validate the copy and hand
  // back the original, which is the version 2 save unchanged.
  return s as unknown as WorldSnapshot;
}

