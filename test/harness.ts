// The test harness: one `check`, one pair of counters, and the shared fixtures.
//
//   import { check, eq } from './harness.ts';
//
// There is no framework here and there never has been — `check(name, condition)`
// prints a line and counts it, and that is the whole of it. What is new is that
// it lives in its own file.
//
// WHY. `test/run.ts` reached 5,300 lines and is a recorded debt in
// `tools/sizes.mjs`, for the reason every kitchen-sink file in this project got
// there: it was the default place to put a test, so nobody ever decided. The
// cost was real and specific — three agents working on unrelated modules still
// collided in the same file, and one merge spliced a section inside another's
// block and left an unbalanced brace.
//
// So the split starts here, from the bottom: the counters and `check` come out
// FIRST, because until there is one `check` that every file can import, a second
// test file has to bring its own — and then `npm test` prints two totals, two
// exit codes, and neither is the answer.
//
// The rule for a new test file:
//
//   1. `import { check, eq } from './harness.ts'` — never redefine them.
//   2. Assert at module scope; importing the file runs the tests.
//   3. Add one import line to `test/run.ts`, which calls `summarise()` at the
//      end. One total, one exit code, however many files there are.
//
// Nothing game-specific belongs in here beyond a fixture two files genuinely
// share. A helper used by one file lives in that file.

import { commandsFor, type Command, type CommandInput, type ControlMode } from '../src/game/controls.ts';
import { useHarnessSaves } from '../src/game/storage.ts';

// NO TEST CAN WRITE A PLAYER'S SAVE, and this is where that stops being a rule
// somebody has to remember. Every test file imports this one — that is the
// contract at the top — so calling it here puts the whole run in the harness
// namespace before a single assertion has been made, including a file run on
// its own. It is one way for the life of the process: there is no call that
// undoes it, so a test cannot leak by forgetting a `finally`. Several tests
// install a fake `localStorage` and drive the real save path through it; under
// this switch every key they touch is `elite-web-harness-*`, and the keys a
// player's career lives under are not addressable from here at all.
useHarnessSaves();

/** Assertions that passed, and failed, across every imported test file. */
export let passed = 0;
export let failed = 0;

export function check(name: string, condition: boolean, detail = ''): void {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

export function eq(name: string, actual: unknown, expected: unknown): void {
  check(name, actual === expected,
    `got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
}

/**
 * Print the total and exit non-zero if anything failed.
 *
 * Called once, from the end of `test/run.ts`. It is a function rather than
 * module-scope code so that the exit happens AFTER every imported test file has
 * run — an `import` is hoisted, so a file that exited on load would take the run
 * with it before run.ts's own body had started.
 */
export function summarise(): void {
  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

// --- shared fixtures --------------------------------------------------------

/**
 * A keyboard that has already been pressed. Taps are consumed, as `Input`'s are.
 *
 * The two-method `CommandInput` and nothing else: not `engine/input.ts`, not a
 * DOM event. controls.ts reads that interface precisely so a replay, an AI or a
 * test can ask for a command with an object literal.
 */
export function keys(down: string[], held: string[] = []): CommandInput {
  const taps = new Map<string, (boolean | null)[]>();
  // `null` is a real keydown, so `held` answers for its modifier — which is
  // what every entry of `down` is here. `clicks()` below is the other kind.
  for (const k of down) taps.set(k, [...(taps.get(k) ?? []), null]);
  return {
    pressed: (code) => {
      const q = taps.get(code);
      if (!q || !q.length) return false;
      q.shift();
      return true;
    },
    held: (...codes) => codes.some((c) => held.includes(c)),
    tapShift: (code) => {
      const q = taps.get(code);
      return q && q.length ? q[0] : null;
    },
  };
}

/**
 * The other kind of tap: injected, carrying its own shift, with NO keyboard
 * behind it (docs/TODO/146). This is what a click on a menu row produces.
 *
 * `held` answers false for everything, deliberately. A click happens with
 * nobody's hands on the keys, and a test that let it borrow a held modifier
 * would prove the frame-wide rule this item exists to delete.
 */
export function clicks(taps: { key: string; shift?: boolean }[]): CommandInput {
  const queue = new Map<string, boolean[]>();
  for (const t of taps) queue.set(t.key, [...(queue.get(t.key) ?? []), t.shift === true]);
  return {
    pressed: (code) => {
      const q = queue.get(code);
      if (!q || !q.length) return false;
      q.shift();
      return true;
    },
    held: () => false,
    tapShift: (code) => {
      const q = queue.get(code);
      return q && q.length ? q[0] : null;
    },
  };
}

/** What this mode's table makes of these keys. */
export function cmds(mode: ControlMode, down: string[], held: string[] = []): Command[] {
  return commandsFor(mode, keys(down, held));
}

/** `eq()` compares by identity; a command list has to be compared by value. */
export function eqc(name: string, actual: Command[], expected: Command[]): void {
  eq(name, actual.join('|'), expected.join('|'));
}

/**
 * Close the briefing a fresh commander boots into (docs/TODO/106), for the
 * many tests that are about anything else. One Escape through the real input
 * path and one fixed step to deliver it — the same dismissal a player makes,
 * so a test cannot skip the onboarding by a route no player has.
 * test/briefing-onboarding.test.ts is the file that does NOT call this.
 *
 * Structural type rather than `Game`, so importing the harness never drags the
 * whole game in for the files that only want `check`.
 */
export function dismissBriefing(g: {
  mode: string;
  input: { injectPress(code: string): void };
  step(dt: number, now: number): void;
}, now = 1 / 60): void {
  if (g.mode !== 'briefing') return;
  g.input.injectPress('Escape');
  g.step(1 / 60, now);
}

/**
 * Watch the console the way a pilot does: `fly(steps)` steps the game and
 * returns the lines that APPEARED during those frames, in order.
 *
 * A new line is one that differs from the frame before, which is the only
 * definition that matches what is read. Reading the event stream instead would
 * miss the whole subject of the two files that use this: a QUEUED line
 * (`session.queued`) reaches the console seconds after the event that owed it,
 * and one said over its own cause never reaches it at all.
 *
 * Shared by test/character-line.test.ts (what a deed cost your name,
 * docs/TODO/129) and test/record-line.test.ts (what it cost your record,
 * docs/TODO/130) — the same instrument, and a second copy of it would be free
 * to disagree about what "a player saw this" means.
 *
 * Structural type rather than `Game`, for the reason above.
 */
export function consoleWatcher(g: {
  step(dt: number, now: number): void;
  state: { session: { messageText: string } };
}): (steps: number) => string[] {
  let at = 0;
  let last = '';
  return (steps: number): string[] => {
    const said: string[] = [];
    for (let f = 0; f < steps; f++) {
      g.step(1 / 60, at += 1 / 60);
      const now = g.state.session.messageText;
      if (now && now !== last) said.push(now);
      last = now;
    }
    return said;
  };
}
