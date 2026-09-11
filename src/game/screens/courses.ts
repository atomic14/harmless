// The launch list: the station asks where the ship goes (docs/TODO/205 M4).
//
// The station menu's LAUNCH row opens it. Each row is one course from
// `courses.ts`, and a pick leaves the station on it. A row the ship cannot fly
// says why, and a pick of it refuses. So a ship with no target and no work
// cannot leave. The last row opens the galactic chart, where the pilot sets a
// target, and ESC from the chart comes back here.
//
// The screen decides nothing itself. `course-actions.ts` applies a pick, the
// way the survivors screen hands its answer to `game/survivors.ts`.

import type { Screen, ScreenOutcome } from '../../ui/screen-host.ts';
import type { Input } from '../../engine/input.ts';
import type { Course, CourseKind } from '../courses.ts';
import { COURSE_CHART_KEY, COURSE_KEYS } from '../bindings.ts';
import { renderLaunchCourses } from '../../ui/screens-courses.ts';

/** The slice of the Game this screen is allowed to see. */
export interface CoursesContext {
  /** the launch courses, in order */
  rows(): readonly Course[];
  /** pick one; a refusal says why and leaves the screen up */
  pick(kind: CourseKind): void;
}

export class CoursesScreen implements Screen {
  readonly id = 'courses' as const;
  private readonly ctx: () => CoursesContext;

  constructor(ctx: () => CoursesContext) {
    this.ctx = ctx;
  }

  open(): void {
    this.render();
  }

  render(): void {
    renderLaunchCourses(
      this.ctx().rows().map((course) => ({ code: COURSE_KEYS[course.kind], course })),
      COURSE_CHART_KEY);
  }

  input(i: Input): ScreenOutcome {
    const ctx = this.ctx();
    for (const course of ctx.rows()) {
      if (i.pressed(COURSE_KEYS[course.kind])) {
        ctx.pick(course.kind);
        return 'stay';
      }
    }
    if (i.pressed(COURSE_CHART_KEY)) return { open: 'chart' };
    if (i.pressed('Escape')) return 'back';
    return 'stay';
  }
}
