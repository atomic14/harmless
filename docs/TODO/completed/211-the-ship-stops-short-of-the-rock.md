# 211 — The ship stops short of the rock

**Kind:** bug · **Severity:** high · **Size:** small · **Depends on:** 206 ·
**Blocks:** nothing · **GitHub:** none

## Where we are

**Chris flew at a rock and reported a fault** (2026-09-12: *"when targeting
asteroids or the derelict. We fly towards - and just keep flying towards until
we hit it. We should probably stop when we are within a certain range."*).

**A picked target is flown by the co-pilot** (`game/scripted-co-pilot.ts`). It
holds `PURSUIT_RANGE`, which is 500 units. Beyond it the ship closes. Inside
it the ship drops back. A rock and the derelict are on the target list, as
Chris asked in 206, so the same pilot flies at both.

**The standoff did not hold.** A trace of 2026-09-12 followed a picked rock
53,000 units out:

| time | range | speed |
| --- | --- | --- |
| 0 s | 53,074 | 254 |
| 130 s | 1,559 | 397 |
| 140 s | 481 | 4.3 |
| 230 s | 101 | 4.3 |

**The cause is the speed deadband.** `FlightDemand.throttle` is only a sign,
so a deadband of 6 units stops the throttle from a flip on every frame. Inside
the standoff the wanted speed is zero. A ship that coasts at 4.3 is inside the
band, so the throttle asked for nothing, and the drift went on to the hull.

**The second fault is the frame of reference.** The range is held to the
target's CENTRE. A rock is 54 units across the radius, and the generation ship
is 340. So the commander stopped 160 units off the derelict's hull.

## What to do

**M1 — a stop is a stop.**

1. In `pursuitThrottle`, brake when the wanted speed is zero. The deadband
   then holds a speed, and never a drift.
2. Measure the standoff from the hull. Pass `dist - radius` to the throttle.
   The gun keeps the true distance, because a shot travels to the hull by
   itself.
3. Pin both in `test/scripted-co-pilot.test.ts`.
4. Fly the whole game in `test/mine-and-collect.test.ts`: pick a rock, wait 90
   seconds, and check the gap. Wait another minute, and check that the gap is
   still there.

## Decisions already made

- **The stop is the range the co-pilot already holds.** `PURSUIT_RANGE` is
  inside the laser's reach and outside the break-off range. A second number
  for a rock would be a second rule with no reason.

## Open questions

None.

## Watch out for

- **The fight must not change.** A fighting target moves, so it asks for a
  wanted speed above zero at any useful range. The brake only fires where the
  ship is asked to stop.
- **The hull standoff moves a fighter's range too**, by its own radius, which
  is 25 to 62 units on the shipped hulls.

## Verification

1. The trace, flown again: the range at rest, and the range one minute later.
2. `test/scripted-co-pilot.test.ts` on the throttle rule itself.
3. The whole suite, which holds the fight.

## What the milestones found

**The rock, flown again with the fix:** the ship stops at 554 units from the
centre of a 54 unit rock. Its speed is 0.0 units a second. It holds that range
for the rest of the run.

**The derelict:** the commander holds 838 units from the centre of the 340
unit hull, which is 500 units of clear space. It matches the hulk's own drift
of 25 units a second, as it did before.

**The test fails without the fix.** With the brake removed, the whole-game
test reports 2.7 units a second and a loss of 160 units of range in one
minute.

**The fight is unchanged.** The suite holds it at 5,886 assertions, including
the co-pilot's gun cone, its range and its break-off.

## Outcome

Landed on 2026-09-12. `npm run check` passes.
