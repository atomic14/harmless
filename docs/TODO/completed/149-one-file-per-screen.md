# 149 — One file per screen

**Kind:** refactor · **Severity:** low · **Size:** large · **Depends on:** 148 ·
**Blocks:** nothing · **Source:** Chris, 2026-08-14, after the exemption audit:
*"3 yes - go ahead and do the split"*.

## Where we are

`src/ui/screens.ts` is **1,954 lines** — the second largest file in the project
— and its exemption is the weakest entry in `tools/sizes.mjs`:

> one render function per screen; they share layout helpers and nothing else

That sentence is the argument FOR splitting, written as the argument against
one. It says the parts are independent and share only helpers, which is the
precondition for a clean split. The audit measured it: **25 exported render
functions, 37 exports, 24 non-exported helpers.** No coupling is claimed
anywhere in the entry, because there is none to claim.

Compare a good entry — `game/brain-names.ts` argued that its halves are the two
directions of one bijection, so splitting them puts one map in two files. That
is a coupling. `screens.ts` has never offered one.

## What the triage found that the audit did not

**The consumers are already one per screen.** Fourteen files under
`src/game/screens/` import from `ui/screens.ts`, and each takes exactly its own
render function: `status.ts` takes `renderStatus`, `contracts.ts` takes
`renderContracts`, `chart.ts` takes the eight chart symbols. The split this item
performs is one the callers have been describing all along.

**`show()` is the only real shared thing.** Every render function ends in it. It
is 13 lines, it owns the `screen-open` class and the `wide` toggle, and it sits
on top of a four-function DOM seam (`el`, `body`, `maybeById`, `hideScreen`)
that copes with there being no document at all. That seam is what makes every
screen paintable headlessly, and it must not be copied.

**The blast radius is 25 importers**, all taking small coherent sets, so the
repointing is mechanical rather than delicate.

## What to do

### M1 — `ui/screen-shell.ts` takes the DOM seam

`show`, `hideScreen`, `el`, `body`, `maybeById`. Every screen module imports it.
It is extracted FIRST so the later milestones have somewhere to import from, and
so no module ends up a hub that others reach through.

### M2 — `ui/charts.ts` takes the maps

The biggest block, ~680 lines: `nearestSystem`, `Journey`, `journey`,
`daysTerm`, `contractTerm`, `drawContractMarks`, `drawLanes`, `laneSummary*`,
`drawPriceTells`, `renderChart`, `chartKeyline`, `drawChart`,
`renderLocalChart`, `drawLocalChart`, `renderMarketEstimate`,
`chartCoordsFromClick`, `localCoordsFromClick`.

It is a distinct MEDIUM as well as a distinct subject: this is the only code in
the file that paints a canvas, and everything else writes HTML.

**It will still be over 400 after the move.** Do not pre-judge the second cut —
land M2, measure, and decide with a real number rather than an estimate. The
candidate seam is the overlay painters (`drawContractMarks`, `drawLanes`,
`drawPriceTells` and the lane summary) against the two chart screens.

### M3 — `ui/screens-trainer.ts` takes the combat trainer

`simSetupRow`, `reservedNotes`, `renderCombatSimSetup`, `opening`, `bySource`,
`renderCombatSimReport`, `compareColumn`, `renderCombatSimCompare` — ~315 lines,
and its three helpers are used by nothing else. One consumer:
`game/screens/combat-sim.ts`.

### M4 — `ui/screens-career.ts` takes the commander's lifecycle

`SavesPending`, `whoLine`, `renderSaves`, `renderSavePrompt`, `renderNaming`,
`renderNewCommander`, `renderNewGameConfirm`, `renderQuit`, `renderTestMode`,
`renderGameOver` — ~320 lines. These are the screens about the CAREER rather
than about the flight: naming one, putting one down, giving up a flight, and
being destroyed.

### M5 — `ui/screens-trade.ts` takes the market and the shipyard

`renderMarket`, `EquipRow`, `equipRows`, `renderEquip` — ~130 lines, one
consumer (`game/screens/trade.ts`) and three tests.

### M6 — `ui/briefing.ts` takes the briefing

`KEY`, `BRIEFING`, `BRIEFING_PAGES`, `renderBriefing` — ~130 lines. It is the
one block that is DATA plus its renderer, and the data is player-facing prose
that `CLAUDE.md`'s style rules deliberately exclude.

**What is left in `ui/screens.ts`** is the station: `renderDockedMenu`,
`renderStatus`, `renderMissions`, `renderContracts`, `renderSystemData`,
`renderSurvivors`, `portraitUrl`. Roughly 300 lines.

## Decisions already made

- **Do the split** (Chris, 2026-08-14).
- **No prose is cut to make any file fit.** docs/TODO/148 is the precedent and
  the reason the ceiling message now says so.
- **Every comment travels with the code it explains**, as in 148.

## Open questions, and the answers

**1. Why not one file per screen — 25 of them?** The unit that has a reader is
the SUBJECT, not the function. Twenty-five 30-line files would trade one
oversized file for twenty-five import lines and a directory nobody can scan.
`game/screens/` is per screen because each is a class with state; a render
function is not.

**2. Does `ui/screens.ts` keep its name?** Yes. It keeps the station screens,
which is what a reader looking for "the screens" most often wants, and it means
14 of the 25 importers do not move at all.

**3. Does the exemption come off?** Yes, and that is the point of the item. If
`charts.ts` still needs one after M2's second cut, it earns one honestly, with a
coupling argument this entry never had.

## Watch out for

- **`show()` must not be copied.** One `screen-open` class, one `wide` toggle.
  Two copies is the exact failure the size gate exists to prevent.
- **`describeContract` and `distanceTenths` are re-exported** from this file
  because the charts were their heaviest user. Those re-exports move with the
  charts, and `test/contract-eta.test.ts` reads one of them.
- **`test/screen-capture.ts`** drives painters headlessly through `inert-dom`.
  Every moved painter must still be inert with no document.
- **`tools/sizes.mjs` and `test/constants.test.ts`** both name
  `ui/screens.ts` by path. The constants whitelist lists `KEY`, `BRIEFING`,
  `BRIEFING_PAGES` and `LEVERS_OFF`, which land in three different files.

## Verification

**The gates always run**, and they are `npm run check`. This item moves code
between files and changes no rule, so docs/PROCESS.md's tier table asks for
nothing more. `npm run portability` runs too, because the module graph moves —
`ui/` is PLATFORM, so every new file must stay inside that bucket.

**A refactor's gate is that nothing needed a new test.** The existing suite is
the proof: `ui`, `elapsed-day`, `chart-days`, `contract-eta`, `trade`,
`economy`, `consigned-hold`, `contracts-screen`, `standing-orders` and
`key-help` all paint through these functions and must pass untouched, at the
same assertion count.

**And the count that says it worked:** every file under 400 lines with no new
`ALLOWED` entry, or one entry that names a coupling.

## What landed

All six milestones, on 2026-08-14. `npm run check` passes.
`npm run portability` is unchanged. **The exemption is gone.**

| file | lines |
| --- | --- |
| `ui/screens-career.ts` | 340 |
| `ui/screens-trainer.ts` | 305 |
| `ui/screens.ts` | **298** (was 1,954) |
| `ui/chart-local.ts` | 253 |
| `ui/chart-overlays.ts` | 176 |
| `ui/chart-galactic.ts` | 172 |
| `ui/briefing.ts` | 154 |
| `ui/screens-trade.ts` | 145 |
| `ui/chart-readout.ts` | 144 |
| `ui/screen-shell.ts` | 51 |
| `ui/reserved-note.ts` | 32 |
| `ui/portrait.ts` | 29 |

`npm run sizes` reports **30** files over the limit where it reported 32 that
morning: five dead entries removed by the audit, and this one split.

**No prose was cut.** Of 349 comment lines below the original header, **340
moved verbatim**. The nine that did not are the two module headers rewritten on
purpose and the dead re-export deleted in M2.

## What the milestones found that the plan did not have

**1. The charts were four subjects, not one.** M2 said to land the move and
measure before deciding the second cut, and that was the right instruction: the
moved block came to **719 lines** and the gate said SPLIT. The honest
decomposition is which star is under the cursor, what is painted over the stars,
and the two maps — because **the two charts are two SCREENS**, with two
projections, two readouts and two click surfaces. Had the plan guessed, it would
have guessed one file and been wrong.

**2. A dead re-export with a false justification.** `export { distanceTenths }`
claimed to exist because *"every caller already reaches for it from this
module"*. No caller does — all eleven import it from `galaxy/navigation.ts`
directly. Deleted rather than moved.

**3. Three helpers had two unrelated readers each.** `portraitUrl` (the chart
readout and the DATA ON page), `reservedNotes` (the trainer's setup panel and
the test-mode screen), and `chartKeyline` (both charts). Each got its own home
rather than making one consumer a place the other reaches through. That is the
same rule the whole item is about, applied one level down.

**4. Six tests named a file by path**, and every one was a source SCAN rather
than an import — the class of test no compiler can follow. Five were repointed.
The sixth came out stronger: `descriptions.test.ts` checked two named files for
a private HTML escaper, and it reads the whole of `src/ui/` now. Naming the
files would be a list to keep in step with a directory, which is the exact shape
of failure that check exists to catch.

**5. The mechanical extraction was the hard part**, not the design. Two attempts
at slicing by pattern mis-cut — once on `{ x: number; y: number }` in a
parameter list, once on an arrow-function `const` that ends in `;` rather than
`}`. Both were caught by asserting brace balance on every extracted block before
writing it, and the third attempt partitioned the file at declaration boundaries
instead, which cannot over-run by construction. **A refactor script needs its
own gate**, and brace balance is a cheap one.

## What this leaves

`game.ts` is 2,524 lines and `npc.ts` 1,568. Both carry honest `DEBT:` entries
naming what they are waiting for. Neither was touched here, and each needs a
plan of its own.
