// The missions page's markup, from the tour model (docs/TODO/193 M2).
//
// One builder, run by the Vite plugin at build time, and read by a test as
// text. It escapes every word a model wrote, as the DATA ON page does, so a
// dossier cannot decide how the page is built. The worked example is
// `logHtml`'s markup, handed in, so the page and the game's LOG screen tell
// a story one way.

import { escapeHtml } from '../engine/escape-html.ts';
import type { TourArc, TourModel } from './tour-page.ts';

function arcHtml(a: TourArc, n: number): string {
  const face = a.patron.portrait
    ? `<img src="/${a.patron.portrait}" alt="${escapeHtml(a.patron.name)}" loading="lazy" />`
    : '';
  const legs = a.legs.map((l) => `<li${l.recovery ? ' class="recovery"' : ''}>`
    + `<b>${escapeHtml(l.verb)}</b> — ${escapeHtml(l.line)}`
    + `${l.recovery ? ' <i>(a recovery leg)</i>' : ''}</li>`).join('\n          ');
  const next = a.next === null
    ? '<p class="next">The tour ends here.</p>'
    : `<p class="next">${a.jumpsToNext} jumps on to the next patron.</p>`;
  return `
      <article class="arc" id="${escapeHtml(a.id)}">
        <div class="arc-head">
          ${face}
          <div>
            <h3>${n}. ${escapeHtml(a.title)}</h3>
            <p class="who">${escapeHtml(a.patron.name)}, ${escapeHtml(a.patron.role)} of ${escapeHtml(a.world.name)}</p>
          </div>
        </div>
        ${a.briefing.map((p) => `<p class="briefing">${escapeHtml(p)}</p>`).join('\n        ')}
        <ul class="legs">
          ${legs}
        </ul>
        ${next}
      </article>`;
}

/**
 * The page's body between the markers: the route, the arcs, the side jobs
 * by verb, and the worked example.
 */
export function tourHtml(m: TourModel, example: string): string {
  const arcs = m.arcs.map((a, i) => arcHtml(a, i + 1)).join('\n');
  const jobs = m.sideJobs.map((g) => `
        <tr>
          <td><b>${escapeHtml(g.verb)}</b></td>
          <td>${g.jobs.map((j) => `<b>${escapeHtml(j.title)}</b> — ${escapeHtml(j.pitch)}`).join('<br/>')}</td>
        </tr>`).join('');
  return `
      <section id="route">
        <h2>The route</h2>
        <p>Five patrons, each four to six jumps farther across galaxy one. Each
          arc ends two to four jumps from the next patron's world, and both
          its outcomes lead there.</p>
        <div class="route">${m.routeSvg}</div>
      </section>

      <section id="arcs">
        <h2>The five arcs</h2>
        ${arcs}
      </section>

      <section id="side-jobs">
        <h2>Side jobs, by verb</h2>
        <p>Every station board holds two or three of these. The same world
          offers the same jobs on every visit.</p>
        <table class="data">
          <tr><th>Verb</th><th>The job</th></tr>${jobs}
        </table>
      </section>

      <section id="example">
        <h2>A failure is a branch</h2>
        <p>A mission never ends at the first thing that goes wrong. Each leg
          says what happens on each way it can end, and a loss is a way. Here
          is the rescue job as the game's own log tells it: a survey pilot's
          pod adrift one jump out, the pod shot before the scoop, and the
          survey data, which came across first, carried home for a lower fee.
          The job is done, not failed. An arc keeps its lead to the next
          patron on either outcome, so a lost arc still moves you on.</p>
        ${example}
      </section>`;
}
