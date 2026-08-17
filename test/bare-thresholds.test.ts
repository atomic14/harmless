// A game rule compared against a bare number has no name, and this finds it.
//
// docs/TODO/180. `test/constants.test.ts` next door holds the other half of
// "one home for every constant", and it scans for a `const UPPER_CASE`
// DECLARATION outside `src/constants/`. It says so on purpose. **A bare literal
// in an expression has no declaration**, so nothing could see `if (d < 7000)`
// until this file.
//
// Thirteen were found and named. What is left is twelve, and every one of them
// is on the list below with the reason it is not a game rule.
//
// WHAT IT LOOKS FOR is a comparison against a bare number: `< 900`, `>= 3000`.
// A comparison is where a threshold hides, because a threshold is a line you
// are on one side of. A number used in arithmetic is a different question and a
// much noisier one — 769 non-trivial literals live in `src/`, and docs/TODO/180
// measured that almost none of them should move.
//
// THE FLOOR IS 50, AND IT IS A CHOICE. Below it a number is usually a count, an
// index, an angle or a small tolerance. The floor lets those through, and that
// is the price of a list short enough to read.
//
// `src/` only. `train/` and `tools/` are outside the home by the decision
// `test/constants.test.ts` records, not by omission.
//
// THE LIST IS THE REVIEW SURFACE, in the shape `tools/sizes.mjs` and
// `test/ai.test.ts` both use. It guards itself in both directions: an entry
// whose site no longer holds that threshold fails too, so it cannot become a
// place to hide (docs/TODO/165).

import { readdirSync, readFileSync } from 'node:fs';
import { check, eq } from './harness.ts';

/** Below this, a number is usually a count, an index or an angle. */
const FLOOR = 50;

/**
 * Every bare threshold that is NOT a game rule, by file and value.
 *
 * A reason is not "it is fine". It says what KIND of number it is, and every
 * kind here is one that `src/constants/` is not the home for: a training
 * internal, the 1984 source material, a buffer cap, or a bound on a loop.
 */
const ALLOWED: Readonly<Record<string, readonly (readonly [number, string])[]>> = {
  'ai-training/scenario.ts': [
    [1500, 'training: the gap inside which an episode banks engaged time'],
    [1800, 'training: the outer edge of the band a pass is scored in'],
    [120, 'training: the inner edge of that same band'],
    [60, "training: the speed the episode's trader target coasts below"],
    [300, "training: how near its waypoint that target has arrived"],
  ],
  'galaxy/galaxy.ts': [
    [256, 'the 1984 galaxy holds 256 systems — the source material, not a rule'],
  ],
  'galaxy/goatsoup.ts': [
    [127, "the 1984 text generator's own byte test, reproduced exactly"],
  ],
  'galaxy/living.ts': [
    [400, 'a ring buffer cap on the convoy list — memory, not a game rule'],
  ],
  'game/combat-sim-report.ts': [
    [200, "a ring buffer cap on the trainer's event log — memory again"],
  ],
  'game/save-file.ts': [
    [1000, 'a loop bound while a duplicate save name is made unique'],
    [60, 'minutes in an hour, for the "N MIN AGO" line'],
  ],
  'game/snapshot-parse.ts': [
    [255, 'the highest valid system index — the 256 above, as a bound'],
  ],
};

// --- the scan ---------------------------------------------------------------

const ROOT = new URL('../src/', import.meta.url);
const walk = (dir: URL): URL[] => readdirSync(dir, { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? walk(new URL(`${e.name}/`, dir))
    : /\.ts$/.test(e.name) ? [new URL(e.name, dir)] : []));

/**
 * Source with its comments and strings gone, walked one character at a time.
 *
 * The comments go for `test/constants.test.ts`'s reason: this project writes
 * down the numbers it deleted. The strings go because a console line may hold a
 * number, and a string is not a comparison.
 *
 * IT IS A WALKER RATHER THAN FOUR REGULAR EXPRESSIONS, AND THAT IS NOT
 * FASTIDIOUSNESS. The first draft of this file stripped block comments, then
 * line comments anchored at the start of a line, then quoted runs. A TRAILING
 * comment holding one backtick then survived the second pass and unbalanced the
 * third, which swallowed the rest of `galaxy/galaxy.ts` — including the
 * `i < 256` this file exists to see. The gate went green by reading nothing.
 *
 * `tools/ste-read.mjs` walks characters for the same reason, and docs/TODO/154
 * states it: a line-at-a-time reader cannot tell a comment from a string that
 * holds `//`.
 */
function codeOnly(src: string): string {
  let out = '';
  for (let i = 0; i < src.length;) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && d === '/') {
      while (i < src.length && src[i] !== '\n') i += 1;
    } else if (c === '/' && d === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i += 1;
      i += 2;
    } else if (c === "'" || c === '"' || c === '`') {
      i += 1;
      while (i < src.length && src[i] !== c) i += src[i] === '\\' ? 2 : 1;
      i += 1;
      out += ' ';
    } else {
      out += c;
      i += 1;
    }
  }
  return out;
}

const code = (url: URL): string => codeOnly(readFileSync(url, 'utf8'));

/** Every `<`, `>`, `<=` or `>=` against a bare number of at least FLOOR. */
function thresholdsIn(src: string): number[] {
  return [...src.matchAll(/[<>]=?\s*(\d[\d_]*)(?![\w.])/g)]
    .map((m) => Number(m[1].replace(/_/g, '')))
    .filter((v) => Number.isFinite(v) && v >= FLOOR);
}

const scan = (root: URL): Map<string, number[]> => {
  const found = new Map<string, number[]>();
  for (const url of walk(root)) {
    const rel = url.pathname.slice(root.pathname.length);
    if (rel.startsWith('constants/')) continue;         // the home itself
    if (/generated|danube/.test(rel)) continue;         // a generator writes it
    const hits = thresholdsIn(code(url));
    if (hits.length) found.set(rel, hits);
  }
  return found;
};

console.log('\na game rule compared against a bare number');
{
  const found = scan(ROOT);
  const total = [...found.values()].reduce((a, v) => a + v.length, 0);

  // 1. NOTHING UNLISTED. This is the rule: a new bare threshold in a rule file
  //    has to be named, or argued onto the list above.
  const stray: string[] = [];
  for (const [rel, values] of found) {
    const allowed = ALLOWED[rel] ?? [];
    for (const v of values) {
      if (!allowed.some(([a]) => a === v)) stray.push(`${rel}: ${v}`);
    }
  }
  check(`no game rule is compared against an unnamed number (${total} threshold(s) read)`,
    stray.length === 0,
    stray.length
      ? `${stray.join('; ')} — give it a name in src/constants/, or add it to `
        + 'ALLOWED in test/bare-thresholds.test.ts with the reason it is not a rule'
      : undefined);

  // 2. NOTHING STALE. The other direction, and the reason docs/TODO/165 exists:
  //    an exception that outlives its site turns the list into a hiding place.
  const dead: string[] = [];
  for (const [rel, entries] of Object.entries(ALLOWED)) {
    const values = found.get(rel) ?? [];
    for (const [v] of entries) {
      if (!values.includes(v)) dead.push(`${rel}: ${v}`);
    }
  }
  check(`nothing on the list has outlived its site (${Object.keys(ALLOWED).length} file(s) listed)`,
    dead.length === 0,
    dead.length ? `${dead.join('; ')} — take it off the list` : undefined);

  // 3. THE CONTROL. A scan that matched nothing would pass both checks above
  //    while reporting nothing at all. This is what says the reader works.
  check(`...and the scan reads thresholds at all (${total})`, total > 0);
  eq('...and finds the 1984 galaxy\'s own 256, which is on the list',
    (found.get('galaxy/galaxy.ts') ?? []).includes(256), true);
}
