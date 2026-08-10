# 114 — The chart shows where the trade is

**Kind:** feature / UI · **Severity:** medium · **Size:** medium
**Depends on:** 111 (landed) — reuses its model/painter seam and its
`ChartContext` read-only rule. Touches the same `ui/screens.ts` lines
docs/TODO/93 will sweep; add no new hex.
**GitHub:** #10 (second and final slice)

## Why

111 made piracy visible and proved the interaction: a threshold, a sparse
overlay, a named legend, and the charts stayed readable. What is still
invisible is the trade itself — the thing the simulation actually spends its
day doing. At any moment there are **~240 convoys in flight across ~175
distinct lanes** (measured, seeded galaxy 1, seeds 999/4242 at 23/120/365
days), and the player sees none of it. #10's own words: which routes are
moving goods, and where prices have diverged.

The data is already there and already public:

- `LivingGalaxy.convoys` is a public array of `{from, to, commodity, tonnes,
  etaDay, intact}`, bounded at 400 (`living.ts:215`) and already saved.
  Reading it is a pure read — unlike `state()`, nothing about it inserts.
- `priceMultiplier(system, commodity)` is the same non-mutating accessor the
  market estimate already goes through (`living.ts:257-261`), clamped to
  ±25%.
- `neighbours` stays private and is **not needed**: convoys carry their own
  `from`/`to`, so the lanes that matter are the ones with freight on them,
  not every pair within jump range.

## The numbers this is designed against

Measured before the code, at two advance lengths and two seeds:

| | day 23 | day 120 | day 365 |
|---|---|---|---|
| convoys in flight | 216 | 232 | 242 |
| distinct lanes | 163–168 | 171–180 | 160–177 |
| lanes with **≥2** convoys | 40 | 43 | 44–47 |
| systems with price drift **>15%** | 12–16 | 14–15 | 16–17 |

So: drawing every lane is a hairball, and drawing every drifted price is
worse (243–251 systems have *some* drift). Two thresholds make both legible
and both are stable across seeds and across the life of a career.

## What to do

1. **Two constants, in `constants/living-galaxy.ts`, beside
   `DANGER_VISIBLE`.** Constants process applies (`constants:find`,
   `generate:constants`, `constants:check`; a value clash needs `@rule` ids
   on **both** sides — see 113 and 111).
   - `BUSY_LANE_CONVOYS = 2` — a lane is worth drawing when it has more than
     one load on it right now. Self-describing rather than a top-N cut, and
     it lands on ~45 lanes at every sample above.
   - `PRICE_DIVERGENCE_VISIBLE = 0.15` — 15% off the 1984 baseline, against
     a ±25% clamp. Lands on 12–17 systems; 12% lands on 31–39, which is one
     dot in seven and says nothing.
2. **Two pure models, beside `danger-overlay.ts`.** Same shape, same reason
   (`docs/ARCHITECTURE.md`, invariant 10, testable without a canvas):
   - `galaxy/trade-lanes.ts` — `busyLanes(convoys)` folds convoys into
     undirected `{a, b, convoys, tonnes}` lanes, keeps those at or over the
     threshold, and returns them heaviest-first so a painter that ever caps
     the list drops the least interesting.
   - `galaxy/price-divergence.ts` — `divergentSystems(systems,
     priceMultiplier)` returns, per flagged system, the direction only:
     `dear` where the strongest drift is up, `cheap` where it is down. The
     *magnitude* stays out of the model's return — the chart draws a tell,
     not a number, and `M` already gives the number.
3. **One overlay mode, shared by both charts.** `ChartContext` gains
   `overlay: ChartOverlay` (`'none' | 'routes' | 'prices'`) and
   `cycleOverlay()`; `game.ts` holds the field beside `dataSubject`, which is
   the identical seam already in place for "which system the data screen
   reads" (`game.ts:231-243`). Both `ChartScreen` instances therefore agree,
   so `G` and `N` show the same thing.
   **Not the snapshot.** `SNAPSHOT_VERSION` is checked strictly
   (`snapshot.ts:262`) so a new required field invalidates every existing
   save, and a view mode is not worth that. It is also not screen-local
   state: `find`/`estimate` are sub-modes that swallow the keyboard, this is
   a preference two screens share.
4. **`KeyT` cycles it**, on both charts, in `chart.ts` beside `KeyM`/`KeyF`.
   Free: the chart's own keys are `M D F T` plus arrows and the held
   `WASD` cursor pair, and chart keys are the screen's own (exempt from the
   binding tables, `screens.ts:99-101`). The danger rings from 111 stay
   **always on** underneath every mode — they are a warning, not a view.
5. **Paint it, in the palette that is already there** (93 collision: reuse
   spellings, add no hex).
   - Routes: lines from `a` to `b` in `#2a7a33`, the dim green the local
     chart already uses for out-of-range systems, drawn **before** the dots
     so freight passes under the worlds it serves.
   - Prices: the tell is a **shape**, not a new colour, because the palette
     has no blue and inventing one is 93's problem. A small up-tick above
     the dot in `#ffb444` for dear, a down-tick below it in `#7dff88` for
     cheap.
6. **Name it for the player.** The keylines already end in `RED RING: PIRATE
   ACTIVITY` (111). Extend to `· T TRADE OVERLAY` when off, and to the
   overlay's own legend when on (`ROUTES IN FLIGHT`, `PRICES — UP DEAR, DOWN
   CHEAP`). One home: build the segment once in `screens.ts` and let both
   `renderChart` and `renderLocalChart` use it, rather than a third
   hand-written copy.
7. **Tests** (`test/trade-overlay.test.ts`, beside `danger-overlay`):
   - `busyLanes` folds both directions of a route into one lane, sums
     tonnage, and drops lanes under the threshold. At two advance lengths.
   - `divergentSystems` flags exactly the systems over the threshold and
     names the direction the pressure actually points, at two advance
     lengths.
   - **Drawing still creates no state**: extend 111's headless-Game gate to
     cycle the overlay through all three modes and redraw, asserting
     `living.states.size` is unchanged. This is the check that must go red if
     either new model is handed the galaxy instead of an accessor.
   - The cycle returns to where it started after three presses, and both
     charts read the same mode.

## Decisions already made

- Chris (triage, #10): trade-flow or price-divergence follows once the chart
  interaction is proven readable. 111 proved it.
- Chris (this session): #10 should be finished, and progress tracked on the
  issue as it lands.

## Open questions — answered here

- **One overlay or two keys?** One key cycling three modes. Two always-on
  overlays plus the rings is three pictures at once on a 780×400 canvas; one
  at a time is why each stays legible, and it is the cycling 111 anticipated
  when it left `T` free.
- **Directed lanes (arrows)?** No. Direction changes per convoy and a 30–40
  px line cannot carry an arrowhead at this scale. Undirected also halves the
  line count where two systems trade both ways.
- **Draw a lane for a lost convoy?** No — `intact: false` cargo never
  arrives, and drawing it would promise freight that is not coming. Losses
  already surface as the danger ring at the destination.
- **Show the commodity?** No. A lane carries mixed cargo once folded, and the
  cursor system's market estimate (`M`) is where a commodity question is
  already answered.

## What is NOT in scope

- Any change to `advance()`. Thresholds move surfaces, not the simulation.
- Convoy animation or per-day movement along a lane — the charts repaint on
  open, cursor move and click, never per frame, and that is what keeps the
  overlay free.
- Making `neighbours` public. Nothing here needs it.
- The `#local-info` column (measured to fit all 256 descriptions,
  `style.css:157-176`).

## Watch out for

- **The `≥` boundary.** `BUSY_LANE_CONVOYS = 2` must mean "2 or more", where
  `DANGER_VISIBLE` means "strictly over". Two thresholds, two comparisons —
  the test states which each is rather than mirroring the implementation.
- **The constants gate.** New top-level `UPPER_CASE` in `ui/screens.ts` or
  `galaxy/*.ts` fails `test/constants.test.ts`; both constants belong in
  `src/constants/` anyway. A repeated literal needs `@rule` ids on both
  sides, not just the new one.
- **docs/TODO/93 collision** — `ui/screens.ts`'s chart block is 93's
  inventory ground.
- **Headless drawing needs the stub document** (`test/danger-overlay.test.ts`
  has the pattern, including the `dataset` sink `inertElement` grew for it).
- **Determinism gates** (`test/galaxy.test.ts:106-110`,
  `test/game.test.ts:130-148`) pin seeded runs. A pure read cannot move them.

## Acceptance

- `T` on either chart cycles routes → prices → off, and the other chart is
  already showing the same mode when you open it.
- Routes draw only lanes with freight actually on them, under the dots,
  and the count stays near ~45 rather than ~175.
- Prices flag ~12–17 systems and the direction matches the pressure's sign.
- The danger rings survive every mode.
- Cycling and redrawing insert nothing into `living.states`, and that test
  goes red when a model is handed the galaxy instead of an accessor.
- Full gates: `npm test`, `npm run lint`, `npm run constants:check`.
  `npm run campaign` is untouched (no sim change) — say so rather than run
  it.

## Verify

Measured, 2026-08-10, seeded galaxy 1 at seeds 999 and 4242 and 23/120/365
days: the convoy, lane and price-drift counts in the table above. Confirmed
by reading: `convoys` public and bounded (`living.ts:84, 215`), `neighbours`
private and unnecessary (`living.ts:95`), `priceMultiplier` non-mutating
(`:257`), the strict snapshot version check (`snapshot.ts:262`), and the
`dataSubject`/`viewData` seam this reuses (`game.ts:231-243`).
