// Getting the prose out of a source file, and nothing else.
//
// This is the half of the Simplified Technical English checker that decides
// WHAT IS MEASURED. `tools/ste-rules.mjs` decides what is wrong with it, and
// `tools/ste.mjs` is the parent that reports.
//
// The exclusions live here, and they are the part that has to be right. The
// house style never touches code, an exact command, an API name, an error
// string, or anything quoted from a person. A quotation rewritten is falsified,
// so a checker that cannot see a quotation mark asks for exactly that.
//
// Nothing in this file knows a rule. It answers one question: what sentences
// does a reader of this file actually read?

/**
 * Every comment in one source file, with the line each one starts on.
 *
 * This walks characters rather than lines. A line-at-a-time reader cannot tell
 * a comment from a string that holds `//`, and cannot see a trailing comment at
 * all. `tools/internal-claims.mjs` records what the cheap reader
 * costs: it found 22 of 28 paths and dropped six in silence.
 *
 * A string and a regular expression are skipped for the same reason. A quote
 * inside a regular expression would otherwise open a string that never closes,
 * and every comment after it in the file would go unread.
 */
export function comments(src) {
  const out = [];
  let i = 0;
  let line = 1;
  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '\n') { line += 1; i += 1; continue; }
    if (c === '/' && d === '/') {
      let end = src.indexOf('\n', i);
      if (end < 0) end = src.length;
      out.push({ line, text: src.slice(i + 2, end), block: false });
      i = end;
      continue;
    }
    if (c === '/' && d === '*') {
      let end = src.indexOf('*/', i + 2);
      if (end < 0) end = src.length;
      const body = src.slice(i + 2, end);
      out.push({ line, text: body, block: true });
      line += newlines(body);
      i = end + 2;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const end = endOfString(src, i);
      line += newlines(src.slice(i, end));
      i = end;
      continue;
    }
    if (c === '/' && startsRegex(src, i)) { i = endOfRegex(src, i); continue; }
    i += 1;
  }
  return out;
}

function newlines(s) {
  let n = 0;
  for (let i = 0; i < s.length; i++) if (s[i] === '\n') n += 1;
  return n;
}

function endOfString(src, start) {
  const quote = src[start];
  let i = start + 1;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') { i += 2; continue; }
    if (c === quote) return i + 1;
    // Only a template literal may hold a newline. Anything else that reaches
    // one is not a string, and stopping here limits the damage to that line.
    if (c === '\n' && quote !== '`') return i;
    i += 1;
  }
  return src.length;
}

/**
 * Does a slash at this position open a regular expression, or divide?
 *
 * The test is what comes before it. A division follows a value, so a slash
 * after a name, a number or a closing bracket divides. Everything else opens a
 * pattern, and that includes the keywords that take an expression on the right.
 */
const BEFORE_REGEX =
  /(?:^|[=(,:[!&|?{};+\-*%~^<>]|\b(?:return|typeof|case|in|of|new|delete|void|do|else|yield|await))\s*$/;

const startsRegex = (src, i) => BEFORE_REGEX.test(src.slice(Math.max(0, i - 48), i));

function endOfRegex(src, start) {
  let i = start + 1;
  let inClass = false;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') { i += 2; continue; }
    if (c === '\n') return i;
    if (c === '[') inClass = true;
    else if (c === ']') inClass = false;
    else if (c === '/' && !inClass) return i + 1;
    i += 1;
  }
  return src.length;
}

/**
 * One comment RUN, as physical lines with their line numbers.
 *
 * A run is a block comment, or a set of line comments on consecutive lines. It
 * is read whole because a sentence wraps: the subject can end one line and the
 * verb can start the next.
 */
export function runs(pieces) {
  const out = [];
  let current = null;
  for (const piece of pieces) {
    if (piece.block) {
      current = null;
      out.push(piece.text.split('\n').map((l, n) => ({
        line: piece.line + n, text: l.replace(/^\s*\*+ ?/, ''),
      })));
      continue;
    }
    const entry = { line: piece.line, text: piece.text };
    if (current && current[current.length - 1].line === piece.line - 1) current.push(entry);
    else { current = [entry]; out.push(current); }
  }
  return out;
}

/**
 * A line that is not prose, and is therefore not a sentence.
 *
 * A markdown table row, a rule and a fence are the first three. The fourth is a
 * COMMAND TO RUN, which the style excludes by name. Every tool in `tools/` ends
 * its header with a usage block. Read as prose, that block is one very long
 * instruction that nobody can rewrite. A `Run:` label may come first.
 *
 * No sentence of English starts with `node` or `npm`. A sentence ABOUT one of
 * them writes it in backticks, so this test cannot take a sentence away.
 *
 * The fifth is a table laid out in COLUMNS rather than in pipes, which several
 * headers in `src/` use for an inventory. A run of three spaces inside a line
 * is a column gap, and prose never has one, so the test is the gap rather than
 * the subject. Leading indentation is not a gap.
 */
const NOT_PROSE = /^\s*(?:\||```|-{3,}\s*$|={3,}\s*$|(?:Run:\s*)?(?:node|npm|\$)\s)|\S {3,}\S/;

/**
 * The paragraphs of one run, each with the line it starts on.
 *
 * A blank line ends a paragraph. So does a bullet. The style asks for a list of
 * three conditions rather than one long sentence. A list counted as one
 * sentence would report the opposite of what it is.
 *
 * A doc tag starts one too. `@param` and `@returns` open a new claim about a
 * new thing, and the tag itself comes off in `prose()` below. Joined to the
 * sentence above, the words after the tag were counted as part of it.
 */
const OPENS_A_PARAGRAPH = /^\s*(?:[-*+]\s|\d+[.)]\s|@[A-Za-z])/;

export function paragraphs(run) {
  const out = [];
  let current = null;
  for (const { line, text } of run) {
    if (text.trim() === '' || NOT_PROSE.test(text)) { current = null; continue; }
    const opens = OPENS_A_PARAGRAPH.test(text);
    if (current === null || opens) { current = { line, text: text.trim() }; out.push(current); }
    else current.text += ` ${text.trim()}`;
  }
  return out;
}

/**
 * A paragraph with everything the style does not cover taken out.
 *
 * Each replacement leaves one placeholder word behind, so the sentence keeps
 * its shape and the word count stays honest. A name in backticks is one word to
 * a reader, and it is one word here.
 *
 * A QUOTATION BECOMES ONE WORD RATHER THAN NOTHING. It is the exclusion that
 * matters most, because the tool cannot ask for a rewrite of somebody's own
 * words without asking for a falsification. The words inside it are not
 * counted, and the sentence that carries it is still measured on the words
 * around it.
 *
 * The placeholder is what keeps that second half true. A quotation deleted
 * outright leaves a fragment that starts in the middle, so the full stop before
 * it stops looking like the end of a sentence, and two sentences are then
 * measured as one long one.
 */
export function prose(text) {
  return text
    .replace(/`[^`]*`/g, ' CODE ')
    .replace(/\*"[^"]*"\*/g, ' QUOTE ')
    .replace(/"[^"]*"/g, ' QUOTE ')
    .replace(/“[^”]*”/g, ' QUOTE ')
    .replace(/https?:\/\/\S+/g, ' URL ')
    .replace(/@[A-Za-z]\w*/g, ' ')
    // A path must end on a letter or a digit. The greedy form of this swallows
    // the full stop that ends the sentence, and joins it to the next one.
    .replace(/[A-Za-z0-9_-]+\/[A-Za-z0-9_@./-]*[A-Za-z0-9_]/g, ' PATH ')
    .replace(/\*\*?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A word that ends in a full stop and does not end a sentence. */
const ABBREVIATION = /\b(?:e\.g|i\.e|etc|vs|cf|approx|fig|ref|Dr|Mr|Ms|St|No)\.$/i;

/**
 * The sentences of one paragraph.
 *
 * A full stop ends a sentence when whitespace follows it, and when the next
 * word starts with a capital. That second test keeps a version number and a
 * file name whole where the masking above did not reach them.
 */
export function sentences(text) {
  const out = [];
  const re = /[.!?]+/g;
  let start = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    const cut = m.index + m[0].length;
    const after = text.slice(cut);
    if (!/^(\s|$)/.test(after)) continue;
    const piece = text.slice(start, cut).trim();
    if (ABBREVIATION.test(piece)) continue;
    if (!/^\s*(?:$|["'(*]*[A-Z0-9])/.test(after)) continue;
    if (piece) out.push(piece);
    start = cut;
  }
  const tail = text.slice(start).trim();
  if (tail) out.push(tail);
  return out.filter((s) => words(s).length > 0);
}

/** The words of a sentence. A hyphenated compound is one word, as a reader reads it. */
export const words = (s) => s.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w));

/** Every prose sentence of one source file, with the line its paragraph starts on. */
export function proseOf(src) {
  const out = [];
  for (const run of runs(comments(src))) {
    for (const para of paragraphs(run)) {
      const text = prose(para.text);
      if (!text) continue;
      for (const sentence of sentences(text)) out.push({ line: para.line, sentence });
    }
  }
  return out;
}
