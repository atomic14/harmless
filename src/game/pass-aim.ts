// The arithmetic that turns an intended pass into a heading: how far ahead of a
// target to aim, and how far to the side.
//
// The numbers are `constants/pass-aim.ts`. EVERYTHING HERE IS PURE, and it takes
// the geometry as numbers. So a test can assert the whole rule, and no ship has
// to leave the ground. The vectors, the line of sight and the scratch to
// resolve them in belong to `NpcShip.attack`. That is the only caller, and the
// only place that has them.

import {
  MAX_LEAD_SECONDS, MAX_MISS_STRETCH, PASS_MISS_DISTANCE,
} from '../constants/pass-aim.ts';

/**
 * How far ahead of itself a target should be aimed: time to the merge, capped.
 *
 * `closingSpeed` is the rate at which the RANGE shuts. It is the attacker's own
 * speed, less the part of the target's motion that takes it away. So
 * `dist / closingSpeed` is when the two arrive in the same place.
 *
 * That is the moment the pass has to clear. A prediction to that moment is what
 * turns `PASS_MISS_DISTANCE` from an intention into a distance.
 *
 * A target that opens the range has no merge at all. `dist/closing` is then
 * either negative or enormous, so both cases take the cap. That is not a
 * fallback. There is nothing to intercept, so the ship should aim half a second
 * ahead and hold its run.
 */
export function leadTime(dist: number, closingSpeed: number): number {
  if (closingSpeed <= 0) return MAX_LEAD_SECONDS;
  return Math.min(MAX_LEAD_SECONDS, dist / closingSpeed);
}

/**
 * How far to the side to aim THIS run, so the LINE it flies passes
 * `PASS_MISS_DISTANCE` clear.
 *
 * An aim at a point 110 units to the side of the target does not make a ship
 * miss by 110. It makes it miss by however far its own path drifted from the
 * target's by the time the two arrive. That is a smaller number, for two
 * separate reasons. This function corrects both, and neither is a tuning
 * constant.
 *
 * ROOM. From `dist` out, a line that passes `m` clear leaves the line of sight
 * by `asin(m/dist)`. So the ship has to generate a sideways rate of
 * `closing · m / sqrt(dist^2 - m^2)`. An aim at a point `m` aside generates
 * `closing · m / dist` instead. The ratio is `dist / sqrt(dist^2 - m^2)`: 1.01
 * at 900 units, and 1.16 at the 220 the pass commits at. It is a pure function
 * of the range. So the aim stays tight where the gun really shoots, and opens
 * only at the merge.
 *
 * TRAVEL. The two ships meet after `dist/closing` seconds, and the attacker
 * flies `own · dist/closing` in that time. The faster the closure, the less of
 * run remains for a step sideways. Head-on against a commander flat
 * out, that is 83 units of travel to open 110 units of gap, and no heading
 * achieves it. So `closing/own` stretches the aim. That term is 1 against a
 * target at rest, and 2.7 in the fastest merge the game can produce.
 *
 * Both are first-order, and the exact solution is uglier. What matters is that
 * each one EARNS its place, measured. Against a target that translates at 400,
 * over 100 episodes, contact per merge is 0.034 with both terms and 0.053 with
 * the room term alone.
 *
 * With NEITHER it is also 0.034, over a fifth fewer merges. A ship that never
 * led its aim misses by accident rather than by design, and a pass that never
 * arrives is not a fix.
 *
 * It takes the same closing speed as `leadTime`, resolved once by the caller
 * along the one line of sight both of them are about.
 *
 * @param intended how wide this ship MEANS to pass. It defaults to the
 * constant. It is a parameter because a tactic is a choice of how wide to pass
 * and nothing else. The correction is the same arithmetic whatever the intent.
 */
export function passMissDistance(
  dist: number, closingSpeed: number, ownSpeed: number,
  intended: number = PASS_MISS_DISTANCE,
): number {
  if (ownSpeed <= 0) return intended;
  // Inside the miss distance, no heading opens it. So take the cap, and let
  // the pass commit. This is also the guard on the square root.
  const room = dist > intended
    ? dist / Math.sqrt(dist * dist - intended * intended)
    : MAX_MISS_STRETCH;
  const stretch = Math.min(
    MAX_MISS_STRETCH, Math.max(1, (closingSpeed / ownSpeed) * room));
  return intended * stretch;
}
