// WHERE TO AIM, so that the line a course flies is clear of what is on it.
//
// Split from `course-pilot.ts` on 2026-09-12, when that file passed the
// 400-line ceiling. It is a different subject from the one next door. That file
// flies a course: which leg, what speed, which switches to ask for. This one is
// pure geometry over a line and a thing beside it. It knows nothing about a
// course, a demand or a ship.
//
// THREE THINGS ARE IN THE WAY, and each has its own clearance:
//
//   - the PLANET, at `COURSE_PLANET_CLEARANCE` above its surface;
//   - a SOLID in the sky — a rock hermit, an asteroid, the derelict — at
//     `COURSE_OBSTACLE_CLEARANCE` from its hull;
//   - a POLICEMAN, on a smuggling run alone. That one is about being SEEN
//     rather than about hitting anything, which is why its clearance comes
//     from the scan's own warning band.
//
// All three end in `sidestep`, which is the one rule. Aim beside the thing, on
// the side the line already passes, and half as far again.

import * as THREE from 'three';
import { COURSE_OBSTACLE_CLEARANCE, COURSE_PLANET_CLEARANCE } from '../constants/course.ts';
import { COURSE_POLICE_CLEARANCE } from '../constants/mission-course.ts';

/** Something solid a course must not fly through — see `clearOfObstacles`. */
export interface Obstacle {
  at: THREE.Vector3;
  /** the hull's own radius, because the clearance is measured from the hull */
  radius: number;
}

const seg = new THREE.Vector3();
const off = new THREE.Vector3();

/**
 * Where to aim, so that the line to the target clears the planet
 * (docs/TODO/205 M3). The clearance is the planet's own radius plus
 * `COURSE_PLANET_CLEARANCE`, which is above the height the planet holds the
 * torus drive down at.
 *
 * @returns `out`, holding the point to aim at.
 */
export function clearOfPlanet(
  from: THREE.Vector3, to: THREE.Vector3, planet: THREE.Vector3, radius: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  return sidestep(from, to, planet, radius + COURSE_PLANET_CLEARANCE, out);
}

/**
 * Where to aim, so that the line to the target keeps clear of the police
 * (docs/TODO/208 M4).
 *
 * A police ship reads a hold inside `SCAN_RANGE`, which is 2,600 units, and
 * the smuggling course must not be read. It aims wide of the nearest
 * policeman in the way, at `COURSE_POLICE_CLEARANCE`, which is the warning
 * band. The line from there is clear, and the ship then turns onto the
 * target. Where no wide line exists, it takes the widest it can find.
 */
export function clearOfPolice(
  from: THREE.Vector3, to: THREE.Vector3, police: readonly THREE.Vector3[],
  out: THREE.Vector3,
): THREE.Vector3 {
  let worst: { at: THREE.Vector3; miss: number } | null = null;
  for (const at of police) {
    const miss = distanceToSegment(from, to, at);
    if (miss >= COURSE_POLICE_CLEARANCE) continue;
    if (worst === null || miss < worst.miss) worst = { at, miss };
  }
  return worst === null ? out.copy(to)
    : sidestep(from, to, worst.at, COURSE_POLICE_CLEARANCE, out);
}

/**
 * Where to aim, so that the line keeps clear of everything solid in the way.
 *
 * Chris flew into a rock hermit on the station course (2026-09-12). The line
 * went round the planet and round a policeman, and through everything else.
 *
 * It takes the WORST one, by how near the line passes its hull, and aims wide
 * of that. One detour a frame is enough, because the ship re-plans on the next
 * one. The line from a detour point is a new line, with its own worst thing in
 * the way. Where nothing is in the way it returns the target unchanged.
 *
 * A thing at the END of the line is never in the way of it. That is
 * `distanceToSegment`'s rule, and it is what lets the hermit course fly to a
 * hermit.
 *
 * @returns `out`, holding the point to aim at.
 */
export function clearOfObstacles(
  from: THREE.Vector3, to: THREE.Vector3, obstacles: readonly Obstacle[],
  out: THREE.Vector3,
): THREE.Vector3 {
  let worst: { o: Obstacle; over: number } | null = null;
  for (const o of obstacles) {
    const clear = o.radius + COURSE_OBSTACLE_CLEARANCE;
    // How far INSIDE its clearance the line passes, so the worst is the one
    // with least room rather than the one nearest the ship.
    const over = clear - distanceToSegment(from, to, o.at);
    if (over <= 0) continue;
    if (worst === null || over > worst.over) worst = { o, over };
  }
  return worst === null ? out.copy(to)
    : sidestep(from, to, worst.o.at, worst.o.radius + COURSE_OBSTACLE_CLEARANCE, out);
}

/** How near the line from `from` to `to` passes `at`. */
function distanceToSegment(
  from: THREE.Vector3, to: THREE.Vector3, at: THREE.Vector3,
): number {
  seg.subVectors(to, from);
  const len2 = seg.lengthSq();
  const t = len2 > 0 ? Math.max(0, Math.min(1, off.subVectors(at, from).dot(seg) / len2)) : 0;
  // The nearest point is the target itself: nothing is between.
  if (t >= 1) return Infinity;
  return off.copy(from).addScaledVector(seg, t).sub(at).length();
}

/**
 * Where to aim, so that the line keeps `clear` units from one thing in the
 * way. It aims beside that thing, on the same side as the line, and half as
 * far again. The line from there is clear, and the ship then turns onto the
 * target.
 *
 * A target that is itself the nearest point needs no detour. docs/TODO/205 M3
 * found a hermit low over the planet. The line to it always counted as
 * blocked, and the ship circled the detour point for ever.
 *
 * @returns `out`, holding the point to aim at.
 */
function sidestep(
  from: THREE.Vector3, to: THREE.Vector3, at: THREE.Vector3, clear: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  seg.subVectors(to, from);
  const len2 = seg.lengthSq();
  const t = len2 > 0 ? Math.max(0, Math.min(1, off.subVectors(at, from).dot(seg) / len2)) : 0;
  if (t >= 1) return out.copy(to);
  off.copy(from).addScaledVector(seg, t).sub(at);
  if (off.length() >= clear) return out.copy(to);
  // A line through the centre has no side. Any direction square to it will do.
  if (off.lengthSq() < 1e-6) {
    off.set(seg.y, -seg.x, 0);
    if (off.lengthSq() < 1e-6) off.set(0, seg.z, -seg.y);
  }
  return out.copy(at).addScaledVector(off.normalize(), clear * 1.5);
}
