# 135 — The approach is one frame deep

**Kind:** bug / fidelity · **Severity:** medium · **Size:** medium · **Depends
on:** 134 (landed) · **GitHub:** none — found by Chris flying 134's fix:
*"I think when we pitch to avoid things we pitch violently, and then pitch back
up. And then pitch violently again. How do we plan our trajectory and paths?"*

The premise in the question is worth answering first, because it is generous:
nothing is avoiding anything. There is no trajectory, no path and no lookahead
anywhere in the docking computer. `planDocking` runs fresh every frame and
returns one aim point; `dockingSticks` asks what stick brings the nose onto it
now. That is the whole system, and both halves of this item are consequences of
it.

## Where we are

**The violent pitch is the phase switch, and it fires on almost every
approach.** The gate phase aims at a point 800 units straight out from the slot.
The run phase aims at the station centre. A ship that satisfies the lined-up test
while INSIDE the gate distance — `along` may be anywhere from `dockZ` to
`gateDist * 1.5` — has been flying at a point behind it, and on commit the aim
point teleports to a point in front of it.

Measured over `dock-probe`'s 320 approaches, counting frames where the commanded
heading moves more than 20 degrees in one frame of 1/60s:

| what flipped | frames |
| --- | --- |
| gate → run, the normal commit | 216 |
| run → gate, a run giving up | 4 |
| the stand-off branch | 0 |
| **biggest single-frame jump** | **162.2 degrees** |
| approaches with at least one | 212 of 320 |

`pitchOnto` saturates at `STEER_SATURATION` (0.35 rad, 20 degrees), so any error
past 20 degrees asks for FULL stick, and there is no damping term anywhere in the
loop — the ramp limits how fast the rate builds, nothing sheds it. So the ship
pitches hard, overshoots, and rings back. That is the reported shape exactly:
violently, back, and again. It is not a rare failure mode; it is what committing
to the run looks like two times in three.

**Nothing avoids traffic, and no measurement covers it.** The only thing that
disengages the docking computer is the pilot touching the controls
(`world-step.ts:319`). There is no obstacle test of any kind. What is in the
lane is real: traders run the same `planDocking` corridor into the same slot
(`npc.ts:907-911`), and Vipers launch from it. A ship in the way is a ram —
`IMPACT.ram` to both parties and a `COLLISION` on the console.

And the gap is in the evidence as much as the code: **`train/dock-probe.ts` calls
`world.clearNpcs()` every frame**, deliberately, so that it measures the autopilot
rather than a dogfight. Every "320/320 docked" this project has ever quoted —
126's, 134's — was flown in an empty sky. Nothing has ever measured the
autopilot's approach through traffic, so the honest position is not "it is safe"
but "we do not know".

## What to do

**M1 — the aim point stops teleporting.** The commit must be continuous: the
heading the ship is asked for immediately after committing must be close to the
heading it was asked for immediately before. Whether that is best done by making
the gate aim slide along the axis as the ship closes, or by committing only
where the two aims already agree, is a question for measurement rather than for
this document — but `planDocking`'s approach geometry is delicate (docs/TODO/126
put a warning on it) and the smallest change that removes the discontinuity is
the one to keep.

The probe learns to score it, exactly as 134 taught it to count roll reversals:
the largest single-frame heading change becomes a column, because a jarring
approach that docks 320/320 is invisible without one.

**M2 — measure the approach through traffic, then decide.** A probe that does
NOT clear the sky: the same grid flown in a populated system, counting rams,
near misses and their cost. This is the number that does not exist, and it comes
before any avoidance code, because "we could easily crash into things" is a
hypothesis until it has one.

**M3 — conditional on M2's number.** If the approach really does collect rams,
the docking computer gets a way to deal with traffic. The design bias is to WAIT
rather than swerve: the slot is a queue, throttling back for a ship in the
corridor reads as traffic control, and it does not disturb the roll alignment
that 126 and 134 spent their whole budget getting right. Swerving is the option
that risks turning a cosmetic complaint into a missed letterbox.

## Decisions already made

- **Both halves, and in this order** (Chris, asked directly: *"smooth commit +
  traffic awareness"*). The jarring pitch is a real defect and cheap; the
  collision risk is possibly larger and is unmeasured, so it gets a number first.
- **M2 is a measurement, not a fix.** No avoidance code lands until the probe
  says how much there is to avoid. If the answer is "one ram in 320 approaches",
  M3 does not happen and the plan says so.
- **Waiting beats swerving**, if M3 happens at all. Recorded here so that the
  measurement is not read as a mandate for a steering behaviour.
- **`dockingSticks` is not reopened.** 134 landed two gates on that function and
  the reversal columns are where they should be. This item is about the PLAN —
  where the ship is being sent — not about the hand that flies it.

## Watch out for

- **The approach geometry is load-bearing.** `planDocking`'s standoff, corridor
  and gate distance are pinned by `test/docking.test.ts` (the gate is solved back
  out of the heading, not probed at a constant). Those tests must keep passing on
  their own terms, not be relaxed to fit.
- **NPC traders share `planDocking`.** Whatever M1 changes, every trader in the
  game flies it too, and `test/world.test.ts` covers their docking. A smoother
  commit for the player must not put traders through the letterbox side-on.
- **The phase is saved state** (`GameState.dockPlan`, snapshot.ts). A save taken
  mid-approach still has to restore into the same manoeuvre.
- **A populated probe is a noisier probe.** Traffic is seeded, so it is
  reproducible, but the answer will move with the seed — M2 needs two seed sets
  before its number means anything (CLAUDE.md's two-sample-sizes rule).

## Verification

Tier: unit for the discontinuity, plus the measured sweep for everything else.

- **Unit:** across the frame where the phase commits, the commanded heading moves
  by less than a stated angle. Failable by reverting the aim point, and it fails
  today by 162 degrees.
- **Sweep:** the largest single-frame heading change over 320 approaches drops
  from 162 degrees to a small number, with docked, median time, scrapes and the
  roll/pitch reversal columns from 134 no worse.
- **Traffic sweep (M2):** rams per 320 approaches in a populated sky, at two seed
  sets, before any avoidance exists — and again after, if M3 happens.
- **Fly it.** The complaint was about how the approach feels, and the pitch
  reversal count is a proxy for it, not a substitute.

## Where we are now

**M1 and M2 landed. M3 is recommended AGAINST on M2's own number** — see the
last section; the decision is Chris's and the evidence is here rather than an
opinion.

### M1 — the aim point stops teleporting

The fix is a lookahead, and it took three attempts because the first two were
each half of it:

1. **Never aim further out than the ship already is.** Reasonable, and worth
   almost nothing: the aim then sits `lateral` away — 44 units — and a heading
   toward a point the ship is sitting on is as ill-conditioned as the arrival it
   replaced. Median jump stayed at 42.8 degrees.
2. **Lead down the axis unconditionally.** Fixes the jump outright (42.8 → 4.0
   median) and ruins the docking: **335 scrapes against 1**, because a ship well
   off the axis that aims inward cuts the corner into the hull — precisely the
   failure the stand-off branch already existed to prevent.
3. **What shipped: a lookahead the ship EARNS by being lined up.** It ramps in
   over the last stretch of lateral, from the width at which a committed run
   gives up (`LINED_UP_LATERAL * 2`) to the corridor itself. Far off the axis
   this is the old gate, exactly; by the time the ship can commit, the aim has
   already swung round to point where the run points, so committing changes the
   speed and the roll handover and nothing else.

`DC_GATE_LOOKAHEAD` is **half the gate distance**, and a share rather than a
distance because the cliff in the sweep is at a fraction of the gate: the worst
single-frame heading change is 10.4 degrees at a quarter, 6.2 at three eighths,
4.3 at a half, then 141 and 142 at three quarters and the whole of it. A bigger
station has a gate further out and should lead by more.

| | docked | median | worst | scrapes | roll rev | fell back | jump median | jump worst |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| after 134 | 320/320 | 16.8s | 25.2s | 1 | 8 | 4 | 42.8° | 162.2° |
| after 135 | 320/320 | **15.0s** | **23.8s** | **0** | 8 | **0** | **3.5°** | **4.3°** |

Every column improved, and two of them answer older questions. **Zero scrapes**
— the sweep no longer touches the station at all. And **zero fall-backs**, which
retires the open question docs/TODO/134 left in the backlog: runs were giving up
because the aim discontinuity threw them off the axis, so it was never a defect
of its own. The backlog entry goes.

A second, independent grid agrees on the commit (median jump 3.7 degrees) and
shows the one thing that is NOT fixed: a run that gives up still reverses, 150
degrees on the single approach out of 320 where that happened. That is a change
of intent rather than a jitter — the plan really has changed its mind — and at
one in 320 with no scrape attached it is left alone deliberately.

**Both halves are proved failable.** Reverting the lookahead puts the unit check
at 162.0 degrees, which is the sweep's own worst case arriving in a test.

`test/docking.test.ts` was 443 lines and over the ceiling, so it split along the
seam the constants already have: `test/docking-computer.test.ts` is the HAND —
every check that calls `planDocking` or `dockingSticks` directly — and the
original keeps the letterbox and everything that needs a real `WorldStep` frame.

One test moved that is a finding rather than a fixture tweak.
`test/snapshot.test.ts` has a control proving that resetting the docking latch
changes something; at 60 units off the axis it now drifts only 5.4 units instead
of the 10 it demands, **because the two phases no longer disagree about
direction**. The disturbance moved to 85, where the lookahead has not been
earned and the gate really does send you back out, and the reason is written
beside it.

### M2 — the sky, measured for the first time

`npm run dock-traffic` (new): the same approaches with nothing cleared, in a
world that populates itself. Two seed sets, 40 approaches each.

**Building the probe found the reason nobody had this number.** A freshly built
world is *empty*: traders arrive on a ~50–160s timer from 22,000 units out and
have to fly all the way in, and an approach takes fifteen seconds. The first
version of this probe carefully did not clear the sky and measured **0 ships** —
a fact about the fixture, not the game. So the world is pre-rolled for five
minutes with the ship parked and the autopilot off, and only then is the
approach flown.

| | docked | died | rams | fatal | closest pass | lane at engage |
| --- | --- | --- | --- | --- | --- | --- |
| seed set A | 40/40 | 0 | 0 | 0 | 66 units | 0.47 ships |
| seed set B | 40/40 | 0 | **1** | **0** | 51 units | 0.30 ships |

**One collision in eighty approaches, and it was not fatal.** That last column
is the one that decides the severity, and it is why it is measured separately: a
ram that KILLS runs `destroyNpc` → `Combat.destroy`, which pushes an `offence`
for the victim's role — so a docking computer that rams a trader to death files
a criminal record against a commander who did not fly the manoeuvre. That path
is real and it was not reached: at docking speeds a ram costs damage and a
`COLLISION`, not a life.

### M3 — recommended against, on the number M2 exists to produce

The plan said M3 happens only if the approach really does collect rams, and set
the bar at "one ram in 320 approaches". The measurement is one in eighty, none
fatal, in a lane holding 0.3–0.5 ships. That is above the bar and a long way
below what would justify the intervention:

- The approach currently measures **320/320 docked with zero scrapes** —
  materially better than anything this project has shipped. Avoidance is new
  behaviour in the one manoeuvre where two items in a row have shown that a
  plausible-looking change ruins the letterbox (this item's own attempt 2: 335
  scrapes).
- A ram costs damage and a message. It is a bump, not a death, and not a crime.
- The lane is thin because a fresh system is thin. A busy economy discounts the
  arrival gap and would be denser, so the honest statement is that this number
  describes an ordinary system rather than the worst one.

If it is built anyway, the design bias stays as written: **wait, do not swerve**.
Throttling back for a ship in the corridor reads as traffic control and leaves
the roll alignment alone; steering around it spends the axis that 126 and 134
spent their whole budgets getting right.

`npm run dock-traffic` is committed and permanent either way, so the next person
to ask "can it crash into things?" gets a number rather than an absence.
