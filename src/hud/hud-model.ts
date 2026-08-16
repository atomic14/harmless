// The world becomes the numbers the HUD paints.
//
// The HUD itself is a dumb painter: hand it a HudState and it draws. Three
// things have to be worked out first:
//
//   1. where the scanner blips are;
//   2. which ship the crosshair is over;
//   3. where the docking slot lands on screen.
//
// Those three were 210 lines inside game.ts's renderHud, mixed in with the
// assembly.
//
// These are pure functions over the state they are given. Nothing here mutates
// the game. The only THREE objects they touch are the scratch vectors passed
// in. This runs every frame, so a fresh allocation would show.

import * as THREE from 'three';
import type { HudState, ScannerContact, ScreenTarget } from './hud.ts';
import type { NpcShip } from '../game/npc.ts';
import { velocityOf } from '../game/npc.ts';
import { isHostileToPlayer } from '../game/hostility.ts';
import { PLAYER_INTEREST_RANGE } from '../constants/player-interest.ts';
import {
  inSlotChannel, rollAlignedWithSlot, slotRollOffset,
} from '../game/docking.ts';
import { TARGET_BRACKET_RANGE, BOLT_SPEED } from '../constants/console.ts';

/**
 * Everything on the scanner: the station, the ships, the missiles and the
 * loose objects adrift.
 *
 * A loose object arrives with its `kind`, because a capsule is not a canister
 * and reads as its own blip. This parameter used to narrow them to
 * `{ object }`, which threw the kind away one call before the blip was painted.
 */
export function scannerContacts(
  stationPos: THREE.Vector3,
  npcs: readonly NpcShip[],
  missiles: readonly { object: THREE.Object3D }[],
  canisters: readonly { object: THREE.Object3D; kind: 'cargo' | 'capsule' }[],
  legalStatus: number,
  playerToStation: number,
): ScannerContact[] {
  const contacts: ScannerContact[] = [{ position: stationPos, kind: 'station' }];
  for (const npc of npcs) {
    if (!npc.state.alive) continue;
    const kind =
      npc.role === 'asteroid' ? 'asteroid'
      : npc.role === 'thargoid' || npc.role === 'thargon' ? 'thargoid'
      : isHostileToPlayer(npc, legalStatus, playerToStation) ? 'hostile'
      : 'ship';
    contacts.push({ position: npc.object.position, kind });
  }
  for (const m of missiles) contacts.push({ position: m.object.position, kind: 'missile' });
  for (const c of canisters) {
    contacts.push({
      position: c.object.position, kind: c.kind === 'capsule' ? 'pod' : 'cargo',
    });
  }
  return contacts;
}

/**
 * Project a world point into the HUD's marker space.
 *
 * A point behind us is mirrored, so an off-screen arrow points BACKWARDS. It
 * does not point at the reflection of that point through the camera. Project a
 * position behind the viewer, and clip space hands you a coordinate that looks
 * plausible on the wrong side.
 *
 * Written once here because the docking-slot marker and the threat arrow both
 * need it, and both had their own copy.
 */
export function projectMarker(
  world: THREE.Vector3,
  playerPos: THREE.Vector3,
  forward: THREE.Vector3,
  camera: THREE.Camera,
  scratch: THREE.Vector3,
): { x: number; y: number; behind: boolean } {
  const behind = scratch.copy(world).sub(playerPos).dot(forward) <= 0;
  scratch.copy(world).project(camera);
  return { x: behind ? -scratch.x : scratch.x, y: behind ? -scratch.y : scratch.y, behind };
}

/** Name the ship nearest the current view axis, for the auto ship-ID line. */
export function shipIdUnderView(
  npcs: readonly NpcShip[],
  playerPos: THREE.Vector3,
  viewDir: THREE.Vector3,
  scratch: THREE.Vector3,
): string {
  let bestAngle = 0.06;
  let id = '';
  for (const npc of npcs) {
    if (!npc.state.alive) continue;
    const to = scratch.copy(npc.object.position).sub(playerPos);
    const dist = to.length();
    if (dist > 4500) continue;
    const angle = viewDir.angleTo(to.normalize());
    if (angle < bestAngle) {
      bestAngle = angle;
      id = `${(npc.object.name || 'ASTEROID').toUpperCase()} ${(dist / 1000).toFixed(1)}KM`;
    }
  }
  return id;
}

/** Nearest hostile within 9km, plus how many there are, for the threat arrow. */
export function nearestHostile(
  npcs: readonly NpcShip[],
  playerPos: THREE.Vector3,
  legalStatus: number,
  playerToStation: number,
): { npc: NpcShip; count: number } | null {
  let nearest: NpcShip | null = null;
  let best = Infinity;
  let count = 0;
  for (const npc of npcs) {
    if (!isHostileToPlayer(npc, legalStatus, playerToStation)) continue;
    const d = npc.object.position.distanceTo(playerPos);
    if (d > PLAYER_INTEREST_RANGE) continue;
    count += 1;
    if (d < best) { best = d; nearest = npc; }
  }
  return nearest ? { npc: nearest, count } : null;
}

/**
 * Where the slot is on screen, and how well lined up you are.
 *
 * The marker is deliberately NOT gated on a nose pointed at the station.
 * "Which way is the slot?" is exactly the question you have when you point the
 * wrong way. Close in, the station fills the view with a blank black face.
 *
 * The alignment aid IS gated, so it appears only once the approach is real. A
 * departure launches with the nose the other way, and the aid should stay out
 * of the way.
 */
export function dockingAid(
  station: THREE.Object3D,
  stationDockZ: number,
  playerPos: THREE.Vector3,
  playerQuat: THREE.Quaternion,
  playerForward: THREE.Vector3,
  camera: THREE.Camera,
  scratch: { a: THREE.Vector3; b: THREE.Vector3; q: THREE.Quaternion },
): { dockAid: HudState['dockAid']; slotMarker: HudState['slotMarker'] } {
  const none = { dockAid: null, slotMarker: null };
  const dist = playerPos.distanceTo(station.position);
  const slotN = scratch.a.set(0, 0, -1).applyQuaternion(station.quaternion);
  const onSlotSide = scratch.b.copy(playerPos).sub(station.position).dot(slotN) > 0;
  if (dist >= 3000 || !onSlotSide) return none;

  const slotWorld = scratch.a.set(0, 0, -stationDockZ);
  station.localToWorld(slotWorld);
  const slotMarker = projectMarker(
    slotWorld.clone(), playerPos, playerForward, camera, scratch.b);

  const facingStation = playerForward
    .dot(scratch.b.copy(station.position).sub(playerPos).normalize()) > 0.35;
  if (!facingStation) return { dockAid: null, slotMarker };

  const local = scratch.b.copy(playerPos);
  station.worldToLocal(local);
  scratch.q.copy(station.quaternion).invert().multiply(playerQuat);
  const right = scratch.a.set(1, 0, 0).applyQuaternion(scratch.q);
  // The slot's own rules, not a copy of them. This used to hardcode the
  // channel and the roll tolerance. So the aid and the dock test could
  // disagree, and once the letterbox turned upright they did.
  const inSlot = inSlotChannel(local.x, local.y);
  const rollOk = rollAlignedWithSlot(right.x, right.y);
  return {
    slotMarker,
    dockAid: {
      x: local.x,
      y: local.y,
      roll: slotRollOffset(right.x, right.y),
      inSlot,
      rollOk,
      // The CHOICE lives here rather than in the painter. Green has to mean
      // that the dock test would pass, and `inSlot` alone is the lateral half
      // of it. So a ship centred in the letterbox and rolled 30° out read
      // LINED UP one moment before `dockingOutcome` returned 'slotMiss'.
      // A canvas cannot be asserted against. This can (docs/TODO/120).
      port: !inSlot ? 'off' : rollOk ? 'lined' : 'roll',
    },
  };
}

/**
 * Target brackets: ships in front of the current view, plus a lead marker on
 * the locked one.
 *
 * A laser bolt is instant, but the target moves on while you line up. So the
 * lead point shows where the target will be after the bolt's flight time.
 *
 * It assumes that the target holds its heading at its speed. That is wrong the
 * moment the target turns, which is exactly why it is an aid rather than an
 * autoaim.
 *
 * On a stopped target the lead sits on the hull, and that is correct. No floor
 * keeps it off, because a floor is a lie about where the shot lands.
 */
export function screenTargets(
  npcs: readonly NpcShip[],
  playerPos: THREE.Vector3,
  viewDir: THREE.Vector3,
  camera: THREE.Camera,
  legalStatus: number,
  locked: NpcShip | null,
  scratch: THREE.Vector3,
  playerToStation: number,
): ScreenTarget[] {
  const out: ScreenTarget[] = [];
  for (const npc of npcs) {
    if (!npc.state.alive) continue;
    const to = scratch.copy(npc.object.position).sub(playerPos);
    const dist = to.length();
    if (dist > TARGET_BRACKET_RANGE) continue;
    if (viewDir.dot(to.normalize()) < 0.3) continue;   // behind, or far off-view
    const ndc = npc.object.position.clone().project(camera);
    if (ndc.z > 1) continue;

    const isLocked = locked === npc;
    const target: ScreenTarget = {
      x: ndc.x,
      y: ndc.y,
      size: Math.min(0.5, (npc.radius * 2.2) / dist),
      hostile: isHostileToPlayer(npc, legalStatus, playerToStation),
      locked: isLocked,
      // NORMALIZED at the boundary: the bracket paints a 0..1 bar, and combat
      // stores whole source energy points — see NpcShip.healthFraction.
      hp: npc.healthFraction,
      label: `${(npc.object.name || 'ASTEROID').toUpperCase()}  ${(dist / 1000).toFixed(1)}KM`,
    };
    if (isLocked && npc.role !== 'asteroid') {
      const flight = dist / BOLT_SPEED;
      const vel = velocityOf(npc.object.quaternion, npc.state.speed, scratch);
      const lead = npc.object.position.clone().addScaledVector(vel, flight).project(camera);
      if (lead.z <= 1) target.lead = { x: lead.x, y: lead.y };
    }
    out.push(target);
  }
  return out;
}

