// The run-out, as numbers: a curve rather than a straight line.
// These two shape the curve; `game/extend-arc.ts` ramps it.

/**
 * The angle the run-out holds off the OUTWARD radial, at its tightest.
 *
 * A ship flying at `psi` to the radial opens the range at `v·cos(psi)`, so while
 * psi < 90 the run-out always terminates, arriving `180 - psi` off its target
 * rather than a full 180. 60 degrees is the knee: below it the merge-to-merge
 * gap keeps falling, above it the ship starts loitering at mid-range (a turret).
 */
export const EXTEND_ARC_ANGLE = (60 * Math.PI) / 180;

/**
 * How far out the ship gets before it starts to curve at all.
 *
 * Turning before it has cleared puts it back through the target it just passed,
 * so this is `BREAK_OFF_RANGE` and half again (approximately) to clear the hull
 * radius. Stays a literal; it is the value the arc was tuned at.
 */
export const CLEAR_RANGE = 340;
