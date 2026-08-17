// Is every plan title a sentence?
//
// A title names a document to somebody who has not read it. `CLAUDE.md` states
// the rule: a title takes a subject and a verb, in the active voice and a
// simple tense. It never carries a term that the document defines.
//
// WHY THIS TOOL EXISTS. Chris read the titles on 2026-08-16 and named the
// cause: *"this is not the house convention — this is something that you have
// been doing and we've been trying to correct by mandating ASD-STE100."* He is
// right. Every title under `docs/TODO/` was written by an agent. So an agent
// that reads the archive to learn the convention finds its own habit, and calls
// it a rule. That is docs/TODO/165's finding again: the index and the archive
// agreed with each other, and neither one checked.
//
// The sweep of 2026-08-16 rewrote 30 titles. `tools/ste.mjs` cannot hold them:
// it reads comments in `src/`, and a 20-word cap never fires on a title. So
// this file holds the two rules of the style that a title can break.
//
// A LIST DECIDES WHAT A VERB IS, AND THAT IS THE COST. English has no cheap
// test for a finite verb. So `VERBS` below is curated, and the gate FAILS when
// it meets a word it does not know. That is deliberate, and it is
// `tools/sizes.mjs`'s bargain: a title outside the rule is allowed, and a title
// outside the rule SILENTLY is not. The remedy is one of two things, and the
// failure message says both:
//
//   1. rewrite the title, which is the answer most of the time;
//   2. add the verb to `VERBS`, when the title is already a sentence.
//
// `--audit` reports an entry that no title uses. A dead entry is the same
// defect as a stale claim, and it is the review surface that stops this list
// from growing without a reader.
//
// WHAT IT CANNOT DO, AND THE ONE WORD THAT SHOWS IT. A word list cannot tell a
// noun from a verb. `name` is both, so *"a name for the seed stride"* satisfies
// the verb rule while it carries no verb at all. That title was rewritten by
// eye rather than by this gate. So the gate catches the common fault, and a
// reader still reads the title.
//
// Run: node tools/titles.mjs   (also `npm run titles:check`, and part of
// `npm run check`)

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'docs/TODO';

/**
 * A finite verb, or an auxiliary that carries one.
 *
 * It holds every form the 158 titles use, and nothing else. A new title that
 * needs a new word adds it here, which is the review this gate asks for.
 */
const VERBS = new Set([
  'is', 'are', 'was', 'were', 'has', 'have', 'had', 'does', 'do', 'did',
  'can', 'cannot', 'must', 'will', 'would', 'should', 'may',
  'says', 'holds', 'reads', 'names', 'makes', 'takes', 'gives', 'goes',
  'comes', 'knows', 'needs', 'wants', 'costs', 'pays', 'draws', 'flies',
  'obeys', 'owns', 'means', 'sees', 'shows', 'shoots', 'tells', 'keeps',
  'leaves', 'lives', 'runs', 'turns', 'works', 'breaks', 'falls', 'stops',
  'starts', 'ends', 'fits', 'hides', 'lies', 'sits', 'stands', 'exists',
  'arrives', 'eats', 'deletes', 'performs', 'gets', 'thinks', 'wins',
  'loses', 'kills', 'spends', 'carries', 'counts', 'reports', 'sends',
  'picks', 'chose', 'rerolls', 'strands', 'lands', 'fires', 'parks',
  'asserts', 'drives', 'rewards', 'freeze', 'freezes', 'plays', 'writes',
  'puts', 'refuses', 'claims', 'offers', 'bills', 'covers', 'tracks',
  'hands', 'differs', 'flew', 'scores', 'loads', 'credits', 'rolls',
  'uses', 'hit', 'headlines', 'meets', 'agree', 'agrees', 'disagree',
  'wait', 'waits', 'answers', 'asks', 'earns', 'blocks', 'moves',
  'launches', 'attacks', 'clears', 'crosses', 'follows', 'points',
  // added by the sweep of 2026-08-16, when this gate first read every title
  'name', 'names', 'jumps', 'write', 'get', 'leave', 'advances', 'perform',
  'stop', 'come', 'assert', 'quotes', 'load', 'flies', 'need', 'needs',
  // docs/TODO/177, whose title is a sentence this list could not read
  'compares',
]);

/**
 * A title that opens with an imperative is a sentence, and ASD-STE100 allows
 * one. The early plans are written this way, and they are correct.
 */
const IMPERATIVE = new Set([
  'add', 'use', 'bring', 'vendor', 'implement', 'replace', 'audit',
  'rebaseline', 'compare', 'create', 'make', 'give', 'put', 'move', 'split',
  'sweep', 'delete', 'fix', 'show', 'surface', 'separate', 'review', 'name',
  'tell', 'start', 'stop', 'hold', 'keep', 'find', 'write', 'record', 'open',
  'close', 'teach', 'let', 'run', 'read', 'check', 'pin', 'land', 'trim',
  'cut', 'join', 'drop', 'generate', 'import', 'extract', 'build', 'turn',
  'send', 'pick', 'raise', 'lower', 'report', 'log', 'track', 'store', 'save',
  'scan', 'count', 'measure', 'prove', 'widen', 'narrow', 'retire', 'restore',
  'repair', 'convert', 'rename', 'document', 'parse', 'this',
  'say', 'ship', 'promote', 'decide', 'anchor',
]);

/** A word that a be-verb turns into the passive voice. */
const PARTICIPLE = /(?:ed|en)$|^(?:written|given|taken|made|held|left|lost|kept|sold|told|built|spent|drawn|known|seen|shown|paid|said|found|gone|done|become)$/;
const BE = new Set(['was', 'were', 'is', 'are', 'be', 'been', 'being']);
const SKIP = new Set(['not', 'no', 'longer', 'never', 'still', 'always', 'now', 'then']);

const words = (title) => title
  .replaceAll(/`[^`]*`/g, ' ')          // inline code carries its exact wording
  .replaceAll(/[^A-Za-z' -]/g, ' ')
  .split(/[\s-]+/).filter(Boolean).map((w) => w.toLowerCase());

/** Which of the two rules this title breaks, if either. */
function faults(title) {
  const w = words(title);
  const out = [];
  for (let i = 0; i < w.length - 1; i++) {
    if (!BE.has(w[i])) continue;
    let j = i + 1;
    while (j < w.length && SKIP.has(w[j])) j += 1;
    if (j < w.length && PARTICIPLE.test(w[j]) && !VERBS.has(w[j])) {
      out.push(`passive voice — "${w[i]} ${w[j]}"`);
      break;
    }
  }
  if (!IMPERATIVE.has(w[0]) && !w.some((x) => VERBS.has(x))) {
    out.push('no verb — a title states a subject and a verb');
  }
  return out;
}

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = join(dir, e.name);
  if (e.isDirectory()) return walk(p);
  return e.name.endsWith('.md') && e.name !== 'README.md' ? [p] : [];
});

/** Every heading, plus every label an index gives a plan. Both are titles. */
const found = [];
for (const path of walk(ROOT)) {
  const head = readFileSync(path, 'utf8').split('\n')[0];
  const m = head.match(/^#\s*(?:\d+\s*—\s*)?(.+)$/);
  if (m) found.push({ where: path, title: m[1].trim() });
}
for (const dir of [ROOT, `${ROOT}/completed`, `${ROOT}/retired`, `${ROOT}/research`]) {
  const text = readFileSync(join(dir, 'README.md'), 'utf8');
  for (const m of text.matchAll(/\[([^\]]{6,})\]\([^)#]*?\d+-[a-z0-9-]+\.md\)/g)) {
    found.push({ where: `${dir}/README.md`, title: m[1].replace(/^\d+\s*—\s*/, '').trim() });
  }
}

const bad = found.map((f) => ({ ...f, why: faults(f.title) })).filter((f) => f.why.length);

if (process.argv.includes('--audit')) {
  const used = new Set(found.flatMap((f) => words(f.title)));
  const dead = [...VERBS, ...IMPERATIVE].filter((v) => !used.has(v));
  console.log(`${VERBS.size + IMPERATIVE.size} entries · ${dead.length} that no title uses`);
  if (dead.length) console.log(`UNUSED: ${dead.join(' ')}`);
}

console.log(`titles: ${found.length} read · ${bad.length} break the style`);
// The control. A walk that found nothing would report the same success.
if (found.length < 100) {
  console.error('\nFAIL: this gate read almost nothing, so its pass means nothing.');
  process.exit(1);
}

if (bad.length) {
  console.error(`\nFAIL: ${bad.length} title(s) break the style CLAUDE.md states.\n`);
  for (const f of bad) console.error(`  ${f.where}\n    "${f.title}"\n    ${f.why.join('; ')}`);
  console.error(`
A TITLE IS A SENTENCE. It names a document to somebody who has not read it, so
it takes a subject and a verb, in the active voice.

  write this   The briefing says reputation when it means rating
  not this     The map was not repaired with the headers      (passive)
  not this     Behaviour and flight in one file               (no verb)

There are two remedies, and the first one is right most of the time.

  1. REWRITE THE TITLE. Say what the document found, as a sentence.
  2. ADD THE VERB to VERBS in tools/titles.mjs, when the title already is a
     sentence and this gate simply does not know the word.

A heading and its index label are both titles, and both are read here. Rename
the file with the heading: a slug is a title that a code search reads.
`);
  process.exit(1);
}
