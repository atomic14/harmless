# 198 — A phone can leave every docked screen

**Kind:** bug · **Severity:** high · **Size:** small · **Depends on:** 197 ·
**Blocks:** nothing · **GitHub:** none

## Where we are

**Chris opened the Cloudflare preview of PR #44 on his phone on 2026-09-10,
and he was stuck on the briefing.** The panel fits the phone. The briefing
turns a page on an arrow key, and it closes on Escape or H. A phone has no
key. The screen offers no button, so a finger has nothing to press.

**Three docked screens carry no button.** Every other screen ends in a button
row, and each button carries a `data-key`. `ui/screen-host.ts` turns a tap on
one into a keystroke. The three without one are:

- the briefing, `ui/briefing.ts`;
- the short range chart, `ui/chart-local.ts`;
- the galactic chart, `ui/chart-galactic.ts`.

A tap on a system on either chart already targets it, through `clickAt` in
`game/screens/chart.ts`. The chart's other keys are these: D for the data
screen, M for the market estimate, F to find, and T for the overlay. Escape
leaves.

**The console line covers the bottom of the panel on a phone.** With a screen
open, the panel is 88 `dvh` tall and the console line sits 3 `vh` from the
bottom. On a desktop the panel rarely reaches that height. On a phone it does,
and the line landed on the briefing's hint line.

## What to do

Two milestones.

### M1 — every docked screen ends in a button row

The briefing gains PREVIOUS, NEXT and CLOSE, on the arrow keys and Escape.
Both charts gain DATA ON SYSTEM, TRADE OVERLAY and DONE, on D, T and Escape.
The keyline stays, because the keys still work.

The gate is a new `test/screen-buttons.test.ts`. It paints each of the three
screens under the capture helper, and asserts each carries a button for
Escape. It asserts the briefing carries a button for each arrow key. It fails
on the painters as they are today, and that is its proof.

### M2 — the console line clears the panel on a narrow window

On a window of 700 pixels or less, a screen-open panel caps at 80 `dvh` and
centres at 46%. So its bottom edge sits at 86%, and the console line sits
below it.

## Decisions already made

- **A button carries the key's own label.** `BUY 1` and `DONE` on the market
  set the pattern. The briefing's buttons say PREVIOUS, NEXT and CLOSE.
- **The chart's M and F stay keys.** The market estimate needs a system under
  the cursor, and F opens a typed search. Neither is a phone's next step.

## Open questions

None.

## Watch out for

- **`test/run.ts` imports every test file into one process.** The capture
  helper installs and removes its stub in one synchronous block.
- **`renderLocalChart` and `renderChart` take a `ChartState` and overlays.**
  `test/chart-headless.test.ts` shows the smallest inputs.

## Verification

The gates always run: `npm run check`.

The tier: prose, comments, a stylesheet and three painters. Nothing more
runs.

Evidence:

- `test/screen-buttons.test.ts` fails before M1 and passes after it.
- Chris opens the preview on his phone. He turns a briefing page and closes
  the briefing by touch. He leaves each chart by touch.
