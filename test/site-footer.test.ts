// The site's shared footer line (docs/TODO/97): which build the site is, and
// where to report a bug — one fallback chain for the hash, one spelling of the
// line, and a marker on every page so no page can quietly lose it.
//
// The chain and the line live in vite.config.ts — the only place that knows a
// build's identity — and are imported from there, so these assertions run the
// code that ships rather than a restatement of it.

import { readFileSync } from 'node:fs';
import { check, eq } from './harness.ts';
import { buildHash, buildFooterHtml, FOOTER_MARKER } from '../vite.config.ts';

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
// The seven pages are vite.config.ts's rollup inputs; play.html's marker is the
// foot of the in-game `?` guide, which is how the line is reachable in flight.

const PAGES = ['index.html', 'play.html', 'manual.html', 'novella.html',
  'gallery.html', 'viewer.html', 'encyclopaedia.html'];
for (const page of PAGES) {
  const html = readFileSync(new URL(`../${page}`, import.meta.url), 'utf8');
  check(`${page} carries the ${FOOTER_MARKER} marker`, html.includes(FOOTER_MARKER));
}
