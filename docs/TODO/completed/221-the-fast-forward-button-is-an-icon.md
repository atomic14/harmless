# 221 — The fast forward button is an icon

**Kind:** fix · **Severity:** low · **Size:** small · **Depends on:**
nothing · **Blocks:** nothing · **GitHub:** none

## Where we are

Chris, 2026-09-13, from his phone: *"The fast forward button is very big -
let's just have it as an icon."* The button is a second header under the
course header while a course flies. It carries the words FAST FORWARD, a
hint under them, and the reason it cannot start when it cannot. On a phone
that is a bar as wide as the course header.

## What to do

One milestone.

- A button can be an icon: a glyph, small, at the right under the header,
  with no hint and no note. The painter gives it a class, and the
  stylesheet its size.
- The fast forward button is two arrows. It is lit while it runs, and dim
  while it cannot start. The console already says why on the press.
- The briefing and the manual name the icon where they named the words.

## Decisions already made

- **An icon, and no words** (Chris, 2026-09-13).

## Open questions

None.

## Watch out for

- **The briefing test lists the buttons it teaches by their words.** The
  icon takes the words' place in that list.

## Verification

The gates always run: `npm run check`.

Evidence:

- A test reads the icon beside the course header, with no hint under it.
- Checked by eye in a 390 by 844 frame.

## What the milestones found

- **An icon is a button with two more flags**, `icon` and `dim`. The note
  used to carry the refusal and dim the button at once. An icon has no
  note, so `dim` says the button refuses, and the console says why.
- **The glyph is a lower-case name** in the buttons file, because the
  constants gate reads an upper-case one as a rule.
- **The briefing test lists the buttons it teaches**, and the glyph took
  the words' place in it.

## Outcome

Landed 2026-09-13, in one milestone. The fast forward button is two
arrows, small, under the course header, lit while it runs and dim while
it cannot start. 6,159 assertions.
