// Is the prose of this repository in Simplified Technical English?
//
// `CLAUDE.md` sets the house style. It had no measurement until docs/TODO/154,
// and a rule with no measurement is a preference. The numbers said so.
// `src/constants/`, swept in one pass by docs/TODO/141, held 7% long sentences.
// The rest of `src/`, left to convert as each file was edited, held 24%. A
// sweep converts a surface. An intention does not.
//
// IT GATES, UNDER `--gate`, AND ONLY THERE (docs/TODO/154 M4). Every other run
// reports and exits 0. `npm run ste:check` is the gated one, and `npm run
// check` calls it.
//
// THE GATE IS WHOLE-TREE, and it holds two of the three rules: the sentence
// caps, and the tense. M3 swept `src/` to 0 of 14,582 sentences over the cap
// and 0 in a compound tense, so a whole-tree gate costs nothing to adopt today.
// A diff-scoped gate would cost the same and let more through: docs/TODO/141
// recorded an export that sat undocumented until somebody edited its file.
//
// IT READS TWO SURFACES (docs/TODO/168). The first is every comment in `src/`.
// The second is the ten documents `CLAUDE.md` names, plus every active TODO
// item. A markdown file holds no comment, so `tools/ste-read-md.mjs` reads that
// surface. The gate counts the two apart, because a gate that reads one of them
// and reports one number cannot say which one it missed.
//
// A TITLE IS NOT READ HERE, and `tools/titles.mjs` holds it. A 20-word cap
// never fires on a title, so the caps would report a clean surface that is not
// clean. That tool reads a plan title and an index label, which is where the
// drift was (Chris, 2026-08-16).
//
// THE `-ing` COUNT NEVER GATES. It is 788, and a technical noun is the honest
// answer for most of them. The allowlist decides what the number means, so the
// number is a report and `--nouns` is its review surface (docs/TODO/154 M4).
//
// This file is the parent of three children. `tools/ste-read.mjs` decides what
// is measured in a source file, and that is the harder half. The style never
// touches code, an exact command, an API name, an error string, or anything
// quoted from a person. `tools/ste-read-md.mjs` does the same job for a
// document. `tools/ste-rules.mjs` holds the three countable rules and their
// word lists. `tools/ste.test.mjs` proves that each rule, each exclusion and
// the markdown reader work.
//
// Run: node tools/ste.mjs                 src/ and the documents, worst first
//      node tools/ste.mjs <path>...       one file or one directory, in detail
//      node tools/ste.mjs --all           every file, not the worst 20
//      node tools/ste.mjs --work          worst by the COUNT of breaches
//      node tools/ste.mjs --dirs          one row per directory
//      node tools/ste.mjs --words         the flagged -ing words, by frequency
//      node tools/ste.mjs --nouns         the audit of the technical-noun list
//      node tools/ste.mjs --gate          the gate: exit 1 on a cap or a tense
//
// (also `npm run ste`, which needs `--` before a flag, and `npm run ste:check`)

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { proseOf, words } from './ste-read.mjs';
import { proseOfMarkdown } from './ste-read-md.mjs';
import {
  DESCRIPTIVE_CAP, capFor, isInstruction, ingWords, tenseBreaches, TECHNICAL_NOUN,
} from './ste-rules.mjs';

/** The tree that is measured when the caller names no path. */
const ROOT = 'src';

/**
 * The documents the house style covers, beyond the comments in `src/`.
 *
 * `CLAUDE.md` names them: itself, the three rule documents and the six
 * reference documents. The list is written out rather than walked, because
 * `docs/` also holds two records. `docs/DEVLOG.md` and `docs/TRAINING-LOG.md`
 * report what happened, and the style never touches a record.
 */
const DOCUMENTS = [
  'CLAUDE.md',
  'docs/INVARIANTS.md',
  'docs/PROCESS.md',
  'docs/ARCHITECTURE.md',
  'docs/AI-TRAINING.md',
  'docs/BROWSER-TRIALS.md',
  'docs/COMBAT-SIM.md',
  'docs/DAMAGE-PATHS.md',
  'docs/ELITE-A.md',
  'docs/JAMESON-TRIALS.md',
];

/**
 * The active TODO items, which `CLAUDE.md` also covers.
 *
 * The top level of `docs/TODO/` holds the index and the plans that are not
 * finished. The archive under it — `completed/`, `research/` and `retired/` —
 * is a record of what somebody decided, so this walk stops at the top level.
 *
 * THE INDEX IS READ WHOLE, ON CHRIS'S CALL OF 2026-08-16. Its dated sections
 * report what landed, and 144 of its 150 breaches were in them. He chose to
 * hold the file rather than to split its scope in two.
 */
const TODO = 'docs/TODO';
const todoItems = () => readdirSync(TODO)
  .filter((name) => name.endsWith('.md'))
  .map((name) => join(TODO, name))
  .sort();

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

/** The reader this file answers to. A document has no comment in it. */
const readerFor = (path) => (path.endsWith('.md') ? proseOfMarkdown : proseOf);

/** Every breach of the three rules in one file, with the counts. */
function measure(path) {
  const found = {
    path, sentences: 0, long: 0, long25: 0, ing: 0, tense: 0,
    breaches: [], flagged: [], allowed: [],
  };
  for (const { line, sentence } of readerFor(path)(readFileSync(path, 'utf8'))) {
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

// A DOCUMENT THAT MOVED MUST STOP THE RUN. The list above is written out, so a
// renamed file would otherwise leave the tool reporting a clean surface it
// never opened. That is docs/TODO/165's defect: a name that resolves to nothing
// is invisible to whoever wrote it.
const missing = DOCUMENTS.filter((p) => !existsSync(p));
if (missing.length) {
  console.error(`ste: ${missing.join(', ')} — named in DOCUMENTS and not found.`);
  process.exit(1);
}

const named = targets.filter((t) => !statSync(t).isDirectory());
const walked = (targets.length ? targets : [ROOT])
  .filter((t) => statSync(t).isDirectory()).flatMap(walk);
const documents = targets.length ? [] : [...DOCUMENTS, ...todoItems()];

const skipped = walked.filter((p) => GENERATED.test(p));
const files = [...named, ...documents, ...walked.filter((p) => !GENERATED.test(p))]
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
  console.log('This run reports. `npm run ste:check` is the gate (docs/TODO/154 M4).');
}

if (flags.has('--gate')) {
  // THE GATE. It prints only what fails, because a gate that prints 252 clean
  // rows buries the one line somebody has to act on. The remedy is in the
  // message: `CLAUDE.md` says to split a sentence, and never to drop a fact to
  // meet a cap.
  const bad = files
    .map((f) => ({ path: f.path, breaches: f.breaches.filter((b) => !b.rule.startsWith('-ing')) }))
    .filter((f) => f.breaches.length);
  for (const f of bad) {
    for (const b of f.breaches) {
      console.log(`${f.path}:${b.line}  ${b.rule}`);
      console.log(`  ${b.sentence}`);
    }
  }
  const n = total.long + total.tense;
  if (n) {
    console.log(`\nste: ${n} breach(es) of the house style in ${bad.length} file(s).`);
    console.log('Split the sentence. Never drop a fact to meet a cap (CLAUDE.md).');
    process.exit(1);
  }
  // THE GATE SAYS WHAT IT READ, and it counts the two surfaces apart. A gate
  // that reads one of them and reports one number cannot say which one it
  // missed (docs/TODO/171).
  const docs = files.filter((f) => f.path.endsWith('.md'));
  const inDocs = docs.reduce((n, f) => n + f.sentences, 0);
  console.log(`ste: ${total.sentences - inDocs} sentences in ${files.length - docs.length} files`
    + ` and ${inDocs} in ${docs.length} documents`
    + ` — 0 over cap, 0 in a compound tense`
    + ` · ${total.ing} -ing reported, not gated`);
} else if (flags.has('--words')) {
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
