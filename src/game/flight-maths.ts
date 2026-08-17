// Nose, thrust and throttle: the three pieces of flight maths that everything
// in the sky shares.
//
// ONE RESPONSIBILITY. Everything that flies in this game turns toward a heading
// at a capped rate, thrusts along its nose, and changes speed at a capped rate.
// The commander's ship does it. Every NPC does it. A training target does it.
// These three functions are that rule, and they hold no state between calls.
//
// FIVE FILES OUTSIDE THE SHIPS READ THE FIRST TWO. They are the trainer's
// scenarios, the two spawners, the HUD's lead marker and one test. Three of the
// five want no NPC class at all. Each of those three used to import a class
// file of 1,566 lines to reach a helper of four (docs/TODO/169 M3).
//
// `approach` CAME LATER, and for the same reason (docs/TODO/176 M2). It was a
// four-line private helper in `game/npc.ts` with eight call sites. Four of the
// eight went to `game/trader-flight.ts`, so the helper needed a shared home.
//
// IT ALLOCATES NOTHING PER CALL. `steerQuatToward` writes into the quaternion
// it is given. `velocityOf` writes into an `out` vector the caller owns.
// `approach` returns a number. All three run per ship per frame, and per
// ship-step of every training episode. The module scratch below is why, and it
// is safe because no function here yields.
//
// It came out of `game/npc.ts` (docs/TODO/169 M3).

import * as THREE from 'three';

// The origin and the world up, for the `lookAt` below. They are per-module
// rather than shared, and docs/TODO/90 rules that by name. A THREE.Vector3 is
// mutable, so one shared home is a bug rather than a fix. `game/game.ts`,
// `game/combat-sim.ts` and `game/trader-flight.ts` each keep their own.
//
// THAT LIST NAMED `game/npc.ts` AND `player.ts` UNTIL docs/TODO/176 M2. The
// first one's `ZERO` served the trader alone, so it left with it. The second
// one never held one at all, and the claim was false when it was written.
const ZERO = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const steerMat = new THREE.Matrix4();
const steerQuat = new THREE.Quaternion();

/**
 * Rotate `quat` so its −Z points along `dir`, by at most `maxStep` radians.
 *
 * The scripted steering rule, as a free function. The training scenarios steer
 * the TARGET with it too, and it is not the target's own rule. It is this one.
 * It mutates `quat` in place, and allocates nothing.
 *
 * NOT `Object3D.lookAt`. That aims +Z at its target, and every hull in this
 * game is built nose-down −Z. The two spawners each say so at their call site.
 */
export function steerQuatToward(
  quat: THREE.Quaternion, dir: THREE.Vector3, maxStep: number,
): void {
  if (dir.lengthSq() < 1) return;
  steerMat.lookAt(ZERO, dir, UP); // -Z ends up along dir
  steerQuat.setFromRotationMatrix(steerMat);
  quat.rotateTowards(steerQuat, maxStep);
}

/**
 * How something with this attitude and this speed is travelling.
 *
 * Nose and thrust are the same direction for everything that flies in this
 * game. `NpcShip.advance()` is the same two lines, and the commander's
 * `update()` is a third. So nobody has to store a target's velocity.
 *
 * The ships derive it here to lead their shots. The HUD's lead marker
 * (hud-model.ts) reads the SAME rule, so the aid and the AI agree about where a
 * target is going. It writes into `out`, and allocates nothing.
 */
export function velocityOf(
  quat: THREE.Quaternion, speed: number, out: THREE.Vector3,
): THREE.Vector3 {
  return out.set(0, 0, -1).applyQuaternion(quat).multiplyScalar(speed);
}

/**
 * Move `current` toward `target`, by at most `step`. It never overshoots.
 *
 * The throttle rule, and it is `steerQuatToward`'s rule over a scalar. A ship
 * picks a speed it wants, and this is how fast it may get there. The caller
 * owns the rate, because a hull's thrust and a phase's urgency both set it.
 *
 * `player.ts` holds its OWN `approach`, and the two are not the same rule. That
 * one is `1 - exp(-rate * dt)`, so it eases and it never quite arrives. This
 * one is linear and it clamps. Do not merge them.
 */
export function approach(current: number, target: number, step: number): number {
  if (current < target) return Math.min(target, current + step);
  return Math.max(target, current - step);
}
