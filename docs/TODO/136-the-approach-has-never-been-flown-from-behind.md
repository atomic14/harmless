# 136 — The approach has never been flown from behind

**Kind:** bug · **Severity:** medium · **Size:** large · **Depends on:** 135
(landed) · **GitHub:** none — found by Chris flying 135: *"I'm still seeing
extreme pitch. You can recreate by placing the ship on the other side of the
station pointing towards it."*

## Where we are

**M1 landed: the probe now flies the whole sphere, and that is the finding.**
Every approach `dock-probe` had ever flown — 126's, 134's, 135's — started on the
slot side, pointing along world -Z. So "504/504 docked" meant "docked from in
front", and the worst defects in the approach lived in a hemisphere nothing
measured. The grid is now a sweep: bearings at 0, 45, 90, 135 and 180 degrees
from the slot normal at four azimuths each, three ranges, three station
rotations, and four starting attitudes including pointing straight at the
station. 504 approaches.

| | docked | median | worst | scrapes | roll rev | plan jumps > 20° | worst jump |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 504-case sweep | 504/504 | 19.4s | 38.6s | 1 | 10 | **223 of 504** | **180.0°** |

**The defect is the stand-off branch, and it is the last hard switch left in the
approach.** `range < gateDist * 0.95 && along < dockZ * 2` aims the ship radially
outward. Radially outward from behind the station is still behind the station, so
it makes no progress; the branch releases the moment the ship crosses back out
through its own entry radius; the gate aim then pulls it straight back in; the
condition fires again. A threshold with no hysteresis, and every cycle costs a
full-authority pitch reversal at the hull's 1.45 rad/s cap — eight to ten of them
per approach. That is exactly what Chris felt.

**Two smaller things came out of the same blind spot, and both are fixed:**

- **`arrived` had no idea which side it was on.** `along` is signed, so a ship
  BEHIND the station satisfied `along < dockZ` trivially, and on the axis line its
  `lateral` is 0. Both halves were true from the wrong side, so a trader that
  drifted there counted itself docked and despawned through the back of the hull
  (`game/npc.ts` is the only reader). Now requires `along > 0`, and
  `test/docking-computer.test.ts` fails without it.
- **`earned` had the same hole.** 135's lookahead is granted on `lateral` alone,
  which is measured perpendicular to the slot axis and so reads 0 for a ship
  directly astern — perfectly lined up, by that measure, and handed the full
  lookahead toward a point just outside the slot, through the hull. It is earned
  on `along` as well now.

## What to do

**Build a PATH and fly along it** (Chris): *"In theory, we should be able to make
a path that you fly on smoothly to get in front of the docking port. That would
be the ideal thing and then the docking computer's job is to just fly along that
path. That could then be easily replanned to avoid collisions."* — arrived at by
way of the manoeuvre it replaces: *"fly an orbit around the station until it is
side onto the docking slot, then point at the slot by pitching and match the
rotation as it flies in."*

That is the right shape, and it is not a refinement of what is there — it
inverts it. Today the plan answers "which way now?" from the ship's current
position, so every change of intent is a discontinuity in the only output it has.
A path answers "where does this approach go?" once, and the follower's aim is a
point a fixed distance ahead ALONG it. Both of the properties four rewrites
failed to buy fall out for free:

- **The aim can never be ill-conditioned or reverse.** It is always a lookahead
  away, on a continuous curve, moving forward. 135's whole budget went on that
  one property for a single handover; a path has it everywhere by construction.
- **Clearing the hull is a property of the CURVE, not a correction.** The path is
  laid outside the stand-off sphere in the first place, so nothing has to detect
  that the line is blocked and push against it — which is attempt 4, and the
  reason attempt 4 still scraped 21 times.

**M2 — the path.** From the ship to the slot mouth, through: the stand-off sphere
(radially, in or out), a great-circle arc over it to the gate on the slot axis,
and the straight run in. Smooth through the joins rather than a polyline, because
a corner in the path is a step in the follower's demand — the same defect one
level down.

**M3 — the follower.** The nearest point on the path, plus a lookahead along it,
is the aim; `dockingSticks` already turns an aim and a roll budget into sticks,
and is not reopened. The roll handover 135 settled becomes "on the last leg"
rather than "in the run phase", which is the same rule said in the path's terms.

**M4 — replanning.** The path is recomputed whenever it is invalidated — the
ship pushed off it, or the leg ahead blocked. This is where traffic finally has
somewhere to live: docs/TODO/135 measured one non-fatal collision in eighty
approaches and argued against bolting avoidance onto a reactive planner, and a
path is exactly the structure that makes it cheap. **Not in scope here** — it is
named so the path is not designed in a way that forecloses it.

The one hard turn that remains is real: the arc arrives at the gate moving
across the axis and the run leaves it moving down the axis. That is a manoeuvre
at a known place, to be flown slowly, rather than a threshold between two rival
answers.

## Decisions already made

- **The probe grid comes first and it has landed.** Nothing here is arguable
  without it; the defect had survived three items because it was unmeasured.
- **A path, not branches** (Chris, above). The four rewrites below all kept the
  reactive shape and all failed; the shape is the problem, not the tuning.
- **`dockingSticks` is not reopened.** 134 and 135 both settled it. This item is
  about WHERE the ship is sent, not the hand that flies it.
- **320/320-and-zero-scrapes is the floor.** The approach from the slot side is
  measurably good now and must not pay for the far side.

## Watch out for

- **NPC traders share `planDocking`.** Every trader in the game flies whatever
  this becomes, and `test/world.test.ts` covers them.
- **The phase is saved state** and will gain legs; `snapshot.ts` walks it
  generically, but a save taken mid-manoeuvre must still restore into it.
- **Speed is part of the manoeuvre, not a detail.** Three of the four failures
  below hurt because the ship arrived somewhere too fast to turn.

## FOUR REWRITES THAT DID NOT WORK, and what each cost

All four kept the reactive two-branch shape. They are recorded because each one
looks reasonable and the measurements are the only reason to believe otherwise.

| attempt | plan jumps > 20° | worst | scrapes |
| --- | --- | --- | --- |
| baseline (135 as shipped) | 223 | 180.0° | 1 |
| 1. arc round the hull, axis recomputed | 113 | 154.6° | 7 |
| 2. ...with the way round LATCHED | 117 | 149.0° | 12 |
| 3. ...arc flown as a TANGENT, 45° | 330 | 133.4° | **0** |
| 4. continuous offset, no branch at all | **21** | 154.4° | 21 |

1. **Arc round the hull.** Replaces the radial push with an aim swung round
   toward the slot normal, and drops the range gate so a ship 3,000 units behind
   is not treated as "not close". Halves the jumps and starts scraping.
2. **Latch the way round.** Dead astern every way round is the same length, so
   the swing axis is a coin toss; latching it seemed obviously right. It is
   wrong: a latched axis goes stale as the ship comes round, and once the
   bearing lines up with it the rotation does nothing at all and the aim lands
   on the ship itself — the ill-conditioned heading 135 spent its whole budget
   removing. Attribution: 108 jumps INSIDE the detour with no branch change.
3. **Fly the tangent.** Fixes the scraping outright — the detour holds its
   radius instead of spiralling in. But a tangent is 45 degrees off the radial
   direction by construction, so the handover from orbiting to heading for the
   gate is discontinuous by that much, on every approach: median jump 4.3° →
   47.5°. **This is the attempt to build on**, and the missing piece is that the
   orbit must END at the gate rather than hand over near it.
4. **Delete the branch; offset the one aim continuously** by however much the
   straight line to it would cut the hull, falling to nothing as the path clears.
   The best jump number by a distance — 21 approaches, down from 223 — and it
   still scrapes 21 times, because an offset aim point does not stop the ship's
   own turn lag carrying it into the box. Widening the berth makes it far worse
   (at 4.5 half-widths the median jump is 170°, because the offset then fights
   the run-in as well). The lesson is that steering the AIM cannot fix a leg the
   ship is flying too fast to fly.

## Verification

- **The sweep:** plan jumps over 20 degrees, from 223 of 504 toward none, with
  docked, scrapes, time and 134's reversal columns no worse.
- **Unit:** each leg ends where it says it does, and the heading is continuous
  across each handover — the same shape as 135's commit check, which fails at
  162° without its fix.
- **The reported case:** parked on the far side, pointing at the station, the
  approach turns once and comes round, rather than reversing eight to ten times.
- **Fly it.**

## Where we are now

**M1 landed** — the sweep, the two side-blindness fixes, and the diagnosis
written where the defect is. M2–M4 are the path and are not started.

The defect Chris reported is characterised and measured but **NOT fixed**: 223 of
504 approaches still have a plan that jumps, and the worst still reverses through
180 degrees.

**To see it:** `npm run dock-probe | grep -E '· 180° +·'`. Those are the bearings
directly astern — mind the label, `45°/180°` is a 45-degree bearing at azimuth
180 and not the same thing — and every one of them jumps 170 to 180 degrees, with
9 to 11 pitch reversals and around 28 seconds against a 19-second median. The
`facing at` rows are Chris's own reproduction, parked on the far side pointing at
the station. The whole-sweep summary is the last three lines of a full run.
