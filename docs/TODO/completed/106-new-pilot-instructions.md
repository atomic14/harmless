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

Landed in three commits on `cycle/106` from base `fddcc95`, the first built
by the cycle orchestrator's worker, the rest directly in-session after Chris
dropped the orchestrator (2026-08-09) as too token-hungry for the job.

- `1b05afe` (m1) — `#help` gets `z-index: 30` over `#screen`'s 10; an open
  guide consumes the whole keyboard in `Game.handleInput` (only Escape/`?`
  close it) and unread taps drop at `endFrame`. `test/help-overlay.test.ts`
  pins the stylesheet ordering and the suppression through a headless Game.
- `9e25a60` (m2) — `CommanderData.briefingSeen` (edition number, 0 = never;
  `BRIEFING_VERSION` in `constants/commander.ts`, @rule
  onboarding.briefingVersion). `enterDocked` marks it BEFORE `station.dock`
  so an 'arrived' checkpoint persists it in the same act, then opens the
  briefing; `repairCommander` defaults absent/mistyped markers to 0, so
  imported and pre-marker saves are shown it once. Screens now register
  before the boot dock in the Game constructor. `dismissBriefing()` in
  `test/harness.ts` for tests about anything else;
  `test/briefing-onboarding.test.ts` pins boot/persistence/repair/H.
- `c0741a4` (m3) — briefing keys interpolate `boundKey()` off the binding
  table (`KEY` in `ui/screens.ts`, claimed as derived prose in
  `test/constants.test.ts`); a seventh page A FIGHT covers crosshair,
  overheat, missiles and what death does; the E.C.M. line says equip one
  first; FLY THERE states the AUTOSAVE_INTERVAL rhythm; README and the menu
  caption drop the stale "six-page" count and the README promises the
  automatic first briefing. `test/key-help.test.ts` holds journey coverage
  (every journey command quoted with its bound key) and the README promise.

Gates: full suite 3399/0, `npm run build` clean, `npm run elite-a` 494/0.
Every new gate was proven able to fail (auto-open disabled → 7 fails; repair
guard broken → 1; fresh default broken → 7; a journey quote removed → named).

Flown (dev server, disposable tab): a pre-marker save booted straight into
the briefing (page 1/7 with the ? and H lines); ESC left it; `?` painted the
guide OVER the open market and Escape closed guide-then-market in order; B
bought a tonne of food; N targeted Esesla; L launched; the launch checkpoint
carried `briefingSeen: 1`; reload resumed flight with no briefing and no
console errors.

Deviation: the verifier contract crash (PASS with findings) that killed the
first orchestrator run is recorded in the session, not fixed here — the
orchestrator is being retired instead.
