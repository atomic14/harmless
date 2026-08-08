import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { generateGalaxy } from './src/galaxy/galaxy.ts';
import { entryFor, entryHtml } from './src/encyclopaedia/entry.ts';

/**
 * Write all 256 encyclopaedia entries into the document.
 *
 * The page is chart-led, and a chart is invisible to a crawler and useless to
 * a reader with no JavaScript — which would leave 205,000 characters of prose
 * that exists nowhere else behind a click. So the document is built the other
 * way up: the entries ARE the page, and the chart is an enhancement over
 * markup that is already complete.
 *
 * This runs `entryHtml()`, the same function the detail panel calls in the
 * browser, so there is no second rendering to drift from the first. It is
 * build-time and deterministic — the seeds in, the same bytes out — with no
 * model and no network, exactly like the Elite-A generator and the species
 * prompts.
 *
 * It hooks `transformIndexHtml` rather than emitting a file so that `npm run
 * dev` serves the same document the build produces; a placeholder that only
 * filled in for production would mean developing against a page nobody ships.
 */
function encyclopaediaEntries(): Plugin {
  const MARKER = '<!--ENTRIES-->';
  return {
    name: 'harmless:encyclopaedia-entries',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        if (!ctx.path.includes('encyclopaedia') || !html.includes(MARKER)) return html;
        const entries = generateGalaxy(1)
          .map((sys) => entryHtml(entryFor(sys, 1)))
          .join('\n');
        return html.replace(MARKER, entries);
      },
    },
  };
}

// --- the build footer --------------------------------------------------------

/** The repo — the one spelling; the issues link and commit links derive from it. */
const REPO_URL = 'https://github.com/atomic14/harmless';

/** Where a reader reports a bug or asks for a feature. */
const ISSUES_URL = `${REPO_URL}/issues/new`;

/**
 * Which commit this build is, as a 7-character short hash — the ONE fallback
 * chain (docs/TODO/97): Cloudflare Pages stamps `CF_PAGES_COMMIT_SHA` on a
 * deploy; a local build or the dev server asks git; a tree with neither says
 * `dev`. Seven characters because that is what GitHub shows and resolves.
 * `env` and `git` are injectable so the tests can exercise all three rungs
 * without depending on what the machine running them has.
 */
export function buildHash(
  env: Record<string, string | undefined> = process.env,
  git: () => string = () => execSync('git rev-parse --short HEAD').toString(),
): string {
  const deployed = env.CF_PAGES_COMMIT_SHA;
  if (deployed) return deployed.slice(0, 7);
  try { return git().trim().slice(0, 7); } catch { return 'dev'; }
}

/** The marker each page's markup carries where the footer line lands.
 *  `test/site-footer.test.ts` asserts every page has one. */
export const FOOTER_MARKER = '<!--BUILD-FOOTER-->';

/**
 * The footer line every page shares — hash and issues link are ONE treatment
 * (docs/TODO/97), so this string is the only spelling of it. The hash links to
 * its commit when it is a real hash and stays plain text as `dev`. It arrives
 * as quiet small print because every marker sits inside markup its page
 * already styles that way; `.build-line` only tunes the two canvas pages.
 */
export function buildFooterHtml(hash: string): string {
  const build = hash === 'dev'
    ? 'build dev'
    : `build <a href="${REPO_URL}/commit/${hash}">${hash}</a>`;
  return `<span class="build-line">${build} · `
    + `<a href="${ISSUES_URL}">report a bug · request a feature</a></span>`;
}

/**
 * Replace the marker in every page with the shared footer line. A
 * `transformIndexHtml` hook, like `encyclopaediaEntries` and for the same
 * reason: `npm run dev` serves the same line the build ships.
 *
 * The hash is resolved inside the hook, per page, not at config load: a dev
 * server lives across commits, and a load-time hash would name whatever was
 * HEAD when the server started for the rest of the session. One git call per
 * HTML page is cheap, and importing this file (as the test does) spawns none.
 */
function buildFooter(): Plugin {
  return {
    name: 'harmless:build-footer',
    transformIndexHtml: (html) => html.replaceAll(FOOTER_MARKER, buildFooterHtml(buildHash())),
  };
}

export default defineConfig({
  plugins: [encyclopaediaEntries(), buildFooter()],
  build: {
    rollupOptions: {
      // `import.meta.dirname` rather than `__dirname`: this file is ESM, and
      // only Vite's config loader shims `__dirname` — `test/site-footer.test.ts`
      // imports this file under plain node, where the shim does not exist.
      input: {
        // index is the landing page; the game itself is play.html, so the
        // three.js bundle never loads for someone who arrived to read
        main: resolve(import.meta.dirname, 'index.html'),
        play: resolve(import.meta.dirname, 'play.html'),
        // Two dev pages, one thing each: the combat viewer replays trained
        // episodes, the gallery shows the 38 released hulls. They were one page
        // with a `G` between them, so /viewer opened on the gallery.
        viewer: resolve(import.meta.dirname, 'viewer.html'),
        gallery: resolve(import.meta.dirname, 'gallery.html'),
        manual: resolve(import.meta.dirname, 'manual.html'),
        novella: resolve(import.meta.dirname, 'novella.html'),
        // The galaxy as a reference work — public content rather than a dev
        // page, so it is in the sitemap and linked from the landing page.
        encyclopaedia: resolve(import.meta.dirname, 'encyclopaedia.html'),
      },
    },
  },
});
