// The missions page's markup, from the tour model (docs/TODO/193 M2).
//
// One builder, run by the Vite plugin at build time, and read by a test as
// text. It escapes every word a model wrote, as the DATA ON page does, so a
// dossier cannot decide how the page is built.
//
// A VISITOR READS IT, so it carries no name from the code (docs/TODO/199).
// Each job has one shape. First, who asks. Then what the job is, in the site's
// voice. Then the patron's opening words, as a quotation. The shouted order
// lines and the in-game log went with 199. So did a line of steps and a line
// of jumps under every job, because a line that repeats five times says
// nothing (Chris, 2026-09-10). A failure is explained once, at the end.

import { escapeHtml } from '../engine/escape-html.ts';
import type { TourArc, TourModel } from './tour-page.ts';

function arcHtml(a: TourArc, n: number): string {
  const face = a.patron.portrait
    ? `<img src="/${a.patron.portrait}" alt="${escapeHtml(a.patron.name)}" loading="lazy" />`
    : '';
  // The first paragraph is the patron's voice. The rest restates the job the
  // summary above already states.
  const words = a.briefing[0] ?? '';
  return `
      <article class="arc" id="${escapeHtml(a.id)}">
        <div class="arc-head">
          ${face}
          <div>
            <h3>${n}. ${escapeHtml(a.title)}</h3>
            <p class="who">${escapeHtml(a.patron.name)}, ${escapeHtml(a.patron.role)} at ${escapeHtml(a.world.name)}</p>
          </div>
        </div>
        <p class="summary">${escapeHtml(a.summary)}</p>
        <blockquote class="briefing"><p>${escapeHtml(words)}</p></blockquote>
      </article>`;
}

/**
 * The page's body between the markers: the route, the five jobs, the side
 * jobs, and what a failure means.
 */
export function tourHtml(m: TourModel): string {
  const arcs = m.arcs.map((a, i) => arcHtml(a, i + 1)).join('\n');
  const jobs = m.sideJobs.flatMap((g) => g.jobs).map((j) => `
          <li><b>${escapeHtml(j.title)}</b> &mdash; ${escapeHtml(j.summary)}</li>`).join('');
  return `
      <section id="route">
        <h2>The route</h2>
        <p>The five worlds, in order.</p>
        <div class="route">${m.routeSvg}</div>
      </section>

      <section id="arcs">
        <h2>The five jobs</h2>
        ${arcs}
      </section>

      <section id="side-jobs">
        <h2>Side jobs</h2>
        <p>Every station board offers two or three of these. The same world
          offers the same jobs on every visit.</p>
        <ul class="jobs">${jobs}
        </ul>
      </section>

      <section id="fail">
        <h2>If you fail</h2>
        <p>A lost fight does not end a job. Each job has another way to
          finish. Whatever happens, the next person with work for you still
          sends word.</p>
      </section>`;
}
