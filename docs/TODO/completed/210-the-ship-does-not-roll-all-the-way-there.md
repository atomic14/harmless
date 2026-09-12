# 210 — The ship does not roll all the way there

**Kind:** bug · **Severity:** high · **Size:** small · **Depends on:** 205 ·
**Blocks:** nothing · **GitHub:** none

## Where we are

**Chris flew a course and reported a fault** (2026-09-12: *"There is something
a bit annoying - we seem to be constantly rotating when heading towards
something. I don't remember this happening with the combat computer."*).

**He is right, and the measurement is large.** A trip to the station cost 41
full turns of roll on a median run with traffic, and 7.8 with a clear sky. The
roll moved in 92% of the samples.

**The steering is `bankToTurn`** (`game/pitch-roll-steer.ts`). The ship has no
yaw axis. To point the nose it rolls the target onto the vertical plane, then
pitches up to it. The pitch is gated by the cosine of the roll error, so the
ship pulls once the bank is nearly there.

**The soft gate leaves a cone.** A trace of 2026-09-12 caught the equilibrium.
The ship rolled at 0.25 radians a second. The pitch that the soft gate still
allowed was 0.0087. The nose then circled the target at a fixed 0.035 radians
off, for ever, because a bearing turns by `pitch / theta`. Near the nose that
ratio is huge, and the two rates cancel exactly.

**The combat computer never shows it**, which is why Chris does not remember
it. It passes the gun's own hit cone as a null band. That cone is wide up
close, and the computer holds the sticks still inside it.

## What to do

**M1 — the course pilot gets a hard roll gate.**

1. Add a `rollGate` parameter to `bankToTurn`. Above that roll error it asks
   for no pitch at all. The default is 0, which keeps every combat caller
   exactly as it is.
2. Add `COURSE_ROLL_GATE` (0.05 radians) and `COURSE_AIM_DEADZONE` (0.02
   radians) to `constants/course.ts`. The course pilot passes both.
3. Pin the gate in `test/pitch-roll-steer.test.ts`.
4. Pin the whole trip in `test/course-pilot.test.ts`: less than one full turn
   of roll from the witchpoint to the hand-over.

## Decisions already made

- **The fight keeps the law it has.** Its targets manoeuvre. A pitch held
  still while the roll catches up is time off the gun. The probes that tune
  the fight are `aim-probe`, `defence-probe` and `survivability`.

## Open questions

- **Should the fight take the gate too?** A measurement of 2026-09-12 shows
  that all the roll left on a trip with traffic happens under the combat
  computer, in a fight. Chris did not report it, and a dogfight rolls for real
  reasons. This is his call.

## Watch out for

- **The gate must not cost an arrival.** Measure the trips that reach the
  hand-over, the time and the speed.
- **A tighter gate costs time in a big turn**, because the roll must finish
  first.

## Verification

1. The count of full turns over a trip, before and after.
2. Trips that reach the hand-over, with the time and the speed at hand-over.
3. The new test fails with the gate set to zero.

## What the milestones found

**The numbers, over 20 trips with a clear sky:**

| | before | after |
| --- | --- | --- |
| full turns of roll, p50 | 7.8 | 0.2 |
| trips that reach the hand-over | 20 of 20 | 20 of 20 |
| seconds to the hand-over, p50 | 39.5 | 39.4 |
| speed at the hand-over, p50 | 227.7 | 227.7 |

**And with traffic, over 10 trips:** the median fell from 41 full turns to 1.3.
The roll that is left is all in a fight, under the combat computer. A split of
the same runs put 39.2 of 39.3 turns there, and 0.1 on the course.

**The gate is what fixes it, not the deadzone.** A sweep of the deadzone alone
gave 37.7 turns at 0.02 radians, 34.7 at 0.05 and 44.1 at 0.08. The hard gate
gave 5.5 turns at 0.2 radians, 2.9 at 0.1 and 1.3 at 0.05.

**The test fails without it.** With `COURSE_ROLL_GATE` set to zero, the trip
test reports 7.38 turns against a limit of one.

## Outcome

Landed on 2026-09-12. `npm run check` passes.
