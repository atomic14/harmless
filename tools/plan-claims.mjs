// Does every plan number that the tree cites still have a plan document?
//
// `docs/TODO/<number>` is the most common cross-reference in this repository,
// ahead of the invariant number. It is how a comment says WHY a rule is the
// shape it is. A number that resolves to no file sends the next maintainer
// nowhere, and the comment then costs more than it gives.
//
// Three numbers resolved to nothing when this gate was written, and one of them
// was cited from `src/` (docs/TODO/165). Each was a different way to skip step 4
// of docs/PROCESS.md: move the plan to `completed/`, and add its line to the
// index. THE INDEX AND THE ARCHIVE AGREE WITH EACH OTHER, which is why nobody
// saw it. A number that reached neither one is invisible to both.
//
// IT MATCHES THE NUMBER RATHER THAN THE SLUG. A plan document is renamed by its
// own milestones, and a citation names the number alone. Where a citation DOES
// carry a full file name, the exact path is checked as well.
//
// This is docs/TODO/151's gate in a second form. That one holds
// `driven by <path>`, which names a file. This one holds a number.
//
// Run: node tools/plan-claims.mjs   (also `npm run plans:check`, and part of
// `npm run check`)

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Where a citation may be written.
 *
 * `.claude/worktrees/` and `.cycle/` are deliberately absent. Both are
 * gitignored scratch, and a stale worktree holds a whole copy of the tree that
 * cites numbers its own branch archived.
 */
const ROOTS = ['src', 'test', 'tools', 'train', 'docs'];

/**
 * Two files at the root that cite plans, and are read at the top of a session.
 *
 * `CLAUDE.md` carries the most load-bearing citations in the tree. A walk of the
 * root would reach the gitignored scratch above, so the two are named.
 */
const ROOT_FILES = ['CLAUDE.md', 'README.md'];

/** What is read. A `.json` file carries no prose, and `QUEUE.json` holds bare numbers. */
const READS = /\.(?:ts|js|mjs|md)$/;

/** Where a plan document may live. The first is the active queue. */
const PLAN_DIRS = [
  'docs/TODO',
  'docs/TODO/completed',
  'docs/TODO/research',
  'docs/TODO/retired',
];

/** A plan document: the number, a hyphen, then the slug of the day it was written. */
const PLAN_FILE = /^(\d+)-.*\.md$/;

/**
 * Numbers with no plan document, by decision rather than by accident.
 *
 * An entry here is a permanent exception, so each one carries its reason. THE
 * LIST GUARDS ITSELF IN BOTH DIRECTIONS. A number that gains a document fails,
 * because the exception is then a lie. A number that nothing cites fails too,
 * because the exception then hides nothing and should go.
 *
 * Keep it short. The remedy for a plan that landed and was never archived is to
 * restore it from git, and not to write a line here.
 */
const KNOWN_MISSING = new Map([
  [147, 'never committed in any commit. The station header takes as many lines '
    + 'as it has orders (Chris, 2026-08-13). His call on 2026-08-16 was to name '
    + 'the number here rather than reconstruct a record (docs/TODO/165)'],
]);

/**
 * A citation, with the archive directory optional and the file name optional.
 *
 * The number must follow the prefix, so `docs/TODO/QUEUE.json`,
 * `docs/TODO/README.md` and `docs/TODO/completed/` are not citations. Neither is
 * the prose form `docs/TODO/-era`. That answers the queue file directly: its
 * entries are numbers with no prefix at all.
 *
 * The whitespace is what lets a wrapped citation resolve. See `textOf`.
 */
const CITATION = /docs\/TODO\/(?:(?:completed|research|retired)\/)?\s*(\d+)(-[A-Za-z0-9._-]*\.md)?/g;

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : READS.test(e.name) ? [p] : [];
  });
}

/**
 * One file as a single run of text.
 *
 * A citation WRAPS. `docs/TODO/` can end one line of a doc comment and the
 * number can start the next, behind a `//` and some indent. So each line loses
 * its comment marker, and the lines are joined by one space. docs/TODO/151
 * recorded what a line-at-a-time reader costs: it found 22 of 28 paths and
 * dropped six in silence.
 *
 * A zero-width space is removed rather than kept. One citation in the archive
 * carries one on purpose, to stop that citation from wrapping.
 */
function textOf(path) {
  const raw = readFileSync(path, 'utf8').replace(/[​-‍﻿]/g, '');
  if (path.endsWith('.md')) return raw.replace(/\n/g, ' ');
  return raw.split('\n')
    .map((l) => l.replace(/^\s*(?:\/\*\*?|\*\/|\*|\/\/)/, ''))
    .join(' ');
}

/** Every plan number on disk, and the file that carries it. */
const plans = new Map();
for (const dir of PLAN_DIRS) {
  for (const name of readdirSync(dir)) {
    const found = PLAN_FILE.exec(name);
    if (found) plans.set(Number(found[1]), join(dir, name));
  }
}

const files = [...ROOTS.flatMap(walk), ...ROOT_FILES.filter((f) => existsSync(f))];
const cited = new Map();   // number -> Set of citing files
const bad = [];
let total = 0;

for (const path of files) {
  const text = textOf(path);
  for (const m of text.matchAll(CITATION)) {
    const number = Number(m[1]);
    total++;
    if (!cited.has(number)) cited.set(number, new Set());
    cited.get(number).add(path);
    if (!plans.has(number)) {
      if (!KNOWN_MISSING.has(number)) {
        bad.push({ path, number, why: 'no plan document carries this number' });
      }
      continue;
    }
    // The longer form names an exact file, so the exact file is checked. A
    // number that resolves through a renamed document is still a broken link.
    if (m[2] && !existsSync(m[0])) {
      bad.push({ path, number, why: `\`${m[0]}\` does not exist` });
    }
  }
}

// The allowlist is held to its own two claims. An exception that stopped being
// needed is the same defect as a citation that names nothing: something written
// down once and never checked again.
for (const [number, why] of KNOWN_MISSING) {
  if (plans.has(number)) {
    bad.push({ path: 'tools/plan-claims.mjs', number,
      why: `\`${plans.get(number)}\` exists now, so the allowlist entry must go` });
  } else if (!cited.has(number)) {
    bad.push({ path: 'tools/plan-claims.mjs', number,
      why: 'nothing cites this number, so the allowlist entry hides nothing' });
  } else {
    console.log(`  allowed: ${number} — ${why}`);
  }
}

console.log(`${total} plan citations naming ${cited.size} plans of ${plans.size}`
  + ` · ${bad.length} unresolved`);

if (bad.length) {
  console.error(`\nFAIL: ${bad.length} citation(s) name a plan that does not exist.\n`);
  // One line per citing file per number. A number cited from twenty files is
  // twenty repairs or one restore, and the reader needs to see which.
  for (const b of bad) console.error(`  ${b.path}  -> docs/TODO/${b.number}  (${b.why})`);
  const numbers = [...new Set(bad.map((b) => b.number))].sort((a, b) => a - b);
  console.error(`
RESTORE THE PLAN. Do not delete the citation.

A citation says WHY a rule is the shape it is, and step 4 of docs/PROCESS.md is
where a plan reaches its archive. These numbers are ${numbers.join(', ')}.

  the plan landed, and was never moved    git log --diff-filter=D -- 'docs/TODO/*'
                                          then restore it into completed/
  the plan was never committed            write an outcome-only record, and say
                                          so at the top of it
  the number is wrong                     correct the citation

DO NOT RENUMBER ANYTHING. The tree cites these numbers ${total} times, and
CLAUDE.md forbids a renumber for the same reason it forbids one for an invariant.
`);
  process.exit(1);
}
