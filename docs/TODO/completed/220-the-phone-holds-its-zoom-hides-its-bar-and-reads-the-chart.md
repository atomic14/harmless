# 220 — The phone holds its zoom, hides its bar, and reads the chart

**Kind:** fix · **Severity:** medium · **Size:** small · **Depends on:**
nothing · **Blocks:** nothing · **GitHub:** none

## Where we are

Chris, 2026-09-13, from his phone: *"Can we prevent zoom by double
tap/pinch. Hide the address bar. And increase the fonts in the local
chart."*

Three faults, one page. A double tap on a button zooms the page, and a
pinch on the sky zooms it too, so the console lands off the screen. The
browser's address bar takes the top of the view and comes and goes with a
scroll. The short range chart draws its names at ten pixels on a canvas of
560. The phone shows that canvas at about 370, so a name is under seven
pixels tall.

## What to do

One milestone.

- The viewport meta says no user scale. The root takes `touch-action:
  pan-x pan-y`, which refuses the pinch and the double tap where the
  browser honours it. Where it does not, the shell refuses the gesture
  itself: a `gesturestart` and a scaled `touchmove` are cancelled. The
  buttons keep their own `touch-action: none`.
- A web app manifest with `display: standalone`, and the two meta tags a
  phone reads to open the page as an app from the home screen. On a phone
  that allows it, the first touch in the page asks for fullscreen, so the
  bar goes in the browser too. The request is made only on a coarse
  pointer, and a refusal is silent.
- The chart's names are drawn in CSS pixels. The painter reads the ratio
  of the canvas width to its width on the page. It scales the font, the
  dot and the offset by that ratio. A canvas with no page width, as under node,
  scales by one. The name size is one constant, twelve pixels.

## Decisions already made

- **A constant name size on every screen**, rather than a phone size and
  a desktop size. The desktop gains two pixels.
- **Fullscreen on the first touch, on a coarse pointer alone.** A desktop
  click never asks for it.

## Open questions

None.

## Watch out for

- **The iPhone ignores the viewport's no-scale** since iOS 10, and it
  honours `touch-action` for a pinch only in part. The gesture listeners
  are the fix that holds there.
- **`requestFullscreen` does not exist on the iPhone.** The manifest and
  the meta tags are the fix that holds there, once the page is on the home
  screen.
- **The reticle canvas and the chart canvases** share the page's touch
  rules. Nothing on them pans, so `pan-x pan-y` costs nothing.

## Verification

The gates always run: `npm run check`.

The tier: markup, a listener and a painter's size. No rule changes.

Evidence:

- A test reads the viewport meta, the manifest link and the app meta tags
  in both pages, and the manifest as JSON with `standalone`.
- A test paints the chart under a canvas shown at half its width and
  reads the font at twice the constant. Under no page width it reads the
  constant.
- Checked by eye in a 390 by 844 frame.

## What the milestones found

- **The names at twelve CSS pixels are nineteen canvas pixels on a phone**,
  where the canvas of 560 shows at 350. At that size a name at the right
  edge ran off the canvas, so a name that would not fit sits to the left
  of its dot. The recording canvas measures nothing, and then every name
  sits right, so the test reads the font and not the side.
- **The double tap window is the platform's number**, so it is on the
  threshold gate's list with that reason, and not in `src/constants/`.
- **Two other constants at twelve gained a rule id**, because the
  constants gate asks for one on every repeated value.
- **The recording canvas keeps the font** beside its two colours now, so
  a test can read what size a name was drawn at.
- **The boot line went too.** Chris asked, on the same day: *"Can we get
  rid of that 'press ? For controls' message?"* A phone has no ? key, and
  the station menu carries the guide and the layout toggle as rows.

## Outcome

Landed 2026-09-13, in one milestone. A phone keeps its zoom on a double
tap and a pinch, opens the page from the home screen with no address bar,
asks for the whole screen on the first touch where it can, and reads the
short range chart's names at twelve pixels. Checked in a 390 by 844
frame, and on Chris's phone next. 6,153 assertions.
