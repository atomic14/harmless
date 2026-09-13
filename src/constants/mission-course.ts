// How a mission's course flies the ship (docs/TODO/208).
//
// A live job is the first row of the course list. `game/course-pilot.ts`
// flies it in one of five shapes: a fight, a hold, an escort, a scoop and a
// slip past the police. These are the numbers the hold, the escort and the
// slip spend. They left `course.ts` when docs/TODO/213 M1 pushed that file
// over the size ceiling, and a mission's course is a subject of its own.

import { SCAN_WARN_RANGE } from './law.ts';
import { SCANNER_RANGE } from './console.ts';

/**
 * How far from a ship the scan course holds, in world units
 * (docs/TODO/208 M2).
 *
 * A scan counts seconds while the ship is inside `SCANNER_RANGE`, which is
 * 6,000, and within `WATCH_CONE` of the nose. So the hold sits well inside
 * the range, and near enough that the ship fills a useful part of the cone.
 * It is far enough out that a trader's own wandering does not shake it off.
 *
 * @rule course.watchStandoff
 * @domain mission-course
 */
export const COURSE_WATCH_STANDOFF = 1200;

/**
 * How far from its charge the escort course flies, in world units
 * (docs/TODO/208 M2).
 *
 * The escort is safe when no hostile ship is within 3,500 units of the
 * charge. A pilot who flies this close is inside that ring, and the fight
 * comes to the pilot rather than to the charge.
 *
 * @rule course.escortStandoff
 * @domain mission-course
 */
export const COURSE_ESCORT_STANDOFF = 600;

/**
 * How much faster than its charge the escort course may close, in world
 * units a second, once it is inside three standoffs of it: sixty.
 *
 * The approach used to brake from full speed to the charge's own at the
 * standoff, and it overshot into the hull (docs/TODO/213 M1). A ram is a hit
 * from the commander, and a trader that is hit runs. So the escort's own
 * course set its charge to flight in one run of eight. Sixty over the charge
 * closes 1,800 units in half a minute, and it stops inside the tolerance.
 *
 * @rule course.escortClosing
 * @domain mission-course
 */
export const COURSE_ESCORT_CLOSING = 60;

/**
 * How far the commander may fall behind their charge before it holds for
 * them, in world units (docs/TODO/214 M3). It is two thirds of the scanner,
 * which is four thousand.
 *
 * The charge flew to the station on its own, and the escort was a job the
 * commander watched. It moves while they are inside the leash and holds
 * where it is when they are not. The leash is well outside the escort
 * standoff of 600, so the course never trips it. It derives from the
 * scanner so that a charge that holds is always still on their scanner.
 *
 * @rule course.escortLeash
 * @domain mission-course
 */
export const ESCORT_LEASH = SCANNER_RANGE * 2 / 3;

/**
 * How wide of a police ship the smuggling course flies, in world units
 * (docs/TODO/208 M4).
 *
 * A policeman reads a hold inside `SCAN_RANGE`, which is 2,600 units. This is
 * the warning band, `SCAN_WARN_RANGE`, so the course keeps a margin outside
 * the range that would end the job. It is the same rule from the other side,
 * so the two cannot drift apart.
 *
 * @domain mission-course
 */
export const COURSE_POLICE_CLEARANCE = SCAN_WARN_RANGE;
