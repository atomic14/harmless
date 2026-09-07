// The LOG screen's markup: the story pages, the patron's face, and the route.
//
// It reads what `missions/story.ts` and `missions/route-map.ts` return, and
// it paints. Nothing here decides what a page says. `logHtml` is the one
// builder of that markup. The screen wraps it in its title and its BACK
// key. The site's missions page (docs/TODO/193) sets the same markup in
// its own frame. So the game and the site cannot tell a story two ways.

import { escapeHtml } from '../engine/escape-html.ts';
import type { StoryPage } from '../missions/story.ts';
import { show } from './screen-shell.ts';

export interface LogView {
  pages: readonly StoryPage[];
  /** the SVG text of the route, or '' */
  route: string;
  /** the latest patron's portrait path, or '' */
  portrait: string;
  /** the latest patron's name, for the caption */
  patron: string;
}

/** The log's markup: the face, the pages newest first, and the route. */
export function logHtml(view: LogView): string {
  const { pages, route, portrait, patron } = view;
  const face = portrait ? `
    <figure class="portrait">
      <img src="${portrait}" alt="${escapeHtml(patron)}" onerror="this.parentElement.remove()"/>
      <figcaption>${escapeHtml(patron.toUpperCase())}</figcaption>
    </figure>` : '';
  const body = pages.length === 0
    ? '<div class="info">Nothing yet. A mission accepted is the first line.</div>'
    : [...pages].reverse().map((p) => `
    <div class="info">
      <b>${escapeHtml(p.title.toUpperCase())}</b>${p.ending === null ? ' &middot; IN PROGRESS' : p.ending === 'complete' ? ' &middot; DONE' : ' &middot; FAILED'}<br/>
      ${p.lines.join('<br/>')}
    </div>`).join('');
  return `
    <div class="sysbody">
      ${face}
      ${body}
    </div>
    ${route}`;
}

export function renderLog(view: LogView): void {
  show(`
    <h2>COMMANDER'S LOG</h2>
    <div class="rule"></div>
    ${logHtml(view)}
    <div class="buttons"><button data-key="Escape">BACK</button></div>
  `);
}
