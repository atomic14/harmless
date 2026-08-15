# 158 — The safe zone that only the spawner obeys

**Kind:** defect · **Severity:** medium · **Size:** medium · **Depends on:**
nothing · **Blocks:** nothing · **GitHub:** #30 — *"I was attacked by a bounty
hunter when I was in range of a space station. I think pirates and bounty
hunters should not engage when you are in range of a space station."*

A **truce** in this plan is the promise that a named role does not attack the
commander close to the station. The code has no word for it today. This plan
gives it one, and uses that word only.

## Where we are

Every claim below is read off the code that runs.

**The safe zone is already written down, and one rule obeys it.**
`AMBUSH_STANDOFF` is 7,000 units (`src/constants/encounters.ts:116`). Its own
doc comment states the design: *"A commander closer than this to the station is
not worth an ambush. The station's Vipers start a fight that the pirate cannot
finish, and this keeps the one place where a player can catch their breath."*

**Only the spawner reads it.** `stepEncounters` (`src/game/encounters.ts:89`)
refuses to warp a pirate wave in while the commander is inside that range.
`world-step.ts:452` measures the distance and passes it as
`playerFarFromStation`. No other rule in the game reads the constant.

**A ship that is already in the sky attacks wherever it is.**
`isHostileToPlayer` (`src/game/npc.ts:312`) is the one home of *"does this ship
attack the player?"*. It takes a ship and a legal status. It cannot see the
station, so it cannot answer a question about the station.
`aggressiveToPlayer` (`src/game/npc.ts:766`) adds one more test, and that test
is the range to the COMMANDER.

**The report describes correct behaviour under the rules that run.** A bounty
hunter comes for an Offender: `lawTakesInterest` (`src/game/law.ts:182`) gives
Fugitives to the police and Offenders to the bounty hunter. So the defect is not
a bug in the hunter. It is a design rule with one reader out of the two it
needs.

## What the triage found that the issue did not report

**Every idle ship in the system drifts to the station.** The last branch of
`NpcShip.update` (`src/game/npc.ts:857`) ambles between waypoints, and a
waypoint is drawn 800 to 3,300 units from the STATION. That branch is reached by
a pirate, a police ship, a bounty hunter and a Thargoid alike — the trader is
the only role with a route of its own. So the station's neighbourhood is where
the whole system ends up, whatever it did before.

**That is why the spawner's guard cannot hold the promise.** Refusing to warp a
wave in near the station does nothing about the ships that walked there.

**The hunter also STARTS inside the zone about two times in three.**
`HUNTER_SCATTER` is 6,000 (`src/constants/spawn-placement.ts:46`), and
`scatter()` (`src/game/spawning.ts:48`) places at `range * (0.5 + random())`.
That is a flat draw over 3,000 to 9,000, and 7,000 cuts it two thirds of the
way up.

**Four readers must give the same answer.** `isHostileToPlayer` is called by the
NPC decision loop (`npc.ts:767`), the HUD (`src/hud/hud-model.ts:42`, `111`,
`215`), the bought combat computer (`src/game/combat-computer.ts:163`) and the
scripted co-pilot (`src/game/scripted-co-pilot.ts:100`). A truce written into
the decision loop alone would paint a red blip for a ship that attacks nobody.
It would also aim the commander's own combat computer at that ship.

**The bribe key spends the same rule.** `nearestEngaging`
(`src/game/npc.ts:366`) offers money only to a ship that is in the fight. Under
a truce there is no fight, so the offer must not be made.

## What to do

Two milestones, and therefore two commits. M1 is the rule. M2 is the placement
that the rule exposes.

### M1 — the truce is part of the hostility rule

**One constant, and it moves.** `AMBUSH_STANDOFF` becomes `STATION_TRUCE` in
`src/constants/law.ts`. The rule it states is a law rule — who may engage the
commander, and where — and it now has two readers rather than one. The name
`AMBUSH_STANDOFF` describes only the spawner's half, so it would be false for
the other half from the day this lands. The value does not change.

`src/game/encounters.ts` imports it from the new home. Nothing about the pirate
wave changes.

**One new pure rule, in `src/game/law.ts`:**

```
truceHolds(role: string, playerToStation: number): boolean
```

It is true when `role` is `pirate` or `hunter`, and `playerToStation` is below
`STATION_TRUCE`. It is false for every other role.

- **The police are NOT in the truce.** Chris named two roles, and the police
  are the station's own. A Fugitive who parks on the doorstep must still be
  hunted, or the station becomes the one place a Fugitive is safe from the law.
- **A Thargoid is not in the truce.** It does not read the Galactic
  Government's mail.
- **It measures the COMMANDER's distance**, not the ship's. That is what the
  issue says, it is one number a frame rather than one per ship, and it means a
  hunter cannot hold station just outside the line and shoot across it.

**`isHostileToPlayer` gains a third parameter,** `playerToStation`, and it is
REQUIRED. An optional parameter would let a reader forget, and a reader that
forgets is the HUD painting a blip red for a ship that will not come. Every
caller must answer the question.

The truce is asked AFTER `satisfied` and before the role test, because it is the
same kind of answer: this ship is not your business now.

**A commander who shoots first ends the truce.** The test in
`isHostileToPlayer` reads:

```
if (!npc.state.provokedByPlayer && truceHolds(npc.role, playerToStation)) return false;
```

`takeDamage` sets `provokedByPlayer` for damage from the commander
(`src/game/npc.ts:1541`), whatever the role. So a hunter that the commander
fires on inside the truce fights back exactly as it does now. A truce that
covered that case would make the station a free firing position, which is worse
than the fault this plan fixes.

**`engaging`, `hostilesNear` and `nearestEngaging` (`npc.ts`) each carry the
number through.** They are the condition light and the bribe, and both must
agree with the ship.

**`WorldView` gains `playerToStation`,** measured once a frame in
`world-step.ts` beside the number that `stepEncounters` already gets. The two
readers then read one measurement.

### M2 — an idle hostile does not loiter in the truce

The amble at `src/game/npc.ts:857` draws a waypoint 800 to 3,300 units from the
station. For a role in the truce that is a waypoint inside a zone where it can
do nothing at all, so the ship becomes scenery parked over the port.

**A role in the truce ambles outside it.** The waypoint for a `pirate` or a
`hunter` is drawn from `STATION_TRUCE` outward, over the same width the amble
already uses. The police and everything else keep the waypoint they have.

Two new constants in `src/constants/spawn-placement.ts`, beside the distances
that say where a ship goes:

- `AMBLE_NEAR` (800) and `AMBLE_SPAN` (2,500) — the amble's own literals, named
  where they are now inline. They are named because M2 adds a second reader,
  and a rule with two homes is what `CLAUDE.md` forbids.

The truce's own floor is `STATION_TRUCE` and is imported, not copied.

**`HUNTER_SCATTER` is NOT raised.** It is tempting, because two thirds of its
band is inside the truce. It is wrong for two reasons. A hunter must still be
able to close to `PLAYER_INTEREST_RANGE` (9,000) of a commander who leaves the
station, and a floor at 7,000 would put the median start at 14,000. And the
amble is what actually decides where a hunter spends its time, so raising the
start would move the first thirty seconds and nothing after that. M2 fixes the
cause.

## Verification

The gates always run: `npm run check`.

Beyond them, tiered to the change. This changes a rule that decides how a fight
starts, so:

1. **`test/station-truce.test.ts`**, a new file, is the gate. It asserts
   behaviour through the real `Game` and the real `NpcShip`:
   - an Offender with a bounty hunter at 2,000 units, both inside the truce, is
     not engaged, and the hunter fires nothing over 300 steps;
   - the CONTROL — the same pair at the same separation, with the commander
     outside the truce, is engaged inside one decision interval;
   - a pirate inside the truce does not engage a Clean commander, and does not
     engage a Fugitive either;
   - a POLICE ship inside the truce still engages a Fugitive, which is the half
     of the rule that must not move;
   - a Thargoid inside the truce still engages;
   - a hunter the commander SHOOTS inside the truce fights back, so the truce
     is not a free firing position;
   - the HUD paints a truced hunter as neutral rather than hostile, through
     `hud-model.ts`, so the surface and the ship agree;
   - the bribe key finds nobody to pay inside the truce;
   - a pirate and a hunter left to amble for 600 seconds never hold a position
     inside `STATION_TRUCE`, and a police ship still does.
2. **Prove the gate can fail.** Return `false` from `truceHolds`, and count the
   failures. Then restore the truce and revert M2's waypoint alone, and count
   the failures again. The two halves must fail separately.
3. **`npm run defence-probe`** and **`npm run survivability`**. Both fly fights
   that are far from a station, so both must be unchanged. A move in either
   says the truce reached a fight it has no business in.
4. **`npm run dock-traffic`**. The approach runs through the truce, and the
   probe counts collisions. It must not move.

Not run: `npm run campaign`. It abstracts flight entirely, so no engagement rule
reaches it (docs/TODO/132).

## Decisions already made

- **The station's neighbourhood is quiet for pirates and bounty hunters**
  (Chris, 2026-08-15, GitHub #30): *"I think pirates and bounty hunters should
  not engage when you are in range of a space station."* The two roles are his;
  the police are left out on the argument in M1.

## Open questions

None. The one that would otherwise be open is answered in M1: the police stay
out of the truce, because the alternative makes the station a Fugitive's
hiding place.

## Watch out for

- `isHostileToPlayer` is called in five files. Use `findReferences` before the
  signature changes, not Grep.
- `test/npc.test.ts` fails if `PLAYER_INTEREST_RANGE` reappears as a literal in
  a consumer. `STATION_TRUCE` deserves the same guard, and it does not have one
  yet.
- `constants:check` is diff-scoped, and this moves a constant between files.
  Run `npm run generate:constants` before the gates, because the doc comment is
  the `Purpose` column of `CATALOG.md`.
- The truce must not stop a ship DEFENDING itself. The provocation test is in
  `isHostileToPlayer` rather than in `truceHolds`, so the pure rule stays a
  statement about a role and a distance.
- `launchStationDefence` (`src/game/spawning.ts:377`) launches Vipers that are
  already `provokedByPlayer`. They are police, so the truce never reads them.
  Do not add a second guard there.
