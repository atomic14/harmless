# 224 — The README leads with the buttons, and the combat computer says what it adds

**Kind:** docs · **Severity:** low · **Size:** small · **Depends on:**
223 · **Blocks:** nothing · **GitHub:** none

## Where we are

Chris, 2026-09-14, after 223: *"Do we still need the keyboard and controls
stuff? Is there any time where a user takes manual control?"*

The code says a pilot takes manual control in two places, and one of them is
optional. The last stretch of a dock is the pilot's until a docking computer
is bought. The pilot holds the roll, by the strip or the roll keys. The
pilot holds the speed, by THRUST and BRAKE. In a fight the computer takes the stick for every commander since
docs/TODO/206, and the trigger is the pilot's. Hand flying by the steering
keys or the mouse is a desktop option, and a phone never has it.

The README's Controls section leads with the two keyboard layouts and a
Flight table. It puts the buttons, the course list and the fight after them.
Its opening and its K row say the bought combat computer "flies your ship".
So does the `?` guide's line for K. Since docs/TODO/206 the aim is free, and
the purchase adds the trigger and the E.C.M.

Chris chose to keep hand flying as a desktop option, and to shrink the
section: *"Let's do the first."*

## What to do

Two milestones.

- **M1. The README's Controls section leads with the buttons.** One
  paragraph says that every command is a button, and that the ship flies
  a course. It says that the computer lines the ship up in a fight, and
  that a keyboard can also fly by hand. Then the course list, the fight, the dock,
  the phone, the docked rows, the trainer, the market and the charts. The
  keys are the last subsection: three sentences on the steering keys, the
  layouts and the mouse, and the Commands table under a new heading. The
  Flight table goes, because the `?` guide and the manual render the
  steering keys from the key map. The opening and the K row say what the
  bought combat computer adds. The test that reads the table reads the new
  heading.
- **M2. The `?` guide's K line says what the purchase adds.** The command
  help said "the trained defence AI flies your ship". No weights load, and
  the aim is free. The line says the computer pulls the trigger and fires
  the E.C.M. The manual renders the same line.

## Decisions already made

- **Hand flying stays, as a desktop option** (Chris, 2026-09-14).
- **The Commands table stays in the README.** `test/key-help.test.ts` holds
  it to the bindings in both directions.
- **The Flight table goes from the README.** The steering keys have two
  generated homes, the `?` guide and the manual, and a hand-written third
  copy drifts.

## Open questions

None.

## Watch out for

- **The Docked slice in the key-help test** runs from `### Docked` to
  `### Combat training simulator`. Both headings stay, in that order.
- **Three tests pin trainer phrases** in the README. The paragraph keeps
  them.
- **The K row's words are the README's own.** The test reads the key
  column alone.

## Verification

- `npm run check` passes.
- The README names no key that is not bound, and every bound key.

## What the milestones found

**M1.** The Controls section opens with the buttons now: the course list,
the fight, the dock, the phone, the docked rows, the trainer, the market
and the charts. The keys are the last subsection, three sentences and the
Commands table under the heading "The keys". The Flight table is gone. The
opening and the K row say the bought combat computer pulls the trigger and
fires the E.C.M., and that the aim is free. The README is 375 lines. The
four tests that read it pass, and the key-help test reads the new heading.

## Outcome

(filled when the plan lands)
