# 200 — The cockpit fits a phone in portrait

**Kind:** enhancement · **Severity:** medium · **Size:** medium · **Depends on:**
197 · **Blocks:** touch flight, which is a later plan · **GitHub:** none

## Where we are

**Chris flew the preview on his phone on 2026-09-10, in portrait, and he
likes portrait.** The console hung off both sides. The left gauges lost their
labels, the right gauges lost their bars, and the top bar wrapped.

**The console is one fixed row.** `#hud` in `src/style.css` is three panels
in a flex row. The left panel is 210 pixels wide. The scanner canvas is 300
by 176. The right panel is 210 pixels wide. With its gaps and padding it is 770 pixels
wide, centred with a transform. Measured in Chrome at 390 by 844, it read
from -190 to 580. Its height read 197 pixels on both a desktop and the
phone.

**The sight sits at a fixed fraction of the height.** `SIGHT_Y` in
`constants/console.ts` is 0.42. `render-stack.ts` shifts the camera's
projection by it, and `#crosshair` in `style.css` repeats it as `top: 42%`,
which `test/ui.test.ts` holds as a decided twin. The value stands in for the
centre of the view above a console of about a fifth of the height. On the
desktop the console reads 26% of a 757 pixel window, so the true centre is
at 37%. On a phone with a reflowed console the centre moves again. A fixed
fraction cannot follow it.

**The console lines sit at fixed heights too.** `#message` sits 27 `vh` from
the bottom, `#prompts` at 23 `vh`, `#lock` at 48% and `#shipid` at 56%. Each
one was placed by eye against the desktop console.

## What to do

Two milestones.

### M1 — the console reflows on a narrow window

At 700 pixels or less, `#hud` spans the window and becomes a grid of two
rows. The first row holds the scanner, scaled to about six tenths of the
width, with the compass, the indicators and the missiles stacked beside it.
The second row holds the gauges in two columns, the left panel's on the left
and the right panel's on the right. The three panels give up their boxes
through `display: contents`, so the markup in `play.html` does not change.
The labels narrow to fit.

### M2 — the sight meets the centre of the view above the console

The rule becomes one sentence: the gun axis sits at the centre of the view
above the console. The shell measures the console's height at each resize,
computes the fraction, and hands it to the render stack, which shifts the
projection by it. The shell also writes two custom properties on the root:
`--sight-y` for the crosshair, and `--console-h` for the lines above the
console. `#crosshair`, `#lock`, `#shipid`, `#message` and `#prompts` read
them.

A screen-open console hides by `visibility`, not `display`, so it still has
a height to measure while a screen is up.

`SIGHT_Y` goes, with its twin in the stylesheet and the test that held the
twin. A pure `sightFraction` in a new `engine/sight.ts` holds the maths, and
a test pins it.

## Decisions already made

- **Portrait is the phone's layout** (Chris, 2026-09-10). Landscape gets the
  desktop console, which fits at 770 pixels.
- **The desktop sight moves to the true centre.** It was at 42% of the
  height. The console is 26% of a 757 pixel window, so the centre is at 37%.
  The shot follows the axis, so nothing in the fight changes. Chris can call
  it back.
- **The console stays `pointer-events: none`.** Touch controls are the next
  plan, not this one.

## Open questions

None.

## Watch out for

- **`Presentation.resize` is the seam, and it keeps its signature.** The
  browser shell measures the console inside its own `resize`, and hands the
  fraction to the stack. The Game does not change. The headless shell
  returns 1 and reads nothing.
- **`SIGHT_Y` is in the constants catalogue.** Run `npm run
  generate:constants` after it goes, then `constants:check`.
- **The scanner canvas keeps 300 by 176 pixels.** It scales in CSS. The
  painter reads `canvas.width`, never the rendered size.
- **`test/ui.test.ts` holds the twin.** It changes to hold the custom
  property instead.

## Verification

The gates always run: `npm run check`. `npm run generate:constants` runs
first, because M2 removes a constant.

The tier: a stylesheet, the shell seam and one constant. No fight number
moves. Nothing more runs.

Evidence:

- `test/sight.test.ts`, new: `sightFraction` returns 0.5 for no console, the
  centre of the remaining view for a console, and never less than a floor.
- At 390 by 844 in Chrome, in flight, `#hud` reads a left edge of 0 and a
  right edge of 390. The crosshair's top reads the centre of the view above
  the console, within a pixel.
- At 1289 by 757: `#hud` reads 770 wide as before, and the crosshair's top
  reads 37% of the height.
- Chris flies the preview in portrait.
