// One world's encyclopaedia entry — the data, and the markup for it.
//
// This file is the reason the page is both interactive and indexable, and no
// second version of anything exists. `entryHtml()` runs TWICE.
//
// It runs in Node, from the Vite plugin, which writes all 256 entries into the
// built document. So a crawler and a reader with no JavaScript get the whole
// corpus. It runs again in the browser, for the detail panel the chart opens.
//
// Same function, same markup. So there is no "SEO version" to drift from the
// real one.
//
// It is therefore pure and browser-free: no DOM, no window, no side effects at
// module scope. `npm run portability` holds it to that.

import {
  type StarSystem, ECONOMY_NAMES, GOVERNMENT_NAMES, speciesName,
} from '../galaxy/galaxy.ts';
import { planetDescription } from '../galaxy/goatsoup.ts';
import { systemDescription } from '../galaxy/descriptions.ts';
import { escapeHtml } from '../engine/escape-html.ts';

/** Everything the page knows about one world, derived and flattened once. */
export interface Entry {
  index: number;
  name: string;
  slug: string;
  x: number;
  y: number;
  economy: number;
  economyName: string;
  government: number;
  governmentName: string;
  /** 1-15, as shown — not the raw 0-14 field. */
  techLevel: number;
  species: string;
  populationBn: number;
  productivity: number;
  radius: number;
  /** The 1984 line. Always present. */
  canon: string;
  /** The generated pair, or undefined — a world without one is normal. */
  description?: string;
  inhabitants?: string;
  portrait: string;
}

/**
 * URL-safe and stable: it is what `?w=` carries and what an entry's anchor is.
 *
 * Lower-cased name is enough — the 1984 name generator produces letters only,
 * and within one galaxy names are distinct. Across galaxies they are not,
 * which is one more reason this page is galaxy 1 only.
 */
export const slugFor = (sys: StarSystem): string => sys.name.toLowerCase();

/**
 * Everything except the generated prose.
 *
 * Split out from `entryFor`, because the browser does not need the prose and
 * must not pay for it. All 256 entries are already in the document. A page
 * that shipped `descriptions/galaxy-1.json` as well would send the same
 * 205,000 characters twice. It would send them once as markup, and once as a
 * 261 kB script chunk to re-render markup already on screen.
 *
 * So the chart and the filter rail are built from this. The detail panel shows
 * the document's own entry, rather than a second rendering of it.
 *
 * That is not only smaller. It makes "the page works without JavaScript" true
 * by construction rather than by care. There is one set of entry markup, and
 * both paths read it.
 */
export function factsFor(sys: StarSystem, galaxy = 1): Entry {
  return {
    index: sys.index,
    name: sys.name,
    slug: slugFor(sys),
    x: sys.x,
    y: sys.y,
    economy: sys.economy,
    economyName: ECONOMY_NAMES[sys.economy],
    government: sys.government,
    governmentName: GOVERNMENT_NAMES[sys.government],
    techLevel: sys.techLevel + 1,
    species: speciesName(sys),
    populationBn: sys.population / 10,
    productivity: sys.productivity,
    radius: sys.radius,
    canon: planetDescription(sys),
    // Same path the game builds (ui/screens.ts portraitUrl), and the same
    // galaxy-1 restriction, for the same reason. The eight galaxies share a
    // name pool, so a galaxy 2 world could collide on index AND name.
    portrait: galaxy === 1
      ? `/species/${String(sys.index).padStart(3, '0')}-${sys.name.toLowerCase()}.png`
      : '',
  };
}

/**
 * The facts plus the generated prose. Build-time only — the one caller is the
 * Vite plugin, which is also the only place `descriptions.ts` is wanted.
 */
export function entryFor(sys: StarSystem, galaxy = 1): Entry {
  const more = systemDescription(sys, galaxy);
  return { ...factsFor(sys, galaxy), description: more?.description, inhabitants: more?.inhabitants };
}

/**
 * The markup for one entry.
 *
 * Every string that came from the generator goes through `escapeHtml`. The
 * committed file is checked, and it is almost certainly clean. This is the
 * render boundary, and it does not get to assume that. See TODO 58, where a
 * model put a literal `</br>` in a field.
 *
 * The `data-` attributes carry what the filter needs. So the browser hides and
 * shows these, and derives nothing again. The static list and the chart are
 * filtered from one set of numbers.
 */
export function entryHtml(e: Entry): string {
  const stat = (label: string, value: string) =>
    `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`;

  const prose = e.description && e.inhabitants
    ? `<div class="entry-prose">
         <p>${escapeHtml(e.description)}</p>
         <p>${escapeHtml(e.inhabitants)}</p>
       </div>`
    : '';

  const face = e.portrait
    ? `<img class="entry-face" src="${e.portrait}" alt="An inhabitant of ${escapeHtml(e.name)}"
            loading="lazy" width="128" height="128"
            onerror="this.remove()"/>`
    : '';

  return `<article class="entry" id="w-${e.slug}" data-slug="${e.slug}"
    data-eco="${e.economy}" data-gov="${e.government}" data-tl="${e.techLevel}"
    data-species="${escapeHtml(e.species)}">
    <h3 class="entry-name">${escapeHtml(e.name)}</h3>
    <div class="entry-body">
      ${face}
      <div class="entry-text">
        <dl class="entry-stats">
          ${stat('Economy', e.economyName)}
          ${stat('Government', e.governmentName)}
          ${stat('Tech level', String(e.techLevel))}
          ${stat('Population', `${e.populationBn.toFixed(1)} billion`)}
          ${stat('Inhabitants', e.species)}
          ${stat('Productivity', `${e.productivity} M CR`)}
          ${stat('Radius', `${e.radius} km`)}
        </dl>
        <p class="entry-canon">${escapeHtml(e.canon)}</p>
        ${prose}
      </div>
    </div>
  </article>`;
}
