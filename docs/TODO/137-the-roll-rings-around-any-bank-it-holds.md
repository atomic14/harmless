# 137 — The roll rings around any bank it holds

**Kind:** bug · **Severity:** medium · **Size:** medium · **Depends on:** 136
(landed), which measured it · **GitHub:** none — the residue of #23, found by
`npm run dock-probe`'s reversal columns after 136 removed everything else that
was moving.

## Where we are

**The autopilot's roll hunts around any bank it is asked to hold**, at roughly
one reversal a second and ±1.0–1.5 rad/s against a hull cap of 2.5. It is not
the approach: it is the same on a dead-straight run down the axis as on a curve,
and it was the same BEFORE 136 replaced the approach with a path.

**What it costs is measured at the letterbox** (Chris, flying 136: *"how closely
do we match the rotation?"*). The wings arrive **7.5 degrees off the slot's long
axis in a median approach and 30 at worst, against 37 degrees of tolerance** —
so a median approach spends a fifth of what the letterbox allows on nothing, and
the worst spends four fifths of it. The approach 136 replaced arrived at 1.7 and
20: it flew its last thousand units dead straight with the nose settled, so the
turn had no claim on the roll axis and the slot's own attitude was all that was
left. A path is still correcting as it goes in, the turn keeps a claim, and the
ring puts the wings wherever it happens to be at the mouth.

Traced on the shipped code, a ship on the axis 500 units out, lined up, lateral
5–8 units, nose 3 degrees off the plan:

```
r=482 v=110 ph=run err=3° roll=-1.67    r=372 v=110 ph=run err=3° roll=+0.72
r=460 v=110 ph=run err=3° roll=-1.10    r=350 v=110 ph=run err=3° roll=-0.22
r=438 v=110 ph=run err=3° roll=-0.20    r=328 v=110 ph=run err=3° roll=-0.69
r=416 v=110 ph=run err=3° roll=+0.18    r=306 v=110 ph=run err=3° roll=-1.65
r=394 v=110 ph=run err=3° roll=+1.20    r=284 v=110 ph=run err=3° roll=-1.41
```

The same fixture on the approach 136 replaced swings ±1.0–1.4 at the same period,
so this is `dockingSticks`, not `planDocking` — the plan is steady throughout,
which is the point: the heading error sits at 3 degrees and does not converge,
because the ship is rolling underneath its own pitch plane the whole time.

**Why 134 did not catch it.** 134 (#23) fixed the roll asked for when the turn's
axis is MEANINGLESS — `nose × heading` vanishes as the nose arrives, and the
autopilot chased the residue at full stick. `DC_TURN_FADE_ANGLE` fades the claim
to nothing there. This is the other case: a roll demand that is REAL, held, and
overshot. The median approach went 17 → 8 reversals on 134's grid and it was
read as fixed; the remaining 8 are this.

**Why 136 made the columns worse without making the flying worse.** A path curves,
so the ship holds a bank for most of the approach and collects more of the ring;
the reactive approach flew straight legs and reversed its PLAN instead. Over the
504-approach sweep the median went 10 → 18 reversals and 1.2 → 1.9 turns of roll
swept, while pitch reversals went 5 → 4 and plan reversals went 223 → 0.

## The diagnosis, as far as it goes

A proportional roll ask (`steerStick`, saturating at `STEER_SATURATION`) behind a
rate ramp (`PLAYER_FLIGHT.rateRamp`) is a second-order loop with no damping term.
Full stick at `STEER_SATURATION` (0.35 rad) and `maxRoll` 2.5 rad/s is a gain of
about 7 per second, against a ramp time constant of a quarter of a second: enough
to overshoot and ring after any disturbance. The arithmetic is worth checking
before it is trusted, but the trace is not: what it shows is a loop that never
settles. And the disturbance never stops, because pitch and roll are coupled —
the ship rolls past the bank, the
pitch plane sweeps with it, the heading error moves in the ship's own frame, and
the roll is asked for again.

`pitch-roll-steer.ts` records that a roll DERIVATIVE term was tried for the
scripted co-pilot and dropped — "damped close-up chatter but drove sustained
banking on a far target". That is a finding about the gun cone, not about the
letterbox, and the docking computer is a different caller with a different
equilibrium; it should be re-measured here rather than assumed.

## What to do

**M1 — a number for the ring, at the level of the hand.** `dock-probe` has the
two roll columns already (reversals and turns swept). What is missing is a fixture
that isolates the loop: hold a steady bank demand and measure whether the roll
settles. Without it, any fix is being judged through a whole approach.

**M2 — damp it.** The candidates, cheapest first, and all of them are inside
`dockingSticks` or the ramp it feeds:

- a rate term on the roll ask (the co-pilot's rejected derivative, re-measured
  against the letterbox rather than the gun cone);
- a deadband on the roll ask the size of the slot's own spare tolerance, which is
  the same argument `nullBand` makes for `bankToTurn` — the letterbox does not
  care about the last two degrees, so nothing should be asked for them;
- a slew limit on the roll RATE while the nose is inside the fade angle.

**M3 — hold the line that 136 bought.** The plan column is not to move: 504/504,
zero scrapes, no single-frame heading jump over 20 degrees.

## Decisions already made

- **This is the hand, not the plan.** Measured both sides of 136: the ring is
  identical before and after, on a straight approach.
- **The reversal count alone is not the target.** A ship flying a curve has to
  hold a bank, and a controller holding one legitimately corrects it; the columns
  to move together are reversals AND turns swept, which is why the second exists.

## Watch out for

- **NPC traders do not come through `dockingSticks`.** They steer with `lookAt`
  and cannot be hurt by this; nothing here changes what a trader flies.
- **`bankToTurn` is the scripted co-pilot's and is NOT in scope.** It shares
  `steerStick` and `STEER_SATURATION` with the docking computer, so a change to
  either of those is a change to combat: `test/combat-model.test.ts` and the
  exercise reports are the gate if that is where the fix lands.
- **134's fixtures are the regression suite.** The roll near the heading, the
  fade's ratio and the budget the letterbox allows are all pinned in
  `test/docking-computer.test.ts` and none of them may move.

## Verification

- **The steady-bank fixture** (M1): the roll settles rather than ringing.
- **The sweep**: the wings arrive closer to the slot's long axis — 7.5 degrees in
  a median approach today, 1.7 for the approach 136 replaced — with reversals and
  turns swept down too, and docked, scrapes, time, pitch and the plan's own jump
  column no worse.
- **Fly it.** This is a feel defect first and a number second: the question is
  whether the ship comes round the hull like a ship or like a metronome.
