// How a course flies the ship (docs/TODO/205 M3).
//
// A course is one thing the ship does next with no hand on the stick.
// `game/course-pilot.ts` flies it, and it spends these values.

import { HERMIT_DOCK_SPEED } from './hermit-market.ts';
import { PLAYER_FLIGHT } from './player-flight.ts';
import { MASS_LOCK_PLANET_ALTITUDE, TORUS_MULTIPLIER } from './torus.ts';
import { GENERATION_CARGO_SCATTER } from './spawn-placement.ts';

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

/**
 * How far from its target the course pilot drops the torus drive, in world
 * units, before an arrival.
 *
 * It is two and a half seconds of torus travel. The drive carries the ship
 * 3,200 units a second, which is 53 units in one frame. The ship then brakes
 * from its top speed of 400, which takes about 360 units at full thrust. So
 * the margin covers both, with room to spare, and it grows with the drive.
 *
 * @domain course
 */
export const COURSE_TORUS_DROP = TORUS_MULTIPLIER * PLAYER_FLIGHT.maxSpeed * 2.5;

/**
 * The share of the ship's thrust that an arrival plans to brake with.
 *
 * The approach asks for the speed from which this share of thrust stops the
 * ship at the standoff. The rest is a margin for the turn and for one frame
 * of lag in the throttle.
 *
 * @rule course.arriveBrake
 * @domain course
 */
export const COURSE_ARRIVE_BRAKE = 0.7;

/**
 * How near its standoff the ship must be to count as arrived, in world units.
 * The brake plan leaves the ship within a few units of the standoff. This is
 * room for the turn, and for a target that moves.
 *
 * @rule course.arriveTolerance
 * @domain course
 */
export const COURSE_ARRIVE_TOLERANCE = 75;

/**
 * Where the derelict course stops, as a distance from the generation ship's
 * centre, in world units.
 *
 * The hull is 340 units across the radius (`GENERATION_SHIP_RADIUS`). Its
 * canisters drift within `GENERATION_CARGO_SCATTER` of the centre. So the ship
 * stops 400 units outside the canisters, clear of the hull and of every
 * canister, where the pilot can see them all.
 *
 * @domain course
 */
export const COURSE_DERELICT_STANDOFF = GENERATION_CARGO_SCATTER + 400;

/**
 * Where the hermit course stops, as a distance from the rock's centre, in
 * world units.
 *
 * The trade opens inside `HERMIT_DOCK_RANGE`, which is 320. The rock is 120
 * units across the radius. So the ship stops between the two, clear of the
 * rock and inside the range.
 *
 * @rule course.hermitStandoff
 * @domain course
 */
export const COURSE_HERMIT_STANDOFF = 240;

/**
 * The hold distance of the skim course, from the centre of the star, in world
 * units.
 *
 * The scoops take fuel inside `SUN_SCOOP_RANGE`, which is 80,000. The cabin
 * heads toward a temperature set by the distance. It is fatal at
 * `CABIN_TEMP_FATAL`, which is reached near 26,800 units. At this distance
 * the cabin settles near 0.54, well short of fatal. The margin inside the
 * scoop range keeps an overshoot of the brake inside it too.
 *
 * @rule course.skimDistance
 * @domain course
 */
export const COURSE_SKIM_DISTANCE = 65_000;

/**
 * How high above the planet's surface a course keeps its line, in world
 * units.
 *
 * It is a quarter above `MASS_LOCK_PLANET_ALTITUDE`, so the detour does not
 * hold the torus drive down. A line to the target that dips below it goes
 * round the planet instead.
 *
 * @domain course
 */
export const COURSE_PLANET_CLEARANCE = MASS_LOCK_PLANET_ALTITUDE * 1.25;

/**
 * The speed at which the hermit course arrives, in world units a second.
 *
 * The trade opens only below `HERMIT_DOCK_SPEED`. Half of it arrives well
 * inside that rule, and it is still a real approach.
 *
 * @domain course
 */
export const COURSE_HERMIT_SPEED = HERMIT_DOCK_SPEED / 2;

/**
 * How much faster the world runs under the fast forward button, as a count of
 * fixed steps in one screen frame (docs/TODO/205 M7).
 *
 * Chris chose one fixed speed on 2026-09-11: *"Fixed speed - let's keep it
 * simple."* Eight turns the median trip to the station, 148 s, into about
 * 19 s of the player's time. The world step ran about 2,000 times faster than
 * real time with no graphics, so eight costs little.
 *
 * It equals `TORUS_MULTIPLIER`, and the two rules are independent. That one is
 * how far the drive carries the ship. This one is how fast time passes.
 *
 * @rule course.skipSpeed
 */
export const SKIP_SPEED = 8;

/**
 * Below this lead in top speed, in world units a second, the run row says the
 * ship is only a little faster (docs/TODO/206 M5).
 *
 * The player's Cobra tops out at 400. The fastest pirate and the fastest
 * bounty hunter reach 381. A run from one gains 19 u/s. The lasers of both
 * reach 3,500 units. A lead under 50 u/s takes more than a minute to
 * open that range, under fire. A police Viper, at 320, falls behind at 80.
 *
 * @rule course.runCloseMargin
 * @domain course
 */
export const RUN_CLOSE_MARGIN = 50;

/**
 * How far ahead the run course aims, in world units, on the line away from
 * the hostile ships (docs/TODO/206 M5). The point only gives the line a
 * direction, so it sits far beyond scanner range.
 *
 * @rule course.runReach
 * @domain course
 */
export const COURSE_RUN_REACH = 50_000;
