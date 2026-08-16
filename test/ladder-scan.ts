// Everywhere the game puts words in front of a player, and its own comments.
//
// This is the half of the ladder-word gate that decides WHAT IS READ.
// `test/ladder-words.test.ts` decides what is wrong with it. The split is
// `tools/ste-read.mjs`'s, and it is here for the same reason: a scan that reads
// the wrong surface is a gate that passes for the wrong reason.
//
// docs/TODO/162 wrote the first version, and it read one surface: a shouted
// string literal, in TypeScript, under `src/game/` and `src/ui/`. docs/TODO/171
// measured what that misses. It is two things:
//
// 1. Every mixed-case sentence a player reads. Five of the seven pages of the
//    site are prose, and the briefing is a template literal in `src/ui/`.
// 2. Every comment in `src/`. The first version stripped a comment before it
//    read, because the file's own comments discuss the banned words.
//
// So there are three surfaces here, and each one has its own reader. A caller
// asks for one of them, and the counts it reports are the evidence that the
// reader did not silently stop.

import { readdirSync, readFileSync } from 'node:fs';
import { comments, paragraphs, runs, sentences, words } from '../tools/ste-read.mjs';

/** One thing a reader read, with enough to name it in a failure message. */
export interface Line {
  /** The file, relative to the root the reader walked. */
  where: string;
  /** The 1-based line it starts on. */
  line: number;
  /** The words themselves. */
  text: string;
}

/** The repository root. Every path below is relative to it. */
const ROOT = new URL('../', import.meta.url);

/**
 * The two directories that hold the game's own voice.
 *
 * A console line, a screen and the briefing are all written here. Nothing under
 * `src/galaxy/`, `src/ships/` or `src/engine/` speaks to a player.
 */
const SPOKEN = ['src/game/', 'src/ui/'];

/** Every TypeScript file under one directory. */
const walk = (dir: URL): URL[] => readdirSync(dir, { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? walk(new URL(`${e.name}/`, dir))
    : /\.ts$/.test(e.name) ? [new URL(e.name, dir)] : []));

/** A file with its comments gone. A comment about a banned word is not a use of one. */
const stripped = (url: URL): string =>
  readFileSync(url, 'utf8').replace(/^\s*(\/\/|\*|\/\*).*$/gm, '');

/**
 * Every string literal in a file, with the line it is on.
 *
 * `test/key-prose.test.ts`'s reader, and for its reasons: backticks first, and
 * every form takes escapes, so an apostrophe cannot end a match early. An
 * interpolation becomes `0`, so a template literal reads as one sentence.
 */
const LITERAL = /`((?:[^`\\]|\\.)*)`|'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"/g;

function literals(url: URL, where: string): Line[] {
  const src = stripped(url);
  const out: Line[] = [];
  let at = 0;
  let line = 1;
  for (const m of src.matchAll(LITERAL)) {
    // Count forward from the last match rather than from the start of the file.
    // A count from the start is quadratic, and this reader walks the tree.
    for (let i = at; i < m.index; i++) if (src[i] === '\n') line += 1;
    at = m.index;
    out.push({ where, line, text: (m[1] ?? m[2] ?? m[3] ?? '').replaceAll(/\$\{[^}]*\}/g, '0') });
  }
  return out;
}

/** Every string literal under `src/game/` and `src/ui/`. */
function spokenLiterals(): Line[] {
  const out: Line[] = [];
  for (const root of SPOKEN) {
    const dir = new URL(root, ROOT);
    for (const url of walk(dir)) {
      out.push(...literals(url, root + url.pathname.slice(dir.pathname.length)));
    }
  }
  return out;
}

/**
 * The console's voice: a shouted literal with real words in it.
 *
 * `test/key-prose.test.ts` decides it the same way. An identifier is not a
 * message, and neither is a two-letter code.
 */
export function shoutedStrings(): Line[] {
  return spokenLiterals()
    .filter((l) => !/[a-z]/.test(l.text) && (l.text.match(/[A-Z]/g) ?? []).length >= 3);
}

/** The pages of the site, in the order the directory gives them. */
export const PAGES: string[] = readdirSync(ROOT, { withFileTypes: true })
  .filter((e) => e.isFile() && /\.html$/.test(e.name)).map((e) => e.name);

/** Whitespace of the same shape, so a replacement keeps every line number. */
const blank = (s: string): string => s.replaceAll(/[^\n]/g, ' ');

/**
 * The words of one page, as paragraphs, with the line each one starts on.
 *
 * Markup is not prose. A script, a style rule, an HTML comment, a tag and an
 * entity each become whitespace of their own shape, so nothing moves and every
 * line number stays true. A sentence wraps across source lines, so a run of
 * text lines joins into one paragraph.
 */
function pageProse(src: string): Line[] {
  const bare = src
    .replaceAll(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, blank)
    .replaceAll(/<!--[\s\S]*?-->/g, blank)
    .replaceAll(/<[^>]*>/g, blank)
    .replaceAll(/&[#\w]+;/g, ' ');
  const out: Line[] = [];
  const lines = bare.split('\n');
  let open = false;
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i].trim();
    if (!text) { open = false; continue; }
    if (open) out[out.length - 1].text += ` ${text}`;
    else { out.push({ where: '', line: i + 1, text }); open = true; }
  }
  return out;
}

/**
 * Every sentence a player reads, from the pages and from the game itself.
 *
 * The pages are the five prose ones plus the two development ones, because the
 * walk asks the directory rather than a list. A page added to the site is read
 * the day it lands.
 *
 * The second half is the mixed-case literal, which is where a screen and the
 * briefing live. A shouted literal is `shoutedStrings`'s, and a sentence of
 * fewer than three words carries no claim about a ladder.
 */
export function playerSentences(): Line[] {
  const out: Line[] = [];
  for (const name of PAGES) {
    for (const para of pageProse(readFileSync(new URL(name, ROOT), 'utf8'))) {
      for (const text of sentences(para.text)) {
        if (words(text).length >= 3) out.push({ where: name, line: para.line, text });
      }
    }
  }
  for (const l of spokenLiterals()) {
    if (!/[a-z]/.test(l.text)) continue;
    for (const text of sentences(l.text)) {
      if (words(text).length >= 3) out.push({ where: l.where, line: l.line, text });
    }
  }
  return out;
}

/**
 * Every comment paragraph in `src/`, joined and with its line.
 *
 * The paragraph is the unit rather than the sentence, because the word a
 * comment is about and the ladder it is about are often two sentences apart.
 * `tools/ste-read.mjs` supplies the reader: it walks characters, so it can tell
 * a comment from a string that holds `//`.
 */
export function commentParagraphs(): Line[] {
  const dir = new URL('src/', ROOT);
  const out: Line[] = [];
  for (const url of walk(dir)) {
    const where = url.pathname.slice(dir.pathname.length);
    for (const run of runs(comments(readFileSync(url, 'utf8')))) {
      for (const para of paragraphs(run)) out.push({ where, line: para.line, text: para.text });
    }
  }
  return out;
}
