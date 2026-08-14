// Does every comment that names a caller still have one?
//
// Thirty-one members of `src/` carried a doc comment of one shape:
// `@internal — driven by test/playtest.js`. Twenty-one of them were false. The
// harness had shrunk away from them over about a year, and no gate joined the
// two files, so the claim could not fail (docs/TODO/151).
//
// A false claim of this kind is worse than no comment. It tells the next
// maintainer that a member has a caller outside the type system. That
// maintainer keeps a dead method. That maintainer also refuses a signature
// change that nothing forbids.
//
// THE CLAIM IS LOAD-BEARING, WHICH IS WHY THE FALSE ONES DO DAMAGE. Nothing
// type-checks `test/playtest.js`: it is a console paste, and `tsconfig.json`
// compiles no `.js`. So for that file the comment IS the record of the caller.
//
// This gate reads one form only, `driven by <path>`. That form names a file, so
// a machine can check it. A bare `@internal` names no target and is left alone
// (docs/TODO/151, open question 3).
//
// Run: node tools/internal-claims.mjs   (also `npm run claims:check`, and part
// of `npm run check`)

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** The tree that carries the claims. The gate reads the files they name. */
const ROOT = 'src';

/**
 * A path in a claim: `test/playtest.js`, `src/game/game.ts`.
 *
 * The extension is required. It is what separates a path from the prose around
 * it, and every claim in the tree names a real file rather than a directory.
 */
const PATH = /^[A-Za-z0-9_@./-]+\.(?:ts|js|mjs)$/;

/** Words that may sit between two paths in one claim. */
const JOINERS = new Set(['and', 'or', ',', '&']);

/**
 * The member a claim is about, taken from the first line of code below it.
 *
 * A method, an accessor or a field. The modifiers are optional and may repeat,
 * so they are stripped ahead of the name rather than matched in order.
 */
const MEMBER = /^([A-Za-z_$][A-Za-z0-9_$]*)\s*[(<:=]/;
const MODIFIERS = /^\s*(?:export\s+|public\s+|private\s+|protected\s+|readonly\s+|static\s+|async\s+|abstract\s+|declare\s+|get\s+|set\s+|function\s+|const\s+|let\s+|var\s+)*/;

/**
 * A CALL, rather than the bare name.
 *
 * The name must arrive through an object: `g.buyCargo(`, `this.law_.raiseLegal(`.
 * Every caller in the tree reaches a member that way, and requiring the dot is
 * what stops a claim from answering itself. `raiseLegal` is declared in
 * `game.ts` as well as in `law-actions.ts`, so a bare `raiseLegal(` in the
 * named file would match that declaration and pass an empty claim.
 */
const callOf = (name) => new RegExp(`\\.\\s*${name}\\s*\\(`);

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : e.name.endsWith('.ts') ? [p] : [];
  });
}

const isComment = (l) => /^\s*(\/\/|\/\*|\*)/.test(l);

/**
 * Every claim in one file, with the member each one is about.
 *
 * A comment RUN is read whole, because a claim wraps: `driven by` can end one
 * line and the path it names can start the next. Reading line by line found 22
 * of the 25 paths in the tree and silently dropped three.
 */
function claimsIn(path) {
  const lines = readFileSync(path, 'utf8').split('\n');
  const found = [];
  for (let i = 0; i < lines.length; i++) {
    if (!isComment(lines[i])) continue;
    let end = i;
    while (end + 1 < lines.length && isComment(lines[end + 1])) end++;

    const text = lines.slice(i, end + 1)
      .map((l) => l.replace(/^\s*(\/\*\*?|\*\/|\*|\/\/)/, '').replace(/\*\/\s*$/, ''))
      .join(' ');

    if (/driven by/.test(text)) {
      let code = null;
      for (let j = end + 1; j < lines.length; j++) {
        if (isComment(lines[j]) || lines[j].trim() === '') continue;
        code = lines[j];
        break;
      }
      const member = code === null ? null
        : MEMBER.exec(code.replace(MODIFIERS, ''))?.[1] ?? null;
      for (const targets of targetsIn(text)) {
        found.push({ path, line: i + 1, member, targets });
      }
    }
    i = end;
  }
  return found;
}

/**
 * The paths one claim names.
 *
 * Collection starts after `driven by` and stops at the first word that is
 * neither a path nor a joiner. That is what lets a claim carry prose after the
 * list — `driven by test/playtest.js and the console harnesses` names one file
 * and describes the rest.
 */
function targetsIn(text) {
  const out = [];
  const re = /driven by/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const words = text.slice(m.index + m[0].length).trim().split(/\s+/);
    const targets = [];
    for (const w of words) {
      // The sentence's own punctuation comes off first. A path keeps its
      // extension, because `.ts` ends in a letter and this class does not.
      const word = w.replace(/[.,;:)]+$/, '');
      if (PATH.test(word)) { targets.push(word); continue; }
      if (JOINERS.has(word.toLowerCase())) continue;
      break;
    }
    if (targets.length) out.push(targets);
  }
  return out;
}

const claims = walk(ROOT).flatMap(claimsIn);
const bad = [];
for (const c of claims) {
  for (const target of c.targets) {
    if (!c.member) { bad.push({ ...c, target, why: 'no member below the claim' }); continue; }
    if (!existsSync(target)) { bad.push({ ...c, target, why: 'the file does not exist' }); continue; }
    if (!callOf(c.member).test(readFileSync(target, 'utf8'))) {
      bad.push({ ...c, target, why: `no call to \`.${c.member}(\`` });
    }
  }
}

const targets = claims.reduce((n, c) => n + c.targets.length, 0);
console.log(`${claims.length} claims naming ${targets} files · ${bad.length} stale`);

if (bad.length) {
  console.error(`\nFAIL: ${bad.length} claim(s) name a caller that does not exist.\n`);
  for (const b of bad) {
    console.error(`  ${b.path}:${b.line}  ${b.member ?? '?'}  -> ${b.target}  (${b.why})`);
  }
  console.error(`
CORRECT THE CLAIM. Do not delete it.

\`@internal — driven by <path>\` says why a member is public when no other
module in src/ calls it. The reason is what the next maintainer needs; a wrong
reason is corrected rather than dropped (CLAUDE.md).

Find the real caller first. \`findReferences\` answers it for every file the
compiler reads. Then write what is true:

  a test drives it        @internal — driven by test/<name>.test.ts
  the parent drives it    @internal — driven by src/game/game.ts
  nothing drives it       @internal — no caller at all (and report it)

Name up to two files. Where more than two drive it, say so without a path —
"public for the tests, which dock a commander through it" cannot go stale this
way, and this gate leaves it alone.

A member with no caller at all is a second defect. Say that in the comment, and
report it. Do not delete the member in the same pass.
`);
  process.exit(1);
}
