// Getting the prose out of a markdown document, and nothing else.
//
// `tools/ste-read.mjs` does this for a source file, and it decides what a
// comment is. This file does it for a document, and it decides what a heading,
// a code block and a table are. Everything after that is shared: both readers
// hand the same paragraph to the same sentence splitter, so one rule keeps one
// home.
//
// WHAT IT DROPS, and the reason each one is out of scope:
//
// 1. a fenced code block, because the style never touches code;
// 2. a table row, because `docs/DAMAGE-PATHS.md`'s inventory is read by
//    `test/damage-paths.test.ts` (docs/TODO/141);
// 3. the target of a link, because a URL is not prose. The text of the link is
//    prose, and it stays;
// 4. inline code, a quotation and a path, which `tools/ste-read.mjs` masks for
//    both readers.
//
// A HEADING IS READ, AND IT IS NOT A SENTENCE (Chris, 2026-08-16). `CLAUDE.md`
// gives a title its own two rules, and a 20-word cap never fires on one. So a
// heading comes back on its own list. `tools/titles.mjs` owns what is wrong
// with a title.
//
// A LIST ITEM IS ITS OWN SENTENCE. That is the rule the trial reader of
// docs/TODO/168 got wrong. It joined a whole list into one 43-word breach, and
// the number it reported meant nothing. An item ends where the next item
// starts, so a wrapped item is still one sentence.
//
// A BLOCK QUOTATION IS READ, AND docs/TODO/168 M1 SAID TO DROP IT. The plan
// gave one reason: this repository quotes a person in a block, and a quotation
// rewritten is falsified. Measured over the ten documents, that is false. Every
// quotation of a person is inline, in the `*"..."*` shape that
// `tools/ste-read.mjs` already masks to one word. The 95 block lines are house
// prose: an AS BUILT note, a dated note, and one rule statement. A dropped
// block would take all of them out of the gate's reach.

import { paragraphs, prose, sentences } from './ste-read.mjs';

/** The fence that opens or closes a code block. */
const FENCE = /^\s*(```|~~~)/;

/** A heading, and the title it carries. A trailing run of hashes is decoration. */
const HEADING = /^\s*(#{1,6})\s+(.*?)\s*#*\s*$/;

/** The marker of a block quotation, which comes off the line under it. */
const QUOTED = /^\s*>\s?/;

/**
 * A link, an image and their targets.
 *
 * The text of a link is prose and the target is not, so the target comes off
 * first. An image has no prose in it at all. Both run before
 * `tools/ste-read.mjs` masks a path, because a target that holds no slash
 * would otherwise reach the word count as a word.
 */
const IMAGE = /!\[[^\]]*\]\([^)]*\)/g;
const LINK = /\[([^\]]*)\]\([^)]*\)/g;

/**
 * One document, split into the prose lines and the headings.
 *
 * A dropped line becomes an empty line rather than nothing, because
 * `paragraphs()` ends a paragraph on a blank line. A code block deleted
 * outright would join the paragraph above it to the paragraph below it.
 */
export function split(src) {
  const body = [];
  const titles = [];
  let fence = null;
  let quoted = 0;
  for (const [index, text] of src.split('\n').entries()) {
    const line = index + 1;
    const opener = text.match(FENCE);
    if (fence) {
      if (opener && opener[1] === fence) fence = null;
      body.push({ line, text: '' });
      continue;
    }
    if (opener) {
      fence = opener[1];
      body.push({ line, text: '' });
      continue;
    }
    const heading = text.match(HEADING);
    if (heading) {
      titles.push({ line, title: heading[2].trim() });
      body.push({ line, text: '' });
      continue;
    }
    if (QUOTED.test(text)) {
      quoted += 1;
      body.push({ line, text: text.replace(QUOTED, '') });
      continue;
    }
    body.push({ line, text });
  }
  return { body, titles, quoted };
}

/** A markdown line with its links reduced to the words a reader reads. */
export const links = (text) => text.replace(IMAGE, ' ').replace(LINK, '$1');

/** Every prose sentence of one document, with the line its paragraph starts on. */
export function proseOfMarkdown(src) {
  const out = [];
  for (const para of paragraphs(split(src).body)) {
    const text = prose(links(para.text));
    if (!text) continue;
    for (const sentence of sentences(text)) out.push({ line: para.line, sentence });
  }
  return out;
}

/** Every heading of one document, with its line. A heading is a title. */
export const titlesOfMarkdown = (src) => split(src).titles;
