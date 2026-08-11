# 136 — The approach has never been flown from behind

**Kind:** bug · **Severity:** medium · **Size:** large · **Depends on:** 135
(landed) · **GitHub:** none — found by Chris flying 135: *"I'm still seeing
extreme pitch. You can recreate by placing the ship on the other side of the
station pointing towards it."*

## Where we are

**M1–M3 landed. The reported defect is fixed and measured.** The approach is a
PATH now (`game/dock-path.ts`), and the plan is a point one lookahead along it.

| 504-case sweep | docked | median | worst | scrapes | roll rev | pitch rev | jumps > 20° | worst jump | nose in | wings in |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| before | 504/504 | 19.4s | 38.6s | 1 | 10 | 5 | **223 of 504** | **180.0°** | 2.9° | 1.7° |
| after | 504/504 | **16.4s** | **31.6s** | **0** | 18 | **4** | **none** | **1.1°** | 5.4° | 7.5° |

The last two columns are Chris's, flying it, and they were added because of him:
how far off the slot's axis the ship is still POINTING as it goes through the
letterbox, and how far its wings are off the slot's long axis (against 37° of
tolerance). Nothing else in the sweep can see either.

Chris's own case — parked on the far side, pointing at the station — went from 28
seconds, ten full-authority pitch reversals and a plan that turned through 180
degrees, to 16 seconds, one pitch reversal and a plan that moves a degree.
`npm run dock-traffic` also went from one non-fatal collision in eighty
approaches to none.

**Two rounds of flying it landed on top of this item and are in the numbers.**
*"It feels quite tight into the slot so the angle seems a bit too much"* — the
funnel dived all the way to the letterbox, so the ship went through it still
turning, at 13.6 degrees in a median approach. It has a straight RUN IN now
(`RUN_IN_WIDTHS`) and goes through at 5.4. *"How closely do we match the
rotation?"* — 20.4 degrees when he asked, which is a fair thing to notice: the
roll is handed over a gate distance out instead of at the corridor now, and the
projection blend below took the rest. 7.5, against the old approach's 1.7 and
37 of tolerance. The rest of that gap is the roll ring, which is 137.

**M4 (replanning round traffic) is named but NOT started**, as the plan always
said. Nothing in the shape forecloses it: the curve is a function of two ends and
a plane, and a plane pushed off the traffic is still a path of this shape.

## What landed

**The curve** (`dockPathRadius`), in the plane holding the ship, the station and
the slot axis, as a radius for every bearing round from the slot normal. It is
the larger of two terms, which cross where they are equal, so there is no join:

- **the stand-off** — a FIXED funnel holding the gate distance from `TURN_IN`
  (a quarter turn) round to astern, and diving to the slot inside it as the
  square root of the bearing left;
- **the descent** — `range * (bearing left / bearing at the ship)`, the ship's
  own way in through where it actually is.

**The follower.** The path is marched (`STEPS` samples, in equal fractions of the
bearing rather than at a fixed angle, so nothing steps as a sample is crossed),
and the aim is the point one `DC_PATH_LOOKAHEAD` along it from where the ship is
on it. WHERE it is on it is blended rather than chosen: the path's own start
while it is coming round, the nearest point of the path once it is lined up, and
the second spent only as far as the corridor has earned it. Neither alone works
and both failures were measured — a nearest-point projection SWAPS for a ship
deep inside the funnel, which is near two parts of it at once (the aim slid a
quarter of the way round the station in one frame, 21 degrees), and switching
between them on the run latch moves the aim 149 units in the frame it switches
(12 degrees, on every approach).

**The plane is held** (`DockPlan.swing`, saved state). A ship directly astern has
zero distance off the axis line, so its own position cannot say which way round
to come, and the tie is a coin toss a sideways nudge can flip. Near the line the
plane is rotated from the held one toward the ship's own by as much of the angle
between them as the ship has earned by being off the axis at all — exact at both
ends, and one rotation rather than a choice between two answers.

**The phase stopped deciding where the ship goes.** `gate` and `run` fly the same
curve; the latch is now only the roll handover (`dockingSticks`) and the flag
that lets a trader into the station (`collisions.ts`). The handover itself moved
out to a gate distance from the slot, measured along the path — the wings then
have the whole dive to settle on the letterbox rather than the run in alone, and
arrive 7.5 degrees off it instead of 12.9.

## Three things the measurements decided, against what looked right

1. **The path must NOT be re-rooted on the ship.** A follower aimed a lookahead
   along a curve flies inside it by half a lookahead of radius per radian of
   bearing — 200 units a radian here — so a path recomputed through the ship's
   own radius every frame spirals into the hull with nothing pulling back: 353
   scrapes in one sweep, every one of them from 900 units out. Against a funnel
   that does not move, the same follower settles a bounded distance inside
   instead (a lookahead squared over twice the radius, 100 units), and the gate
   distance has room for that.
2. **The lookahead is clamped by what is LEFT of the path, not just by the gate.**
   Aiming at the path's end — the station's centre — makes a ship hold its
   bearing rather than close it, so it arrives at the hull face carrying whatever
   it was off by: four scrapes an approach. Both clamps are the same number.
3. **The run in must FOLLOW a ship that is already on it.** Held at its own
   radius, the whole path sits behind a ship on short final and the aim, one
   lookahead along it, lands astern: the plan reverses through 180 degrees at
   exactly the moment the ship crosses the join. It follows by the same corridor
   membership the projection blends on, so the two move together.
4. **Slowing for the bend was written, measured and deleted.** Capping the speed
   so the nose's lag stays inside `DC_TURN_FADE_ANGLE` reads well and costs more
   than it buys: the ring it aims at is about one reversal a second whatever the
   speed, so slowing only buys more seconds of it (15.6s/16 reversals unlimited,
   18.0s/17 at 0.20 rad/s, 23.9s/20 at 0.12, 34.3s/25 at 0.08). What actually
   fixed the scraping was the lookahead. The reasoning is kept at the speed law
   in `planDocking` so it is not rediscovered.

## The roll is the next item, and it is the HAND

The roll columns are the one place this is worse: a median approach reverses 18
times against 10 and sweeps 1.9 turns against 1.2, and the wings arrive 7.5
degrees off the slot against 1.7. It is not the path.

`dockingSticks` rings around any bank it is asked to hold. Traced on a
dead-straight run down the axis, lined up, with the nose 3 degrees off: the roll
swings ±1.0–1.4 rad/s at about 1 Hz and never settles — in the version BEFORE
this item as well as after it. The loop is proportional with a rate ramp behind
it, which is underdamped at this gain, and 134's fade fixed the case where the
axis is meaningless (the nose dead on) without touching the case where the
demand is real. A path curves, so it holds a bank for most of the approach and
collects more of the ring; the old approach flew straight legs and reversed its
PLAN instead, which is the defect this item existed for.

Per bearing, the trade is plain — pitch reversals fall everywhere the ship has to
come round, roll reversals rise with how far round it comes:

| bearing | seconds | roll rev | pitch rev |
| --- | --- | --- | --- |
| 0° (head-on) | 12.7 vs 13.6 | 7.4 vs 5.4 | 2.8 vs 1.6 |
| 90° | 16.0 vs 19.1 | 15.4 vs 9.8 | 1.6 vs 4.2 |
| 180° (astern) | 22.6 vs 33.1 | 26.2 vs 6.4 | 3.1 vs 10.1 |

(measured on the version before the run in leg; the shape of the trade is the
same after it, and the wings column is the one that reaches the letterbox)

**This was not fixed here**, because 134 and 135 both settled `dockingSticks` and
this item's own decision was that it is about WHERE the ship is sent. The
evidence for reopening it is now on the table and it is a damping problem, not a
geometry one.

## Decisions already made

- **The probe grid comes first** — landed in M1, and it is the whole reason any
  of this was arguable.
- **A path, not branches** (Chris): *"we should be able to make a path that you
  fly on smoothly to get in front of the docking port... then the docking
  computer's job is to just fly along that path. That could then be easily
  replanned to avoid collisions."* The four rewrites below all kept the reactive
  shape and all failed.
- **`dockingSticks` is not reopened.** Held to, and see above for what that cost.
- **320/320-and-zero-scrapes is the floor.** Met: 504/504 and zero scrapes, with
  the head-on cases 0.9s faster than before.

## Watch out for

- **NPC traders share `planDocking`.** They fly the path too; `test/world.test.ts`
  and `npm run dock-traffic` cover them, and traffic collisions went to zero.
- **The phase is saved state**, and there is now a second field beside it:
  `DockPlan.swing`, the held plane. `snapshot.ts` walks it generically.
- **Speed is part of the manoeuvre** — see decision 3 above for the version of
  that which is true and the version that is not.

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
| **the path (M2–M3, landed)** | **0** | **3.4°** | **0** |

1. **Arc round the hull.** Replaces the radial push with an aim swung round
   toward the slot normal, and drops the range gate so a ship 3,000 units behind
   is not treated as "not close". Halves the jumps and starts scraping.
2. **Latch the way round.** Dead astern every way round is the same length, so
   the swing axis is a coin toss; latching it seemed obviously right. It is
   wrong: a latched axis goes stale as the ship comes round, and once the
   bearing lines up with it the rotation does nothing at all and the aim lands
   on the ship itself. Attribution: 108 jumps INSIDE the detour with no branch
   change. **The path holds a plane and does not have this problem**, because the
   ship flies along the path and so stays in the plane it is holding: the hold is
   refreshed by the flying.
3. **Fly the tangent.** Fixes the scraping outright — the detour holds its
   radius instead of spiralling in. But a tangent is 45 degrees off the radial
   direction by construction, so the handover from orbiting to heading for the
   gate is discontinuous by that much, on every approach: median jump 4.3° →
   47.5°. Its lesson — that the orbit must END where the run begins rather than
   hand over near it — is what the funnel does by being one curve.
4. **Delete the branch; offset the one aim continuously** by however much the
   straight line to it would cut the hull, falling to nothing as the path clears.
   The best jump number of the four and it still scraped 21 times, because an
   offset aim point does not stop the ship's own turn lag carrying it into the
   box. The lesson is that steering the AIM cannot fix a leg the ship is flying
   too fast to fly.

## Verification

- **The sweep** — `npm run dock-probe`: done, table above.
- **Unit** — `test/docking-computer.test.ts` walks the plan from 66 starts over
  the whole sphere and asserts every one arrives with no single-frame heading
  jump over 20 degrees. On the approach this replaced, the same walk reverses
  through 180 degrees from directly astern and never arrives at all (3 of its 66
  do not). `test/docking.test.ts` holds the curve itself to the letterbox: it is
  inside the slot channel wherever it is inside the hull box (11.1 units against
  26), and goes red at 44.8 if the funnel's shape is straightened.
- **The reported case** — done, above.
- **Fly it** — done, twice, and both rounds are in the table: the approach and
  then the angle into the slot. What is left to feel for is the rotation match,
  which is 137.
