# 144 — A standing order has nowhere to live

**Kind:** defect · **Severity:** medium · **Size:** medium · **Depends on:**
nothing · **Blocks:** nothing · **GitHub:** #27 — *"I think we actually need a
screen - 'Missions' that would let us put this information somewhere. But also
it feels like an important thing like this should not dissappear."*

A **standing order** is an obligation that outlives the moment it is announced.
The game has two kinds today: a signed contract, and the Navy mission. The term
is this item's, and the rest of the plan uses it.

## Where we are

The issue reports the code correctly. Every claim below is read off the source.

**The one amber line under the station header holds one thing at a time.**
`Station.missionText` (`src/game/station.ts:294`) returns the first contract
when the commander holds one. It reaches `missionHeadline` only when she holds
none. So two contracts hide the Navy mission completely.

**That line is the only place the target system is ever written.**
`missionHeadline` (`src/game/missions.ts:180`) names the system. The docked menu
is its only consumer (`src/game/game.ts:960`, `:2007`, `:2058`).

**The transmission names no system.** `INCOMING NAVY TRANSMISSION` runs for 5
seconds at the dock where the mission fires (`src/game/station.ts:190`). It is
said one time. It carries no target.

**The gun warning rides on the same contested line.** `constrictorWarning`
(`src/game/missions.ts:172`) tells a commander that her fitted laser scores 3
against the target and does nothing. It is said for 8 seconds at the dock, and
after that it lives only as a suffix on `missionHeadline`. A contract takes the
warning down with the order.

## What the triage found that the issue did not report

**A contract has a durable home. The Navy mission has none.** `renderContracts`
draws an ACCEPTED table under the work on offer (`src/ui/screens.ts:1441`). A
contract that wins the one line is therefore written in a second place. The Navy
mission is the only standing order in the game with no screen at all.

**That home is a station, and it closes in flight.** `openContracts` is bound in
the docked table only (`src/game/controls.ts:270`). A rock hermit opens the
market and nothing else (docs/TODO/143). So in flight neither kind of standing
order is readable.

**Both charts mark a contract destination and not the Navy target.**
`contractDestinations` (`src/game/contract-eta.ts:33`) feeds `drawContractMarks`
on the galactic chart and on the local one (`src/ui/screens.ts:1037`, `:1182`).
docs/TODO/140 built that marker and its verdict line. The chart is where a pilot
picks a destination. The Constrictor's system carries no mark on it.

**The census of once-only lines is small.** I read every `say(...)` call in
`station.ts`, `world-step.ts` and `game.ts`. Two of them announce a standing
order: the Navy briefing, and `NAVY: COURIER RUN — EXPECT THARGOID
INTERFERENCE` (`src/game/station.ts:200`). Every other line reports an event
that is over — `COLLISION`, `ENERGY LOW`, `PIRATE SIGNATURES DETECTED`,
`SCOOPED 1t`. Those are correct as transient lines, and this item must not touch
them. So the second half of the issue has a small blast radius today. It is a
rule for what comes next, not a sweep.

**A message may not spell a key out.** Invariant 9 holds, and
`test/key-prose.test.ts` is the gate. `src/game/prompts.ts:14` gives the
sanctioned route: the rule carries a `Command`, and the edge renders the key
through `boundKey`.

## What to do

### M1 — one reader for the standing orders

New pure module `src/game/orders.ts`:

```
export type OrderKind = 'navy' | 'contract';

export interface StandingOrder {
  readonly kind: OrderKind;
  /** one line, upper case, for a screen row or a summary */
  readonly line: string;
  /** where it sends her, or null */
  readonly destination: number | null;
  /** days to the deadline, or null when the order has none */
  readonly daysLeft: number | null;
  readonly reward: number | null;
}

export function standingOrders(
  c: CommanderData, systems: readonly StarSystem[],
): StandingOrder[];

export function ordersSummary(orders: readonly StandingOrder[]): string;
```

It restates no rule. A contract row reads through `describeContract`
(`game/contract-offers.ts`). The Navy row reads through `missionHeadline`
(`game/missions.ts`). Both stay the one home of their own words.

The Navy mission sorts first, and the contracts follow by deadline. The reason
is not taste: the board re-offers work every day, and the Navy briefs a
commander one time.

`ordersSummary` is the docked menu's line. It names every kind it holds, and it
counts what it does not print. `NAVY MISSION · CARRY SEALED DATA TO ERLAZA —
6 DAYS (+1 MORE)` is the reported case, with nothing hidden.

### M2 — the MISSIONS screen

Model it on `src/game/screens/status.ts`. That file's header says it is the
whole `Screen` contract and nothing else, which is what this screen needs.

1. `ScreenId` gains `'missions'` (`src/ui/screen-host.ts:23`).
2. `src/game/screens/missions.ts` holds the screen. Escape returns.
3. `renderMissions` joins the render functions in `src/ui/screens.ts`.
4. `Command` gains `openMissions` (`src/game/controls.ts:52`).
5. `COMMAND_HELP` gains the row label `MISSIONS`
   (`src/game/command-help.ts`).

One table: ORDER, DESTINATION, TIME LEFT, PAYS. The Navy row prints `—` under
TIME LEFT, because the mission has no deadline. The stage 1 row carries
`constrictorWarning` under it, in `--hud-amber`, which is the colour this file
already spends on a warning. Coin no new colour.

**The screen exists when it is empty**, and it says `No standing orders.` A
screen that hides itself is a screen a player learns not to open.

Bind it in BOTH tables:

```
{ key: 'KeyI', shift: true, command: 'openMissions' },
{ key: 'KeyI', command: 'openStatus' },
```

The shifted entry comes first. `src/game/controls.ts:279` records why: the plain
entry is the fallback, and it eats the tap from the front.

### M3 — the summary hides nothing, and the briefing points at the screen

`Station.missionText` becomes `ordersSummary(standingOrders(c, systems))`. The
first-contract-wins branch goes. Nothing else calls it.

Then give a message a way to name a key. The message event gains one optional
field:

```
| { kind: 'message'; text: string; seconds: number; queued?: boolean;
    command?: Command }
```

`game.ts` renders the key at the edge, through `boundKey`, where it already
renders four other keys (`src/game/game.ts:682`, `:1138`, `:1757`, `:2077`).
`station.ts` names `openMissions` and never a letter, so invariant 9 holds and
`test/key-prose.test.ts` stays green.

Both Navy lines carry the command. `INCOMING NAVY TRANSMISSION` becomes a line
that tells the commander where to read the rest of it.

### M4 — the chart marks the Navy target

Add one reader to `src/game/missions.ts`:

```
export function missionDestination(c: CommanderData): number | null;
```

It returns `m.targetIndex` at stage 1 and at stage 3. It returns null elsewhere.

Add `missionVerdict` beside `contractVerdict` in `src/game/contract-eta.ts`.
That file already owns the words and the colour for a marked system, and it
paints nothing, so the shape fits. The Navy line reads
`NAVY MISSION · 3 DAYS AWAY`. It has no deadline, so it is never red.

Both painters then mark the union of the two destination sets. **A contract
answers first when one system carries both**, because a contract has a deadline
and the mission does not. Write that rule where the painter asks.

### M5 — the rule, and a gate that can fail

Append invariant 16 to `docs/INVARIANTS.md`. Never renumber the other 15.

> **16. A standing order has a screen.** A standing order is an obligation that
> outlives the moment it is announced. A console line may announce one. That
> line is never the only place the order is written. A surface that carries
> orders shows every kind of order it holds. It never drops one kind for
> another.

`test/standing-orders.test.ts` is the gate. It asserts behaviour, and it drives
the real mission machine rather than a copy:

1. `stepMissionAtDock` to stage 1. `standingOrders` names the target system.
2. `stepMissionAtDock` to stage 3. `standingOrders` names the target system.
3. A commander with two contracts and a stage 1 mission. `ordersSummary` names
   both kinds, and the count covers the rest.
4. Every `MissionEvent` that opens a standing order leaves a matching order
   behind it.
5. `renderMissions` draws a row for every order the reader returns.

## Decisions already made

- **The screen is Chris's call, and he made it.** *"I think we actually need a
  screen - 'Missions'"*. Do not relitigate the shape.
- **The bulletin board keeps its ACCEPTED table.** Both surfaces render from
  `standingOrders`, so there is one description and two views of it. The board
  is where a commander signs for work, and a board that hides what she already
  holds is the worse screen. This is two views, not two rules.
- **The playtest reports; it does not block** (Chris, 2026-08-11).

## Open questions, and the answers

**1. Which key?** ⇧I, in both tables. **This answer was wrong, and M6 has the
reason.** `I` is the only screen key already bound
in both, and standing orders are the second half of what `openStatus` reports. R
is the one plain letter free in both tables, and it carries no meaning at all.
The shift is not hidden, because the docked menu row prints the label
(`ui/key-help.ts:193`).

**2. Docked only, or in flight as well?** Both. The failure the issue reports
happens in flight, and the pilot is 40 light years from the station that briefed
her.

**3. Does the screen replace the amber line?** No. The line is the summary, and
the screen is the detail. M1 makes them one reader, so they cannot disagree.

**4. Does this add a constant?** No. No number moves. So
`npm run generate:constants` is not needed, and `constants:check` has nothing to
say.

## Watch out for

- **The shifted binding must come first.** `src/game/controls.ts:279` states the
  failure. Put ⇧I above the plain I in both tables.
- **`test/key-help.test.ts`** asserts that every docked binding has a menu label
  or a keyline entry. `openMissions` needs exactly one of the two.
- **`test/game.test.ts`** opens every id in the `ScreenId` union. A new id with
  no registered screen throws.
- **`ui/screens.ts` is already over the size limit**, with a stated reason at
  `tools/sizes.mjs:53`: one render function per screen. `renderMissions` fits
  that reason. A shared helper that is not a render function does not.
- **No parameter properties** in a screen. `src/ui/screen-host.ts:12` gives the
  reason: the test run strips types, and it rejects them.
- **`missionHeadline` keeps its callers and its tests.** `test/missions.test.ts`
  pins it at lines 85, 87, 111 and 113. M1 reads it; M1 does not replace it.
- **The Navy target can equal a contract destination.** `contractDestinations`
  is a Set for the same reason. M4 says which verdict wins.
- **The empty case.** Stage 0, stage 2 and stage 4 give no Navy order, and stage
  2 is the gap between the kill and the next briefing. The screen and the
  summary must both be correct there.

## Verification

**The gates always run, and they are the whole tier.** `npm run check`. This
item changes screens, one reader, prose and a binding table. It changes no ship,
no combat rule and no price. The tier table in docs/PROCESS.md asks for nothing
beyond the gates.

**The new gate must be shown to fail.** Break each protected rule for a moment,
one at a time:

1. Restore the first-contract-wins branch in `missionText`. Assertion 3 fails.
2. Return `[]` from `standingOrders` at stage 3. Assertion 2 fails.
3. Drop the Navy row from `renderMissions`. Assertion 5 fails.

**No sampled number drives a decision here.** So the two-sample-size rule does
not apply to this item. Say so in the outcome rather than skip it silently.

**What needs a pilot rather than a probe.** Two questions no measurement
reaches:

1. Does the summary line read well when it carries three things at once?
2. Is ⇧I a key Chris finds, or does the screen need a plain letter?

## What landed

All five milestones, on 2026-08-13. `npm run check` passes at **4,476
assertions**. `npm run build` is clean.

**M1 — one reader.** `game/orders.ts` asks the two kinds of order the same
question for the first time. A contract's words still come from
`describeContract` and the mission's from `missionOrderLine`. The Navy sorts
above the work, and the contracts sort by deadline.

**M2 — the screen.** At the station and in the cockpit. It draws what the reader
returns, and it exists when it is empty. It shipped on ⇧I; M6 below is why the
key is `R`.

**M3 — the summary and the briefing.** `Station.missionText` is
`ordersSummary(standingOrders(...))`. A `StationEvent` message may carry a
`Command`, and the edge renders it as `— R MISSIONS`.

**M4 — the charts.** `orderDestinations` is the union of the two kinds.
`orderVerdict` prices the Navy leg in the same words as a contract, and a
contract answers first where one world carries both.

**M5 — the rule.** Invariant 16, and two gates that hold it as behaviour.

## What the milestones found that the plan did not have

**1. The gun warning deleted the transmission it explains.** M3's test found it.
`INCOMING NAVY TRANSMISSION` and the warning were both pushed with `say`, in the
same frame, and `showMessage` TAKES the console. So a commander with the wrong
gun never saw that the Navy had called at all — the one line she did get was the
warning, with no announcement in front of it. It is queued now, which is the
rule `session.ts` already states for a line that explains another.
`test/key-prose.test.ts` could not have seen it, because neither line spells a
key: this was one console line deleting another, and nothing had ever asserted
anything about the order of the dock's lines.

**2. Four mission readers became one.** The plan asked for
`missionDestination`, and M1 needed the line, the destination, the fee and the
warning together. Four readers let a caller assemble three states the machine
cannot produce, so `missionLeg` returns all four or null. `missionHeadline`
keeps its callers, its words and its four assertions.

**3. `missionDestination` was needed in M1, not M4.** A screen row reports where
an order sends her, so the reader that says which stages have a target had to
exist before the chart wanted it.

**4. `openStatus` became `openReadingScreen`.** Status and missions want the
same three lines: release mouse flight, record the base state, open the screen.
A second copy of that is how a screen ends up reachable from one mode only.

**5. The README's two key tables are a gate.** `test/key-help.test.ts` holds the
hand-written README to the binding table in both directions, so ⇧I had to be
written into both tables or the build failed. That gate worked exactly as
designed, and it caught the omission on the first run.

**6. The summary carries orders and never warnings.** Today's menu line carried
the gun warning when no contract existed. It does not now: the warning is long
enough to push the order off the line on its own, and the screen is one
keystroke away. That is what invariant 16 asks of an announcement, and the
change is deliberate rather than an oversight.

## M6 — the key was wrong, and the browser is what said so

The first flight found a defect that every gate had missed, and it was in the
key this plan chose.

**Clicking the `⇧I MISSIONS` row opened the COMMANDER STATUS screen.** A menu
row is a click target. `dockedMenuHtml` writes `data-key="${b.key}"` and drops
`b.shift`, so `ScreenHost.click` injected a plain `KeyI` — and the plain entry
answered. The menu cursor's Enter takes the same path, so arrowing onto the row
failed the same way.

That breaks invariant 13: a click becomes the same keystroke as a key press. **A
shifted MENU ROW cannot keep that promise at all.** ⇧T never hit it, because
`src/game/controls.ts` makes it a keyline caption rather than a row — the
comment there says so, and this plan read that comment and still missed the
consequence.

**The fix is a plain letter, and `R` is the only one free in both tables.** One
screen gets one key, because this screen is reached from the cockpit as well as
from the station. The mnemonic is weaker than ⇧I's and that is the correct
trade: a row you can click beats a row that reads better.

**The rule is now a gate.** `test/key-help.test.ts` presses every docked menu
row through the click path and asserts it asks for the command the row
advertises. Restoring `⇧I MISSIONS` fails it with exactly the row named. Nothing
in that file could see this before, because every rule in it asked what was
ADVERTISED and none of them pressed a row.

**Why no test caught it.** `test/standing-orders.test.ts` asserted the BINDING
resolved, with shift held. That was true. The binding table was never the broken
part — the HTML the row renders to was, and no test joined the two.

## Verified in the browser, 2026-08-13

Chrome was connected on the second attempt, and all of it was flown at Leesti
with 16 kills, a beam laser and two contracts held:

1. The station line reads `NAVY MISSION: DESTROY THE CONSTRICTOR — LAST SEEN AT
   LAVE · CARRY SEALED DATA TO ANARLAQU — 6 DAYS (+1 MORE)`. It wraps to two
   lines, and it is legible.
2. The console said `INCOMING NAVY TRANSMISSION — R MISSIONS`, then the gun
   warning behind it. M3's queue fix is visible in a running cockpit. (Read
   before the key changed, it said `— ⇧I MISSIONS`; the line is generated from
   the binding table, so it followed the key.)
3. `R` opens STANDING ORDERS at the station and in flight. The Navy row prints
   `—` under TIME LEFT, and the warning sits under the hunt.
4. Clicking the `R MISSIONS` row opens the screen.
5. The short range chart draws the amber diamond on Lave and reads `LAVE ·
   3.8 LY · 3 DAYS · NAVY MISSION · 3 DAYS AWAY`.

**No save was put at risk.** The browser held three real careers. The page was
switched to the harness namespace (`useHarnessSaves`, invariant 3) before any
docking, every player key was backed up in the page first, and all seven were
byte-identical afterwards.

## What the pilot answered

Both questions the plan left for a flight are closed, on 2026-08-13.

- ~~**Does the summary line read well carrying three things?**~~ — **answered by
  Chris**, who read it and settled it: *"that's fine - we have space"*. It wraps
  to two lines under the station header and stays that way. **The line is not
  shortened**, and that matters beyond the wording: invariant 16 says a surface
  carrying orders names every kind it holds, and the obvious way to fit one line
  is to stop naming one of them.
- ~~Is ⇧I a key Chris finds?~~ — moot. The key is `R`, and M6 has the reason. It
  is structural rather than a matter of taste.

**Nothing on this item is open.**
