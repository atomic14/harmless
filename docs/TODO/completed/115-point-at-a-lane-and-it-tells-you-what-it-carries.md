# 115 — Point at a lane and it tells you what it carries

**Kind:** feature / UI · **Severity:** medium · **Size:** medium
**Depends on:** 114 (landed). Touches `ui/screens.ts`'s chart block, which
docs/TODO/93 will sweep — reuse the palette spellings, add no new hex.
**GitHub:** none — asked for by Chris in session, after 114 landed.

## Why

114 drew the freight network and it reads, but every lane says the same
amount: that trade happens there. The convoy records behind each line already
know what is on them and when it lands (`Convoy.commodity`, `tonnes`,
`etaDay`), and none of it reaches the player. Two changes make the picture
answer questions instead of only posing them:

1. **Point at a lane and read it.** `LEESTI ⇄ DISO · 3 CONVOYS · 47t ·
   FOOD, COMPUTERS · NEXT ARRIVAL IN 2 DAYS`.
2. **Fade the lines by traffic**, so the arteries stand out from the capillaries
   rather than every lane shouting equally.

## Decisions already made

- Chris: **both** pointers — mouse hover *and* the keyboard cursor. Nothing on
  these charts is mouse-only today (a click and the arrows both move the same
  cursor), and the detail should not be the first thing that is.
- Chris: lines faded by traffic.

## What to do

1. **A hover seam, behind the shell.** `Shell.onScreenMove(fn)` beside
   `onScreenClick` (`engine/shell.ts:57`), implemented in `browser-shell.ts`
   with a `mousemove` listener on `#screen` and a no-op in the headless shell.
   Platform access stays behind the shell (CLAUDE.md); `game.ts` routes it to
   `screens.hover(...)` exactly as it routes clicks, and `Screen` gains an
   optional `hoverAt(target, e): boolean` next to `clickAt`.
2. **One hit-test, one home.** `distanceSqToSegment` in `galaxy/navigation.ts`
   beside `distanceSqToPoint` — whose own doc says the charts need it for
   cursor hit-testing and that a fourth copy of the formula had grown in
   `ui/screens.ts`. Same chart metric (`CHART_Y_SQUASH` on the y axis), so a
   lane is picked at the distance it *looks*.
   `nearestLane(lanes, systems, x, y, within)` goes beside `busyLanes`.
3. **The lane carries its cargo.** `TradeLane` gains `commodities: number[]`
   (distinct, heaviest-first so a long list truncates usefully) and
   `soonestEta: number`. Fold them in `busyLanes`, where the convoys are
   already in hand.
4. **The day, into `ChartContext`.** `day: number` — a read of `living.day`,
   needed to turn `etaDay` into "in 2 days". Read-only like `danger`.
5. **Hover state, into the overlay payload.** `ChartOverlays.hovered:
   TradeLane | null`, decided by `ChartScreen` (from the pointer if the mouse
   moved, else from the chart cursor) and only rendered by `ui/screens.ts`.
   Repaint only when the hovered lane CHANGES — `mousemove` fires far faster
   than the charts have ever repainted.
6. **Where the line goes.** The galactic chart writes it into `#chart-info`,
   the keyline that already changes with the cursor, falling back to the
   cursor's system when no lane is under the pointer. The short-range chart
   gets its own one-line `div.keyline` under the chart row: `#local-info` is a
   440 px column measured to fit all 256 descriptions without scrolling
   (`style.css:157-176`) and must not grow a row.
7. **Fade by traffic.** `ctx.globalAlpha`, scaled by the lane's tonnage against
   the heaviest currently drawn, floored so the quietest lane is still visible.
   Alpha rather than a second green: this palette is 93's inventory and a
   traffic ramp in new hex would be four more spellings for it to sweep.
   **Reset `globalAlpha` to 1 afterwards** — the same context draws the dots,
   the rings and the cursor.
   With fade carrying the density, try `BUSY_LANE_CONVOYS` at 1 in the browser
   and keep whichever reads: the threshold exists to stop a scribble, and if
   alpha does that job better, the faint tail is the living galaxy.
8. **Tests.**
   - `distanceSqToSegment`: endpoints, the perpendicular foot, and a point
     beyond each end clamping to that end (a segment, not an infinite line).
   - `nearestLane` picks the nearer of two crossing lanes and returns null
     outside the tolerance.
   - `busyLanes` folds cargo distinctly and reports the soonest ETA, at two
     advance lengths.
   - The detail line names both systems, the tonnage and the cargo.
   - Hovering still inserts nothing into `living.states` — extend 114's
     headless gate rather than writing a third one.

## Open questions — answered here

- **Does hover move the cursor?** No. The cursor is also the hyperspace
  target's selector; moving it on mouse-over would retarget by accident.
  Hover reports, the cursor selects.
- **Hover over systems too?** Not here. `#chart-info` already reports the
  cursor's system and `D` gives the full page; this slice is about the lanes,
  which have no way in at all.
- **What if two lanes overlap?** Nearest wins, ties by the heavier lane —
  the one the eye is more likely to have been aiming at.

## What is NOT in scope

- Hover on any other screen. The seam is general; only the charts use it.
- Tooltips as DOM elements over the canvas — the keyline is where these
  charts have always answered.
- Any change to `advance()`.

## Watch out for

- **`mousemove` is not a click.** Repaint on change only, or the chart
  repaints on every pixel of pointer travel.
- **`globalAlpha` leaks** to everything drawn after it.
- **The pixel/chart-unit conversion** differs per chart: the galactic chart's
  is `canvas.width / CHART_SPAN_X`, the local chart's is `LOCAL_SCALE`. Both
  are already computed for the click snap radius (`chart.ts` `clickAt`).
- **docs/TODO/93 collision** — the alpha ramp is one more thing 93 inherits.

## Acceptance

- Moving the mouse over a lane on either chart names it, its convoy count, its
  tonnage, its cargo and when the next load lands; moving off it restores the
  cursor's system line.
- The arrow keys reach the same detail with no mouse.
- Lines fade with traffic, and nothing drawn after them is faded.
- Hovering inserts nothing into `living.states`.
- Full gates: `npm test`, `npm run lint`, `npm run constants:check`.
  `npm run campaign` is untouched (no sim change) — say so rather than run it.
