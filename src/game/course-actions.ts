// What the Game does with a course: the list it offers, and the pick it
// applies (docs/TODO/205 M4).
//
// Three files hold a course, and each holds one part:
//
//   - `courses.ts` decides which courses the situation allows. It is pure;
//   - `course-pilot.ts` flies the picked course, one frame at a time;
//   - this file joins the two to the Game. It builds the flat view that the
//     list reads, and it applies a pick.
//
// A PICK IS A CONSEQUENCE, so the orchestrator applies it (invariant 15). At a
// launch it leaves the station. For a jump it starts the countdown. So this
// reaches the Game through `CourseHost`, and it names no screen and no key.
//
// A row that says why the ship cannot fly it refuses the pick, and the console
// says the reason. That is how a launch with no target refuses: Chris's rule
// of 2026-09-11 is that no ship leaves without somewhere to go.

import { courseList, type Course, type CourseKind, type CourseSituation, type CourseWorld } from './courses.ts';
import type { checkJump } from './hyperspace.ts';
import type { GameState } from './state.ts';
import type { Input } from '../engine/input.ts';
import { COURSE_KEYS, COURSE_TOGGLE_KEY } from './bindings.ts';

/**
 * What the course buttons show in flight: the list, or the course under way.
 * `rows` is null while a course flies with the list closed.
 */
export interface CoursePanel {
  readonly rows: readonly Course[] | null;
  readonly current: CourseKind | null;
}

const KINDS = Object.keys(COURSE_KEYS) as CourseKind[];

/** What a pick reaches back for. */
export interface CourseHost {
  /** the jump key's own check (`HyperspaceActions.jumpCheck`) */
  jumpCheck(): ReturnType<typeof checkJump>;
  /** the station's transition to flight */
  launch(): void;
  startHyperspace(): void;
  /** close every screen, back to the base state */
  closeScreens(): void;
  showMessage(text: string, seconds: number): void;
  refused(): void;
}

export class CourseActions {
  private readonly state: () => GameState;
  private readonly host: CourseHost;
  /**
   * The pilot opened the list while a course flies. It is what the buttons
   * show, and never what the ship does, so no save carries it.
   */
  private opened = false;

  constructor(state: () => GameState, host: CourseHost) {
    this.state = state;
    this.host = host;
  }

  /**
   * What the course buttons show in flight. With no course, the list shows by
   * itself: at an arrival, after a course ends, and after a key takes the ship.
   */
  panel(): CoursePanel {
    const current = this.state().session.course;
    return {
      rows: current === null || this.opened ? this.list('flight') : null,
      current,
    };
  }


  /**
   * A course button was pressed in flight. The codes are `COURSE_KEYS` and
   * `COURSE_TOGGLE_KEY`. The buttons are their only sender, so no key table
   * spends a letter on them. A screen reads its own codes in the same way
   * (invariant 13).
   */
  read(i: Input): void {
    // The button that opens the list over a course, and closes it.
    if (i.pressed(COURSE_TOGGLE_KEY)) {
      this.opened = !this.opened;
      return;
    }
    for (const kind of KINDS) {
      if (i.pressed(COURSE_KEYS[kind])) {
        if (this.pick(kind, 'flight')) this.opened = false;
        return;
      }
    }
  }

  /** The courses the situation allows, in order. */
  list(situation: CourseSituation): Course[] {
    return courseList(this.view(situation));
  }

  /**
   * Pick a course. At a launch the ship leaves the station on it. A jump
   * starts the countdown.
   *
   * @returns whether the pick stood. A row with a reason refuses, and says it.
   */
  pick(kind: CourseKind, situation: CourseSituation): boolean {
    const row = this.list(situation).find((c) => c.kind === kind);
    if (!row || row.why !== null) {
      if (row?.why) this.host.showMessage(row.why, 3);
      this.host.refused();
      return false;
    }
    if (situation === 'launch') {
      this.host.closeScreens();
      this.host.launch();
    }
    this.state().session.course = kind;
    if (kind === 'jump') this.host.startHyperspace();
    return true;
  }

  /** The flat view `courseList` reads, built from the live state. */
  private view(situation: CourseSituation): CourseWorld {
    const s = this.state();
    const target = s.chart.targetIndex;
    return {
      situation,
      commander: s.commander,
      jump: this.host.jumpCheck(),
      targetName: target === null ? null : s.systems[target]?.name ?? null,
      witchspace: s.session.witchspace,
      // The sky is cleared while the ship is docked (courses.ts).
      sky: situation === 'launch' ? []
        : s.world.npcs.filter((n) => n.state.alive).map((n) => n.role),
      mission: null,
      done: new Set(s.session.coursesDone),
    };
  }
}
