// Are the comments in this tree in Simplified Technical English?
//
// `CLAUDE.md` sets the house style, and states that no gate checks it. A rule
// with no measurement is a preference, and docs/TODO/154 measured what that
// costs. `src/constants/`, swept in one pass by docs/TODO/141, holds 7% long
// sentences. The rest of `src/`, left to convert as each file was edited, holds
// 24%. A sweep converts a surface. An intention does not.
//
// IT REPORTS. IT DOES NOT GATE (docs/TODO/154 M1). M4 decides whether it joins
// `npm run check`, and that decision needs the numbers M2 and M3 produce.
//
// This file is the parent of two children. `tools/ste-read.mjs` decides what is
// measured, and that is the harder half. The style never touches code, an exact
// command, an API name, an error string, or anything quoted from a person.
// `tools/ste-rules.mjs` holds the three countable rules and their word lists.
// `tools/ste.test.mjs` proves that each rule and each exclusion works.
//
// Run: node tools/ste.mjs                 the whole of src/, worst files first
//      node tools/ste.mjs <path>...       one file or one directory, in detail
//      node tools/ste.mjs --all           every file, not the worst 20
//      node tools/ste.mjs --work          worst by the COUNT of breaches
//      node tools/ste.mjs --dirs          one row per directory
//      node tools/ste.mjs --words         the flagged -ing words, by frequency
//      node tools/ste.mjs --nouns         the audit of the technical-noun list
//
// (also `npm run ste`, which needs `--` before a flag)

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { proseOf, words } from './ste-read.mjs';
import {
  DESCRIPTIVE_CAP, capFor, isInstruction, ingWords, tenseBreaches, TECHNICAL_NOUN,
} from './ste-rules.mjs';

/** The tree that is measured when the caller names no path. */
const ROOT = 'src';

/**
 * A generated file, which is skipped rather than measured.
 *
 * Its comments are written by a generator. An edit to one by hand is lost at
 * the next generation, so the fix for a generated comment belongs in the
 * template under `tools/`. The count of skipped files is reported. A file named
 * on the command line is measured whatever it is. So this exclusion cannot hide
 * a population.
 */
const GENERATED = /\.generated\.ts$|music-danube\.ts$/;

/** Every breach of the three rules in one file, with the counts. */
function measure(path) {
  const found = {
    path, sentences: 0, long: 0, long25: 0, ing: 0, tense: 0,
    breaches: [], flagged: [], allowed: [],
  };
  for (const { line, sentence } of proseOf(readFileSync(path, 'utf8'))) {
    found.sentences += 1;
    const n = words(sentence).length;
    if (n > capFor(sentence)) {
      found.long += 1;
      const rule = isInstruction(sentence) ? `${n}w instruction` : `${n}w`;
      found.breaches.push({ line, rule, sentence });
    }
    if (n > DESCRIPTIVE_CAP) found.long25 += 1;
    const ings = ingWords(sentence);
    found.ing += ings.flagged.length;
    found.flagged.push(...ings.flagged);
    for (const w of ings.allowed) found.allowed.push({ word: w, sentence });
    for (const w of ings.flagged) found.breaches.push({ line, rule: `-ing: ${w}`, sentence });
    for (const t of tenseBreaches(sentence)) {
      found.tense += 1;
      found.breaches.push({ line, rule: `tense: ${t}`, sentence });
    }
  }
  found.breaches.sort((a, b) => a.line - b.line);
  return found;
}

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = join(dir, e.name);
  return e.isDirectory() ? walk(p) : /\.(ts|js|mjs)$/.test(e.name) ? [p] : [];
});

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const targets = argv.filter((a) => !a.startsWith('--'));

const named = targets.filter((t) => !statSync(t).isDirectory());
const walked = (targets.length ? targets : [ROOT])
  .filter((t) => statSync(t).isDirectory()).flatMap(walk);

const skipped = walked.filter((p) => GENERATED.test(p));
const files = [...named, ...walked.filter((p) => !GENERATED.test(p))]
  .map(measure)
  .filter((f) => f.sentences > 0);

// THE TWO ORDERS ANSWER DIFFERENT QUESTIONS, so both are here. The share says
// which file reads worst, and it is the plan's own ranking (docs/TODO/154 M2).
// It is unstable over a short file: three long sentences out of five is 60%,
// and it is twenty minutes of work. `--work` sorts by the count of breaches,
// which is where the size of the job actually sits.
const share = (f) => f.long / f.sentences;
if (flags.has('--work')) files.sort((a, b) => b.long - a.long || share(b) - share(a));
else files.sort((a, b) => share(b) - share(a) || b.long - a.long);

const total = files.reduce((t, f) => ({
  sentences: t.sentences + f.sentences,
  long: t.long + f.long,
  long25: t.long25 + f.long25,
  ing: t.ing + f.ing,
  tense: t.tense + f.tense,
}), { sentences: 0, long: 0, long25: 0, ing: 0, tense: 0 });

const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '—');
const per100 = (n, d) => (d ? ((n / d) * 100).toFixed(1) : '—');

function summary() {
  console.log(`\n${files.length} files · ${total.sentences} sentences`
    + ` · ${total.long} over cap (${pct(total.long, total.sentences)})`
    + ` · ${total.long25} over 25 (${pct(total.long25, total.sentences)})`
    + ` · ${total.ing} -ing (${per100(total.ing, total.sentences)}/100)`
    + ` · ${total.tense} tense`);
  if (skipped.length) console.log(`${skipped.length} generated file(s) skipped`);
  console.log('This tool reports. It does not gate (docs/TODO/154 M1).');
}

if (flags.has('--words')) {
  const counts = new Map();
  for (const f of files) for (const w of f.flagged) counts.set(w, (counts.get(w) ?? 0) + 1);
  const rows = [...counts].sort((a, b) => b[1] - a[1]);
  console.log(`${rows.length} distinct -ing words, ${total.ing} uses\n`);
  for (const [w, n] of rows) console.log(`${String(n).padStart(5)}  ${w}`);
} else if (flags.has('--nouns')) {
  // The audit of the allowlist. It is the same review surface `tools/sizes.mjs`
  // keeps for its own list. An entry that names nothing is a reason for a thing
  // that stopped being true. The example lets a reader check the noun claim.
  const uses = new Map([...TECHNICAL_NOUN].map((w) => [w, []]));
  for (const f of files) for (const u of f.allowed) uses.get(u.word).push(u.sentence);
  const rows = [...uses].sort((a, b) => b[1].length - a[1].length);
  const dead = rows.filter(([, seen]) => seen.length === 0);
  for (const [w, seen] of rows) {
    if (!seen.length) continue;
    console.log(`${String(seen.length).padStart(4)}  ${w}`);
    console.log(`      ${seen[0].slice(0, 110)}`);
  }
  console.log(`\n${rows.length - dead.length} of ${rows.length} entries are used.`);
  if (dead.length) console.log(`UNUSED: ${dead.map(([w]) => w).join(' ')}`);
} else if (flags.has('--dirs')) {
  const dirs = new Map();
  for (const f of files) {
    const key = f.path.split('/').slice(0, 2).join('/');
    const d = dirs.get(key) ?? { sentences: 0, long: 0, ing: 0, tense: 0, files: 0 };
    d.sentences += f.sentences;
    d.long += f.long;
    d.ing += f.ing;
    d.tense += f.tense;
    d.files += 1;
    dirs.set(key, d);
  }
  const rows = [...dirs].sort((a, b) => (b[1].long / b[1].sentences) - (a[1].long / a[1].sentences));
  console.log('files  sentences   long  -ing/100  tense  directory');
  for (const [key, d] of rows) {
    console.log(`${String(d.files).padStart(5)}  ${String(d.sentences).padStart(9)}`
      + `  ${pct(d.long, d.sentences).padStart(5)}  ${per100(d.ing, d.sentences).padStart(8)}`
      + `  ${String(d.tense).padStart(5)}  ${key}`);
  }
  summary();
} else {
  const detail = flags.has('--show') || (named.length === 1 && files.length === 1);
  const shown = flags.has('--all') || targets.length ? files : files.slice(0, 20);
  console.log(' long  sentences   -ing  tense  file');
  for (const f of shown) {
    console.log(`${pct(f.long, f.sentences).padStart(5)}  ${String(f.sentences).padStart(9)}`
      + `  ${String(f.ing).padStart(5)}  ${String(f.tense).padStart(5)}  ${f.path}`);
    if (!detail) continue;
    for (const b of f.breaches) {
      console.log(`       ${f.path}:${b.line}  ${b.rule}`);
      console.log(`         ${b.sentence}`);
    }
  }
  if (!flags.has('--all') && !targets.length && files.length > shown.length) {
    console.log(`... ${files.length - shown.length} more (--all)`);
  }
  summary();
}
