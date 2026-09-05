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
