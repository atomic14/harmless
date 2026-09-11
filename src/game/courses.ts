// What the ship can do next, with no hand on the stick (docs/TODO/205 M2).
//
// A COURSE is one thing that the ship does next by itself. "Fly to the
// station" is a course, and so is "skim the star". The pilot picks one from
// a short list, and a computer flies it. This file decides what is on that
// list. `course-pilot.ts` flies a course, and that is a different subject.
//
// THE WORD IS "COURSE", AND NOT "ORDER". `orders.ts` and invariant 16 already
// use "order" for a signed contract or a live mission.
//
// The list is derived state, as a prompt is (`prompts.ts`). The code saves the
// course that the pilot picks. It never saves the list. Two rules hold it:
//
//   - **A course carries a kind and words, and never a key.** The key that
//     opens the list lives in the binding table (invariant 9).
//   - **It is pure.** It reads a flat view of the situation, so a test can
//     raise a situation with no world behind it.
//
// A ROW THAT THE SHIP CANNOT FLY STILL SHOWS WHEN ITS OBJECT EXISTS. The rocks
// are there and the ship has no mining laser: the row shows, and it says what
// the ship needs. A row whose object does not exist never shows. A hermit that
// is not in the sky is not a course.
//
// THE LAUNCH LIST IS SHORTER THAN THE PLAN'S TABLE. The station clears the sky
// while the ship is docked, and the launch builds it again. The rocks are
// certain, because every system holds `ASTEROIDS_MIN` or more. The hermit is a
// draw at the launch, so nothing can know about it before. So the launch offers
// the jump, the rocks and the star. The hermit shows on the list in flight.

import type { CommanderData } from './commander.ts';
import type { NpcRole } from './ship-roles.ts';
import { refusalMessage, type Refusal } from './hyperspace.ts';
import { MAX_FUEL } from '../constants/commander.ts';
import { ASTEROIDS_MIN } from '../constants/population.ts';

/** What the ship can do by itself. */
export type CourseKind =
  'jump' | 'mission' | 'station' | 'derelict' | 'mine' | 'hermit' | 'skim';

/**
 * When the list is asked for. At a launch the ship is still on the pad, and
 * the sky is not built. In flight the sky is there to read.
 */
export type CourseSituation = 'launch' | 'flight';

/** One row of the list. */
export interface Course {
  readonly kind: CourseKind;
  /** the row's words, upper case, as a cockpit line is */
  readonly what: string;
  /** null when the ship can fly it; otherwise what stops it, in words */
  readonly why: string | null;
}

/**
 * Everything the list is raised from.
 *
 * A flat view rather than `GameState`, for the reason `PromptWorld` gives. The
 * caller asks `checkJump` for the jump, so the refusal keeps its one home.
 */
export interface CourseWorld {
  readonly situation: CourseSituation;
  readonly commander: CommanderData;
  /** `checkJump`'s answer for the chart's target */
  readonly jump: { ok: true; cost: number } | { ok: false; reason: Refusal };
  /** the target system's name, or null when the chart has none */
  readonly targetName: string | null;
  readonly witchspace: boolean;
  /** the role of every ship and rock in the sky. Empty at a launch */
  readonly sky: readonly NpcRole[];
  /** the objective's words, when a live leg has its target in this system */
  readonly mission: string | null;
  /** the courses this visit already finished, so they leave the list */
  readonly done: ReadonlySet<CourseKind>;
}

/**
 * The courses that the situation allows, in the order that ranks them.
 *
 * In flight, the mission leads, because the missions are the spine of a
 * career now (docs/TODO/208). The station follows, because it is where most
 * trips end. The jump comes last in flight, and first at a launch.
 */
export function courseList(w: CourseWorld): Course[] {
  if (w.situation === 'launch') {
    return [jumpRow(w, true), mineRow(w, true), skimRow(w)]
      .filter((c): c is Course => c !== null);
  }
  return [
    w.mission !== null && !w.done.has('mission')
      ? { kind: 'mission', what: w.mission, why: null } as const : null,
    w.witchspace ? null : { kind: 'station', what: 'FLY TO THE STATION', why: null } as const,
    present(w, 'generation', 'derelict')
      ? { kind: 'derelict', what: 'INVESTIGATE THE DERELICT', why: null } as const : null,
    mineRow(w, false),
    present(w, 'hermit', 'hermit')
      ? { kind: 'hermit', what: 'VISIT THE HERMIT', why: null } as const : null,
    skimRow(w),
    jumpRow(w, false),
  ].filter((c): c is Course => c !== null);
}

/** Is the thing in the sky, and is its course not done yet? */
function present(w: CourseWorld, role: NpcRole, kind: CourseKind): boolean {
  return !w.done.has(kind) && w.sky.includes(role);
}

/**
 * The jump. At a launch it always shows, because it is why a ship leaves. A
 * row that says why the ship cannot go answers "why can I not launch?". In
 * flight it shows only for a chart that has a target. A jump under way is not
 * a course to pick, so it never shows.
 */
function jumpRow(w: CourseWorld, launch: boolean): Course | null {
  if (!w.jump.ok && w.jump.reason === 'alreadyJumping') return null;
  if (!launch && !w.jump.ok && w.jump.reason === 'noTarget') return null;
  return {
    kind: 'jump',
    what: w.targetName === null ? 'JUMP' : `JUMP TO ${w.targetName.toUpperCase()}`,
    why: w.jump.ok ? null : refusalMessage(w.jump.reason, w.witchspace),
  };
}

/**
 * The rocks. The ore needs a mining laser to cut it and fuel scoops to take it
 * aboard. Without the scoops the ore breaks on the hull (`world-step.ts`), so
 * a course without them would only waste the rocks.
 */
function mineRow(w: CourseWorld, launch: boolean): Course | null {
  const rocks = launch ? ASTEROIDS_MIN > 0 : w.sky.includes('asteroid');
  if (!rocks || w.done.has('mine')) return null;
  const needs = [
    w.commander.equipment.miningLaser ? null : 'A MINING LASER',
    w.commander.equipment.scoops ? null : 'FUEL SCOOPS',
  ].filter((n): n is string => n !== null);
  return {
    kind: 'mine',
    what: 'MINE THE ASTEROIDS',
    why: needs.length ? `NEEDS ${needs.join(' AND ')}` : null,
  };
}

/**
 * The star. The scoops take fuel from it, so a full tank has nothing to gain.
 * In witch-space the star is out of reach, as the station is.
 */
function skimRow(w: CourseWorld): Course | null {
  if (w.witchspace || w.commander.fuel >= MAX_FUEL || w.done.has('skim')) return null;
  return {
    kind: 'skim',
    what: 'SKIM THE STAR FOR FUEL',
    why: w.commander.equipment.scoops ? null : 'NEEDS FUEL SCOOPS',
  };
}
