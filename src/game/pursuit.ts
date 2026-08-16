// The pursuit dogfighter's shipless decisions. It answers two questions:
//
//   1. how fast to fly to sit in gun range behind a target;
//   2. where to break off, so that a chase does not end as a ram.
//
// Two pilots fly these, so they live in ONE place rather than two. One is the
// combat computer at the stick of the commander's ship (scripted-co-pilot.ts).
// The other is a pursuit pirate (npc.ts).
//
// What is NOT here is the STEERING. The co-pilot points the commander's
// yaw-less ship with `pitch-roll-steer.ts`. An NPC arc-slews its quaternion.
// Those are two different flight models, pointed at the same aim. This file
// decides the aim and the speed. Each caller flies them its own way.

import * as THREE from 'three';
import {
  PURSUIT_RANGE, PURSUIT_CLOSE_GAIN, PURSUIT_TURN_FLOOR,
  PURSUIT_BREAK_RANGE, PURSUIT_CLEAR_RANGE, PURSUIT_BREAK_CLEARANCE,
} from '../constants/combat-computer.ts';

/**
 * The speed to fly to hold a gun-range standoff behind a target.
 *
 * Match the target's speed, then close or open the gap toward `PURSUIT_RANGE`.
 * Ease off in a hard turn (`PURSUIT_TURN_FLOOR`), because a slower ship turns
 * in a tighter radius and holds its bead. It is capped to the chaser's own top
 * speed.
 *
 * The caller turns this into a throttle. The co-pilot turns it into a demand
 * sign. An NPC turns it into an `approach` toward the figure.
 *
 * @param facing the chaser's nose-to-target angle, in radians.
 */
export function pursuitSpeed(
  targetSpeed: number, dist: number, facing: number, maxSpeed: number,
): number {
  const turnScale = PURSUIT_TURN_FLOOR + (1 - PURSUIT_TURN_FLOOR) * Math.max(0, Math.cos(facing));
  return Math.max(0, Math.min(maxSpeed,
    (targetSpeed + PURSUIT_CLOSE_GAIN * (dist - PURSUIT_RANGE)) * turnScale));
}

/**
 * The break-off a chaser carries between frames. It is all the state a
 * two-phase pursuit needs. One field says whether the chaser breaks clear now.
 * The other says which side it committed to for this break.
 */
export interface PursuitBreak {
  breaking: boolean;
  /** the side it banks its break toward, chosen once per break; 0 until then */
  side: -1 | 0 | 1;
}

export function freshPursuitBreak(): PursuitBreak {
  return { breaking: false, side: 0 };
}

const perp = new THREE.Vector3();
const away = new THREE.Vector3();
const worldUp = new THREE.Vector3(0, 1, 0);

/**
 * Where to steer THIS frame. Ordinarily it is the target itself: pure pursuit,
 * which curves the chaser onto the six as the target turns. With a collision
 * close, it is instead a point that carries the chaser AWAY and to one side, so
 * that it breaks off the run.
 *
 * It is a two-phase machine on `brk`. Inside `PURSUIT_BREAK_RANGE` it commits
 * to a break. It holds that until the range opens past `PURSUIT_CLEAR_RANGE`.
 * It then resumes the chase.
 *
 * The break aim is `away from the target, deflected to one side`. It is a
 * banked turn-off rather than a retreat straight back. So the chaser sheds the
 * closure, swings wide, and comes round again.
 *
 * It is what a pursuit pilot needs, and what the attack run gets from its
 * pass-and-extend instead. It is kept short, so that the chaser returns to the
 * six quickly.
 *
 * It writes the aim into `out` and returns it. It allocates nothing else.
 */
export function pursuitAim(
  brk: PursuitBreak,
  pos: THREE.Vector3,
  targetPos: THREE.Vector3,
  dist: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  if (brk.breaking) {
    if (dist > PURSUIT_CLEAR_RANGE) { brk.breaking = false; brk.side = 0; }
  } else if (dist < PURSUIT_BREAK_RANGE) {
    brk.breaking = true;
  }

  if (!brk.breaking) return out.copy(targetPos);

  // Break: aim away from the target with a lateral deflection, so that the
  // chaser turns off and opens the range. `away` is the reverse of the line of
  // sight. `perp` is a stable sideways direction: the line of sight crossed
  // with world up. The clearance sets how hard the deflection banks.
  away.copy(pos).sub(targetPos);
  const len = away.length();
  if (len < 1e-6) return out.copy(targetPos); // on top of it — no direction; next frame separates
  away.divideScalar(len);
  perp.crossVectors(away, worldUp);
  if (perp.lengthSq() > 1e-6) {
    perp.normalize();
    if (brk.side === 0) brk.side = perp.dot(pos) >= 0 ? 1 : -1;
  } else {
    perp.set(0, 0, 0);
  }
  return out.copy(pos)
    .addScaledVector(away, PURSUIT_BREAK_CLEARANCE)
    .addScaledVector(perp, brk.side * PURSUIT_BREAK_CLEARANCE);
}
