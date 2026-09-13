# 216 — Every docked screen carries a button for each key it reads

**Kind:** enhancement · **Severity:** high · **Size:** medium · **Depends on:**
nothing · **Blocks:** nothing · **GitHub:** none

## Where we are

Chris asked, on 2026-09-13: *"I need you to review all the docked screens -
make sure there are buttons for everything so that it will work on
mobile."* A phone has no keyboard. `ui/screen-host.ts` turns a tap on a
`data-key` button into the keystroke it names, so a button is how a phone
presses a key (invariant 13). A tap on a `data-row` row selects that row.

The review read every screen's `input()` and every painter's buttons. Most
screens are complete. Fourteen screens carry a button or a row for every
key they read. They are the station menu, the courses, the market, the
equipment, the contracts, the missions and the saves. They are also the
briefing, the survivors, the status, the data, the log, the quit and the
game over. Six places do not:

- **The three name screens.** A save's name, a rename and a new commander
  each read typed letters through `Input.drainPresses`. No button sends a
  letter. The rename screen carries no button at all, not even ESC.
- **The charts.** F starts a search by typed letters, and M opens the
  market estimate. Neither has a button, and the search has no letters.
- **The test mode.** A row's click steps it forward. Nothing steps it back.
- **The trainer's setup.** Left and right change a value. R rerolls the
  seed. HOME and END jump to the ends of a list. None has a button.
- **The trainer's report.** Left and right walk the records. ENTER opens a
  comparison. Shift with X exports every record. None has a button.
- **The trainer's comparison.** Left and right walk the other record. No
  button.

## What to do

Three milestones. Each is one commit.

### M1 — a key grid types a name

- `ui/key-grid.ts` paints a grid of buttons. Each carries the key code the
  screens already read: `Digit1` to `Digit0`, `KeyA` to `KeyZ`, `Space` and
  `Backspace`. Ten columns, so the digits are one row and the alphabet is
  three. No screen changes, because a tap is the keystroke.
- The save prompt, the rename and the new commander each paint the grid
  above their button row. The rename gains ENTER and ESC buttons.
- The stylesheet gives the grid its face, and more height under a finger.

### M2 — the charts find and estimate by a button

- The chart's button row gains FIND A SYSTEM and MARKET ESTIMATE.
- Each chart holds an empty element for the grid. The screen fills it with
  the letters when the search starts, and empties it when the search ends.
  The search's grid carries DEL and ENTER in place of SPACE, because ENTER
  ends the search and keeps the cursor on the match.

### M3 — the levers and the trainer step by a button

- A button that carries both `data-row` and `data-key` selects its row
  first, and then sends its key. So a row can carry its own arrows.
- The test mode's rows and the trainer's setup rows carry a left and a
  right arrow beside the value.
- The trainer's setup gains R for a random seed. The report gains the two
  arrows, ENTER for a comparison, and Shift X for every record. The
  comparison gains the two arrows.
- The report reads the modifier from the tap, as the market does, so the
  Shift X button works.

## Decisions already made

- **Buttons, not a text field** (the house rule since docs/TODO/55). A text
  field needs focus, and every screen repaints on each keystroke. A grid of
  buttons is the same path a key takes.
- **HOME and END get no button.** They are a bigger step of the same act,
  and the arrows reach every value.
- **The desktop paints the grid too.** One layout is one set of tests.

## Open questions

None.

## Watch out for

- **`typeToFind` drains every press in a frame**, ESC included. So a tap on
  DONE while a search runs ends the search, and a second tap leaves the
  chart. That is how the keyboard behaves today.
- **`redraw()` runs on every cursor move.** The grid is written once when
  the search starts, and once when it ends, not on each move.
- **`combat-sim-panel.test.ts` reads the trainer's hints by regex.** The
  hints stay as they are.
- **The phone frame is an iframe.** Each screen is checked at 390 by 844,
  driven through the game's own handle.

## Verification

The gates always run: `npm run check`.

The tier: markup, a click route and a plan doc. Nothing here changes a rule
of the game.

Evidence:

- A test paints each name screen and reads a letter, a digit, SPACE, DEL,
  ENTER and ESC as buttons.
- A test paints each chart and reads FIND and MARKET as buttons. It starts
  the search and reads the letters in the grid, and ends it and reads none.
- A test paints the test mode and the trainer's setup, and reads a left and
  a right arrow on each row, each with its row. A test paints the report
  with two records and reads the arrows, ENTER and Shift X. A test paints
  the comparison with three records and reads the arrows.
- A test clicks a button with a row and a key, and sees the row selected
  and the key sent.

## What the milestones found

**M1 (2026-09-13).** The grid is 36 buttons in ten columns, and it fits a
390 pixel frame at 34 pixels a key. A tap on K, I, 7, SPACE, M and DEL
typed `KI7 ` in the frame, and ESC kept the old name. The rename screen
had no button at all before this, so a phone could not leave it.

**M2 (2026-09-13).** The first shape put the grid under the button row,
and the row is sticky on a phone. It covered the grid. The row also reads
as letters while the search runs, so a tap on DATA typed a D. So the row
hides while the search runs, and the grid sits under the FIND line. A tap
on F, L and E put the cursor on the first name that starts with LE, and
ENTER kept it there.

**M3 (2026-09-13).** A button with a row and a key selects the row first.
That is one change in `ScreenHost.click`, and both lists share one
painter for the two arrows. HOME and END keep no button. The trainer's
report reads the modifier from the tap, as the cockpit does, so the
shifted X button exports every record.

**After the gate.** The key grid put `screens/chart.ts` at 414 lines. The
search moved to `screens/chart-search.ts`, and the chart keeps the cursor.
The two alphabets in the grid took lower-case names, because the constants
gate read them as rules.

## Outcome

Landed 2026-09-13, in four commits. Every docked screen carries a button
for each key it reads. The three name screens and the chart's search type
on a key grid. The charts find and estimate by a button. The test mode
and the trainer step by arrows on each row. 6,114 assertions.
