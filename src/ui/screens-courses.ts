// The launch list: where the ship goes when it leaves the station
// (docs/TODO/205 M4).
//
// It is a render function, as every screen's is. `game/screens/courses.ts`
// owns the input and the state. Each row is a click target with the code that
// `COURSE_KEYS` gives its course. A tap and the menu cursor's Enter send the
// same code.

import type { Course } from '../game/courses.ts';
import { show } from './screen-shell.ts';

/** One row, and the code it sends. */
export interface CourseRow {
  readonly code: string;
  readonly course: Course;
}

export function renderLaunchCourses(rows: readonly CourseRow[], chartCode: string): void {
  const line = (r: CourseRow): string => r.course.why === null
    ? `<div data-key="${r.code}">${r.course.what}</div>`
    : `<div data-key="${r.code}" class="blocked">${r.course.what}`
      + `<span class="why">${r.course.why}</span></div>`;
  show(`
    <h2>LAUNCH</h2>
    <div class="rule"></div>
    <div class="info" style="text-align:center">
      CHOOSE WHERE TO GO
    </div>
    <div class="menu course-list">
      ${rows.map(line).join('\n      ')}
      <div data-key="${chartCode}">LOCAL CHART &mdash; PICK A SYSTEM TO JUMP TO</div>
    </div>
    <div class="buttons"><button data-key="Escape">STAY DOCKED</button></div>
    <div class="keyline">TAP A ROW &middot; &uarr; &darr; SELECT &middot; ENTER CHOOSE &middot; ESC STAY DOCKED</div>
  `);
}
