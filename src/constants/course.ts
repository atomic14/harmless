// How a course flies the ship (docs/TODO/205 M3).
//
// A course is one thing the ship does next with no hand on the stick.
// `game/course-pilot.ts` flies it, and it spends these values.

/**
 * How far off the nose the target may sit, in radians, before the course
 * pilot engages the torus drive.
 *
 * The drive multiplies travel by eight (`TORUS_MULTIPLIER`). A drive engaged
 * with the target well off the nose carries the ship a long way off the line
 * before the turn finishes. So the pilot turns first, and then engages. The
 * pilot still steers while the drive runs, so a small error inside the cone
 * closes on the way.
 *
 * It equals `DC_TURN_FADE_ANGLE`, and the two rules are independent. That one
 * fades the docking computer's turn near its heading. This one gates a drive.
 *
 * It belongs here, and not with the spawn cones in `spawn-placement.ts`. Those
 * place a ship when it appears. This one gates a drive while the commander's
 * own ship flies, and only the course pilot reads it.
 *
 * @rule course.torusCone
 * @domain course
 */
export const COURSE_TORUS_CONE = 0.1;
