# 188 — The Thargoid ambush is too hard

**Kind:** balance · **Severity:** medium · **Size:** medium · **Depends on:**
nothing · **Blocks:** nothing · **GitHub:** #39

## Where we are

**Chris reported it on 2026-09-04 (GitHub #39):** *"thargoid ambush is too
hard. There should be a limit to how many active drone ships there are."*

**A limit exists, and it is four.** `MAX_THARGONS` in `constants/encounters.ts`
caps the live drones at 4, across every mothership. `THARGON_REDEPLOY` puts a
new drone up 5 seconds after the count drops below the cap. A mothership keeps
deployment up while it lives.

**The ambush itself is two or three motherships.** `THARGOID_AMBUSH_MIN` is 2,
and `THARGOID_AMBUSH_EXTRA_CHANCE` adds a third 30% of the time. They wait
3,500 to 6,000 units out, and the commander arrives at a speed of 200. So the
steady state of the fight is six or seven hostile ships. A drone dies, and its
replacement is in the sky 5 seconds later.

### What each ship is worth

From the pack, and from the spec overrides in `game/ship-specs.ts`:

| ship | energy | one hit on the commander | speed | notes |
| --- | --- | --- | --- | --- |
| Thargoid | 253 | 28 | 300 | reloads at 0.7 of the rate, and always has E.C.M. |
| Thargon | 33 | 16 | 350 | inert when the last mothership dies |

The commander holds three 255-point pools. Four drones at 16 a hit and two
motherships at 28 a hit is the shape of the fight.

**No probe flies this fight.** docs/TODO/184 recorded it: *no probe kills a
Thargoid mothership*. `npm run survivability` stages a pirate gang on the
training world. The combat trainer stages "Thargoid ambush" in the browser
only. So the number Chris asks for has no measurement behind it, in either
direction.

**Chris's verdict is the answer to whether a fight is fun** (docs/PROCESS.md).
He says it is too hard. The number is then the thing to move, and this item
measures before it moves.

## What to do

Two milestones.

### M1 — a probe flies the ambush

`train/ambush-probe.ts` flies the witch-space ambush headlessly, over the real
`WorldStep`. `test/world-step.test.ts` shows the rig: a `freshState`, a built
world with `banishScenery`, a stub host, and the step. The ambush spawns as
`enterWitchspace` spawns it, and the drone timer runs as the step runs it.

The commander is a stand-in. She turns to face the nearest live mothership at
the commander's own pitch rate. She fires the pulse laser through
`combat-player.ts` when the mothership is in the gun's cone and range. She
flies slow. That is the knife-fighter of `test/human-shape.test.ts`, with a
gun.

Each episode runs until she dies or 120 seconds pass. The row reports, over
the episodes:

- how many episodes she survives;
- the seconds to death, median and worst;
- the pools left at the end;
- motherships killed, and drones killed;
- the peak count of live drones.

Run it at two sizes, 40 and 160 episodes. Record both in this plan.

### M2 — move the number, on M1's evidence

Candidates, each measured at both sizes by an edit to the constant and a
rerun:

1. `MAX_THARGONS` 4 to 2;
2. `THARGON_REDEPLOY` 5 to 15;
3. both.

Pick the smallest change that moves the survival rate by a clear margin.
Record the table. Chris flies it, and his report enters triage as an issue.

## Decisions already made

- **Measure before you move.** No number moves in M1.
- **The ambush stays an ambush.** `THARGOID_AMBUSH_MIN` stays at 2. The
  witch-space doc says why: a single Thargoid is a duel.
- **The probe is not a gate.** It is the measurement a balance change answers
  to, like the eight probes docs/PROCESS.md names.

## Open questions

None that block M1. M1's table answers M2's number.

## Watch out for

- **`KILLS_PER_RUNG` counts pirates only, and the 5-second redeploy is the
  reason** (`constants/law.ts`). A slower redeploy does not change that rule,
  and this item does not touch it.
- **`MAX_THARGONS` shares the value 4 with `MAX_TRADERS`**, and each has its
  own rule. A change to one is not a change to the other.
- **The drone timer is saved state.** `encounterTimers.thargon` is in the
  save. The probe sets it as `enterWitchspace` does.
- **The stand-in's gun is the pulse laser.** A Thargoid at 253 energy takes
  many hits from it. That is the fight a new commander meets, and it is the
  right floor.

## Verification

The gates always run: `npm run check`.

The tier: a rule that changes how a fight goes, so the probe that owns the
subsystem. M1 builds it. The two-size rule holds for every row.

M2's evidence is the M1 table, before and after. The nine existing probes stay
byte-identical, because none of them stages a mothership.

## Outcome

### M1 — a probe flies the ambush

`train/ambush-probe.ts` is `npm run ambush-probe`. It stages the ambush as
`enterWitchspace` does, in the same order, and it flies every frame after
that through the real `WorldStep`. The stand-in is not the knife-fighter the
plan named. **It is the scripted co-pilot**, `game/scripted-co-pilot.ts`,
which is the defence the combat computer sells. It produces the same demand a
pair of hands does, the step flies it, and its trigger reaches the real gun
through the host. So a row is a floor for the shipped defence in a new
commander's Cobra, with a pulse laser and no E.C.M.

**THE PLAN DID NOT HAVE THE CO-PILOT, AND IT IS THE BETTER STAND-IN.** The
world-step harness takes a `FlightDemand` each frame, and the co-pilot
produces one. A hand-written turn-and-shoot would be a second copy of a rule
this file already ships. CLAUDE.md forbids the copy.

It runs 160 episodes of 120 seconds in about four seconds. The two sizes agree
on every column, at the shipped values:

| size | survived | death median | death p10 | pools left | mothers | drones | peak drones | drone share |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 40 | 93% | 83.5s | 75.3s | 54% | 1.57 | 2.80 | 4.0 / 4 | 71% |
| 160 | 85% | 91.4s | 55.6s | 54% | 1.41 | 2.44 | 4.0 / 4 | 70% |

**The drones deal seven tenths of the damage, and the sky holds four of them
in every episode.** The co-pilot kills a mothership and a half, and two to
three drones, in two minutes. She dies in one ambush in seven at the larger
size, and she ends the rest with half her pools.

### M2 — the cap moves to two

The three candidates, each at both sizes:

| change | size | survived | pools left | mothers | drones | peak drones | drone share |
| --- | --- | --- | --- | --- | --- | --- | --- |
| cap 2 | 40 | 100% | 76% | 1.38 | 1.02 | 2.0 / 2 | 56% |
| cap 2 | 160 | 100% | 79% | 1.52 | 1.14 | 2.0 / 2 | 57% |
| redeploy 15s | 40 | 100% | 79% | 1.80 | 1.48 | 3.5 / 4 | 60% |
| redeploy 15s | 160 | 98% | 74% | 1.63 | 1.44 | 3.5 / 4 | 62% |
| both | 40 | 100% | 86% | 1.70 | 0.95 | 2.0 / 2 | 51% |
| both | 160 | 100% | 86% | 1.69 | 1.07 | 2.0 / 2 | 50% |

**`MAX_THARGONS` IS 2, AND `THARGON_REDEPLOY` STAYS AT 5.** The cap alone
takes survival to 100% at both sizes, and it lifts the pools left from 54% to
76% and 79%. The slower redeploy alone did nearly as well on the pools, but it
left the peak count at 3.5 of 4. Chris's complaint was the count of active
drones, and the cap is the change that answers it. Both together spare more
of the pools, and the plan asked for the smallest change with a clear margin.

**The ambush is still an ambush.** Two or three motherships wait, each drone
that dies is replaced 5 seconds later, and the co-pilot ends with a quarter of
her pools gone. A human without a combat computer sits below this floor.

**THIRTEEN CONSTANTS GAINED A RULE ID, AND THE PLAN DID NOT HAVE THE COUNT.**
`constants:check` refuses two equal values without distinct ids, and twelve
other constants sit at 2. docs/TODO/160 paid the same cost for the value 5.
Each of the thirteen says why in its own doc comment.

**THE TRAINER'S "THARGOID AMBUSH" STAGES THREE TO FIVE DRONES, AND THAT IS
NOW ABOVE THE LIVE CAP.** `combat-sim-scenarios.ts` counts drones by tier
rather than by the timer. It is a practice scenario, and it is not this item's
rule. It is recorded here rather than changed.

**`docs/PROCESS.md` names nine probes now.** The probe is the measurement a
change to either constant answers to.

`test/world.test.ts` walks the cap up the ladder against the constant, so it
followed the value with no edit. The other eight probes stage no mothership,
by a search of `train/` for the word, so none of them can read the cap.
