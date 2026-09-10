# 197 — A docked screen fits a phone

**Kind:** enhancement · **Severity:** medium · **Size:** small · **Depends on:**
nothing · **Blocks:** the flight screen on a phone, which is a later plan ·
**GitHub:** none

## Where we are

**Chris asked for it on 2026-09-10.** The game must become usable on a phone.
He split the work in two. The docked screens come first, because they are the
easy half. The flight screen is a later plan.

**Every docked screen is already clickable.** A menu row and a button carry a
`data-key` attribute. `ui/screen-host.ts` turns a click on one into a
keystroke through `Input.injectPress`. So a finger works on a docked screen
today. The layout is what fails.

**The panel has a hard floor of 640 pixels.** `#screen` in `src/style.css`
sets `min-width: 640px` and `max-width: 860px`. A comment beside the hint
line records that the panel hangs off both edges at 500 pixels. A portrait
phone is 390 pixels wide. Measured on 2026-09-10 in Chrome at a 500 pixel
viewport, the panel read 640 pixels wide, from -70 to 570. Every screen
showed the same fault:

- the market, the equipment list and the contracts table lost their first and
  last columns off both edges;
- the commander status lost the start of every line;
- the mission offers lost the start of every sentence;
- the local chart and the galactic chart opened at their wide layout, 1260
  pixels at most, and lost the readout beside the map;
- the top bar wrapped `Dictatorship` and `0 Cr` on to a second line.

**The panel caps its height in `vh` units.** On a phone the address bar takes
part of that height, and a `vh` unit does not know it. The `dvh` unit does.

**A finger needs a bigger target than a mouse.** A menu row is 29 pixels
tall. A button is 25 pixels tall. A table row is 21 pixels tall. The common
floor for a finger is 44 pixels.

**The chart canvases already survive a CSS scale.** `localChartPoint` in
`ui/chart-local.ts` and `chartPointFromClient` in `ui/chart-galactic.ts` both
divide a click by the canvas's rendered width. So a canvas that shrinks to
fit the panel keeps a correct click.

## What to do

Two milestones.

### M1 — the panel yields to the viewport

`#screen` keeps its floor and its cap on a wide window. On a narrow one, both
yield to the viewport with a small gutter, through `min()`. `#screen.wide`
does the same. Both height caps move to `dvh`.

A narrow window, at most 700 pixels wide, changes the layout:

- the panel's padding shrinks;
- the menu's left margin shrinks;
- the title's letter spacing shrinks;
- a table cell's padding shrinks;
- a chart row wraps, so the readout sits under the map;
- a chart canvas scales to the panel's width;
- the top bar wraps by item, and its letter spacing shrinks.

The hint-line comment in `style.css` cites the 640 pixel floor as the reason a
hint cannot overflow. M1 repairs that comment. A hint span is 319 pixels at
most, and the panel is about 350 pixels wide on a 390 pixel phone.

### M2 — a finger finds its target

A `pointer: coarse` media query grows every tap target to 44 pixels:

- a menu row;
- a button in the button row;
- a button in a table row;
- a selectable table row.

The button row of a long table sticks to the bottom of the panel on a narrow
window. Otherwise the market's BUY and SELL buttons sit below 17 rows, off the
screen.

## Decisions already made

- **The key letters stay on the screen.** A row still shows its letter, and
  the hint lines still name keys. `ui/key-help.ts` is the one home of a key
  label, and a touch variant of a label is a decision for the flight plan.
  This plan changes the layout and the target sizes only.
- **The media query reads the pointer, not the platform.** No JavaScript
  decides "this is a phone". A tablet with a mouse gets the desktop targets.
  A laptop with a touch screen gets the desktop targets, because Chrome
  reports its primary pointer as fine.
- **A canvas scales in CSS. It does not redraw at a new size.** The chart
  constants stay in `constants/chart-metric.ts`. The click maths already
  divides by the rendered width.
- **The `?` help panel is out of scope.** It is an overlay, not a docked
  screen, and it already caps its width at `92vw`.

## Open questions

None.

## Watch out for

- **`#screen` sizes by content between its floor and its cap.** A `min()` in
  both keeps that behaviour on a wide window. Do not set a fixed width.
- **The chart readout caps its height at `--chart-side`.** When the row wraps,
  the readout keeps that cap and scrolls inside it. That is acceptable.
- **`palette:check` scans `style.css` for a spelled colour.** A new rule must
  use a `var()`.
- **`ste:check` reads every comment in `src/`.** A new CSS comment obeys the
  sentence caps.
- **Chrome on macOS cannot open a window under 500 pixels wide.** Measure
  390 pixels through an iframe of that width, or through a root `zoom`.

## Verification

The gates always run: `npm run check`.

The tier: prose, comments and a stylesheet. Nothing more runs.

Evidence, measured in Chrome at three viewports, and recorded in the Outcome:

- At 390 by 844 pixels, `#screen` reads a left edge of at least 0 and a right
  edge of at most 390. The twelve screens measured are these: station menu,
  market, equip, contracts, missions, commander status, data on system, local
  chart, galactic chart, combat trainer, log, briefing.
- At 390 pixels, no table on those screens is wider than the panel's content
  box.
- At 390 pixels with a coarse pointer, a menu row, a button and a selectable
  table row each read at least 44 pixels tall.
- At 1289 by 800 pixels, `#screen` reads 640 to 860 pixels wide, as before,
  and the chart row stays side by side.
