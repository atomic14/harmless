// Does the Simplified Technical English checker find what it claims to find?
//
// Three parts, and the second one matters most. The first proves that each of
// the three rules fires. The second proves the EXCLUSIONS. A quotation, a name
// in backticks, a path and a string that holds `//` are all things the checker
// must leave alone. A checker that reports a false breach asks somebody to
// rewrite correct prose, and where the prose is a quotation, that is a
// falsification (docs/TODO/154).
//
// The third part proves the markdown reader against one fixture (docs/TODO/168
// M1). The fixture holds a heading, a code block, a table, a block quotation, a
// link and a bulleted list. A trial reader joined a whole list into one
// sentence, so the count that fixture asserts is the point of it.
//
// Run: node tools/ste.test.mjs   (also `npm run ste:test`)

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { comments, proseOf, prose, sentences, words } from './ste-read.mjs';
import { proseOfMarkdown, titlesOfMarkdown } from './ste-read-md.mjs';
import { capFor, isInstruction, ingWords, tenseBreaches } from './ste-rules.mjs';

/** A sentence of exactly `n` words, so no assertion below counts by hand. */
const long = (n, first = 'The') => `${first} ${Array(n - 2).fill('word').join(' ')} ends.`;
const said = (src) => proseOf(src).map((p) => p.sentence);

assert.equal(words(long(25)).length, 25);
assert.equal(words(long(26)).length, 26);

// --- the reader: what counts as a comment -----------------------------------

// A trailing comment is prose. A line-at-a-time reader cannot see one at all.
assert.deepEqual(said('const x = 1; // The ship docks.'), ['The ship docks.']);

// A string that holds a comment opener is not a comment.
assert.deepEqual(said('const url = "http://x/a"; const y = 2;'), []);
assert.deepEqual(said("const s = '// The ship docks.';"), []);

// THE FAILURE THAT MATTERS: a quote inside a regular expression must not open a
// string. If it did, the string would never close. Every comment after it in
// the file would then go unread, which is the silent-drop failure that
// tools/internal-claims.mjs was written after.
assert.deepEqual(said("const q = /['\"]/; // The ship docks."), ['The ship docks.']);
assert.deepEqual(said('const r = /a\\/\\/b/; // The ship docks.'), ['The ship docks.']);

// A division is not a regular expression, so the comment after it still reads.
assert.deepEqual(said('const half = a / b; // The ship docks.'), ['The ship docks.']);

// A block comment loses its leading stars, and keeps its line numbers.
const block = '\n/**\n * The ship docks.\n *\n * The slot opens.\n */\n';
assert.deepEqual(proseOf(block), [
  { line: 3, sentence: 'The ship docks.' },
  { line: 5, sentence: 'The slot opens.' },
]);

// A template literal spans lines, and the comment after it still reads.
assert.deepEqual(said('const t = `a\nb`; // The ship docks.'), ['The ship docks.']);

// A quote that never closes stops at the end of its line. Only a template
// literal may hold a newline. Anything else that reaches one is not a string,
// and the rest of the file must still be read.
assert.deepEqual(said("const s = 'oops;\n// The ship docks."), ['The ship docks.']);

// --- the reader: what counts as one sentence --------------------------------

// A comment RUN is read whole, because a sentence wraps.
assert.deepEqual(said('// The ship docks at the\n// station.'), ['The ship docks at the station.']);

// A blank comment line ends a paragraph, so the two do not run together.
assert.deepEqual(said('// The ship docks\n//\n// the slot opens'),
  ['The ship docks', 'the slot opens']);

// Three conditions are three sentences. The style asks for the list, so a list
// counted as one long sentence would report the opposite of what it is.
assert.deepEqual(said('// Three things:\n// - the hull\n// - the shield\n// - the gun'),
  ['Three things:', '- the hull', '- the shield', '- the gun']);

// A decimal, a version and an abbreviation do not end a sentence.
assert.deepEqual(sentences('It sits at 0.38 of the way. It ends.'),
  ['It sits at 0.38 of the way.', 'It ends.']);
assert.deepEqual(sentences('The gun fires, e.g. Lave sells it.'), ['The gun fires, e.g. Lave sells it.']);

// A markdown table is not prose. It is not prose inside a block comment
// either, which is what the stars have to come off for.
assert.deepEqual(said('// | leg | share |\n// | --- | --- |'), []);
assert.deepEqual(said('/**\n * | leg | share |\n * | --- | --- |\n */'), []);

// An abbreviation this tool does not know still holds its sentence together,
// because the next word is lower case. `E.C.M.` is the one this game writes.
assert.deepEqual(sentences('The E.C.M. and the bomb both fire.'),
  ['The E.C.M. and the bomb both fire.']);

// Neither is a command to run. Every tool in tools/ ends its header with a
// usage block, and read as prose that block is one very long instruction.
assert.deepEqual(said('// Run: node tools/ste.mjs   the whole of src/\n'
  + '//      node tools/ste.mjs --dirs   one row per directory'), []);

// Nor is a table laid out in columns rather than in pipes. A run of three
// spaces inside a line is a column gap, and prose never has one.
assert.deepEqual(said('//   NPC laser -> the target     gunnery.ts  damageToPlayer'), []);
assert.deepEqual(said('//   The ship docks at the station on its own.'),
  ['The ship docks at the station on its own.']);

// --- the reader: the exclusions ---------------------------------------------

// A command in backticks is one word to a reader, so it is one word here. The
// four words of `npm run generate:constants` are the style's own exclusion, and
// counting them would make an ordinary sentence look like a long one.
assert.equal(words(prose('Then run `npm run generate:constants` twice.')).length, 4);

// A path must not eat the full stop that ends the sentence it sits in. The
// greedy form of that mask joined two sentences into one, and reported the
// join as a breach of the cap.
assert.deepEqual(sentences(prose('It swept src/constants/. Do not re-sweep it.')),
  ['It swept PATH /.', 'Do not re-sweep it.']);

// A QUOTATION IS ONE WORD. Both of the shapes this repository writes one in.
assert.equal(words(prose('Chris: *"they fly quite far before turning for another run."*')).length, 2);
assert.equal(words(prose('He said "they fly quite far before turning" to me.')).length, 5);

// The words around a quotation are still measured, so a long frame is caught.
assert.ok(words(prose(`${long(30).slice(0, -1)} and he said "a b c d e f g h i j".`)).length > 25);

// The placeholder is what keeps the sentence before a quotation whole. Deleted
// outright, the fragment left behind starts in the middle, so the full stop
// stops looking like the end of a sentence and two are measured as one.
assert.deepEqual(sentences(prose('It is not a question. "Has it moved" is.')),
  ['It is not a question.', 'QUOTE is.']);

// A doc tag opens a new claim about a new thing, so it is a new paragraph.
assert.deepEqual(said('/**\n * It is short.\n * @returns the buffer, or null.\n */'),
  ['It is short.', 'the buffer, or null.']);

// --- rule 1: the caps -------------------------------------------------------

assert.equal(capFor(long(25)), 25);
assert.ok(words(long(25)).length <= capFor(long(25)));
assert.ok(words(long(26)).length > capFor(long(26)));

// An instruction answers to 20 rather than to 25.
assert.equal(isInstruction(long(21, 'Use')), true);
assert.equal(capFor(long(21, 'Use')), 20);
assert.ok(words(long(21, 'Use')).length > capFor(long(21, 'Use')));

// The same 21 words are within the cap when they describe rather than instruct.
assert.equal(isInstruction(long(21)), false);
assert.ok(words(long(21)).length <= capFor(long(21)));

// A negative imperative is an instruction. CLAUDE.md gives more orders that way
// than it does with a bare verb.
assert.equal(isInstruction('Do not fix a symptom.'), true);
assert.equal(isInstruction('Never renumber a rule.'), true);
assert.equal(isInstruction('Nothing here edits them.'), false);

// --- rule 2: the -ing words -------------------------------------------------

assert.deepEqual(ingWords('The ship was flying home.').flagged, ['flying']);
assert.deepEqual(ingWords('The docking computer works.').flagged, []);
assert.deepEqual(ingWords('The docking computer works.').allowed, ['docking']);

// A word that merely ends in the same three letters is not an -ing form.
assert.deepEqual(ingWords('Nothing in the string during the ring.').flagged, []);

// Four letters are too few to be an -ing form of anything.
assert.deepEqual(ingWords('The king sat.').flagged, []);

// --- rule 3: the tense ------------------------------------------------------

assert.deepEqual(tenseBreaches('The claim has been false.'), ['has been']);
assert.deepEqual(tenseBreaches('The claim has never been false.'), ['has been']);
assert.deepEqual(tenseBreaches('It may have been caused by the roll.'), ['may have']);
assert.deepEqual(tenseBreaches('The file had shrunk away from it.'), ['had shrunk']);
assert.deepEqual(tenseBreaches('The rule is being reverted.'), ['is being']);

// The simple tenses are what the style asks for, and none of them is a breach.
assert.deepEqual(tenseBreaches('The ship docks.'), []);
assert.deepEqual(tenseBreaches('The ship docked.'), []);
assert.deepEqual(tenseBreaches('The ship will dock.'), []);
assert.deepEqual(tenseBreaches('The shot is flown by the brain.'), []);
assert.deepEqual(tenseBreaches('It must be proved able to fail.'), []);

// --- the whole checker, end to end ------------------------------------------

const file = `
// The ship has been flying home for a long time, which is a sentence of
// twenty-six words and therefore over the descriptive cap of the style.
const x = 1;
`;
const only = proseOf(file);
assert.equal(only.length, 1);
assert.equal(words(only[0].sentence).length, 26);
assert.ok(words(only[0].sentence).length > capFor(only[0].sentence));
assert.deepEqual(ingWords(only[0].sentence).flagged, ['flying']);
assert.deepEqual(tenseBreaches(only[0].sentence), ['has been']);
assert.equal(only[0].line, 2);

// --- the markdown reader ----------------------------------------------------

// THE FIXTURE IS THE ASSERTION THAT MATTERS (docs/TODO/168 M1). It holds one of
// each thing the reader must drop, and one bulleted list. A trial reader joined
// a whole list into one 43-word sentence, and reported the join as a breach of
// the cap. The count below is what stops that coming back.
const DOC = `# The reader reads a document

The ship docks at the
station.

## The exclusions

\`\`\`
const x = 1; // a line of code that is far too long to pass the descriptive cap
\`\`\`

| leg | share |
| --- | --- |
| one | half |

> The note holds.

Three things:

- the hull
- the shield that is fitted to
  the ship
- the gun

See [the catalogue](ELITE-A.md) for the rest.
`;

const read = proseOfMarkdown(DOC).map((p) => p.sentence);

// Seven sentences, and the fixture names each one. A code block, a table and a
// heading are not among them.
assert.deepEqual(read, [
  'The ship docks at the station.',
  'The note holds.',
  'Three things:',
  '- the hull',
  '- the shield that is fitted to the ship',
  '- the gun',
  'See the catalogue for the rest.',
]);

// A heading is a title rather than a sentence, so it comes back on its own
// list. `CLAUDE.md` gives a title its own rules, and a 20-word cap never fires
// on one.
assert.deepEqual(titlesOfMarkdown(DOC), [
  { line: 1, title: 'The reader reads a document' },
  { line: 6, title: 'The exclusions' },
]);

// A link keeps its text and loses its target. The target reaches the word count
// as a word without this, because a name with no slash in it is not a path.
assert.equal(proseOfMarkdown('See [the catalogue](ELITE-A.md) now.')[0].sentence,
  'See the catalogue now.');

// A fenced block is dropped whole, and the paragraphs on each side of it stay
// apart. A block deleted outright would join them into one long sentence.
assert.deepEqual(proseOfMarkdown('The ship docks.\n\n```\ncode\n```\n\nThe slot opens.')
  .map((p) => p.sentence), ['The ship docks.', 'The slot opens.']);

// A block quotation is READ, and docs/TODO/168 M1 said to drop it. Measured
// over the ten documents, every quotation of a person is inline, and the
// `*"..."*` mask already answers it. A dropped block would exempt 95 lines of
// house prose.
assert.deepEqual(proseOfMarkdown('> Chris said *"it flies well"* to me.')
  .map((p) => p.sentence), ['Chris said QUOTE to me.']);

// The line number is the line the paragraph starts on, as it is in source.
assert.deepEqual(proseOfMarkdown('# A title\n\nThe ship docks at the\nstation.'),
  [{ line: 3, sentence: 'The ship docks at the station.' }]);

// --- the gate, and the proof that it can fail -------------------------------

// `npm run ste:check` is a gate, so it must be able to fail (docs/PROCESS.md).
// These run the real command line against a written fixture, because the gate's
// decision is the exit code and nothing above this line can see one.
//
// THE THIRD CASE IS THE POINT. An `-ing` word is reported and never gated, so a
// file that holds one and nothing else must still exit 0. Without it, a change
// that folded the third count into the gate would pass this file.
const dir = mkdtempSync(join(tmpdir(), 'ste-gate-'));
const gate = (body) => {
  writeFileSync(join(dir, 'fixture.ts'), body);
  const run = spawnSync(process.execPath, [
    new URL('./ste.mjs', import.meta.url).pathname, '--gate', dir,
  ], { encoding: 'utf8' });
  return run.status;
};

assert.equal(gate('// The ship docks.\n'), 0);
assert.equal(gate(`// ${long(30)}\n`), 1);
assert.equal(gate('// The rule has been true.\n'), 1);
assert.equal(gate('// The ship was flying home.\n'), 0);

rmSync(dir, { recursive: true, force: true });

console.log('ste fixtures: ok');
