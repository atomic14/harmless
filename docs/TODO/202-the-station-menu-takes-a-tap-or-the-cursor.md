# 202 — The station menu takes a tap or the cursor

**Kind:** enhancement · **Severity:** medium · **Size:** medium · **Depends on:**
197 · **Blocks:** touch flight, which is a later plan · **GitHub:** none

## Where we are

**Chris decided it on 2026-09-10.** Every menu can be clicked. The letter
keys on the station menu tie the game in knots, so they go. A menu takes a
tap or a click, the cursor keys with Enter, and Escape to go back. **The
menus only.** Every key in flight stays as it is.

**Today every station row is a letter, and some are a shifted letter.** The
`docked` table in `game/bindings.ts` binds nineteen commands to letters. Two
of them are shifted: ⇧R for the log beside R for the missions, and ⇧T for
test mode beside T for training. Seven more commands sit on a hint line
under the menu with no row at all. They are these:

- the log;
- test mode;
- the keyboard layout;
- the commander file;
- export;
- import;
- a new commander.

A phone cannot press any of them.

**A shifted letter is told from a plain one by a key the game saw go down.**
`Input` records a real key press with no modifier, and `fires` in
`game/controls.ts` then asks whether a Shift key is held. The answer comes
from the keys the game saw go down. When the Shift keydown was missed,
the plain binding wins. Chris pressed ⇧R and got MISSIONS. The question-mark
key already reads the event's own modifier, with a comment that says a Shift
keydown "isn't always observable". The rule was never applied to the rest.
Flight keeps five shifted bindings, so the fix still matters after the menu
loses its letters.

**A row is generated from the table.** `dockedMenuHtml` in `ui/key-help.ts`
builds each row from a docked binding: the key's label in bold, then the
command's `menu` label from `game/command-help.ts`. A click on the row
injects the row's key, and the table answers (invariant 13). The market's
BUY MAX button already does this with a virtual code, `VirtBuyMax`, that no
keyboard produces.

**Prose names the letters.** The briefing says "Press M for the market"
through `boundKey`, which throws for an unbound command. The boot plate says
"PRESS ? FOR CONTROLS — CLASSIC LAYOUT (B TO SWITCH)". The manual says
"Press M at the station for the market". The `?` guide and the manual's
command table list the station keys.

## What to do

Four milestones.

### M1 — the modifier comes from the event

`Input` records the modifier the keydown event reports, for every key. The
key handling moves into a method the test can call without a window. The
special case for the question mark goes, because the general rule covers it.
`test/input.test.ts` presses a shifted R with no Shift keydown and gets the
log.

### M2 — every station command is a row, and no row is a letter

Every docked binding takes a virtual code, `Virt` and the command's name,
such as `VirtOpenMarket`. No docked binding is shifted. The seven commands
of the hint line become rows, with `menu` labels. The menu is one list in
this order:

1. LAUNCH, MARKET PRICES, CONTRACTS, EQUIP SHIP, PAY FINE;
2. LOCAL CHART, GALACTIC CHART, DATA ON SYSTEM;
3. COMMANDER STATUS, MISSIONS, COMMANDER'S LOG;
4. COMBAT TRAINING, NEW PILOT'S BRIEFING, KEYBOARD LAYOUT;
5. COMMANDER FILE, EXPORT SAVE, IMPORT SAVE, TEST MODE, NEW COMMANDER.

A virtual code has no label. `keyLabel` answers an empty string, and
`keyIfBound` answers `null`, so prose that quotes a station key fails the
build. A row prints no letter. The hint line under the menu says how the
menu works, and names the `?` guide from the global table. On a wide window
the rows flow in two columns. On a phone they are one column.

The `?` guide's station section and the manual's station table say the one
sentence that is true. At a station, every command is a row on the menu.

### M3 — the prose stops naming station letters

The briefing names the menu rows instead: "Open MARKET PRICES on the
station menu." The boot plate says where the guide and the keyboard layout
are. A station event that points at a docked command names the row alone.

### M4 — the manual says the same

The manual's sentences that press a station letter name the row instead.
Its flight sentences do not change.

## Decisions already made

- **The menus only** (Chris, 2026-09-10). Every flight key stays. The keys
  inside a screen stay too: ENTER to target on a chart, D for its data, A to
  accept a contract. Each of those has a button as well.
- **The cursor stays.** Up, down and Enter walk the rows, and Escape goes
  back. That is the keyboard's way in.
- **One list, not a submenu.** Nineteen rows in two columns fit a desktop
  window. A phone scrolls one column, which it already does for the market.
- **A virtual code is named after its command.** So a row's key and its
  command cannot part company, and the table stays the one home.

## Open questions

None.

## Watch out for

- **`test/key-help.test.ts` holds the shape of the menu.** It asserts every
  docked command is a row or a keyline entry, and it presses every row. Both
  checks change with the shape, and both stay.
- **Tests press station letters.** `help-overlay`, `briefing-onboarding`,
  `input`, `menu-click` and others press M, B, P, H and T at the station.
  Each becomes the virtual code.
- **`boundKey('docked', ...)` throws after M2.** Every caller for a docked
  command changes in M3, and the build says which.
- **The key-help test's shifted-row seam stays.** No shipped row is shifted,
  and the seam is still the proof a shifted row would work.
- **`escape-pod-key` and `mission-game` press shifted keys in FLIGHT.** They
  do not change.

## Verification

The gates always run: `npm run check`.

The tier: the tables, the input seam, prose and one stylesheet. No fight
number moves. Nothing more runs.

Evidence:

- `test/input.test.ts`: a shifted R with no Shift keydown asks for the log.
  It fails before M1.
- `test/key-help.test.ts` holds four things. Every docked command is a row.
  No row prints a letter. No docked binding is shifted. A click on each row
  asks for its command.
- In Chrome at 390 by 844, every station row is reachable by a tap. At 1289
  wide, the rows sit in two columns and the cursor walks them in order.
- Chris uses the menu on his phone and on his desktop.
