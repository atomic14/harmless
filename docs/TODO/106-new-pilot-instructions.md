# 106 — A new pilot must see the instructions

**Kind:** onboarding / UI bug · **Severity:** high · **Size:** medium
**GitHub:** [#15](https://github.com/atomic14/harmless/issues/15)

## Where we are

The README promises two in-game routes for a newcomer: `H` opens the six-page
briefing while docked and `?` opens the controls anywhere. Both exist, but the
promise is not yet reliable:

- `#screen` has `z-index: 10`; `#help` has none. While docked, `?` toggles the
  guide behind the opaque station screen, so the command appears to do nothing.
- Nothing records that a commander has seen the briefing or opens it for a new
  pilot. A player must already know to press `H`.
- Binding-derived help prevents stale key names, but nobody has walked the
  complete newcomer journey and proved that the briefing explains enough to
  trade, launch, navigate, jump, fight, escape and dock.

## What to do

1. Make `?` a real topmost guide over every cockpit and docked screen. While it
   is open, input must not operate the obscured screen; `?` or Escape closes it.
2. Record briefing visibility as saved commander state, not an ambient browser
   global. On the first docked entry for a commander that has not seen this
   briefing version, open page one automatically and record that it was shown.
   `H` always reopens it.
3. Audit the six pages against the commands and first journey that actually
   ship. Keep key names derived from the binding table; the briefing explains
   goals and consequences rather than becoming another key map.
4. Keep the README, manual and in-game wording consistent about where the pilot
   starts and what saving, launching and dying do.

## Decisions already made

- Show the briefing once per commander, including an older save that has never
  recorded the current briefing version. Do not show it on every page load.
- Opening the automatic briefing counts as shown; abandoning it does not trap a
  player in an onboarding loop. `H` remains the permanent route back.
- The controls guide is an overlay, not a competing game screen.

## Watch out for

- `game/storage.ts` is the only save-localStorage owner. The viewed marker
  belongs in `CommanderData` and the ordinary snapshot/save path.
- Imported and older commanders need the same safe default as fresh ones.
- Fixing only the CSS would leave keys changing the hidden station menu.
- The guide must still work in flight, on death screens and in the simulator.

## Verification

- A fresh commander enters the briefing automatically once; reload and later
  docking do not reopen it; `H` still does.
- A commander restored without the marker sees it once and then persists it.
- With any docked screen open, `?` visibly covers it and arrow/letter input does
  not alter the screen underneath.
- A binding/content test accounts for the actions a new pilot needs; a flown
  check completes the first trade-and-launch path using only surfaced guidance.
- Run `npm run build` and `npm run elite-a`; this touches saved state and UI but
  not combat balance.

## Outcome

(recorded when the cycle closes)
