// Nose and thrust: the two pieces of flight maths that everything in the sky
// shares.
//
// ONE RESPONSIBILITY. Everything that flies in this game turns toward a heading
// at a capped rate, then thrusts along its nose. The commander's ship does it.
// Every NPC does it. A training target does it. These two functions are that
// rule, and they hold no state between calls.
//
// FIVE FILES OUTSIDE THE SHIPS READ THEM. They are the trainer's scenarios, the
// two spawners, the HUD's lead marker and one test. Three of the five want no
// NPC class at all. Each of those three used to import a class file of 1,566
// lines to reach a helper of four (docs/TODO/169 M3).
//
// IT ALLOCATES NOTHING PER CALL. `steerQuatToward` writes into the quaternion
// it is given. `velocityOf` writes into an `out` vector the caller owns. Both
// run per ship per frame, and per ship-step of every training episode. The
// module scratch below is why, and it is safe because neither function yields.
//
// It came out of `game/npc.ts` (docs/TODO/169 M3).

import * as THREE from 'three';

// The origin and the world up, for the `lookAt` below. They are per-module
// rather than shared, and docs/TODO/90 rules that by name. A THREE.Vector3 is
// mutable, so one shared home is a bug rather than a fix. `game/npc.ts`,
// `game/game.ts`, `game/combat-sim.ts` and `player.ts` each keep their own.
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
