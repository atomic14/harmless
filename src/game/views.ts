// The four cockpit views, and which way each one faces.
//
// Front, rear, left, right — the original's four windows. This is a small file
// on purpose. Three callers need `viewDirection`:
//
//   - the step, for the missile lock;
//   - combat.ts, because a rear-view shot hits what is behind you, and not
//     what the nose points at;
//   - the Game, for the gun, the sight and the camera.
//
// It lived in world-step.ts. So combat.ts imported the step, and the step
// imported combat.ts's DamageSource. That was the project's last import cycle,
// over a function that belongs to neither of them.
//
// One home, and now a home that depends on nothing.

import * as THREE from 'three';

/**
 * Yaw for each view: front, rear, left, right.
 *
 * IT STAYS HERE, and it is a table rather than a constant. Four
 * `THREE.Quaternion`s are objects, and `src/constants/` may not import three.
 * So the only version of this that could live in the home is the four angles,
 * with the table built back up here from them.
 *
 * That would split one table across two files and buy nothing. The angles have
 * no second home to diverge from. They are not a tuning choice either: they
 * are the definition of what "rear" and "left" mean. Compare npc.ts's
 * `ZERO`/`UP`, which docs/TODO/90 excludes for the neighbouring reason.
 */
export const VIEW_QUATS = [0, Math.PI, Math.PI / 2, -Math.PI / 2].map((a) =>
  new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a));

/**
 * Direction the given view faces, in world space.
 *
 * It is not where the NOSE points. That difference is the whole reason a rear
 * laser is worth its price.
 */
export function viewDirection(
  quaternion: THREE.Quaternion, view: number, out: THREE.Vector3,
): THREE.Vector3 {
  return out.set(0, 0, -1).applyQuaternion(VIEW_QUATS[view]).applyQuaternion(quaternion);
}

/**
 * Which way this view's RIGHT lies, in world space.
 *
 * The companion to `viewDirection`, and it is here for the ear (docs/TODO/142).
 * A sound sits across the stereo field by how far it lies along this axis.
 *
 * It takes the VIEW rather than the hull, and that is the same argument
 * `viewDirection` makes above. The pilot acts through the window in front of
 * her. So a ship on the left of the screen is on the left in rear view as well.
 *
 * An ear bolted to the hull would put that ship on the wrong side of the
 * cockpit the moment the pilot turned to it. That reads as a fault rather than
 * as a frame of reference.
 */
export function viewRight(
  quaternion: THREE.Quaternion, view: number, out: THREE.Vector3,
): THREE.Vector3 {
  return out.set(1, 0, 0).applyQuaternion(VIEW_QUATS[view]).applyQuaternion(quaternion);
}
