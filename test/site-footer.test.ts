// The site's shared footer line (docs/TODO/97): which build the site is, and
// where to report a bug — one fallback chain for the hash, one spelling of the
// line, a marker on every page so no page can quietly lose it, and the plugin
// that actually fills the marker wired into the config.
//
// The chain, the line and the plugin live in vite.config.ts — the only place
// that knows a build's identity — and everything here is read from there, so
// these assertions run the code that ships rather than a restatement of it.

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { check, eq } from './harness.ts';
import config, { buildHash, buildFooterHtml, FOOTER_MARKER } from '../vite.config.ts';

const noGit = (): string => { throw new Error('no repo here'); };

// --- the fallback chain, rung by rung ---------------------------------------

eq('a Cloudflare deploy is stamped with its own commit, shortened to 7',
  buildHash({ CF_PAGES_COMMIT_SHA: 'abcdef0123456789abcdef0123456789abcdef01' }, noGit),
  'abcdef0');

eq('a local build asks git, and trims what it says',
  buildHash({}, () => 'fedcba9\n'),
  'fedcba9');

eq('a tree with neither Cloudflare nor git is a dev build',
  buildHash({}, noGit),
  'dev');

// --- the one footer line ----------------------------------------------------

const line = buildFooterHtml('abc1234');
check('a real hash links to its commit on GitHub',
  line.includes('https://github.com/atomic14/harmless/commit/abc1234">abc1234</a>'));
check('the issues link shares the line with the hash',
  line.includes('https://github.com/atomic14/harmless/issues/new'));
check('the line reads report a bug · request a feature',
  line.includes('report a bug · request a feature'));

const dev = buildFooterHtml('dev');
check('a dev build prints plain text, not a link to a commit called dev',
  dev.includes('build dev') && !dev.includes('/commit/'));
check('a dev build still links the issues page',
  dev.includes('https://github.com/atomic14/harmless/issues/new'));

// --- every page carries the marker ------------------------------------------
// The page roster is READ from the config's rollup inputs rather than copied
// here, so an eighth page joins this check by existing. play.html's marker is
// the foot of the in-game `?` guide, which is how the line is reachable in
// flight and when docked.

const input = config.build?.rollupOptions?.input as Record<string, string>;
const pages = Object.values(input).map((path) => basename(path));
check('the config names the landing page and the play shell (the roster read worked)',
  pages.includes('index.html') && pages.includes('play.html'), pages.join(' '));
for (const page of pages) {
  const html = readFileSync(new URL(`../${page}`, import.meta.url), 'utf8');
  check(`${page} carries the ${FOOTER_MARKER} marker`, html.includes(FOOTER_MARKER));
}

// --- and the plugin that fills it is wired in --------------------------------
// Without this, deleting the plugin from the config (or breaking its
// transform) ships every page with a raw HTML comment where the footer was,
// and nothing else goes red — proven by mutation before this gate existed.

const plugins = (config.plugins ?? []) as { name?: string; transformIndexHtml?: unknown }[];
const footer = plugins.find((p) => p.name === 'harmless:build-footer');
check('the build-footer plugin is wired into the config', footer !== undefined);

const transform = footer?.transformIndexHtml as (html: string) => string;
const out = typeof transform === 'function' ? transform(`<p>${FOOTER_MARKER}</p>`) : '';
check('the transform replaces the marker with the line',
  out.includes('issues/new') && !out.includes(FOOTER_MARKER), out);
check('...stamped with the hash the chain resolves right now',
  out.includes(`>${buildHash()}<`) || out.includes('build dev'), out);
