// How the run-OUT is flown: a curve, not a straight line.
//
// The angles are `constants/extend-arc.ts`. Until docs/TODO/67 `extending`
// steered for NOTHING. It held whatever heading the pass left it with, so the
// closing leg had to contain both the reversal and the run-in. The ship then
// had to go a long way out to have room. Chris: *"they fly quite far before
// turning for another run."*
//
// PURE, and it takes the geometry as two numbers. So the whole rule is
// assertable, and no test has to fly a ship. The vectors and the scratch to
// resolve them in belong to `NpcShip.attack`.

import { CLEAR_RANGE, EXTEND_ARC_ANGLE } from '../constants/extend-arc.ts';

/**
 * The angle to hold off the outward radial, this far into the run-out.
 *
 * A RAMP rather than a constant angle, and the difference is the gap. The full
 * angle held for the whole run-out is a logarithmic spiral. That is elegant,
 * and it spends `sec(60) = 2` times the straight-line time to get out. A ramp
 * means the ship leaves fast, along the line the pass gave it. The ship then
 * tightens into the turn as it runs out of run, which is what a pilot does.
 *
 * It reaches the cap AT the turn-back point, so the ship is at its most turned
 * exactly when the phase flips. Measured over 313 turn-backs, the heading error
 * there is 120 degrees at every quantile up to the ninth.
 *
 * Between `CLEAR_RANGE` and there it is linear in the RANGE rather than in
 * time, because range is what the phase machine reads. So a ship whose run gets
 * cut short by `underFire` still curved as much as its position earned. A ship
 * shoved back inward by a target that chased it straightens out on its own.
 *
 * `extendRange` is the ship's OWN rolled turn-back range, not the band's. So a
 * ship that rolled a short run curves harder for it. That is what makes the
 * short end of the band flyable rather than merely permitted.
 *
 * @param cap the angle this ship's TACTIC holds at its tightest. It defaults to
 * the constant. The sweep behind `EXTEND_ARC_ANGLE` is what makes it safe to
 * vary. 45, 60 and 70 degrees are within a quarter of a second of each other on
 * the merge-to-merge clock, and flat on contact. So the shape of a run-out is a
 * free feel axis, where the length of one is not.
 */
export function extendArcAngle(
  dist: number, extendRange: number, cap: number = EXTEND_ARC_ANGLE,
): number {
  if (dist <= CLEAR_RANGE) return 0;
  const span = extendRange - CLEAR_RANGE;
  // A rolled range inside the clearance leaves no room to ramp through. The
  // ship is already at its turn-back point, so give it the whole angle.
  if (span <= 0) return cap;
  return cap * Math.min(1, (dist - CLEAR_RANGE) / span);
}
