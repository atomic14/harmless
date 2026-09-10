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

## Outcome

Both milestones landed on 2026-09-10, in `src/style.css` alone. 5,555
assertions, unchanged, because a stylesheet has no test.

### M1 — the panel yields to the viewport

`#screen`'s floor and cap each yield to the viewport less a 16 pixel gutter,
through `min()`. `#screen.wide` does the same. Both height caps read `dvh`.
A window of 700 pixels or less trims the padding, the menu indent, the title
spacing and the cell padding. It wraps the chart readout under the map, scales
a chart canvas in CSS, wraps the top bar by item and shrinks the console line.

Measured in Chrome at 390 by 844, through an iframe of that size. Each of
the twelve screens read a left edge of 8 and a right edge of 382. No table, no
canvas and no menu read wider than the 352 pixel content box. At 1289 by 757
the station menu read 645 pixels wide, the local chart 1082, and the chart
row stayed side by side.

### M2 — a finger finds its target

A `pointer: coarse` query grows the padding of a menu row, a selectable table
row, a button and a table button. On a narrow window the button row sticks to
the bottom of the panel.

Measured at 390 by 844 with the coarse rules injected as a plain style,
because a desktop Chrome reports a fine pointer and cannot be told otherwise.
A menu row read 45 pixels, a market row 44, a button 45 and a table button
45. **The query's own firing on a phone is not measured.** Chris's phone is
the instrument for that, at `npx vite --host`.

### What the plan did not have

- **A flex item refuses to shrink below its content.** The chart readout held
  the facts and the portrait side by side, and the column ran off the panel.
  `min-width: 0` on the readout and a wrap on the facts row fixed it.
- **A number cell broke inside itself.** The contracts table showed `8` over
  `days`. A `nowrap` on `td.num` holds a number on one line.
- **The console line took four rows under a tall panel.** At 15 pixels with
  3 pixels of letter spacing, the layout hint filled the bottom of a phone.
  It reads 13 pixels with 2 pixels of spacing on a narrow window.
- **Chrome on macOS refuses a window under 500 pixels wide.** The measurement
  page was an iframe of 390 by 844 under the gitignored `.cycle/`, which Vite
  serves. It is three lines:

  ```html
  <style>iframe{border:0;width:390px;height:844px;display:block}</style>
  <iframe src="http://localhost:5199/play.html"></iframe>
  ```

- **A synthetic Escape and a synthetic letter in one frame lose the letter.**
  The screen that closes consumes the Escape, and nobody reads the letter in
  that frame, so `endFrame` drops it. A keyboard never lands two keys in one
  frame, and a wait of one frame between them was enough. This is the interest
  rule in `engine/input.ts` at work, not a defect.
