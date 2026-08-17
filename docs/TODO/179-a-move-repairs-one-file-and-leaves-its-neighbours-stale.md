# 179 — A move repairs one file and leaves its neighbours stale

**Kind:** defect · **Severity:** low · **Size:** small · **Depends on:**
docs/TODO/176 · **Blocks:** nothing · **GitHub:** none

## Where we are

Chris asked for the next job on 2026-08-17. This came out of a measurement that
found something else, and the measurement is reported below.

**docs/TODO/176 M2 moved the trader's working life out of `game/npc.ts`.** It
repaired that file's header, and it repaired `docs/ARCHITECTURE.md`.
`CLAUDE.md` asks for both. **It repaired none of the files that POINT AT the
code it moved.**

### Five comments name a file the trader left

| site | what it says | what is true |
| --- | --- | --- |
| `constants/spawn-placement.ts:180` | *"`departing` (game/npc.ts) despawns…"* | `trader-flight.ts` |
| `game/spawning.ts:104` | *"npc.ts `updateTrader`"* | `stepTrader`, and `updateTrader` is gone |
| `game/docking.ts:165` | *"game/npc.ts reads this"* | `trader-flight.ts:159` |
| `test/dock-path.test.ts:108` | *"game/npc.ts reads this flag"* | `trader-flight.ts:159` |
| `train/dock-traffic.ts:16` | *"`planDocking` … (game/npc.ts)"* | `trader-flight.ts` calls it |

**One of the five names a member that no longer exists anywhere.**
`updateTrader` was deleted by the move.

**The two docking comments also carry a claim that is still true**, and the
repair must keep it. `trader-flight.ts:159` is the ONLY reader of
`plan.arrived`, measured on 2026-08-17.

**`constants/amble.ts:4` names `game/npc.ts` and is CORRECT.** The amble
between waypoints stayed in `update`. Do not repair it.

**`npm run claims:check` cannot see any of this.** It reads one comment form,
`@internal — driven by <path>`, and every site above is prose.

### A departure distance has two homes

`DEEP_TRADER_RUN` is 30,000, and its doc comment says *"how far it runs before
it jumps out"*. `game/spawning.ts:223` reads it for a trader spawned in deep
space, already departing.

**`game/trader-flight.ts:143` writes the same rule as a bare `30000`.** That is
the waypoint a station trader gets when its business ends and it switches to
`departing`.

**Both feed the same phase and the same despawn.** `stepTrader`'s `departing`
case flies at the waypoint and sets `wantsDespawn` within 2,500 units, whichever
of the two put the waypoint there. So it is one rule.

**The literal came out of `game/npc.ts` unchanged**, so docs/TODO/176 M2 carried
it rather than wrote it. It is older than that item.

### The measurement that found it, and what it says

A scan compared every exported numeric constant against every bare literal in
`src/`. **92 of the 132 distinct constant values appear as a bare literal
somewhere.** Almost all are coincidence: `audio.ts` uses 4,000 and 1,200 as
frequencies, and `world/starfield.ts` uses 2,600 as a distance.

**SO THE OBVIOUS GATE IS NOT WORTH BUILDING**, and this document records that
so nobody tries. A checker at this precision would report 92 findings and be
switched off. The signal was one hit in the noise, found by reading each
candidate's MEANING rather than its value.

The other literals in `trader-flight.ts` were checked the same way. 900, 600,
1,200 and 2,500 each match a constant's value and none matches its meaning.

## What to do

One milestone.

### M1 — repair the five, and give the distance one home

**`trader-flight.ts` reads `DEEP_TRADER_RUN`.** The value does not change, so
no behaviour moves.

**The five comments name `game/trader-flight.ts`.** `spawning.ts`'s also names
`stepTrader` rather than the deleted `updateTrader`.

**The two docking comments keep their "only reader" claim**, because it is still
true.

**`DEEP_TRADER_RUN`'s doc comment gains the second caller**, so the constant
says both situations it governs.

**Run `npm run generate:constants` FIRST.** The doc comment is `CATALOG.md`'s
`Purpose` column, and `PROCESS.md`'s tier table catches this case by name.

## Decisions already made

- **Chris asked for the next job on 2026-08-17**, after docs/TODO/178 landed.
- **The naive constant-literal gate is not built.** The measurement above is the
  argument, and it is recorded rather than acted on.
- **`constants/amble.ts` is correct and stays.** The amble did not move.

## Open questions

None.

## Watch out for

- **One constant, not two.** A second constant of 30,000 would need its own
  `@rule` id, and `constants:check` would ask for one. The two callers share a
  rule rather than a value.
- **`test/deep-space-traffic.test.ts` already pins `DEEP_TRADER_RUN`** for the
  deep-space spawn. Read it before adding anything, so the gate does not say the
  same thing twice.
- **The value must not move.** `npm run campaign` and the trader tests both fly
  this, and a changed distance is a balance change this item has no licence to
  make.

## Verification

The gates always run: `npm run check`, and `npm run generate:constants` before
them.

**The tier table puts this at "prose in `src/constants/`"**, which is why the
generator runs first. The code change is a literal swapped for the constant that
already holds its value, so no rule moves.

**The evidence is that nothing moved.** `npm test` reports the same assertion
count, and the trader's own tests are unchanged.

**A gate for the departure distance**, in `test/trader-flight.test.ts`, which
already drives the `departing` phase. It asserts that the waypoint a station
trader gets is `DEEP_TRADER_RUN` from the station, rather than a number written
out here.

**Prove it able to fail** by putting the literal back as `30001`.

**The five comments have no gate**, and the outcome says so plainly.
`claims:check` reads one comment form and this is prose.

## Outcome

### M1 — six sites repaired, and the distance has one home

`game/trader-flight.ts` reads `DEEP_TRADER_RUN`. The five comments name
`game/trader-flight.ts`, and `spawning.ts`'s names `stepTrader` rather than the
deleted `updateTrader`.

**Nothing moved.** The suite is 4,845 assertions, as before. `npm run campaign`
is byte-identical to docs/TODO/178's baseline, once the wall-clock line is
masked.

**`DEEP_TRADER_RUN`'s doc comment now states both situations it governs.** One
trader arrives already departing, measured from where it warped in. The other
finishes its business at the station, measured from the station. The anchors
differ and the rule does not.

**The generator ran first**, which is `PROCESS.md`'s second tier row. A doc
comment in `src/constants/` is `CATALOG.md`'s `Purpose` column.

**Proved able to fail** by putting the literal back as 30,001. The new claim
reddens alone.

**The five comments have no gate, and that is stated rather than implied.**
`npm run claims:check` reads `@internal — driven by <path>` and every one of the
five is prose. Nothing in the tree gates a prose path.

**THE MEASUREMENT IS THE ITEM'S OTHER RESULT, AND IT SAYS DO NOT BUILD THE
GATE.** 92 of 132 distinct constant values appear as a bare literal somewhere in
`src/`. A checker at that precision reports 92 findings and gets switched off.

**The signal was one hit in the noise.** It was found by reading each
candidate's MEANING, and the other four literals in `trader-flight.ts` were
checked the same way. 900, 600, 1,200 and 2,500 each match a constant's value
and none matches its meaning.

**A SECOND CANDIDATE WAS READ AND REJECTED, AND THE PLAN DID NOT NAME IT.**
`game/npc.ts:730` reads `if (d < 7000)`, and `STATION_TRUCE` is 7,000. They are
not the same rule. One is how far an NPC chases another NPC. The other is where
the lawless leave the commander alone. **It is still a game rule with no name**,
and that belongs to docs/TODO/90's unfinished programme rather than here.
