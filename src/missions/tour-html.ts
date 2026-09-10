// The missions page's markup, from the tour model (docs/TODO/193 M2).
//
// One builder, run by the Vite plugin at build time, and read by a test as
// text. It escapes every word a model wrote, as the DATA ON page does, so a
// dossier cannot decide how the page is built.
//
// A VISITOR READS IT, so it carries no name from the code (docs/TODO/199).
// Each job has one shape. First, who asks. Then what the job is, in the site's
// voice. Then the steps in words. Then the patron's own briefing, as a
// quotation. The shouted order lines and the in-game log went with 199. A
// failure is explained once, at the end, in three sentences.

import { escapeHtml } from '../engine/escape-html.ts';
import type { TourArc, TourModel } from './tour-page.ts';

/** The steps of a job in words: "Two steps: recover, then hunt." */
export function stepsLine(a: TourArc): string {
  const words = ['no', 'one', 'two', 'three', 'four', 'five', 'six'];
  const happy = a.legs.filter((l) => !l.recovery).map((l) => l.verb.toLowerCase());
  const n = words[happy.length] ?? String(happy.length);
  const steps = `${n.charAt(0).toUpperCase()}${n.slice(1)} step${happy.length === 1 ? '' : 's'}: ${happy.join(', then ')}.`;
  const more = a.legs.some((l) => l.recovery)
    ? ' If a step goes wrong, there is another way to finish the job.' : '';
  return steps + more;
}

function arcHtml(a: TourArc, n: number): string {
  const face = a.patron.portrait
    ? `<img src="/${a.patron.portrait}" alt="${escapeHtml(a.patron.name)}" loading="lazy" />`
    : '';
  const next = a.next === null
    ? '<p class="next">This is the last of the five.</p>'
    : `<p class="next">The next person with work is ${a.jumpsToNext} jumps on.</p>`;
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
        <p class="steps">${escapeHtml(stepsLine(a))}</p>
        <blockquote class="briefing">
          ${a.briefing.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n          ')}
        </blockquote>
        ${next}
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
        <p>Five worlds, each a few jumps farther across the first galaxy than
          the last. Each job ends near the next person's world.</p>
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
