# 145 — Two kinds of work, two screens

**Kind:** design · **Severity:** low · **Size:** small · **Depends on:** 144 ·
**Blocks:** nothing · **Source:** Chris, 2026-08-13, on reading 144: *"I think we
might need to rationalise things - or seperate them - we have contracts and we
have missions. We can see our contracts on the contracts screen, but they are
also now on the missions screen... should they be there?"*

## Where we are

docs/TODO/144 put every standing order on one screen. That screen now overlaps
the bulletin board, and two smaller faults came with it.

**The board's ACCEPTED table is a second, independent rendering.** 144's plan
recorded a decision that both surfaces would render from `standingOrders`, so
there would be *"one description and two views"*. **That decision was never
implemented.** `renderContracts` still maps `c.contracts` itself
(`src/ui/screens.ts:1484`). So there are two renderings of one list, and they
can word a job differently.

**One thing has two names.** The menu row says `MISSIONS`. The screen heading
says `STANDING ORDERS`. `CLAUDE.md` forbids that: one word, one meaning.

**The board also has two names**, and it is the same fault. The menu row says
`CONTRACTS`, the heading says `LEESTI STATION BULLETIN BOARD`.

## The decision

**Chris's call, 2026-08-13: split them by kind.** `MISSIONS` holds the Navy
mission. `CONTRACTS` holds the work off a board — the offers and the ones she
signed for — and it opens in flight.

Do not relitigate this. What follows is how, not whether.

## What the triage found that the question did not report

**Contracts were already readable in flight, on the chart.** docs/TODO/140 marks
every contract destination with an amber diamond and prices it: `DUE IN 6 DAYS ·
3 DAYS AWAY`. So the flight screen adds the full list. It is not the first sight
of the work.

**`C` is not free in the cockpit.** It is the docking computer
(`src/game/controls.ts`). The only plain letters free in the flight table are X
and Z, and neither says "contracts".

**A shifted key is safe in FLIGHT, and only in flight.** 144 M6 found that a
shifted docked MENU ROW cannot work, because `data-key` carries no modifier.
That is a property of `dockedMenuHtml`, which is the one place in the codebase
that writes `data-key`. The `?` guide and the manual render read-only tables. So
the cockpit may bind a modifier; the station menu may not.

## What to do

### M1 — MISSIONS is the Navy's screen

`MissionsScreen` renders the Navy leg alone. It reads `missionLeg`
(`game/missions.ts`), which already returns the line, the destination, the fee
and the warning together.

Heading `NAVY MISSIONS`. Menu row `MISSIONS`. The empty case says
`The Navy has no orders for you.`

`renderMissions` stops taking `StandingOrder[]` and takes the leg. The table
becomes a short panel rather than a four-column table: one order needs no
columns.

### M2 — CONTRACTS opens in flight

`ContractsContext` gains one field:

```
/** a board is a station's. In flight there is nothing to sign. */
readonly atStation: boolean;
```

`renderContracts` then draws the ACCEPTED table always, and the WORK ON OFFER
table only at a station. `ContractsScreen.input` ignores the accept key when
`atStation` is false, so a key cannot sign for a job that is not on offer.

Bind `{ key: 'KeyC', shift: true, command: 'openContracts' }` in the flight
table, above nothing — `KeyC` unshifted is the docking computer and stays.
`openContracts` becomes a shared command, so it moves to the *"shared between
the menu and the cockpit"* block of `Command`.

It opens through `openReadingScreen`, which 144 M2 built for exactly this: it
releases mouse flight and records which base state to return to.

### M3 — one name per screen

- The missions heading is `NAVY MISSIONS`; its row stays `MISSIONS`.
- The contracts heading becomes `CONTRACTS`. The offers table's own header
  carries the station: `WORK ON OFFER AT LEESTI`. The name of the screen and
  the name of the row are then the same word.
- `COMMAND_HELP.openMissions.what` drops the contracts from its sentence.

The docked summary line does NOT change. It still names every kind the commander
holds, which is invariant 16 and the whole of GitHub #27.

### M4 — the ACCEPTED table renders from the reader

144's unimplemented decision, done. `renderContracts` builds its ACCEPTED rows
from `standingOrders`, filtered to the contract kind, so the board and any
future surface word one job the same way.

## Decisions already made

- **Split by kind.** Chris, above.
- **The docked summary keeps both kinds.** Invariant 16 is unchanged by this
  item. Two screens do not entitle the one line to drop one of them.
- **⇧C in flight.** Stated as an assumption rather than asked, because the
  alternative is a letter that means nothing. C stays the docking computer.

## Open questions, and the answers

**1. Does invariant 16 still hold with two screens?** Yes, and more cleanly. The
rule is that a standing order HAS a screen, not that all orders share one.
Contracts have theirs, missions have theirs, and the summary still drops
neither. No invariant text changes.

**2. What happens to `standingOrders`?** It stays. It is the docked summary's
reader, the chart's destination set through `orderDestinations`, and now M4's
ACCEPTED rows. Only the missions screen stops using it.

**3. Should the offers table show at a rock hermit?** No, and it already does
not — a hermit opens the market and nothing else (docs/TODO/143). `atStation` is
about the SCREEN's two states, and the hermit reaches neither.

## Watch out for

- **`openContracts` gains a second mode.** `test/key-help.test.ts` asserts every
  docked binding is a row or a keyline entry. A command bound in two modes is
  already normal (`openChart`, `openStatus`), so the menu label is unaffected.
- **The offers list in flight is stale state.** `state.contractOffers` holds the
  last station's board. M2 must not draw it, or a pilot reads work she cannot
  take.
- **`accept` must be refused, not hidden.** A hidden table with a live key is
  the "dead control that looks alive" failure `dockedMenuHtml` exists to stop.
- **The `?` guide gains a flight row.** ⇧C must appear in it, and in the
  README's flight table, or `test/key-help.test.ts` fails. 144 M2 hit exactly
  this and it caught the omission.
- **`test/standing-orders.test.ts` asserts the screen draws every order the
  reader returns.** That assertion is about the MISSIONS screen and stops being
  true. Move it to the contracts screen, where the claim now lives.

## Verification

**The gates always run**, and they are `npm run check`. This item changes
screens, a binding table and prose. It changes no ship, no combat rule and no
price, so docs/PROCESS.md's tier table asks for nothing more.

**New gates, each shown to fail:**

1. The missions screen draws the Navy leg and no contract.
2. The contracts screen draws the accepted work in flight.
3. ...and draws no offers there.
4. ...and refuses the accept key there.
5. ⇧C reaches the contracts screen in flight; plain C is still the docking
   computer.
6. The ACCEPTED rows and the docked summary word one job the same way.

**Flown in the browser** before the item closes, as 144 M6 was. The saves in
that browser are real, so the page switches to the harness namespace first
(invariant 3).

**No sampled number drives a decision here**, so the two-sample-size rule does
not apply.

## What landed

All four milestones, on 2026-08-13. `npm run check` passes. Flown in the
browser, and every surface below was read on screen.

**M1 — MISSIONS is the Navy's alone.** It reads `missionLeg`, so one leg needs
no table. Heading `NAVY MISSIONS`; the empty case says the Navy has no orders
for her. The test asserts the split rather than assuming it: a contract held at
the same time must NOT appear.

**M2 — CONTRACTS opens in flight, on ⇧C.** `atStation` splits the screen. The
ACCEPTED half travels; the board does not, and the accept key is refused rather
than hidden.

**M3 — one name each.** It was mostly carried by M2, because the flight case
forced the heading: `LEESTI STATION BULLETIN BOARD` could not be the name of a
screen opened between two stars.

**M4 — one home for the days-left sum**, and it is smaller than this plan said.

## What the milestones found that the plan did not have

**1. M4's premise was wrong, and the plan was the thing at fault.** It said the
board was *"a second, independent rendering"* that could word a job differently.
It could not. `renderContracts` and `game/orders.ts` both call
`describeContract`, which has been the one home of a job's words all along. What
was genuinely written twice is the DAYS-LEFT SUBTRACTION, and that is what
moved. The milestone is worth having for that alone — docs/TODO/140 M4 records
what a deadline measured from the wrong day costs — but the claim that made it
sound urgent was not true.

**2. The accept-key refusal had no gate.** The test drew the screen and checked
the button was absent. It never pressed the key. Proving each gate could fail is
what caught it: breaking the refusal changed nothing that any assertion read.
The assertion that drives `ContractsScreen.input` was written afterwards.

**3. `controls.ts` crossed the size ceiling three times running**, because the
click-path rule was written out at each binding that obeys it. It has ONE home
now, in `ui/key-help.ts` beside `dockedMenuHtml` — which is the function the
rule is about, and the one place in the codebase that writes `data-key`. That is
better placement, not a smaller comment.

**4. `ordersSummary` had lost its doc comment.** 144 M4 inserted two functions
above it, and the comment stayed where it was — so `orderDestinations` carried
the reasoning for the summary, and the function GitHub #27 is actually about had
none.

**5. `ContractOrder` carries its `job`.** The table needs two facts no summary
does: whether the run is illicit, and how far along a bounty is. A field for
each would put a second decision about what "illicit" MEANS next to the one in
`renderContracts`.

## Verified in the browser, 2026-08-13

Docked at Leesti with 16 kills, a beam laser, a courier job and a part-finished
bounty:

1. `R` opens NAVY MISSIONS. It carries the order, the destination, the fee and
   the gun warning — and **no contract**.
2. `C` at the station opens CONTRACTS, with `WORK ON OFFER AT LEESTI` above the
   two accepted jobs.
3. `⇧C` in flight opens the same screen with the ACCEPTED table only: no board,
   no ACCEPT control, and a keyline that reads `ESC EXIT` alone.
4. The bounty's progress reads `Destroy 5 pirates around RIINUS (2/5)`, and the
   tighter deadline is the first row.

**One thing the browser session found that is not a game defect.** A tab in a
background window has `document.hidden`, so `requestAnimationFrame` never fires
and no key does anything. The docking tunnel then never finishes, and it holds
input for as long as it runs. Both are correct behaviour; a verification session
has to drive `Game.step` itself and let the tunnel finish before pressing
anything.

**No save was put at risk.** The page was switched to the harness namespace
(invariant 3) before anything docked, and the seven player keys were untouched.
