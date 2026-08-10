# 121 — The test mode that has no door

**Kind:** feature / tooling · **Severity:** medium · **Size:** medium (three
milestones) · **Depends on:** none · **GitHub:** #18

## Where we are

**Most of what #18 asks for is already built and cannot be switched on.**

`GameState.cheat` is a real field with a real home (`state.ts:95-103`), saved
and restored like everything else (`snapshot.ts:164-165`, `snapshot.ts:314`
validates it, `persistence.ts:144` and `:254` carry it), threaded into the
outfitters as a `TradeContext` field (`screens/trade.ts:39-40`), and honoured
there: `equipRows` lifts the tech-level lock (`screens.ts:328`), every price
reads FREE (`screens.ts:350`), purchases deduct nothing (`screens/trade.ts:240`),
and the screen prints an amber banner saying so (`screens.ts:358`). There is a
passing test that fits a galactic drive with no money (`trade.test.ts:186`).

Nothing in the shipped game sets it to `true`. It was `window.__cheat`; the
globals purge moved the flag into state and deleted the switch without building
a replacement — `console.ts:12-15` names it in the list of five flags that went,
and `state.ts:99-101` records why the field is where it is. So `cheat` has been
dead code with a live test since that commit.

That inverts the shape of this item. The mode is not the work. **The door is the
work**, and the rest is the extra levers Chris asked for beyond equipment.

The relevant furniture: the docked binding table is `controls.ts:213-245`, in
MENU ORDER because `ui/key-help.ts` builds the station menu's rows and the
keyline from it (`key-help.ts:178-195`); `command-help.ts` is
`Record<Command, CommandHelp>`, so a new command does not compile until somebody
has written down what it does. Free letters on the docked table: A, F, J, K, O,
R, U, V, W, Y.

## What to do

### M1 — the door, and the mark it leaves

A `TestModeScreen` in `game/screens/`, opened from the station menu, owning its
own rendering, keys and state behind the screen interface (invariant 13). Its
first row toggles `GameState.cheat`, which lights everything listed above with
no further work.

Bound to **⇧T** — beside `T` TRAINING, because the simulator is the other thing
on that menu that is not the career, and a shifted entry must come first for its
key (`controls.ts:122-124`). It gets a `keyline` caption rather than a `menu`
row: the keyline is for keys that work here but are not controls you arrow onto
(`command-help.ts:47-51`), which is the right shelf for a development door.

**The career is marked.** `CommanderData` gains `tested: boolean` — a one-way
latch set the first time test mode is enabled in that career, read `?? false`
the way `disrepute` is (`world-step.ts:568`), so old saves load unchanged. The
status screen prints it, and it does not clear when the toggle goes off. The
reason is specific: docs/TODO/96 closed on the understanding that *"what plays
wrong becomes a GitHub issue"*, and a bug report from a career that spent an
afternoon with free equipment fitted is a different report. A live toggle can be
switched off before a screenshot; a latch cannot.

### M2 — the commander levers

Rows on the same screen, each applying an existing rule rather than a new one,
and every one of them refusing to act unless `cheat` is on:

- **FILL TANK / MAX MISSILES** — `MAX_FUEL`, `MAX_MISSILES`
  (`constants/commander.ts`), the same values `shop.ts:14` already quotes.
- **GRANT CREDITS** — a fixed sum in tenths (invariant 8), named in
  `constants/` beside the shop's prices, not typed in by the player. A number
  entry screen is a second typed-input flow for one development lever.
- **LEGAL STATUS** — cycles Clean → Offender → Fugitive using `LEGAL_NAMES`
  and the `CLEAN`/`OFFENDER`/`FUGITIVE` constants (`constants/law.ts:9-13`).
  This is the lever 122 and 123 are tested through: `isHostileToPlayer`
  (`npc.ts:297-309`) branches on exactly this number for police and hunters.
- **CHARACTER** — cycles the disrepute rungs from `constants/character.ts`.
  96 shipped `DISREPUTE_HEAT`, `COURTESY_RATE` and `HERMIT_FAVOUR` as
  **unflown starting values** and closed on the campaign rather than a cockpit.
  This row is what lets somebody fly them, which is the debt that plan left.

### M3 — the flight levers

Two things #18 needs that the station menu cannot give:

- **SPAWN** — put a chosen ship off your nose. Reuses `World.spawn` and the
  placement vocabulary in `spawning.ts`; all chance goes through the seeded
  stream (`game/rng.ts`, invariant 11), never `Math.random`.
- **JUMP ANYWHERE** — the galactic chart stops refusing a target for range or
  fuel while `cheat` is on. The flag is read where the refusal is decided, not
  copied into the chart screen.

Both join `NOT_IN_THE_SIMULATOR` (`controls.ts:176-198`). An exercise that can
have a ship dropped into it is not an exercise, and every entry in that list is
there for that reason.

**M3 is the milestone to cut** if the first two land and the appetite is gone —
it is the only one that adds behaviour to the cockpit rather than the station.

## Decisions already made

- **Docked menu, and more than equipment** (Chris, 2026-08-10) — the door is on
  the station menu, and test mode grants fuel, credits, legal status, character
  and a spawn as well as the free outfitting that already works.
- **`cheat` keeps its name and its home.** It is the field the outfitters
  already read and the save already carries; renaming it to `testMode` would
  rewrite four files and a passing test to buy a word.
- **The mode is a property of the SAVE, not of the tab.** It already persists,
  deliberately: `state.ts:99-101` records that as an ambient global *"a reload
  changed the game"*. Keep that.
- **No numeric entry.** Every lever is a toggle, a cycle or a fixed grant.
  Typing values in is a screen's worth of work for a development affordance.
- **Nothing here bypasses a rule quietly.** Each lever writes commander or
  world state through the normal fields, so the world step, the save and the
  campaign harness see a legitimate — if implausible — commander. No lever
  branches inside a game rule.

## Open questions — answered here

- **Does test mode disable the combat rating or the campaign?** No. The rating
  is a record of what happened and the harness builds its own state; a career
  that cheated is marked, not amputated. Filtering test careers out of anything
  is a second rule with no reported need.
- **Should the cockpit show that test mode is on?** The status screen (M1)
  answers it, and the outfitters already shout it in amber. A permanent cockpit
  badge is HUD real estate spent on a mode only one person uses — deferred
  unless a screenshot turns up that needed it.
- **Why not the `?` guide's own panel instead of a screen?** The guide renders
  bindings; it has no state and no rows that DO anything (`key-help.ts` is
  "strings in, strings out"). Levers need a screen.

## Watch out for

- **Invariant 9 makes a new binding touch four surfaces.** `command-help.ts`
  will not compile without a caption; `key-help.ts:guideSections` must place it
  in exactly one section and `test/key-help.test.ts` asserts precisely that; the
  README's table is the one surface still written by hand and the same test
  holds it in both directions. Budget for all four.
- **Invariant 12 is the whole reason this item exists.** The temptation is a
  URL parameter or a console setter, because that is a smaller diff. It is the
  exact thing `console.ts:12-25` was written to stop growing back "one
  convenience at a time". The door is a binding and a screen.
- **`screens/trade.ts` is 278 lines and `screens.ts` is over a thousand.** The
  new screen is a new file, not a section of either.
- **A new `CommanderData` field flows into the save.** `SAVE_RECORD_VERSION`
  (`save-file.ts:22`) covers the record shape, not the commander; follow
  `disrepute`'s precedent — optional at the read, defaulted, no version bump —
  and check `snapshot.ts:265-273` still validates what it validated.
- **Do not let the levers become rules.** `equipmentOwned`, `fuelNeeded`,
  `offenceFor` and the character ladder already exist. The screen calls them.

## Verification

Tier: unit tests per milestone, because every lever is a pure write to state
that a headless test can make and read back.

- **M1** — `test/trade.test.ts` already proves what `cheat === true` buys; the
  new test is that the door SETS it: drive the screen's toggle through the
  screen interface and assert `state.cheat` flips, that `commander.tested`
  latches true, and that toggling back off leaves `tested` true. Assert an old
  save (no `tested` key) loads and reads false.
- **M1** — `test/key-help.test.ts` should fail before the README row is added.
  That is the gate proving itself; note it in the commit rather than working
  around it.
- **M2** — one test per lever, asserting the commander afterwards against the
  constant that defines the ceiling (`MAX_FUEL`, `MAX_MISSILES`, `FUGITIVE`),
  not against a literal. Assert every lever is a no-op with `cheat === false`.
- **M2** — the legal-status lever proves itself against a rule rather than
  itself: set Fugitive, then assert `isHostileToPlayer(policeShip, status)` is
  true where it was false. That is the behaviour the lever exists for.
- **M3** — a spawned ship appears in `world.npcs` with the requested role; a
  chart target out of fuel range is accepted with `cheat` on and refused with it
  off; both flight commands are absent from `BINDINGS.simulator`.
- Prove each gate can fail by reverting the lever it guards, one at a time.
- `npm run check` at the end of each milestone; commit per milestone.
