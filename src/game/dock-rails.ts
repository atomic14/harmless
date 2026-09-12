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
// IT IS NOT A TELEPORT. Both corrections are eased. The nose turns by the
// SHORTEST rotation onto the axis, which carries no twist about the nose. So
// the pilot's own roll is untouched, and the roll is what the slot measures.

import * as THREE from 'three';
import type { PlayerShip } from '../player.ts';
import type { DockPlan } from './docking.ts';
import { slotNormal } from '../world/slot.ts';
import { RAILS_LATERAL, RAILS_PULL, RAILS_RANGE, SLOT_SPEED_LIMIT } from '../constants/docking.ts';

const _out = new THREE.Vector3();
const _rel = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _turn = new THREE.Quaternion();

/**
 * Is the ship lined up well enough for the rails to take it?
 *
 * Four conditions, and each one matters. The plan must be on its last leg.
 * The ship must be on the axis, inside `RAILS_LATERAL`. It must be slow enough
 * for the slot already, so the mini game starts from a speed that can dock.
 * `RAILS_RANGE` then keeps the game short.
 */
export function railsReady(plan: DockPlan, speed: number): boolean {
  return plan.phase === 'run' && plan.lateral < RAILS_LATERAL
    && speed <= SLOT_SPEED_LIMIT && plan.along < RAILS_RANGE;
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
  player.quaternion.premultiply(_turn).normalize();
}
