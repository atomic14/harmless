# 170 — The rocks are all at the station

**Kind:** defect · **Severity:** low · **Size:** small · **Depends on:**
nothing · **Blocks:** nothing · **GitHub:** #34

## What landed, 2026-08-16

Both milestones landed the same day. The plan was correct on every fact it
stated, and the work found four things it did not have.

**M1 gave the rock loop the two-branch shape the police already had.** An
arrival places each rock with `corridorPos`. A launch keeps the station anchor.
The count and the seed expression are untouched.

**`ASTEROID_LANE_SCATTER` is DERIVED rather than chosen, and that is the first
thing the plan did not have.** `scatter()` places a rock at up to 1.5 times the
nominal. So `SCANNER_RANGE / 1.5` puts the outermost rock at exactly
`SCANNER_RANGE`. The whole field is on the scanner as the commander passes it.
`DEEP_TRADER_CONE` measured that same derivation and rejected it, because a
trader moves off the scanner before the commander arrives. A rock does not move.
The measured furthest rock is 5,961 units off the lane, against a scanner range
of 6,000, so the derivation is exercised rather than merely stated.

**The derivation is also what answers `constants:check`, and that is the second
thing.** The plan expected an `@rule` id. Written as the literal 4,000, the
constant repeats five others, and the check fails. The checker's own message
offers two remedies: a distinct `@rule` id, or a derivation. This takes the
second, so the number carries its reason rather than an exception.

**The measurement, over 40 systems at the real witchpoint distance.** Of 117
rocks:

| | inside `MASS_LOCK_STATION` | mean nearest rock |
| --- | ---: | ---: |
| arrival, before | 64 | 3,652 |
| arrival, after | **0** | **27,477** |
| launch, unchanged | 57 | 3,813 |

The number fell, and it did not fall on a launch. The rock count is 117 on both
sides, which is the plan's "do not change how many rocks spawn".

**`test/spawning.test.ts` sweeps both situations now.** The measurement was one
arrival sweep, so a launch band could not be read at all. It is a function of
the situation, and it runs twice. Neither branch is evidence for the other.

**Proved able to fail twice, and separately.** With the station anchor put back
for an arrival, the three arrival claims go red and the launch claim stays
green. With the corridor used on a launch, the launch claim goes red alone.

**The launch police had no measurement either, and that is the third thing.**
`POLICE_PATROL_RANGE` is the same two-branch answer this item copied, and no
assertion read it. The new launch sweep asserts it in one line.

**Both probes are byte-identical, and neither one measured the change.** That is
the fourth thing, and the plan predicted the result for the wrong reason.
`roster-probe` reads `train/roster-census.ts`, and `dock-traffic` builds its own
approach. Neither calls `spawnPopulation` at all. `src/game/world-build.ts` is
its only caller in the tree. So the two probes prove that nothing else moved,
and the rock count above is the evidence for the change itself.
`dock-traffic` reports 80 of 80 docked, 0 rams and 0 scrapes.

**The open questions are answered as the plan recommended.** A launch keeps
`ASTEROID_SCATTER` at 5,000 rather than spreading as wide as the police, and
`CORRIDOR_SPAN` is unchanged, so the last 15% of the approach stays clear.
Chris can fly it and re-open either one.

**One thing is reported and not fixed.** `HERMIT_SCATTER`'s doc comment says the
hermit sits at *"2.5x the asteroid field's nominal radius"*. It is 14,000
against 5,000, which is 2.8x. The sentence was already wrong, and this item did
not change either number. It is the same class of defect as docs/TODO/167: one
sentence written once and never checked again.

`npm run check` passes at 4,753 assertions.

## Where we are

Chris flew it and reported one thing: *"There always seem to be some asteroids
near the space station. I think they should be spread along the path."*

**The report is exact, and the placement is by construction.** `spawning.ts:118`
puts every rock at the station:

```ts
for (let i = 0; i < plan.asteroids; i++) {
  world.spawn('asteroid', home.clone().add(scatter(ASTEROID_SCATTER)), sys.seed[0] + i * 37);
}
```

`home` is the station. `scatter(5000)` puts each rock 2,500 to 7,500 units out.
So a rock field always straddles the port, and the run in from the witchpoint
holds none.

**It happens on every arrival and on every launch.** `population.ts:73` reads
`ASTEROIDS_MIN + floor(rng() * ASTEROIDS_VARIATION)`, which is 2 to 4. Neither
number can roll zero, and neither branch asks where the commander is.

### The file already holds the answer

`corridorPos(spread)` sits ten lines above the rock loop. It returns a point
`CORRIDOR_START` to `CORRIDOR_START + CORRIDOR_SPAN` of the way from the
commander to the slot, scattered off that line. That is 10% to 85% of the route,
so the last 15% stays clear for the approach.

**Three roles already use it on an arrival**, and each says why in its own
comment:

| role | on an arrival | on a launch |
| --- | --- | --- |
| trader | half on the corridor | at the station |
| police | on the corridor | `POLICE_PATROL_RANGE`, 18,000 out |
| pirate | on the corridor | none spawn |
| asteroid | **at the station** | **at the station** |

The rocks are the one thing that never asks.

### A launch has no path, and that is the scope limit

On a launch the commander starts at the slot, so there is no lane to string
anything along. The police answer that case a second way: they spread 18,000
units across the system instead. The rocks need the same two-branch answer, and
not one branch.

### What the constant says today

`ASTEROID_SCATTER` is 5,000. Its doc comment states two things that this item
must keep or must change on purpose:

1. It is *"the widest of the three things a peaceful system holds"*.
2. It shares its value with `MASS_LOCK_STATION` and is NOT that rule. The
   comment says *"Rocks land 2,500-7,500 out, so the field straddles the lock."*

Claim 2 is the one at risk. A rock on the corridor is no longer measured from
the station at all, so the sentence about the mass lock stops being true.

## What to do

Two milestones. M1 is the placement. M2 is the constant's own prose.

### M1 — the rocks go where the commander flies

Give the rock loop the same two-branch shape the police already have:

- **on an arrival**, place each rock with `corridorPos(...)`;
- **on a launch**, keep the station anchor it has today.

**Use a scatter constant of its own.** Do not reuse `POLICE_SCATTER`. A rock
field is scenery and a patrol is traffic, and one number that served both would
be one rule with two homes. Name the new constant for the lane, and give it an
`@rule` id if its value collides with another.

**Do not change how many rocks spawn.** `plan.asteroids` is not this item's
subject. The complaint is where they are, not how many.

**Keep the seed expression.** `sys.seed[0] + i * 37` is what makes a system's
rocks the same rocks on every visit. A change there is a world-determinism
change, and this item is not one.

### M2 — the constant says what it now means

`ASTEROID_SCATTER`'s doc comment claims the field straddles `MASS_LOCK_STATION`.
After M1 that is true on a launch and false on an arrival. Rewrite the comment
against both branches. Keep the `@rule` reasoning that separates the value from
`MASS_LOCK_STATION`.

**Write it in the house prose style.** `src/constants/` is in scope for
ASD-STE100, and `ste:check` gates it.

**Run `npm run generate:constants` BEFORE the gates.** A doc comment in
`src/constants/` is the `Purpose` column of `CATALOG.md`, so an edit to the prose
alone leaves the catalogue stale and `constants:check` fails
(`docs/PROCESS.md` step 3).

## Verification

The gates always run: `npm run check`. The tier table puts this at "a rule that
changes how a fight goes → the probe that owns the subsystem". A rock is not a
combatant, so the honest reading is the row above it. Run the two probes that
fly the lane anyway, because a rock on the corridor is a new obstacle there:

1. `npm run dock-traffic` — the approach must not gain a collision.
2. `npm run roster-probe` — must come back byte-identical. The rocks are drawn
   from the same seeded stream, so a change in the number of draws would move
   every ship after them.

**The gate is `test/spawning.test.ts`, and it already has both helpers.**
`scattered(role, nominal, what)` asserts a station-anchored band.
`onCorridor(role, scatterRange, what)` asserts a lane position and the offset
from it. Today the rocks are asserted by the first one. After M1 an arrival must
be asserted by the second, and a launch must stay on the first.

**Prove the gate can fail.** Put the station anchor back for an arrival, and the
corridor assertion must go red on its own. That is the step that proves the new
assertion reads the arrival branch rather than the launch one.

**Measure what a pilot now meets.** Count the rocks within
`MASS_LOCK_STATION` of the station before and after, over the same seeds the
test already sweeps. The number must fall, and it must not fall to zero on a
launch.

## Decisions already made

- **A launch keeps the station anchor.** There is no lane to place anything
  along. See the scope limit above.
- **The count does not change.** The report is about placement.
- **The scatter gets its own constant.** A rock field and a patrol are not one
  rule.

## Open questions

- **Should a launch spread the rocks wider, the way the police do?** The police
  use `POLICE_PATROL_RANGE` at 18,000 rather than their corridor number. The
  same argument may hold for scenery: a field the commander just launched
  through is a field she has already flown. **Recommendation: leave the launch
  branch alone in M1.** Change one thing, and let Chris fly it.
- **Does the last 15% of the route want a rock?** `CORRIDOR_SPAN` leaves that
  clear on purpose, so nothing ambushes the approach. A rock is not an ambush.
  **Recommendation: keep the same span**, because one lane geometry with two
  meanings is the failure this repository is organised against.

## Watch out for

- **`ASTEROID_SCATTER` shares its value with `MASS_LOCK_STATION`.**
  `constants:check` has no warning level, so a value collision must be answered
  with an `@rule` id rather than by moving a number.
- **The rocks are drawn from the seeded world stream.** Any change in the number
  of `random()` calls moves every draw after it. `roster-probe` is the check
  that says so.
- **Mining is a live use of a rock.** A commander mines with a laser and scoops
  the splinters. Rocks on the lane rather than at the port change where mining
  happens, and that is the point of the report. It is not a defect to fix.
