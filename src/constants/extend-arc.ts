// The run-out, as numbers: a curve rather than a straight line.
// These two shape the curve, and `game/extend-arc.ts` ramps it.

/**
 * The angle that the run-out holds off the OUTWARD radial, at its tightest.
 *
 * A ship that flies at `psi` to the radial opens the range at `v·cos(psi)`.
 * While psi < 90, the run-out therefore always terminates, and the ship arrives
 * `180 - psi` off its target rather than a full 180. 60 degrees is the knee.
 * Below it, the merge-to-merge gap keeps falling. Above it, the ship starts to
 * loiter at mid-range, which makes it a turret.
 */
export const EXTEND_ARC_ANGLE = (60 * Math.PI) / 180;

/**
 * How far out the ship gets before it starts to curve at all.
 *
 * A turn before it clears puts it back through the target it just passed. So
 * this is `BREAK_OFF_RANGE` and about half again, to clear the hull radius. It
 * stays a literal, because it is the value the arc was tuned at.
 */
export const CLEAR_RANGE = 340;
