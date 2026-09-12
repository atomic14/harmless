// The rails that hold the ship on the slot axis (docs/TODO/212).
//
// Chris flew the pilot's stretch of 207 on a phone and it did not work. His
// words of 2026-09-12: *"lining up is not actually very accurate until the
// last few moments. So we aren't actually flying straight and rolling can send
// you off away from the slot."* He asked for a mini game instead: *"I'm
// wondering if we actually get lined up by the computer and then hand off to a
// 'mini' docking game. Something that is completely on rails."*
//
// THE FAULT WAS ONE STICK WITH TWO JOBS. The ship has no yaw axis, so a roll
// is how it aims. The slot wants that same roll for something else: the wings
// lined up with the letterbox. The docking computer reconciles the two
// (`docking-sticks.ts`). The pilot's stretch could not, because the pilot held
// the roll and the computer held only the pitch. A measurement of 2026-09-12
// put the hand-over 407 to 886 units off the axis, and an ideal pilot docked 0
// times in 4. With no roll at all, the same pilot docked 2 times in 4.
//
// SO THE RAILS HOLD THE LINE, AND THE PILOT HOLDS THE SPIN. This file is the
// one place in the game that moves the commander's ship other than by flying
// it. `test/docking.test.ts` scans for that, and it names this file.
//
// IT IS NOT A TELEPORT, AND THE ROTATION USED TO BE ONE. This comment claimed
// that both corrections were eased. The position was. The rotation went on in
// full, every frame, so whatever error the hand-over left went in ONE frame.
// Chris flew it on 2026-09-12: *"we jump to the on rails version before it's
// actually lined up"*. A trace put that jump at 69.7 degrees.
//
// Two things answer it. `railsAligned` holds the hand-over until the ship is
// the right distance out AND pointed at the port. The COMPUTER flies it to
// both, with its own sticks, so the error the rails see is small. `RAILS_TURN`
// then eases what is left, as `RAILS_PULL` always eased the position.
//
// The nose turns by the SHORTEST rotation onto the axis, which carries no twist
// about the nose. An ease along that same arc adds none either. So the pilot's
// own roll is untouched, and the roll is what the slot measures.

import * as THREE from 'three';
import type { PlayerShip } from '../player.ts';
import type { DockPlan } from './docking.ts';
import { slotNormal } from '../world/slot.ts';
import {
  RAILS_CONE, RAILS_LATERAL, RAILS_PULL, RAILS_RANGE, RAILS_STOPPED, RAILS_TURN,
} from '../constants/docking.ts';

const _out = new THREE.Vector3();
const _rel = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _turn = new THREE.Quaternion();
const _ease = new THREE.Quaternion();

/**
 * Is the ship at the place where the computer stops it?
 *
 * Three conditions, and each one matters. The plan must be on its last leg.
 * The ship must be on the axis, inside `RAILS_LATERAL`. `RAILS_RANGE` then
 * keeps the game short.
 */
export function railsReached(plan: DockPlan): boolean {
  return plan.phase === 'run' && plan.lateral < RAILS_LATERAL
    && plan.along < RAILS_RANGE;
}

/**
 * Is the nose near enough the slot axis to give the ship to the pilot?
 *
 * THE SECOND QUESTION THE HAND-OVER NEVER ASKED. `railsReached` above is about
 * WHERE the ship is. This is about WHICH WAY IT POINTS, and without it the
 * rails turned the ship up to 69.7 degrees in one frame. See `RAILS_CONE`.
 *
 * Two readers, one line. `world-step.ts` flies the computer's last turn until
 * this is true. `holdOnRails` below corrects onto the same axis afterward. So
 * the gate and the correction cannot come to disagree.
 */
export function railsAligned(player: PlayerShip, station: THREE.Object3D): boolean {
  const inward = slotNormal(station, _out).multiplyScalar(-1);
  return player.getForward(_fwd).angleTo(inward) < RAILS_CONE;
}

/**
 * Is the ship stopped, so the rails can take it?
 *
 * THE COMPUTER BRINGS THE SHIP TO A HALT FIRST (Chris, 2026-09-12: *"it's a
 * bit too easy I think. Maybe reducing the speed to nothing so the user has to
 * thrust forward would be good."*). The pilot then owns the whole run in, from
 * a standing start. A ship that arrives with the speed already made needs only
 * a hand on the roll.
 */
export function stopped(speed: number): boolean {
  return speed <= RAILS_STOPPED;
}

/**
 * One frame on the rails. It runs AFTER `PlayerShip.update`, so it corrects
 * the frame the ship just flew.
 *
 * @param dt the length of the frame, in seconds
 */
export function holdOnRails(player: PlayerShip, station: THREE.Object3D, dt: number): void {
  const outward = slotNormal(station, _out);
  const rel = _rel.copy(player.position).sub(station.position);
  const along = rel.dot(outward);
  // `rel` becomes the part of the offset that lies ACROSS the axis, once the
  // part along the axis is taken out of it.
  rel.addScaledVector(outward, -along);
  player.position.addScaledVector(rel, -Math.min(1, RAILS_PULL * dt));
  const fwd = player.getForward(_fwd);
  _turn.setFromUnitVectors(fwd, outward.multiplyScalar(-1));
  // ...and EASE it, as the position above is eased. A slerp from no rotation
  // along that same shortest arc keeps the arc's axis, so it still adds no
  // twist about the nose. The pilot's roll stays the pilot's.
  _ease.identity().slerp(_turn, Math.min(1, RAILS_TURN * dt));
  player.quaternion.premultiply(_ease).normalize();
}
