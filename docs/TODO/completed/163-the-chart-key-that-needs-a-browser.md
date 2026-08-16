# 163 — The chart key that needs a browser

**Kind:** defect · **Severity:** medium · **Size:** small · **Depends on:**
nothing · **Blocks:** nothing · **GitHub:** none — found by the sweep of
2026-08-16

## Where we are

**`src/engine/shell.ts` promises a headless game.** `CLAUDE.md` states it as a
design direction: platform access stays behind the shell, so the game runs with
no browser. `engine/inert-dom.ts` is the machinery. It gives a painter an
element that accepts every write and performs none of them.

**`src/ui/screen-shell.ts:29` is the seam for a lookup that may fail.**
`maybeById` returns `null` when there is no document. Its own doc comment names
the four callers that already cope with a missing element.

**`src/game/screens/chart.ts:194` does not use that seam.** The line reads:

```
const info = document.getElementById(this.local ? 'local-info' : 'chart-info');
```

**The two painters read the SAME two element ids through the seam.**
`ui/chart-galactic.ts:134` asks `maybeById('chart-info')`.
`ui/chart-local.ts:154` asks `maybeById('local-info')`. So the screen and its
painters disagree about one lookup.

**The line runs under a guard that type-to-find turns on.** `redraw()` reads the
element only while `this.find !== null`. The `F` key sets `find` to the empty
string and calls `redraw()` at once (`chart.ts:243`).

**Measured.** A `ChartScreen` was built over a real galaxy under node, with no
document. It opened. The `F` key then threw:

```
typeof document = undefined
opened ok
THREW on F: ReferenceError document is not defined
```

**The browser is not affected**, and no player can see this. The cost is the
seam. No headless test, replay or harness can drive type-to-find, so that path
cannot be tested at all.

**The corrected coverage tool agrees.** `src/game/screens/chart.ts` reads 89.3%,
which is the worst screen in the tree. docs/TODO/164 is the tool.

## What to do

One milestone.

### M1 — the screen reads its element through the seam

`chart.ts` imports `maybeById` from `ui/screen-shell.ts`. Line 194 becomes:

```
const info = maybeById(this.local ? 'local-info' : 'chart-info');
```

The `if (info)` guard below it already handles `null`, so no other line moves.

**Use `maybeById` rather than `elementById`.** `elementById` (`inert-dom.ts`)
hands back a sink, which the caller then writes to. `maybeById` hands back
`null`, and this caller already tests for it. The two painters chose the same
one for the same reason.

## Verification

The gates always run: `npm run check`. The tier table puts a screen change at
"nothing more".

The gate is a new block in `test/chart-days.test.ts`, which already drives a
chart under node:

1. Build a `ChartScreen` over a seeded galaxy, with no document.
2. Open it, and assert that it opens.
3. Press `F` through the screen's own `input()`, and assert that it does not
   throw.
4. Type two letters, and assert that the cursor moves to the first match.

Step 4 matters more than step 3. It proves that the path is now REACHABLE by a
test, which is the whole cost of the defect.

Prove the gate can fail: put `document.getElementById` back, and watch steps 3
and 4 go red.

## Decisions already made

- **The remedy is the existing seam, and not a new one.** `maybeById` was
  written for this exact case, and two painters already spend it.

## Open questions

None.

## Watch out for

- **Scan the rest of `src/game/screens/` before you close this.** Three other
  files name `document` directly. `screens/save-transfer.ts:55`,
  `screens/save-transfer.ts:204` and `screens/combat-sim.ts:335` each build an
  anchor or a file input. Those are platform ACTIONS rather than paints. A file
  download has no headless meaning, so leave them. Say so in the outcome, so
  that the next sweep does not re-open them.
- **`ui/screen-host.ts:207` is the pattern to copy for a guard.** It tests
  `typeof document === 'undefined'` and returns early. It also states why that
  is safe. A paint may take the `null` path instead, which is shorter.

## What landed

**M1 landed on 2026-08-16.** `npm run check` passes at **4,719 assertions**, up
11. All eleven are the new gate. No rule moved, and `constants:check` reports
387 exports and 76 rule ids, unchanged.

**The fix is one line, and the remedy was the seam the plan named.**
`screens/chart.ts` asks `maybeById` now, exactly as the two painters beside it
do. The `if (info)` guard below it already handled `null`, so no other line
moved.

**The gate is a new file rather than a block in `test/chart-days.test.ts`, and
that is a deviation from the plan.** The reason is that the two files want
opposite environments. `chart-days` paints both charts through
`test/screen-capture.ts`, which INSTALLS a recording document for the length of
one paint. This gate needs no document at all, which is the whole subject. A
no-document block inside a file that installs one could pass for the wrong
reason, and nothing would say so. `test/run.ts` states the same idiom in its own
header: a new subject is a new file and one line in the index.

**`test/chart-headless.test.ts` is 11 assertions, and it drives BOTH charts.**
The defect line branches on `this.local` and reads a different element id on
each side, so one chart is not evidence for the other. The first assertion is
the control: it asserts that there is no document. A document leaked from an
earlier test file would let the old line pass, and the gate would then prove
nothing.

**The cursor check is what proves the path is reachable.** `L` moves the cursor
to Leleer, and `A` then narrows it to Lave. Two calls rather than one, because
`typeToFind` drains a whole frame of presses at once. So the second letter is
shown to NARROW the match, rather than merely to leave it alone. Each expected
system is found by its exact name, and not by the prefix rule the code under
test uses.

**Proved able to fail.** With `document.getElementById` put back, six of the
twelve checks go red — three on each chart, and both errors read
`ReferenceError: document is not defined`. The two open checks stay green, which
is correct: `open()` never reaches the line.

**Measured with docs/TODO/164's tool.** `src/game/screens/chart.ts` went from
**89.3% to 91.8%**, and it is no longer the worst-covered screen in the tree.
That is the cost of the defect, paid back.

**The three other direct callers of `document` stay, as the plan predicted.**
`screens/save-transfer.ts:55` builds an anchor for a file download,
`screens/save-transfer.ts:204` builds a file input for an import, and
`screens/combat-sim.ts:335` builds an anchor for a report export. Each is a
platform ACTION rather than a paint. A file download has no headless meaning, so
a seam would give a caller nothing to do. **Do not re-open them.**

**One thing came out of it that the plan did not have.** `maybeById`'s doc
comment said *"These four callers already handle a missing element"*. This item
made a fifth. A count written in prose is the same defect docs/TODO/164 fixed in
a path: written down one time, and never checked again. The count is gone, and
the sentence says what is true of every caller.
