# 137 — The roll rings around any bank it holds

**Kind:** bug · **Severity:** medium · **Size:** medium · **Depends on:** 136
(landed), which measured it · **GitHub:** none — the residue of #23, found by
`npm run dock-probe`'s reversal columns after 136 removed everything else that
was moving.

## Where we are

**M1–M3 landed.** The roll has a damping term (`DC_ROLL_LEAD`), and the bank the
turn may hold at the letterbox was re-chosen once the ring stopped hiding it
(`DC_SLOT_MARGIN`, 0.5 → 0.30). Both are `dockingSticks`, which is its own file
now — `game/docking-sticks.ts`, along the seam the constants and the tests
already had.

| 504-case sweep | docked | median | worst | scrapes | roll rev | turns rolled | pitch rev | nose in | wings in | jumps > 20° |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| before | 504/504 | 16.4s | 31.6s | 0 | 18 | 1.9 | 4 | 5.4° | 7.5° (worst 30.0) | none |
| after | 504/504 | 16.4s | **31.5s** | 0 | **12** | **0.9** | 4 | 6.3° | **4.4°** (worst **13.8**) | none |

Both roll columns moved together, which is what the plan asked for: a controller
that had simply given up would have taken the reversals down on its own. A second
independent grid of 336 approaches agrees on every median (18 → 12 reversals,
7.8° → 4.2° at the letterbox). `npm run dock-traffic` is unchanged at 80/80
docked and no collisions.

**What it cost is the NOSE**, and it is the same bank spending itself twice: the
ship goes through the letterbox 0.9 degrees further off the slot's axis in a
median approach (5.4 → 6.3) and 2.7 closer at worst (12.4 → 9.7). The bank the
turn holds IS the correction, so buying wings sells nose. Both are far inside
what the slot takes.

### What the defect actually was

**The autopilot's roll hunted around any bank it was asked to hold**, at roughly
one reversal a second and ±1.0–1.5 rad/s against a hull cap of 2.5 — the same on
a dead-straight run down the axis as on a curve, and the same BEFORE 136 replaced
the approach with a path.

A proportional ask (`steerStick`, saturating at `STEER_SATURATION`) driving a
rate ramp (`PLAYER_FLIGHT.rateRamp`) is a second-order loop with no damping term.
The arithmetic the plan asked to have checked before it was trusted: full stick
at 0.35 rad against 2.5 rad/s is a gain of 7.1/s, against a ramp time constant of
0.242s, so the loop sits at a damping ratio of 0.38 — 25% overshoot and a ring.
Measured on the isolated fixture: a 30-degree bank overshot by 7.6 degrees,
reversed twice and took 1.5s to settle.

**And on the run in it was ±40 degrees, not ±7.** Traced frame by frame through
the shipped step, the wings swung from 49 degrees one side of the slot to 23 the
other and back, twice, in the last 400 units — because the disturbance never
stops: the ship rolls past the bank, its pitch plane sweeps with it, the heading
error moves in the ship's own frame, and the roll is asked for again.

**Which is why the entry-roll column was never what it looked like.** 7.5 degrees
in a median approach was not a controller sitting 7.5 degrees off; it was a
±40-degree swing sampled wherever the letterbox happened to catch it. Damping it
alone took the median UP to 8.8 with the reversals down at 12, and that was the
fix working: the ship now sat where it was asked, and where it was asked was the
whole 18.6 degrees `DC_SLOT_MARGIN` allowed. So the two constants had to be
chosen together, and the second one is now measurable for the first time — the
wings arrive at 3.1, 3.8, 4.3, 5.0 and 5.5 degrees for margins of 0.25, 0.28,
0.30, 0.33 and 0.35, a straight line through the constant.

**0.30 is the knee, not the floor.** Below it the median keeps falling and the
worst case blows out past where it started — 33.5 degrees at 0.25, 34.3 at 0.28,
against 30.0 before this item — on both grids, so it is a signal rather than one
unlucky approach: that is the turn being refused a bank it genuinely needs, the
correction going unmade, and the ship rolling hard at the mouth. Below 0.15 it is
scrapes and a plan that jumps again.

## What was tried and measured away

**A feedforward for the station's own spin.** The letterbox turns at
`STATION_SPIN` (0.26 rad/s) forever, so holding the wings on it is a standing
roll rate, which a proportional law can only produce by holding a standing error
— 1.8 degrees, and the lead term adds to it (3.3 at a lead of 0.10, 4.8 at 0.20).
Crediting the roll the slot itself asks for removes the added lag exactly, and on
a fixture it does: the standing error stays 1.8 at any lead. In flight it is
worth **0.1 degrees** at the letterbox on both grids, because what the wings
arrive with is set by the bank the turn is holding and not by the lag. It cost a
field on the plan, an import of the station's spin into the flight law and a gate
for the phase, so it is not there. Recorded in `DC_ROLL_LEAD`.

**A bigger lead.** The reversals keep falling with it — 18 with no term, 14 at
0.06, 12 at 0.10, 10 at 0.16, 9 at 0.28 — and past 0.10 it costs the nose, and
past 0.28 the plan itself starts jumping and the sweep scrapes. Two grids put the
flat part of the trade at 0.08–0.12.

The other two candidates in the plan — a deadband the size of the slot's spare
tolerance, and a slew limit inside the fade angle — were not needed once the loop
was damped and are not there. A deadband would still be the answer if the wings
ever chattered at rest; they do not.

## Decisions already made

- **This is the hand, not the plan.** Measured both sides of 136: the ring is
  identical before and after, on a straight approach.
- **The reversal count alone is not the target.** A ship flying a curve has to
  hold a bank, and a controller holding one legitimately corrects it; the columns
  to move together are reversals AND turns swept, which is why the second exists.

## Watch out for

- **NPC traders do not come through `dockingSticks`.** They steer with `lookAt`
  and cannot be hurt by this; nothing here changed what a trader flies, and
  `npm run dock-traffic` says so.
- **`bankToTurn` is the scripted co-pilot's and was NOT touched.** `steerStick`
  and `STEER_SATURATION` are unchanged, so combat is untouched by construction.
- **134's fixtures are the regression suite.** The roll near the heading, the
  fade's ratio and the budget the letterbox allows are all still pinned in
  `test/docking-computer.test.ts`; the budget check reads `DC_SLOT_MARGIN` rather
  than a number, so it moved with the constant instead of being edited.

## Verification

- **The steady-bank fixture** (M1) — `test/docking-computer.test.ts`, the last
  block. It flies the shipped roll ask through the commander's own ramp and caps
  with the demand standing still: a 30-degree bank now stops 1.8 degrees past it
  with one reversal and settles in 1.02s, and a 10-degree bank does not reverse
  at all. **Proven to fail**: with the lead at 0 both checks go red (7.6 degrees
  past, two reversals, 1.52s), and at half the value they still do.
- **The sweep** — done, table above, on two grids.
- **Fly it** — NOT DONE. This is a feel defect first and a number second: whether
  the ship comes round the hull like a ship or like a metronome, and whether
  arriving with the wings 4 degrees off reads as lined up. The numbers say the
  metronome is gone; nobody has watched it.
