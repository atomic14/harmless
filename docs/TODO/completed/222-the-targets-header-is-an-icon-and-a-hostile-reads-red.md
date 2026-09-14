# 222 — The targets header is an icon, and a hostile reads red

**Kind:** fix · **Severity:** medium · **Size:** small · **Depends on:**
nothing · **Blocks:** nothing · **GitHub:** none

## Where we are

Chris, 2026-09-14, with a picture from his phone: *"The targets button
overlaps the console. Also - on the list of targets - hostile targets
should be red not green. Maybe the targets button could be an icon? Think
carefully about the UI and available screen space."*

The picture shows three things. The TARGETS header stands on the
console's scanner, and the console line TORUS DRIVE ENGAGED runs across
it. The gun row takes a third of the console, because each button wraps
its words over three lines with a hint under them. And every ship in the
target row is green, whether it attacks the commander or not.

The overlap has a cause the picture does not show. The shell measures the
console's height at a window resize and writes it for the stylesheet. On
the phone the console grew after that measure, when the fonts landed and
the gun row wrapped, and nothing measured it again. So the header and the
message line stood on a console that was no longer there.

## What to do

One milestone.

- The shell watches the console itself, and measures it again whenever it
  changes size, where the browser can watch an element.
- The targets header is an icon with the count: a bullseye and how many
  are on the scanner. It is small, at the bottom left, lit while the row
  is open, and red while any ship on the scanner attacks the commander. So
  the icon is the threat tell too.
- A ship that attacks the commander reads red in the row. A picked ship
  keeps its amber.
- The message line on a phone stands above the icon.
- The gun row on a phone keeps its notes and drops its hints, and the two
  missile buttons say ARM MISSILE and FIRE MISSILE. The manual carries the
  hints.
- The briefing and the manual name the icon where they named the words.

## Decisions already made

- **An icon with the count, and red for a hostile** (Chris, 2026-09-14).
- **The course header keeps its words.** It says what the ship is doing,
  and that is the one line a pilot reads on the sky.
- **The gun row's hints go on a phone alone.** A desktop has the room, and
  a thumb learns five buttons in a row.

## Open questions

None.

## Watch out for

- **The briefing test lists the buttons it teaches by their words.** The
  icon and the shorter labels take the words' places in that list.
- **The target row sits above the header**, and the icon is shorter than
  the header was, so the row moves down with it.

## Verification

The gates always run: `npm run check`.

Evidence:

- A test reads the icon with the count, red with a hostile on the scanner
  and green without, and lit when the row is open.
- A test reads a hostile row red and a trader's row not.
- Checked by eye in a 390 by 844 frame.

## What the milestones found

- **The console was 265 pixels tall and measured at 203** in the phone
  frame, which is the overlap in the picture. A resize observer on the
  console closes that gap on a phone. A hidden tab gets no rendering step,
  so the frame here needed a resize event to show the same.
- **The icon is lit when open, and red when closed with a hostile near.**
  Open, the row itself shows the red, so the icon's amber says the one
  thing the row cannot: that a tap folds it.
- **The gun row is two lines on a phone**, from three or four, with the
  hints gone and the missile words shorter. The notes stay, because NOT
  ARMED and NOT FITTED are why a button does nothing.
- **A console line named the old header**, A SHIP IS CLOSE — OPEN TARGETS,
  and it names the icon now.

## Outcome

Landed 2026-09-14, in one milestone. The targets header is a bullseye
with the count, red while a hostile is on the scanner. A hostile reads
red in the row. The console is measured again whenever it changes, so
nothing stands on it. The gun row on a phone is two lines. 6,163
assertions.
