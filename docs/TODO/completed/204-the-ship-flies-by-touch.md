# 204 — The ship flies by touch

**Kind:** enhancement · **Severity:** medium · **Size:** large · **Depends on:**
197, 200, 202 · **Blocks:** nothing · **GitHub:** none

## Where we are

**Chris asked for the flight screen on a phone on 2026-09-10, after the
docked screens and the cockpit fitted one.** The brainstorm of that day is
in the conversation, and this plan is its result. He likes portrait.

**The ship reads its controls through one small interface.** `FlightControls`
in `engine/flight-controls.ts` has five inputs: which keys are held, a stick
on two axes, and whether the trigger is down. `flightDemand` is pure. It
turns those five into a roll rate, a pitch rate, a throttle of -1, 0 or 1,
and a fire flag. The mouse-flight mode already fills the stick from pointer
movement, and `Input.decayMouse` centres it when the pointer stops.

**Every command in flight is a key in the binding table.** A docked menu
row turns a tap into a keystroke through `Input.injectPress`, since
docs/TODO/202 with no letter on the row. `game/prompts.ts` decides which
commands matter right now and returns a command, never a letter. The HUD
paints the prompt line as text, through `paintPrompts` in `hud/hud.ts`.

**Nothing on the flight screen takes a touch.** The console has
`pointer-events: none`. The view is the canvas. A phone player can dock,
trade and read every screen, and cannot fly.

**Two things a phone lacks.** Pointer lock, which the mouse-flight command
asks for. A held key: `Input.down` is private, and only a keydown fills it.

## What to do

Five milestones.

### M1 — the input takes a wanted speed and a held button

`Input` gains `press(code)` and `release(code)`, so a button can hold a key
as a keyboard does. It also gains `wantedSpeed: number | null`. A throttle
slider sets it, as a fraction of the ship's top speed. `FlightControls`
carries the wanted speed. `flightDemand` gains one rule, for a wanted speed
with no speed key held. The throttle is 1 below the wanted speed, and -1
above it. It is 0 inside a small band. The band is `THROTTLE_BAND` in
`constants/player-flight.ts`.
`test/flight.test.ts` pins the rule at both sides of the band.

### M2 — the touch overlay: drag to steer, hold to fire, slide to set speed

A new `engine/touch.ts` lives behind the platform seam, beside the browser
shell. It listens to pointer events on one overlay element over the view. A
finger that lands on empty view steers. Its offset from where it landed is
the stick, with `TOUCH_STICK_TRAVEL` pixels for full deflection. The stick
decays when the finger lifts, as the mouse stick does. It writes
`Input.mouseFlight`, `mouseX` and `mouseY`, and nothing in `flightDemand`
changes. A second finger may hold the FIRE button in the bottom right corner
of the view, which presses the fire key. A finger on the throttle slider at
the left edge of the view sets the wanted speed. Each finger is tracked by
its pointer id, so steering and firing happen at once.

The overlay shows only on a coarse pointer, through the media query
docs/TODO/197 uses. The keyboard keeps working beside it. The mouse-flight
command hides where pointer lock does not exist.

### M3 — the command row and the tappable prompts

A row of five buttons sits along the top edge of the console: MISSILE,
E.C.M., JUMP, TORUS and DOCK. Each carries the key it presses, from the
binding table, and a tap injects it. MISSILE arms on one tap and launches on
the next, because that is what the two keys do. A button is lit when the HUD
already knows its state is on: a missile armed, the torus engaged, the
docking computer engaged.

The prompt line becomes buttons on a coarse pointer. A prompt carries a
command. The edge looks the key up through the binding table, as it does
for the text, and the button injects it. The words stay the prompt's own.

### M4 — the flight menu

A MENU button opens a screen with rows, as the station menu is. The rows
are these:

1. LOCAL CHART, GALACTIC CHART;
2. COMMANDER STATUS, MISSIONS, COMMANDER'S LOG, CONTRACTS;
3. FRONT VIEW, REAR VIEW, LEFT VIEW, RIGHT VIEW;
4. PAUSE, and ESCAPE POD.

Each row carries the flight key it stands for, and the screen host's
row cursor and tap path serve it. The escape pod row asks first, on a
confirmation with buttons. The world keeps flying while the menu is up, as
it does under the charts.

### M5 — fullscreen, and the manual

The first touch on the view asks the browser for fullscreen. The manual and
the briefing gain one paragraph each on how to fly by touch.

## Decisions already made

- **Drag anywhere to steer, with no drawn stick** (Chris, 2026-09-10). A
  drawn stick invites the thumb to one spot. The decay is the mouse stick's.
- **No tilt in this plan.** iOS asks permission through a dialog, and a
  player on a bus cannot tilt. It may come later as an option.
- **No swipe and no pinch.** A swipe fights the steering drag, and a pinch
  fights two thumbs. The views are rows on the flight menu.
- **The console is read, never touched.** The controls sit on the view and
  along the console's top edge.
- **Portrait is the phone's layout.** Landscape gets the same overlay over
  the desktop console.

## Open questions

None.

## Watch out for

- **`Input.down` is private, and `held` reads it.** `press` and `release`
  add and delete a code there. A test drives them with no window.
- **The overlay must not swallow a tap on a screen.** `#screen` sits above it
  in the stacking order, and the overlay hides while a screen is open, as the
  console does.
- **`pointer-events: none` on the console.** The command row sits outside
  the console element, so the console's rule does not reach it.
- **The prompts line is rebuilt only when the text changes.** The buttons
  follow the same rule, or a tap lands on a button that was just repainted.
- **A held key and `endFrame`.** A pressed code is held, not tapped, so the
  carry rule does not apply. The fire key is `held`, as it always was.
- **`keyIfBound` answers null for a virtual code.** Every flight command is
  a real key, so the buttons and the menu rows find one.

## Verification

The gates always run: `npm run check`. `npm run generate:constants` runs
first, because M1 and M2 add constants.

The tier: a rule that changes how a flight goes, the throttle. `npm run
flight-probe` runs once.

Evidence:

- `test/flight.test.ts`: the wanted speed drives the throttle up, down and
  not at all inside the band, and a speed key overrides it.
- `test/input.test.ts`: `press` holds a key until `release`, and a pressed
  key is never carried as a tap.
- A new `test/touch.test.ts`: the stick maths from a finger's offset, the
  decay after a lift, and two fingers tracked apart.
- A new `test/flight-menu.test.ts`: the rows carry the flight keys, and a
  tap on each asks for its command.
- In Chrome at 390 by 844, in flight, synthetic pointer events steer the
  ship, hold the trigger and set the speed. Each button opens what it
  names.
- Chris flies the preview on his phone.

## Outcome

All five milestones landed on 2026-09-11. 5,661 assertions, from 5,619. The
flight probe ran once and passed, because the throttle rule touches how a
flight goes.

### M1 — the input takes a wanted speed and a held button

`Input.press` and `Input.release` hold a key as a keyboard does, and never
make a tap. `Input.wantedSpeed` is a fraction of top speed or null.
`flightDemand` opens the throttle below it, brakes above it, and coasts
inside `PLAYER_FLIGHT.throttleBand`. A speed key overrides it.

### M2 — the touch overlay

`engine/touch.ts` is two halves. `TouchTracker` is pure and runs under node.
`attachTouch` binds the overlay's pointer events, and `Input` calls it when
the page has the overlay. A drag is the mouse stick, with
`TOUCH_STICK_TRAVEL` pixels for full deflection. A held finger holds the
stick through `Input.stickHeld`, which `decayMouse` honours. In the 390 by
844 frame with synthetic pointer events, the slider took the speed from 30%
to 93%, a full drag right rolled the ship, FIRE heated the laser while the
other finger steered, and the stick decayed after the lift.

### M3 — the command row and the tappable prompts

`ui/key-help.ts` paints the five buttons at boot from the binding table, and
the HUD swaps MISSILE's key once a missile is armed and lights the buttons
whose state is on. Each prompt carries its code beside its words, through
`keyCodeIfBound`, and a coarse pointer taps it. The browser shell listens on
the row, the menu and the prompt line as it does on a screen. In the frame,
a tap on MISSILE armed one, and a tap on TORUS was refused as MASS LOCKED
beside the station.

### M4 — the flight menu

A MENU button opens a list of rows over the view, painted from the binding
table. The escape pod row opens a confirmation inside the list, and only
YES carries its key. In the frame, LOCAL CHART opened the chart and hid the
list and the overlay, and the pod's row opened its confirmation, which NO
closed.

### M5 — fullscreen, and the manual

The first touch asks for the whole screen. The manual and the briefing each
gain a paragraph.

### What the plan did not have

- **The flight menu is a list, not a screen.** The plan named a screen under
  the screen host. A list of rows with the keys on them needs no screen, no
  id in the host's union and no input routing. It uses the seam every
  button already takes.
- **A synthetic pointer has no capture to give.** `setPointerCapture` throws
  for one, and the overlay catches that, so a test can drive it.
- **Node's strip-only mode refuses a parameter property.** The tracker's
  constructor assigns its fields by hand.
- **The travel is 125 pixels, not 120.** Four constants already share 120,
  and the gate wants each value its own.
- **The feel is not measured here.** Chrome drove the overlay with synthetic
  events. Whether the stick's travel and the decay feel right on a phone is
  Chris's to judge.
