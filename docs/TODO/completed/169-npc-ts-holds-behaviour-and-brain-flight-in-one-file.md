# 169 — npc.ts holds behaviour and brain flight in one file

**Kind:** design · **Severity:** medium · **Size:** large · **Depends on:**
nothing · **Blocks:** nothing · **GitHub:** none — promoted from the backlog by
the sweep of 2026-08-16

## What landed, 2026-08-17

**Four milestones, and two files came out of `src/game/npc.ts`.** The file went
1,632 lines to 1,536. `game/hostility.ts` holds the rule that says who attacks
the commander. `game/flight-maths.ts` holds the nose-and-thrust rule. Neither
one names a ship class.

**THE DEBT ROW WAS WRONG ABOUT THE SPLIT, AND SO WAS THE PLAN.** The row named
the flight half for months. M2 measured, and the cheapest cut was the fleet
queries. M3 measured, and the flight half does not separate at all. That is
docs/TODO/150's lesson twice in one item, and the plan predicted it.

**Nothing moved that a probe can see.** All five probes are byte-identical to
the M1 baseline, at every milestone. `npm run check` passes at 4,752 assertions.

**Two things are recorded and not scheduled.** `NpcState` is a candidate that
M4 recommends leaving. `updateTrader` and the constructor are the two biggest
members left, and neither is on any candidate list.

## What M4 found, 2026-08-17

**M4 measures again and stops, which is what the plan asked for.** Two of the
four candidates left the file. Two remain, and neither one is scheduled.

| what is left | lines | what it costs to move |
| --- | ---: | --- |
| the flight half | 158 of body | a 69-call seam around 21 lines of primitive. Refused in M3, with the measurement above. |
| `NpcState` | 184 | low, and the gain is unclear. Most of the length is the doc comment beside each field. |

**`NpcState` is not recommended, and the plan's open question is answered.** It
is 184 lines because each field carries the reason it exists. `CLAUDE.md` asks
for that comment beside the field it describes. A move would carry the prose to
another file and leave the class reading its own saved shape from a distance.
The gain is 184 lines off a 1,536-line file, and the cost is one more hop for
every reader of a field. **Recommendation: leave it.** Revisit it only if
`snapshot.ts` ever needs the shape without the class.

**The biggest members left are not on the candidate list at all.** `update` is
154 lines of body, the constructor is 101, `attack` is 83 and `updateTrader` is
73. `updateTrader` is the trader's whole phase machine, and it is the one that
most reads as a subject of its own. The constructor builds a ship from a roster
row, which is a factory. **Neither is proposed here.** Each is a new argument
rather than this item's, and the queue should get a measurement before it gets a
plan.

**So the item ends at 1,536 lines**, from 1,632. Two files came out of it, and
each holds a rule that named no ship class. The file states one responsibility,
and its header names what is still in the wrong place.

## What M3 landed, 2026-08-17

**THE SPLIT THE DEBT ROW NAMED FOR MONTHS DOES NOT CLEAR THE BAR.** M3 measured
the flight half first, as the plan told it to. The measurement refuses the
split. What left instead is the shared maths, at `src/game/flight-maths.ts`.
`npc.ts` is 1,536 lines. `npm run check` passes at 4,752 assertions.

**This is docs/TODO/150's lesson for the second time in one item.** The plan
predicted it in as many words: each time a plan names a favourite, the
measurement names something else. M2 was the first time. M3 is the second.

### The measurement that refuses the split

**The flight half is 158 lines of body, and `brainFly` is 101 of them.** The
plan's figure of 244 counts the doc comments, and the true count with them is
230. Neither number is the interesting one.

**`brainFly`, `attack` and `pursue` are decision loops rather than steering
primitives.** Each one steers, throttles, advances and then pulls a trigger.
Each one returns a `FireEvent`. `pursue`'s own doc comment says so, and it says
the three share one shape. The plan calls two of the three behaviour and one of
them flight. The code draws no such line.

**`pursuitFly` is 11 lines, and it chooses between `attack` and `pursue`.** It
is a chooser, and the plan files it under flight.

**`matePositions` is an obstacle list, and the plan files it under flight too.**
It answers which hulls a ship must not fly into.

**The true primitives are `advance`, `steerToward`, `faceToward` and `facing`,
at 21 lines of body.** That is the whole of what a collaborator could hold.

**The behaviour half reaches across the seam 69 times.** Five members were
measured. They are `update`, `updateTrader`, `attack`, `pursue` and
`slashesRatherThanHoldSix`. Between them they make 19 reads of the scratch
vectors, 30 of the transform and the flight stats, and 20 calls to the
primitives. A collaborator holding the transform, the rates and the nine
scratch vectors would answer 69 calls from its own sibling. That is a wide seam
around a 21-line subject, and it is the plan's own scratch-vector warning made
into a number.

**Both shapes fail for the same reason, so M2's answer did not decide this
one.** A collaborator needs the fields the behaviour half writes. Pure functions
over state need the same fields as parameters. The plan expected the interface
decision to settle the shape. It settles nothing, because the problem is the
line, and not the shape.

### What did leave, and why it clears the bar

**`steerQuatToward` and `velocityOf` are `game/flight-maths.ts` now, at 71
lines.** They are the nose-and-thrust rule: turn toward a heading at a capped
rate, then thrust along the nose. They hold no state, and they name no class.

**Five files outside the ships read them.** They are `ai-training/scenario.ts`,
`game/spawning.ts`, `game/spawning-arena.ts`, `hud/hud-model.ts` and
`test/human-shape.test.ts`. Three of the five wanted no ship class at all, and
each imported a class file of 1,566 lines to reach a helper of four. Those three
take a type-only import of `npc.ts` now, and `hud-model.ts` still reads the
class for its own signatures.

**It is the same argument M2 made, at a smaller size.** A pure function that a
class file happens to host is a rule in the wrong home.

### The constants gate caught the move, and the plan did not predict it

**`ZERO` and `UP` are named in `test/constants.test.ts`'s own list**, under the
file that declares them. The move made that entry false, and the gate failed on
it. It also failed the other way, because `game/npc.ts` was then on the list
with nothing to account for. Both halves of that check earned their place.

**docs/TODO/90's recorded rule then decided the shape of the fix.** The list's
reason says a `THREE.Vector3` is mutable, so one shared home is a bug rather
than a fix. `game/game.ts`, `game/combat-sim.ts` and `player.ts` each keep their
own pair for that reason. So `flight-maths.ts` keeps a private pair, and
`npc.ts` keeps its own `ZERO` for the `lookAt` in `updateTrader`. The first
draft exported one and shared it, which argued with a decision already recorded.

## What M2 landed, 2026-08-17

**The fleet queries are `src/game/hostility.ts` now, at 169 lines.** `npc.ts`
went 1,677 lines to 1,566. `npm run check` passes at 4,752 assertions.

**The recommendation was taken, and the narrow interface is two interfaces.**
`FleetShip` is a position and `alive`, which is the whole of what `nearestNpc`
reads. `HostileShip` adds the role and three more flags. The narrower question
keeps the narrower dependency.

**A generic parameter is what the plan did not have.** `nearestNpc` and
`nearestEngaging` return the ship they were given. Written against the
interface alone, each one would hand a caller back a `FleetShip`, and every
call site would need a cast. `<T extends FleetShip>` returns the caller's own
type, so `law-actions.ts` still gets an `NpcShip` back. That is what makes the
move a move rather than a change to eight call sites.

**`engaging` did not move as an export, because it never was one.** It is
private to the new file, and `hostilesNear` and `nearestEngaging` are its only
callers.

**Eight files in `src/` and eight tests were repointed.** Six of the eight
source files keep a `type NpcShip` import for their own signatures, so the
import is split in two rather than deleted.

### The gate, and the proof that it fails

**`test/hostility.test.ts` is 13 assertions in two parts.** The first part is
the source scan the plan asked for. The second is a fixture: an object literal
with a role, four flags and a position drives all four exported functions.

**A scan alone is not enough.** It cannot say whether the type is
honestly narrow, and a signature can name no class while still needing one. The
fixture constructs no ship at all, so it answers what the scan cannot.

**Proved able to fail.** With `import type { NpcShip } from './npc.ts'` put
into `hostility.ts`, both scan claims go red and the control stays green. The
control is `game/combat-computer.ts`, which does name the class.

**The scan strips the comments first, and the prose names `NpcShip` three
times.** Each of the three tells a reader which callers hand one in. The test
header says so, because a claim of "nowhere in the file" would be false.

### Two stale claims came out of the move

**`src/game/law.ts` named the wrong file twice.** Both `lawTakesInterest` and
`truceHolds` said `npc.ts`'s `isHostileToPlayer` reads them. They say
`hostility.ts` now.

**`test/break-off.test.ts` held a consumer list that lost a member.**
`PLAYER_INTEREST_RANGE` had three named readers, and the fleet queries took the
constant with them. `game/hostility.ts` is the fourth, and the list names it.

**`docs/ARCHITECTURE.md` gained a line**, under docs/TODO/166's rule. The map
named `npc.ts` and could not name a module that did not exist yet.

### The evidence that no rule moved

**All five probes are byte-identical to the M1 baseline.** They are
`roster-probe`, `survivability`, `defence-probe`, `aim-probe` and `gap-probe`.
The item has no licence to move a rule, and a byte-identical table is the claim.

## What M1 landed, 2026-08-16

**The file says what it does, and the debt row says what the measurement
found.** `npm run check` passes at 4,739 assertions. The header is 45 lines, so
`npc.ts` is 1,676 lines now.

**M1 changes comments and one tool string. It changes no code at all.** The five
probes ran as the baseline M2 will be read against. Each one exits 0.

### `approach` is exported, and nothing outside the file reads it

**The plan's table names `approach` and never asks who calls it.** Measured, it
has eight callers, and all eight are inside `npc.ts`. No file in `src/`, `test/`,
`train/` or `tools/` imports it.

**Three other files hold a private function of the same name.** They are
`src/player.ts`, `train/dock-probe.ts` and `train/dock-traffic.ts`. None of them
imports this one.

**It is REPORTED rather than changed.** That is `tools/internal-claims.mjs`'s own
rule: name a member with no caller, and do not delete it in the same pass. M1
lands alone, and an `export` keyword taken off is a code change.

### The file was not silent, and the header does not repeat what it said

**A comment above the class lists the five roles and what each one does.** It
sits at line 235 of the file as the plan measured it. So `npc.ts` carried no
module header, and it still described its own subject part of the way down.

**The header points at that list rather than copying it.** A rule gets one home
(`CLAUDE.md`). A second copy of the role list would rot against the first.

### The debt row was wrong about the split, and now it says so

**It named the flight half, and the flight half is the smallest candidate.** The
row carries the old sentence in quotation marks, so a reader can see what
changed. It names all four candidates, and it names the cheapest cut first.

**The number moved with the header.** The flight half taken alone leaves about
1,399 lines, and not the 1,355 the table below states.

## Where we are

**`src/game/npc.ts` is the head of the decomposition programme.** The backlog
holds it at number 1, on Chris's rule of 2026-08-14:

> *"The rules should be single responsibility - files that have multiple
> responsibilities are the problem. And then it's all about decomposing large
> files."*

> *"Single responsibility does not mean put everything in one file. A file can
> import child files. The key is to keep files small so they can be easily
> understood."*

**It is 1,632 lines over 99 commits.** `tools/sizes.mjs` carries it as the one
DEBT row in the tree: *"behaviour and brain flight in one file; the flight half
wants its own."*

**It is the only file in `src/` with no module header at all.** A scan of all
259 source files found one. `CLAUDE.md` requires a header on every file.

## What the measurement says, and it is not what the debt row says

**The file holds four separable things, and the flight half is the smallest.**
Measured by line span:

| part | lines | count |
| --- | --- | ---: |
| imports | 1–54 | 54 |
| `NpcState` | 66–249 | 184 |
| `PlayerRef`, `WorldView`, `FireEvent`, `TraderPhase` | 250–441 | 91 |
| the fleet queries | 332–432 | 101 |
| flight maths (`steerQuatToward`, `velocityOf`) | 442–470 | 29 |
| `class NpcShip` | 471–1627 | 1,157 |
| `approach` | 1629–1632 | 4 |

**Inside the class the two halves are lopsided.** Counted by member body:

| half | lines | the members |
| --- | ---: | --- |
| behaviour | 613 | `update`, `attack`, `updateTrader`, `pursue`, `updateTactic`, `chooseWeapon`, the attacker list, the damage takers, the clocks |
| flight | 244 | `brainFly`, `pursuitFly`, `steerToward`, `faceToward`, `advance`, `nosePosition`, `facing`, `bindTransform`, `matePositions` |
| neither | 233 | the constructor, the accessors, `breakingOff`, `healthFraction` |

**So the flight half is 244 lines of the class, and 277 with the module-level
maths.** The debt row names it as the split. It is the smallest of the four
candidates, and taking it leaves 1,355 lines behind.

**The fleet queries are the cheapest cut and the debt row never names them.**
`isHostileToPlayer`, `engaging`, `hostilesNear`, `nearestEngaging` and
`nearestNpc` are 101 lines of pure function. They have the widest readership in
the file after the class itself:

| export | files that import it | of those, in `src/` |
| --- | ---: | ---: |
| `NpcShip` | 49 | 23 |
| `isHostileToPlayer` | 10 | 3 |
| `FireEvent` | 6 | 3 |
| `steerQuatToward` | 4 | 3 |
| `hostilesNear` | 4 | 2 |
| `nearestEngaging` | 3 | 2 |
| `nearestNpc` | 3 | 3 |

**`isHostileToPlayer` is a rule rather than a behaviour.** Its own doc calls it
*"the single source of truth for 'does this ship attack the player?'"*.
docs/TODO/158 then made it the one home that six surfaces read:

1. the ship's own decision loop;
2. the scanner blip;
3. the threat arrow;
4. the condition light;
5. the bought combat computer;
6. the bribe key.

A rule with six readers sits inside a 1,632-line class file today.

**This is docs/TODO/150's lesson repeating.** 150 recorded that no milestone
after M1 named its own successor, and that each time the plan named a favourite
it was wrong. The debt row named the flight half in 2026. The measurement names
the fleet queries.

## What to do

Four milestones. M1 is cheap and it decides the rest.

### M1 — the file says what it does

Write the module header. State ONE responsibility. Then list what the file holds
that does not belong to it.

**Do this first and land it alone.** The backlog's own argument is that the act
of stating the one responsibility is what exposes the second. A header written
after the split is a header written to fit a decision already made.

**Repair `tools/sizes.mjs`'s DEBT row in the same commit.** That row names one
split, and the measurement above names four. A gate's review surface that states
a false claim is what docs/TODO/151 was about.

### M2 — the fleet queries leave

Move `isHostileToPlayer`, `engaging`, `hostilesNear`, `nearestEngaging` and
`nearestNpc` into `src/game/hostility.ts`.

**Decide what they take as a parameter.** Two answers are possible:

1. They keep `NpcShip`, and the new file imports the type from `npc.ts`. This is
   the smaller diff. It leaves an import edge from the rule to the class.
2. They take a narrow interface, in the shape `PlayerRef` and `WorldView`
   already use. The rule then depends on `role`, `state.alive`, `state.inert`,
   `state.satisfied` and `state.provokedByPlayer`, and on nothing else.

**Recommendation: 2.** The file's own vocabulary already prefers it, and a pure
rule that names no class is what invariant 15 asks for. Measure the cost before
you commit: `nearestNpc` reads `object.position`, so the interface has to carry
a position too.

### M3 — flight becomes a collaborator or a set of functions

This is the split the debt row names, and it is a design decision rather than a
move. 1,157 lines sit inside one class, so the flight members read and write the
same fields the behaviour members do.

Two shapes, and M2's answer probably decides this one:

1. **A collaborator.** `NpcFlight` holds the transform, the rates and the
   scratch vectors. `NpcShip` owns one and asks it to steer. The behaviour half
   stops touching `object.quaternion` at all.
2. **Pure functions over state.** `flight.ts` exports `steerToward(state, point,
   dt)` and its kin. Nothing new is constructed, and the trainer can call each
   one directly.

**Measure before you choose.** Use 150's method:

1. Set the appliers and the host literals aside first.
2. Count lines of body against external dependencies.
3. Count what an area is reached BY, as well as what it reaches.
4. Read the result before you trust the ratio.

**Watch the scratch vectors.** The class holds nine `THREE.Vector3` fields and
two static buffers, and they exist to keep the step allocation-free. A split
that gives each half its own copies doubles them. A split that shares them puts
one buffer in two files.

### M4 — measure again, and stop if nothing clears the bar

150 M6 measured and stopped, and recorded that as the finding. Do the same here.

Report what is left, and what it costs to move. Do not take a fifth area because
the programme has momentum.

## Verification

The gates always run: `npm run check`. `npm run sizes` reports the new shape.

**This item changes no rule.** So the strongest evidence is that nothing moved:

| probe | what it proves |
| --- | --- |
| `npm run roster-probe` | the roster and the spawn are byte-identical |
| `npm run survivability` | a lone pirate still wins and loses at the same rates |
| `npm run defence-probe` | the armed trader's three-phase run is unchanged |
| `npm run aim-probe` | the four legs hold their shares and their aim errors |
| `npm run gap-probe` | the pursuit flight is unchanged |

**Run each one before M2 and after every milestone.** A byte-identical table is
the claim. A table that moves means a rule moved, and this item has no licence
to move one.

**No new gate is needed for a move.** A gate that pins a moved function against
itself is the defect `CLAUDE.md` forbids under Validation. The existing suite
already drives every member.

**One new gate IS needed for M2**, if the recommendation is taken: assert that
`hostility.ts` names no `NpcShip`. Prove it can fail by importing the class.

## Decisions already made

- **The header comes first, and lands alone** (the backlog's own argument).
- **Nothing is deleted.** Every member of the file has a caller.
- **The target is a small parent beside its children**, and never a shorter
  file. Chris set that on 2026-08-14.

## Open questions

- **Does `NpcState` want its own file?** It is 184 lines, and it is the saved
  shape of an NPC rather than a behaviour. `snapshot.ts` already owns what a
  snapshot IS. **Recommendation: measure it in M4, and do not assume.** Its size
  is mostly doc comment, and a doc comment beside the field it describes is what
  `CLAUDE.md` asks for.
- **Which shape does flight take in M3?** See M3. The answer follows M2's
  interface decision, so do not settle it before M2 lands.

## Watch out for

- **Invariant 5 governs this item.** Training uses the game's combat modules and
  never a copy. A flight file that the trainer cannot call is a breach.
  `src/ai-training/scenario.ts` imports `NpcShip` directly.
- **Invariant 15 governs the other half.** An NPC reports and an orchestrator
  resolves. `update` returns a `FireEvent` and causes no effect. A split must
  not give the flight half a way to fire.
- **`npc.ts` reached 0% on the prose gate on 2026-08-14, then drifted back.**
  docs/TODO/158 put five long sentences into it the next day. `ste:check` gates
  now, so a new comment must clear the caps as it is written.
- **49 files import `NpcShip`.** Use `findReferences` before you change any
  signature, as `CLAUDE.md` requires.
- **The header this item writes is a claim that can rot.** docs/TODO/152's rule
  applies to every later milestone: the one that takes a responsibility out
  repairs the header in the same commit.
