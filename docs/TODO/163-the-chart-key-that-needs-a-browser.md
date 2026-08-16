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
