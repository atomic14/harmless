// Bank-to-turn: how the commander's ship points its nose at a place with only
// the two axes the stick has — pitch and roll, never yaw.
//
// The player's Cobra has no yaw axis. The stick pitches and rolls, and that is
// all (player.ts). To bring the nose onto something off to one side, you ROLL
// until it is above or below you, then you PITCH up to it. Those are the same
// two moves a hand on the stick makes.
//
// This returns those two moves as STICK COMMANDS in −1..1, which is exactly
// what a human's keys produce (engine/flight-controls.ts). So the scripted
// combat computer flies through the same ramp and the same `PlayerShip.update`
// a person does. The Game ramps the commands into rates, which is why the HUD's
// pitch and roll needles read a co-pilot at the stick too.
//
// It replaced a quaternion slew that turned the ship directly toward a look-at
// orientation. That slew rolled the target into the pitch plane and only THEN
// measured pitch. So it asked for no pitch at all until the roll ended. The
// ship visibly "just rotated", and for a target behind and below it never
// arrived. A roll and a pitch TOGETHER, each off the current geometry, is what
// fixes both: a sphere-convergence probe went from 70 stuck directions to none.
//
// Pure and allocation-free on a shared scratch. The caller owns the ramp and
// the caps. This only decides which way to move each stick, and how hard.

import * as THREE from 'three';
import { STEER_SATURATION, STEER_PITCH_SATURATION, ROLL_FADE_ANGLE, ROLL_FADE_FLOOR } from '../constants/combat-computer.ts';

export interface StickCommand {
  /** pitch stick, −1 (nose down) .. +1 (nose up) */
  pitch: number;
  /** roll stick, −1 .. +1 */
  roll: number;
}

/**
 * The one thing the controller remembers between frames. It is which vertical
 * the roll takes the target onto: +1 for the top, where the nose pitches up, or
 * −1 for the bottom.
 *
 * Without it, a target near the horizontal plane flips the choice every frame.
 * The roll and pitch sticks then slam hard over in alternate directions, and
 * the nose never arrives. The sphere probe caught that limit cycle about 30
 * degrees out, near dead astern. The caller owns one per engagement.
 */
export interface SteerMemory {
  side: 1 | -1;
}

export function freshSteerMemory(): SteerMemory {
  return { side: 1 };
}

const dirNorm = new THREE.Vector3();
const up = new THREE.Vector3();
const right = new THREE.Vector3();
const fwd = new THREE.Vector3();

/** A proportional ask that saturates to ±1 at `STEER_SATURATION` radians. */
function stick(errorRad: number): number {
  return Math.max(-1, Math.min(1, errorRad / STEER_SATURATION));
}

/** Wrap an angle to −pi..pi. */
function wrap(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/**
 * The pitch and roll a pilot would ask for this frame to bring `quat`'s nose
 * (−Z) toward `dir`, with pitch and roll alone.
 *
 * Bank first, then pull. ROLL swings the target onto the vertical pitch plane,
 * and PITCH raises the nose to it. But pitch is GATED by how far the roll still
 * has to go, which is the `cos` of the roll error.
 *
 * Full pitch during a roll makes the nose trace a cone that orbits the target
 * rather than closes on it. The sphere probe caught it stuck about 30 degrees
 * out. The gate on roll alignment is what makes it converge, and roll is fast
 * enough (`PLAYER_FLIGHT.maxRoll` > maxPitch) that the wait costs little.
 *
 * The vertical it banks toward is STICKY (`mem`). It takes the shorter roll to
 * begin with, and flips only when the other becomes shorter by a clear margin.
 * A target near the horizontal plane is otherwise a coin-toss that lands
 * differently every frame, and the sticks chatter instead of turn.
 *
 * `nullBand` is the angle in radians inside which the nose counts as ON the
 * target. It is the caller's gun cone, which is WIDE up close, because a near
 * target subtends a wide angle. Inside it the controller asks for NOTHING.
 *
 * That is the seasickness fix. A target that already fills the gun still has a
 * bearing, and that bearing swings as it drifts a hair off centre. A bank to
 * chase the last degree chatters the roll axis for a correction the gun does
 * not need.
 *
 * A sweep of the whole control law settled it. Every attempt to damp the
 * chatter in the GEOMETRY broke convergence, whether by a softer roll or by
 * decoupled axes. The aggressive bank is what gets the nose onto a hard target.
 * This deadzone leaves convergence from all 475 sphere directions
 * intact, and cuts roll amplitude by an order of magnitude. Pass 0 to steer all
 * the way to dead centre.
 */
export function bankToTurn(
  quat: THREE.Quaternion, dir: THREE.Vector3, mem: SteerMemory, nullBand = 0,
): StickCommand {
  if (dir.lengthSq() < 1e-12) return { pitch: 0, roll: 0 };
  dirNorm.copy(dir).normalize();

  // Where the target lies in the ship's own frame.
  right.set(1, 0, 0).applyQuaternion(quat);
  up.set(0, 1, 0).applyQuaternion(quat);
  fwd.set(0, 0, -1).applyQuaternion(quat);
  const localX = dirNorm.dot(right);
  const localY = dirNorm.dot(up);
  const localZ = dirNorm.dot(fwd);

  const offPlane = Math.hypot(localX, localY);
  const theta = Math.atan2(offPlane, localZ); // off-nose angle, 0..pi
  // On the target already — inside the gun cone — so hold steady (see nullBand).
  if (theta < Math.max(1e-6, nullBand)) return { pitch: 0, roll: 0 };

  // The roll to bank the target onto each vertical. A frame roll of r about
  // local +Z shifts the target's X-Y bearing by −r. That bearing is `alpha`,
  // measured from "right". So the top costs `alpha - pi/2` at bearing +pi/2,
  // and the bottom costs `alpha + pi/2` at −pi/2. A target dead ahead or dead
  // astern (offPlane ~ 0) has no bearing and no roll to make.
  const alpha = offPlane > 1e-6 ? Math.atan2(localY, localX) : Math.PI / 2;
  const toTop = wrap(alpha - Math.PI / 2);
  const toBottom = wrap(alpha + Math.PI / 2);

  // Flip the committed side only when the other is shorter by more than the
  // saturation band. That is enough to break the every-frame tie near the
  // horizontal plane, and it still answers a genuine change of side at once.
  const here = mem.side === 1 ? toTop : toBottom;
  const other = mem.side === 1 ? toBottom : toTop;
  if (Math.abs(other) + STEER_SATURATION < Math.abs(here)) mem.side = mem.side === 1 ? -1 : 1;
  const rollErr = mem.side === 1 ? toTop : toBottom;

  // Roll to bank the target onto the vertical, FADED by how far off the nose it
  // actually is (`theta`).
  //
  // `rollErr` is a BEARING: how far round the clock the target sits from
  // vertical. It is large even for a target a few degrees off the nose, so
  // `stick(rollErr)` alone asked for full roll to correct a 3-degree error. At
  // full authority the ship overshoots as a target manoeuvres, and then
  // reverses. That is the spin far out, and the seasick oscillation in the mid
  // range.
  //
  // Authority ramps in over `ROLL_FADE_ANGLE`, down to a floor
  // (`ROLL_FADE_FLOOR`). It is full for a genuinely off-axis target, and gentle
  // near the nose. The floor is why this converges where a fade to zero did
  // not. It converges to within a gun cone rather than to dead centre, which is
  // all a gun that fires through a cone needs. See the constants for the whole
  // argument, and for why lead pursuit was rejected.
  const rollAuthority = Math.max(ROLL_FADE_FLOOR, Math.min(1, theta / ROLL_FADE_ANGLE));
  const roll = stick(rollErr) * rollAuthority;

  // PITCH the nose onto the target. The gate is `cos(rollErr)`: pull once the
  // bank is there, and not while the plane is still 90 degrees off. That is
  // what stops a far target from a pitch the wrong way, before the roll brings
  // it in. That is the convergence property.
  //
  // STRONGER when the target is AHEAD. A saturation shared with roll left a
  // near, slightly-off target with only a fraction of the pitch. That was too
  // weak to drag a target that weaves into the gun (Chris, flying it: "the pitch is
  // not strong enough"). `pitchSat` tightens toward `STEER_PITCH_SATURATION` as
  // `localZ` -> 1. It blends back to the roll band as the target goes abeam or
  // behind, where hard pitch would cost convergence.
  //
  // This alone tripled time on target close up, and it held that gain at
  // distance, which is the part that matters. A roll derivative term was tried
  // beside it. It damped the close-up chatter, but it drove a sustained bank on
  // a far target, and it was dropped.
  const pitchSat = localZ > 0
    ? STEER_PITCH_SATURATION + (STEER_SATURATION - STEER_PITCH_SATURATION) * (1 - localZ)
    : STEER_SATURATION;
  const pitch = Math.max(-1, Math.min(1, theta / pitchSat))
    * mem.side * Math.max(0, Math.cos(rollErr));

  return { pitch, roll };
}

/**
 * The roll stick that brings the ship's WINGS onto `wanted`, with the nose
 * where it is.
 *
 * `bankToTurn` above answers "which way is the nose". This answers the other
 * question a pilot has, and the docking computer is the caller that has it. The
 * slot is a letterbox on a hull that spins, so a ship pointed at it is only
 * half way in (docs/TODO/126, `rollAlignedWithSlot` in docking.ts).
 *
 * A roll of `r` about the ship's own +Z carries local +X toward local +Y. So
 * the error is just where `wanted` sits in that pair. It is folded to a QUARTER
 * TURN either way, and `rollErrorTo` below states why.
 *
 * It uses the same `STEER_SATURATION` band as the pitch and roll above. So the
 * whole controller asks for full stick at one angle rather than at three.
 *
 * @param wanted where the ship's +X should end up, in world space. Near-parallel
 *   to the nose it carries no roll information, and the answer is 0.
 */
/**
 * A stick deflection for an error in radians. It is the proportional ask every
 * controller in this file makes, and it saturates to ±1 at `STEER_SATURATION`.
 *
 * It is exported for a caller that works in ANGLES. The docking computer clamps
 * its roll into the letterbox's tolerance before it asks (docking.ts). That
 * caller can then do the arithmetic where the geometry is. It still hands the
 * ship the same deflection for the same error as everything else here.
 */
export function steerStick(errorRad: number): number {
  return stick(errorRad);
}

/**
 * The pitch stick that pulls the nose onto `dir` with NO bank. It is the
 * vertical half of the error, in the ship's own pitch plane.
 *
 * `bankToTurn`'s pitch is gated by how far its own roll plan still has to go.
 * That is right where the turn spends the roll, and wrong where something else
 * spends it. The docking computer is that caller. Once its wings commit to the
 * letterbox (`rollOnto` above), the gate reads a roll that will never happen.
 * The nose then gets no correction at all. Measured, it drifts from 6 to 15
 * degrees off over a run, and into the hull.
 *
 * What it cannot do is the sideways half. A ship with no yaw axis, and its
 * wings spoken for, can only pull. That is the honest limit of the two
 * together. It survives here, because the slot's own rotation sweeps the pitch
 * plane round as the approach runs.
 */
export function pitchOnto(quat: THREE.Quaternion, dir: THREE.Vector3): number {
  if (dir.lengthSq() < 1e-12) return 0;
  dirNorm.copy(dir).normalize();
  up.set(0, 1, 0).applyQuaternion(quat);
  fwd.set(0, 0, -1).applyQuaternion(quat);
  return stick(Math.atan2(dirNorm.dot(up), dirNorm.dot(fwd)));
}

export function rollOnto(quat: THREE.Quaternion, wanted: THREE.Vector3): number {
  return stick(rollErrorTo(quat, wanted));
}

/**
 * ...and the same thing in RADIANS, for a caller that must reason about the
 * angle before it asks. The docking computer clamps this into the letterbox's
 * roll tolerance, so that the turn and the slot share one stick (docking.ts).
 *
 * Signed, and folded to a quarter turn either way. A letterbox takes a ship
 * upside down as happily as the right way up, so a 180-degree roll to prefer
 * one of them buys nothing.
 */
export function rollErrorTo(quat: THREE.Quaternion, wanted: THREE.Vector3): number {
  if (wanted.lengthSq() < 1e-12) return 0;
  dirNorm.copy(wanted).normalize();
  right.set(1, 0, 0).applyQuaternion(quat);
  up.set(0, 1, 0).applyQuaternion(quat);
  const x = dirNorm.dot(right);
  const y = dirNorm.dot(up);
  if (Math.hypot(x, y) < 1e-6) return 0;
  const err = Math.atan2(y, x);
  if (err > Math.PI / 2) return err - Math.PI;
  if (err < -Math.PI / 2) return err + Math.PI;
  return err;
}
