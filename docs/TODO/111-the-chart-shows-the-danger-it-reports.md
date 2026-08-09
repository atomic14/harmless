# 111 — The chart shows the danger it already reports

**Kind:** feature / UI · **Severity:** medium · **Size:** small–medium
**Depends on:** none. Touches the same `ui/screens.ts` lines docs/TODO/93
will sweep — reuse the palette spellings already in the file, add no new hex.
**GitHub:** #10 (first slice; trade-flow/price-divergence is a later item)

## Why

256 systems trade every day and the player sees it as prices, spawn mixes
and one news line (`living.ts:296-312` → the data screen only,
`ui/screens.ts:987`). The simulation is real and almost entirely invisible —
`docs/GAP-ANALYSIS.md`'s words. The data for a danger overlay already
exists and is already read-only:

- `LivingGalaxy.danger(systemIndex)` is a public, non-mutating accessor
  (`living.ts:264-266`), saved state, advanced only when the clock moves —
  never per frame (`living.ts:135-138`).
- The charts repaint only on open, cursor move or click — `screens.render`
  is not in the frame loop — so an overlay costs one canvas pass per redraw.
- The screen seam is ready: `ChartContext` (`screens/chart.ts:31-42`) is the
  chart's entire view of the world, built per call at `game.ts:231-240`,
  and already carries `priceMultiplier` in exactly the shape `danger` needs.
  The screen never touches the Game (invariant 13).
- The headline already draws a danger line at one threshold: "Merchants
  report heavy pirate activity" when `danger > 0.4`. The chart should show
  the same fact the news prints — one rule, two surfaces.

## What to do

1. **One home for the threshold.** Extract the headline's `0.4` into
   `constants/living-galaxy.ts` (say `DANGER_VISIBLE`) with an `@rule`;
   `headline()` and the overlay both read it. Constants process applies
   (`constants:find`, `generate:constants`, `constants:check`).
2. **A pure overlay model, HUD-style.** A small function — beside the rule,
   not in `screens.ts` — that maps `(systems, danger(index))` to the list of
   flagged system indices. The model/painter split is the established
   precedent (`docs/ARCHITECTURE.md:18-20`), it is what makes this testable
   headlessly (`drawChart` bails without a document, `screens.ts:639`), and
   invariant 10 says a derived economic quantity does not live in a render
   file.
3. **Wire `danger(index)` into `ChartContext`** at `game.ts:231-240`, one
   line beside `priceMultiplier`. **Use the accessor, never
   `living.state()`** — `state()` inserts an entry when missing
   (`living.ts:108-121`), which would mutate the world from a draw path.
4. **Paint it.** On both charts, a ring around the dot of each flagged
   system: `#ff4d4d`, the red both charts already use for the cursor
   (`screens.ts:690, 798`) — no new hex. The states map is sparse (only
   drifted systems exist) and the threshold keeps it sparser, so the 780×400
   galaxy canvas at ~3 px/system stays legible; the 560×560 local chart has
   room to spare. Always on — no toggle key in this slice, and `KeyD` is
   already double-booked (`chart.ts:96-144, 188-191`).
5. **Name it for the player.** Append `· RED RING: PIRATE ACTIVITY` to the
   two hand-written keylines (`screens.ts:631, 729`) — the chart keys are
   the screen's own, exempt from the binding tables
   (`screens.ts:99-101`), so the keyline is their one home. Do not add rows
   to `#local-info`: its 440 px column is measured to fit all 256
   descriptions without scrolling (`style.css:157-176`).
6. **Tests.**
   - The overlay model: advance a seeded galaxy and assert flagged systems
     are exactly those over the threshold, at two sample sizes (two advance
     lengths) per the house sampling rule; assert Lave (index 7) is never
     flagged for a new commander — the sim already pins `danger(7) < 0.35`
     (`test/galaxy.test.ts:155`), safely under 0.4.
   - **Drawing does not create state:** after a chart redraw with a stub
     document (the `inertElement` canvas pattern,
     `engine/inert-dom.ts`), `living.states.size` is unchanged. The
     existing draw-twice snapshot test (`test/game.test.ts:84-90`) would
     *miss* this — `save()` skips untouched systems — so the direct
     assertion is the gate, and it must go red if the painter is switched
     to `state()`.

## Decisions already made

- Chris (triage comment, #10): accepted as roadmap work; danger overlay is
  the first slice; trade-flow or price-divergence follows once the chart
  interaction is proven readable.

## Open questions — answered here

- **One band or two?** One. An "elevated" band at ~0.2 would tag Lave amber
  for new commanders (its pin is only `< 0.35`) and doubles the legend for
  no decision the player can act on yet. The single band matches the news
  line exactly; a second band can ride in with the trade-flow slice if this
  proves readable.
- **Toggle?** No. Always-on is the legibility test the triage asked for;
  the flagged set is small by construction. If a later overlay (trade
  flow) needs cycling, that item picks the key — plenty are free
  (`O`, `V`, `T`…), and any `data-key` element becomes a keystroke via the
  existing click routing.
- **Danger halo on the cursor info line too?** No. `#chart-info` is one
  keyline already carrying six fields; the ring plus the legend is the
  slice.

## What is NOT in scope

- Trade-route / convoy-edge rendering (`convoys` is a 400-cap list of
  `(from, to)` edges and `neighbours` is private — the follow-up item will
  need an accessor and density filtering; note it there, not here).
- Price-divergence colouring; the market-estimate sub-mode already covers
  the cursor-system case (`chart.ts:114-117`).
- Any change to the sim itself — thresholds move surfaces, not
  `advance()`.

## Watch out for

- **docs/TODO/93 collision.** `ui/screens.ts:627-783` is 93's inventory
  ground. Reuse the `#ff4d4d` spelling already present; do not introduce a
  new one-off, and expect 93 to later rename whatever this touches.
- **The constants gate.** Any new top-level `UPPER_CASE` const in
  `ui/screens.ts` or `galaxy/living.ts` fails `test/constants.test.ts`
  unless it lives in `src/constants/` — which is where the threshold goes
  anyway.
- **Headless drawing needs a stub document** — `maybeById` returns `null`
  without one (`screens.ts:52-54`); follow the stub pattern at
  `test/ui.test.ts:233-241` with `inertElement`'s no-op 2D context.
- **Determinism gates**: `test/galaxy.test.ts:106-110` and
  `test/game.test.ts:130-148` pin seeded runs; a pure read cannot disturb
  them, so if they move, the overlay is not a pure read.

## Acceptance

- Both charts ring systems whose danger exceeds the one shared threshold;
  the news line and the ring can never disagree, because they read the same
  constant.
- The legend names the ring on both keylines.
- Redrawing the charts inserts nothing into `living.states`, and the test
  for it goes red when the painter is pointed at `state()`.
- Lave is unflagged on a new commander's chart at two advance lengths.
- Full gates: `npm test`, `npm run constants:check`. `npm run campaign` is
  untouched (no sim change) — say so rather than run it.

## Verify

Confirmed by reading, 2026-08-09: `danger()` non-mutating at
`living.ts:264-266` vs `state()` inserting at `:108-121`; `ChartContext`'s
shape and construction at `screens/chart.ts:31-42` / `game.ts:231-240`; the
headline threshold in `living.ts:296-312`; chart repaint sites and the
absence of any chart-drawing test (grep for `drawChart` under `test/`
returns nothing).
