// A ship goes into the station slot. It is the one manoeuvre that needs roll
// control. Neither the scripted NPC steering nor the player's docking computer
// could do it before this file.
//
// Shared deliberately. A trader that puts in at the station and the player's
// docking computer solve the same problem. Get onto the slot axis. Match the
// slot's rotation. Run in. Two solutions would be two things to get wrong, and
// the hard part is roll, which is identical for both.
//
// Roll is the crux for one reason. `NpcShip.steerToward` builds an orientation
// from `lookAt(dir, WORLD_UP)`, so roll is whatever falls out of an aim at a
// target. The station's slot is a letterbox on a hull that spins at
// `STATION_SPIN`. So a ship that cannot choose its roll cannot fit through it.
// The fix takes the up-hint from the STATION rather than from the world. That
// matches the slot's rotation for free as it turns.
//
// The letterbox itself is constants/docking.ts. That file holds which way up it
// stands, how wide the channel is, and the roll tolerance. The released slot
// measurements sit beside the values. `test/world.test.ts` and
// `test/docking.test.ts` pin the geometry.
//
// WHERE the ship is sent is `dock-path.ts`, and it is a curve. What is here is
// the plan read off that curve: the heading, the speed, the roll handover and
// who counts as docked. The split is docs/TODO/136. The approach used to be two
// rival aims with a threshold between them, and the threshold is what reversed.
//
// WHAT THE PLAYER'S AUTOPILOT DOES WITH THE STICK is `docking-sticks.ts`, along
// the seam the constants and the tests already had. An NPC trader reads the plan
// and steers with `lookAt`. Only the commander's ship is flown by a hand.

import * as THREE from 'three';

import {
  GATE_HALF_WIDTHS, LINED_UP_LATERAL, HULL_BOX_MARGIN,
  SLOT_HALF_ACROSS, SLOT_HALF_ALONG, SLOT_DEPTH, ROLL_TOLERANCE,
} from '../constants/docking.ts';
import { slotNormal } from '../world/slot.ts';
import { dockPath, makeDockPath } from './dock-path.ts';

export type DockPhase =
  /** still on the turn — the path decides where the ship goes */
  | 'gate'
  /** on the last leg: down the axis, rolled with the slot */
  | 'run';

export interface DockPlan {
  /** unit vector the ship should point along */
  heading: THREE.Vector3;
  /** up-hint for the orientation — the station's own up, so roll matches the slot */
  up: THREE.Vector3;
  /** speed to fly at */
  speed: number;
  phase: DockPhase;
  /** inside the slot far enough to count as docked */
  arrived: boolean;
  /** distance off the slot axis, for HUD and tests */
  lateral: number;
  /**
   * The plane this ship turns in, held across frames. `dock-path.ts` reads and
   * writes it. It is saved state, like the phase: a ship restored mid-approach
   * carries on the way round it already took.
   */
  swing: THREE.Vector3;
}

const _rel = new THREE.Vector3();
const _slotN = new THREE.Vector3();
/** the path is scratch, not state: everything held across frames is in DockPlan */
const _path = makeDockPath();

/**
 * One frame of a docking approach.
 *
 * @param pos       the ship's position
 * @param station   the station object (its quaternion carries the slot's roll)
 * @param dockZ     station half-width — the slot sits on the local -Z face
 * @param maxSpeed  the ship's top speed
 * @param out       reused plan object, so this allocates nothing per frame
 */
export function planDocking(
  pos: THREE.Vector3,
  station: THREE.Object3D,
  dockZ: number,
  maxSpeed: number,
  out: DockPlan,
): DockPlan {
  // the slot faces along the station's local -Z, which is outwards
  slotNormal(station, _slotN);
  _rel.copy(pos).sub(station.position);
  const along = _rel.dot(_slotN);
  // perpendicular distance from the axis
  const lateral = _rel.addScaledVector(_slotN, -along).length();
  out.lateral = lateral;
  // The station's local X, and not its Y. `lookAt(heading, up)` puts the ship's
  // RIGHT perpendicular to the up-hint. The wings must lie along the slot's
  // LONG axis, which is the station's local Y (see the header). The Y put every
  // trader through the letterbox side-on.
  out.up.set(1, 0, 0).applyQuaternion(station.quaternion);

  const gateDist = dockZ * GATE_HALF_WIDTHS;

  // WHERE THE APPROACH GOES is `dock-path.ts`. The whole of the answer here is a
  // point one lookahead along it. No branch is left. The stand-off, the way
  // round the hull and the run in are one curve, so the aim moves along it
  // smoothly however sharply it turns. What used to be here was two rival aims
  // and a threshold with no hysteresis between them. It reversed the commanded
  // heading through a half turn on 223 of 504 approaches, and every one of them
  // came from behind the station (docs/TODO/136).
  const path = dockPath(pos, station, dockZ, out.swing, _path);
  // A zero-length heading is not reachable. The aim runs no deeper than the
  // station's centre, and `arrived` fires by the slot mouth. A plan that yields
  // NaN steers every axis at once, so the last heading stands instead.
  if (path.aim.distanceToSquared(pos) > 1e-6) {
    out.heading.copy(path.aim).sub(pos).normalize();
  }

  // Speed is part of the manoeuvre and not a detail. Three of the four rewrites
  // in docs/TODO/136 hurt, because the ship arrived somewhere too fast to turn.
  // The speed is eased over the gate distance BEFORE the mouth, rather than
  // switched at it. So the roll has the length of the corridor to settle in, and
  // the run's own speed is unchanged.
  //
  // A SECOND RULE WAS TRIED HERE AND MEASURED AWAY. It capped the speed by how
  // sharply the path bends. The nose's lag behind a turned demand would then
  // stay inside `DC_TURN_FADE_ANGLE`, and the roll would never get a nearly
  // degenerate axis to hunt around. It reads well and it costs more than it
  // buys. The ring it was aimed at is roughly one reversal a second whatever the
  // speed, so a slower ship simply buys more seconds of it. The 504-approach
  // sweep gives the median approach at four caps:
  //
  //   - unlimited: 15.6s and 16 roll reversals;
  //   - 0.20 rad/s: 18.0s and 17;
  //   - 0.12 rad/s: 23.9s and 20;
  //   - 0.08 rad/s: 34.3s and 25.
  //
  // What fixed the scrape that motivated it was the LOOKAHEAD. See
  // `DC_PATH_LOOKAHEAD`, where the same sweep put the cliff.
  const settled = Math.min(110, maxSpeed * 0.7);
  const cruise = Math.max(settled, maxSpeed * 0.55);
  const eased = Math.max(0, Math.min(1, (path.toGo - gateDist) / gateDist));
  out.speed = Math.max(25, settled + (cruise - settled) * eased);

  // The phase no longer decides anything about WHERE the ship goes. The path
  // does that from end to end, and that is the point of it. What is left is the
  // question `dockingSticks` asks: is this ship on the last leg, and does the
  // slot's own roll matter yet? The flag an NPC trader carries is the other
  // half.
  //
  // Commit only when the ship is on the axis. To skip the lateral test is the
  // obvious mistake. A ship that reaches the gate 150 units off-axis, and then
  // flies straight, carries that error into the hull instead of the slot.
  //
  // It also LATCHES. As the ship runs in, `along` shrinks past any
  // outside-the-hull guard. A test on every frame would drop the roll handover
  // exactly where the letterbox needs it.
  const committed = out.phase === 'run' && along > 0 && lateral < LINED_UP_LATERAL * 2;
  const linedUp = committed || path.toGo <= gateDist ||
    (lateral < LINED_UP_LATERAL && along > dockZ && along < gateDist * 1.5);
  out.phase = linedUp ? 'run' : 'gate';

  // Inside the slot mouth, still on the axis, and IN FRONT of the station. The
  // third of those three was absent. `along` is signed, so a ship behind the
  // hull satisfied `along < dockZ` trivially. So a trader that drifted within
  // `LINED_UP_LATERAL` of the axis LINE, on the far side, counted itself docked.
  // It then despawned through the back of the station (game/npc.ts reads this).
  // The wrong-side sweep in docs/TODO/136 found it.
  out.arrived = along > 0 && along < dockZ && lateral < LINED_UP_LATERAL;
  return out;
}

/** A fresh plan object to hand to `planDocking` each frame. */
export function makeDockPlan(): DockPlan {
  return {
    heading: new THREE.Vector3(0, 0, -1),
    up: new THREE.Vector3(0, 1, 0),
    speed: 0,
    phase: 'gate',
    arrived: false,
    lateral: 0,
    swing: new THREE.Vector3(),
  };
}


// --- who is actually docked ------------------------------------------------
//
// This lived twice. `arrived` above is what an NPC trader docks on, and it has
// NO roll test at all. A second version sat in game.ts `checkStation()`, with a
// bounding box, a slot channel and a roll test. So an NPC could thread a
// letterbox the player could not, and only the NPC's half was testable.
//
// One rule, one home. The consequence — bounce, damage, message, or actually
// docking — stays with the Game, because that is what it costs.

/**
 * Is a point in the slot channel? `x` and `y` are station-LOCAL.
 *
 * It is exported because the HUD's alignment aid asks the same question. That
 * aid answered it with its own copy of the numbers (`hud/hud-model.ts`), which
 * is the rule with two homes this project is organised against. That copy also
 * kept the old horizontal channel through this change, and said nothing.
 */
export function inSlotChannel(localX: number, localY: number): boolean {
  return Math.abs(localX) < SLOT_HALF_ACROSS && Math.abs(localY) < SLOT_HALF_ALONG;
}

/**
 * Are the wings lined up with the slot's long axis?
 *
 * `right` is the ship's own +X in the STATION's frame. The slot runs along the
 * station's local Y, so alignment is measured against Y and the tolerance is
 * the angle away from it. Both magnitudes are absolute: a ship upside down in
 * the slot still fits through it.
 */
export function rollAlignedWithSlot(rightX: number, rightY: number): boolean {
  return slotRollOffset(rightX, rightY) < ROLL_TOLERANCE;
}

/** How far off the slot's long axis the wings are, in radians. */
export function slotRollOffset(rightX: number, rightY: number): number {
  return Math.atan2(Math.abs(rightX), Math.abs(rightY));
}

export type DockingOutcome =
  /** nothing near enough to matter */
  | 'clear'
  /** through the slot, lined up — you are down */
  | 'docked'
  /** in the channel but rolled wrong */
  | 'slotMiss'
  /** flew into the hull */
  | 'hull';

/**
 * Where a ship is relative to the slot.
 *
 * @param scratch a Vector3 and a Quaternion to work in; this runs every frame.
 */
export function dockingOutcome(
  pos: THREE.Vector3,
  quat: THREE.Quaternion,
  station: THREE.Object3D,
  dockZ: number,
  scratch: { v: THREE.Vector3; q: THREE.Quaternion; r: THREE.Vector3 },
): DockingOutcome {
  const box = dockZ + HULL_BOX_MARGIN;
  const local = scratch.v.copy(pos);
  station.worldToLocal(local);
  // deliberately cheap: an axis-aligned cube
  if (Math.abs(local.x) > box || Math.abs(local.y) > box || Math.abs(local.z) > box) {
    return 'clear';
  }
  const inSlot = local.z < -(dockZ - SLOT_DEPTH) && inSlotChannel(local.x, local.y);
  if (!inSlot) return 'hull';

  scratch.q.copy(station.quaternion).invert().multiply(quat);
  const right = scratch.r.set(1, 0, 0).applyQuaternion(scratch.q);
  return rollAlignedWithSlot(right.x, right.y) ? 'docked' : 'slotMiss';
}
