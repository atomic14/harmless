# 215 — The gun row lives in the console, and a list runs sideways

**Kind:** enhancement · **Severity:** high · **Size:** large · **Depends on:**
nothing · **Blocks:** nothing · **GitHub:** none

## Where we are

Chris flew the game on his phone and said, on 2026-09-13: *"the buttons
cover up the area where all the action is happening"*. The flight view
carries three columns of buttons over the sky. The course list sits top
right, the target list bottom left since the same day, and the guns bottom
right. On a phone each column is 46% of the width. What is left for the
fight is a window about 390 by 330 pixels in the middle. A screenshot of the
arrival at Diso, at a phone's size, showed the planet under a button.

Chris drew the shape he wants, the same day, and this plan builds it:

- the sky holds two icons only, the course top right and the targets bottom
  left, and each opens its list on a tap;
- the guns are a row at the bottom of the console. They are FIRE LASER,
  the missile as two buttons, ARM or DISARM and FIRE, and the E.C.M.;
- the missile squares go, because the count is on the arm button;
- the S and E letters sit beside the compass;
- the right gauges sit under the compass, and the left gauges and the
  shields share the row below, beside a scanner two rows tall.

What exists today. `cockpit-buttons.ts` builds three columns from one
source. `hud-buttons.ts` paints a column into an element. The shell listens
for taps on the columns by id, and a held button and the roll strip listen
on the whole document. The console is `#hud`, a fixed row of three panels
on the desktop and a two-column grid on a phone, with `display: contents`
on the panels. The shell measures the console's height at each resize and
writes it to `--console-h`.

## What to do

Three milestones. Each is one commit.

### M1 — the gun row in the console

- `#guns` is a fourth child of `#hud`, under the three panels, on both
  layouts. The three panels gain a wrapper row, `display: contents` on a
  phone, so the desktop console can be a column of the panels and the row.
- `gunButtonsFor` replaces `actionButtonsFor`. The row is four buttons in
  flight, always in the same places. FIRE LASER is held. ARM A MISSILE or
  DISARM reads by the missile's state, with the count as its hint. FIRE THE
  MISSILE is lit on a lock. E.C.M. is lit while a missile is inbound. A
  button the ship cannot use stays and says why: NONE LEFT, NOT ARMED, NOT
  FITTED. A stable row is one a thumb learns.
- During the pilot's stretch into the slot the row holds the stretch's own
  buttons, as the column did. They are LINING UP, and then the roll strip,
  THRUST, BRAKE and the fitted docking computer.
- The `#actions` column and the missile squares go. The S and E letters keep
  their place beside the compass.
- The phone grid follows the mock-up. The scanner spans the rows the four
  right gauges take. The compass and the letters sit above them. The left
  gauges and the shields share the rows below.
- `--console-h` is measured from `#hud`, so the row is inside it and the
  console lines and the two icons stand on it.

### M2 — the lists fold to headers, and open as one row that scrolls

Chris refined this the same day, after the gun row landed: *"this could be
an expanding button that is collapsed by default"*, and *"the expanding
target and fly to buttons could actually be horizontal and scroll"*.

- The course column folds to one header, top right: ACTIONS with a chevron,
  closed by default. While a course flies the header says the course, lit,
  and FAST FORWARD is a second header beside it, one tap. An offer the
  situation raises stays a button under the header, because an offer is
  urgent.
- The target column folds to one header, bottom left: TARGETS with the count
  and the chevron.
- A tap on a header opens THE ROW. It is one line of buttons beside the
  header, the full width, and it scrolls sideways with a snap to each button.
  The course row holds the courses, and the target row holds the ships and
  LET THE COMPUTER CHOOSE. A pick folds the row, and so does a tap on the
  open header, whose chevron points up while it is open.
- One row at a time. A tap that opens one folds the other.
- `course-actions.ts` and `target-actions.ts` each hold the open flag, as
  the target list does today. No save carries it.

### M3 — the desktop keeps the same layout

- One layout, one set of tests. The desktop gets the console row and the
  two icons, with the key names as hints on the buttons.
- The manual's flight page says where the guns are now.

## Decisions already made

- **The guns go to the bottom** (Chris, 2026-09-13: *"I think the buttons
  should be at the bottom"*).
- **The missile is two buttons, arm or disarm and fire** (Chris, 2026-09-13).
- **The missile squares go** (Chris, 2026-09-13: *"We could actually drop
  the squares"*).
- **Two icons over the sky, and each expands into its list** (Chris's
  mock-up, 2026-09-13).
- **The headers are closed by default, and a list opens as one row that
  scrolls sideways** (Chris, 2026-09-13).

## Open questions

- **Does the desktop get the same?** Yes. A desktop screen has room either
  way, and one layout is one set of tests.
- **Where does fast forward go?** A second header beside the course
  header, shown while a course flies. It stays one tap.
- **What does the row show for an E.C.M. that is not fitted, or a rail with
  no missile?** The button, dim, with the reason. A row that changes shape
  is a row a thumb cannot learn.

## Watch out for

- **`#hud` takes no pointer events** on the desktop, so the row must take
  its own.
- **A held button and the roll strip listen on the document**, so the row
  needs no wiring for those. A tap does: the shell lists the columns by id.
- **`HudFrame` and `HudState` carry the columns by name**, and two tests
  build a frame by hand.
- **The manual is Chris's page.** M3 changes one sentence of fact, and says
  so.
- **The phone frame is an iframe.** The browser here cannot shrink to a
  phone. So each milestone is checked in an iframe at 390 by 844, driven
  through the game's own handle, and then on Chris's phone.

## Verification

The gates always run: `npm run check`.

The tier: prose, comments, markup and a plan doc, and the flight's buttons.
Nothing here changes a rule of flight or a fight.

Evidence:

- A test reads the four gun buttons in flight, in order. The arm button's
  label follows the missile's state, and the count is its hint.
- A test reads the stretch's buttons in the same row during the slot.
- A real-game test sends the row's codes and sees a missile arm, disarm and
  fire, and the laser held.
- A test reads the two headers closed, one row open, and the other folded
  by the tap that opened it.
- A screenshot of the arrival at a phone's size, from the iframe, before and
  after each milestone.
- Chris flies it on his phone.

## What the milestones found

### M1

- **The row is four buttons in the same places, always.** A button the ship
  cannot use stays and says why: NONE LEFT, NOT ARMED, NOT FITTED. The
  fight-button test reads the row in order, and the dock-trial test reads
  the stretch's buttons in the same row.
- **The console grows by the row.** On the desktop it is 249 pixels, and on
  a phone 267. The shell measures `#hud`, so the console lines and the two
  columns over the sky stand on the new height with no change.
- **The phone grid follows the mock-up** with explicit rows. The scanner
  spans five. The four right gauges take rows two to five beside it. The
  six left gauges split three and three across the two columns below.
- **The missile squares are gone**, with their painter and four style
  rules. The S and E letters sit beside the compass.

### M2

- **One fold serves both lists**, `game/list-fold.ts`. It holds which list
  is open, or neither, and a tap that opens one folds the other. The target
  list's own flag went into it. No save carries it.
- **The run stays under the header.** A list closed by default would hide
  RUN FOR IT behind a tap, and a pilot in a fight has no time for one. The
  run and the offers sit under the header at all times, and the row holds
  the rest.
- **A row scrolls sideways with a snap**, the full width, with the
  scrollbar hidden. The course row sits under its header at the top. The
  target row sits above its header at the bottom. So cause and effect stay
  close. On a phone the second course button is cut at the edge, which is
  what says the row scrolls.
- **The chart is a row item.** LOCAL CHART left the header column for the
  end of the course row.
- **Three tests read the list through its header now**, and one reads the
  run by name rather than by place.

### M3

- **The desktop had the layout from M1 and M2 already**, because both
  milestones built one layout. The key names sit under the buttons that
  have a key, as they did. Nothing changed in code.
- **The manual's Trouble page says where the guns are**, that the missile
  is two buttons, and that TARGETS and ACTIONS each open a row. That is
  Chris's page, and the sentence is a fact about the screen.

## Outcome

215 landed on 2026-09-13, the day Chris drew it. The guns are a row at the
bottom of the console, always four buttons in the same places, with the
missile as two. The missile squares are gone. The two lists over the sky
are two headers, closed by default, and each opens as one row that scrolls
sideways. A tap that opens one folds the other. The sky is the sky, with
two small marks on it. The desktop has the same layout. The suite has
6,072 assertions, from 6,061.

What the plan did not have: the run had to stay under the course header,
or a fight would start with RUN FOR IT behind a tap. The plan's title
changed once, because the title gate knows no verb "fold".
