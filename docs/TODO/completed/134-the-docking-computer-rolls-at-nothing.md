# 134 — The docking computer rolls hardest when it is dead on course

**Kind:** bug / fidelity · **Severity:** medium · **Size:** medium · **Depends
on:** none · **GitHub:** #23 — *"Docking computer seems to occasional oscillate.
Looks like a similar control problem to the combat computer"*

The guess on the issue is right, and it is more specific than it looks: the
combat computer had exactly this failure, fixed it three ways, and none of the
three was carried across to the docking computer.

## Where we are

`dockingSticks` (`src/game/docking.ts:187-212`) decides the roll from two
angles — where the wings must be to fit the letterbox (`slotErr`) and where they
must be for the ship to pull its nose round (`turnErr`) — and clamps the second
into a window around the first. `turnErr` is measured against the turn axis:

```ts
_turn.crossVectors(_nose, plan.heading);   // docking.ts:194
const turnErr = rollErrorTo(quat, _turn);
```

**That axis vanishes at exactly the moment the controller succeeds.** Its length
is `sin(theta)`, `theta` being how far off the heading the nose is, so a ship
flying the plan perfectly has a zero-length turn axis whose *direction* is
numerical residue. `rollErrorTo` normalises it and asks for a proportional roll,
guarded only by `wanted.lengthSq() < 1e-12` (`pitch-roll-steer.ts:240`) — a
length of 1e-6, six orders of magnitude below where the direction stops meaning
anything.

So the wings chase noise at full stick. Traced from the middle of a real
approach (left 1500 off · 900 out · spin 0.9), while the nose sits **on** the
gate heading:

```
  3.55s  gate  theta 0.0deg  |turn| 0.0008  turnErr -64.6deg  roll -1.00  rate  1.30
  4.03s  gate  theta 0.1deg  |turn| 0.0025  turnErr   0.2deg  roll  0.01  rate -0.65
  4.43s  gate  theta 0.0deg  |turn| 0.0001  turnErr -89.6deg  roll -1.00  rate  1.11
  4.88s  gate  theta 0.0deg  |turn| 0.0005  turnErr   0.2deg  roll  0.01  rate -0.63
  5.35s  gate  theta 0.0deg  |turn| 0.0000  turnErr -70.6deg  roll -1.00  rate  1.28
```

Four and a half seconds of nothing to correct, and the ship rolls hard over and
back every 0.45s at ±1.3 rad/s. That is the report: not a wobble near the slot,
but the autopilot rolling at nothing while it is doing well.

**The budget does not catch it.** `onAxis` is zero while `plan.lateral` is
larger than `LINED_UP_LATERAL` (45), so `budget` is a full 90 degrees and the
window around `slotErr` is wide enough to pass the garbage straight through. The
clamp was built for the run-in, and this happens on the way to the gate.

**Measured over the shipped probe grid** (320 approaches, roll-rate sign
reversals counted with a 0.05 rad/s deadband):

| | docked | roll reversals, median | worst | worst per second | dropped out of `run` |
| --- | --- | --- | --- | --- | --- |
| today | 320/320 | 17 per approach | 29 | 1.96 | 7 of 320 |

Pitch, over the same runs, reverses 2–7 times. The axis with the problem is the
one with the degenerate error.

**This is why it survived docs/TODO/126.** `npm run dock-probe` scores docked,
seconds and scrapes, and all three are still fine — 320/320, median 16.8s, 3
scrapes. The probe cannot see the symptom, so nothing failed when it appeared.

**What the combat computer does that this does not.** `bankToTurn` faces the
same collapsing geometry and has three defences (`pitch-roll-steer.ts:94-165`),
each added after a measured limit cycle:

- roll authority fades with the off-nose angle (`ROLL_FADE_ANGLE`,
  `ROLL_FADE_FLOOR`) — "ungated it asks full roll for a tiny error";
- a `nullBand` deadzone, inside which it asks for nothing at all;
- `SteerMemory`, a sticky choice that stops a per-frame coin-toss chattering.

`dockingSticks` has none of them. It could not simply borrow `bankToTurn` — the
roll has a second job here — but it inherited none of what that function learnt.

## What to do

**M1 — the probe scores the symptom.** `train/dock-probe.ts` counts roll-rate
sign reversals per approach (deadband 0.05 rad/s, so a coasting axis is not
noise) and reports median, worst, and worst-within-one-second alongside the
existing columns. Commit the before numbers in the table above. The bug is
invisible to the current gate, and a fix nobody can measure is a preference.

**M2 — the turn stops asking for a roll it cannot justify.** When `theta` is
small there is no turn to make, so the turn has no opinion about the roll axis
and the stick belongs entirely to the slot. Fade `turnErr`'s claim by `theta`
and let `slotErr` stand as `theta` goes to zero.

This keeps the property docs/TODO/126 paid three attempts for — one law, one
equilibrium — rather than reintroducing the blend that failed there. The blend
that rolled into the hull mixed two laws at a *fixed* ratio, so neither error
could reach zero; a fade governed by `theta` has a single fixed point at each
end: far off the heading it is the turn's roll, clamped by the letterbox budget
exactly as now, and on the heading it is the slot's roll, which is the roll the
ship wants anyway.

The degeneracy guard in `rollErrorTo` is left alone. Raising `1e-12` would be
tuning a threshold in a shared helper on behalf of one caller; the fade makes
the guard's exact value stop mattering, which is the better fix.

**M3 — conditional, and re-measured before it is written.** Seven of 320 runs
fall out of the `run` phase back to `gate` mid-approach, which is the latch
escape at `lateral > LINED_UP_LATERAL * 2` firing on a ship that has been thrown
off the axis. In the trace the lateral distance goes 27 → 50 → 66 while the roll
is slamming, so this is most likely a *consequence* of M2's bug. Re-run the
probe after M2. If the count is zero, M3 does not exist and the plan says so.
If it survives, it is a separate defect and gets its own diagnosis.

## Decisions already made

- **The approach is not the problem.** `planDocking` is untouched, as in 126: the
  standoff, the corridor and the slot normal are right. Only the stick changes.
- **A fade, not a deadzone.** A hard null band on `theta` is the other obvious
  shape, and the reason to prefer the fade is on the record: 126's attempt 2 was
  a null band, and it worked well enough to expose the next bug. A fade
  degenerates to the same thing without a cliff for a ship sitting on the
  boundary, and it is what the combat computer settled on for the same axis.
- **Any new constant lives in `constants/docking-computer.ts`.**
  `npm run constants:find "roll fade"` returns `ROLL_FADE_ANGLE` (0.35) and
  `ROLL_FADE_FLOOR` (0.5), both documented as *the co-pilot's* — a gun cone's
  numbers, not a letterbox's. If the value coincides it still gets its own
  `@rule` id, so retuning the dogfighter cannot silently retune the approach.
- **The success rate is the ceiling, not the target.** 320/320 docked, median
  16.8s, 3 scrapes is what shipped. A smoother autopilot that docks 318 times is
  a regression and does not land.

## Watch out for

- **NPC traders do not come through `dockingSticks`.** They dock via
  `steerToward`/`lookAt` (docking.ts header). Nothing here should change what a
  trader flies, and `test/world.test.ts` still has to pass untouched.
- **The phase latch is saved state** (`GameState.dockPlan`, snapshot.ts). A save
  taken mid-approach must still restore into the same manoeuvre.
- **`plan.lateral` is the fade's neighbour, not its input.** `onAxis` and the
  budget already read lateral; the new fade reads the off-nose angle. Two
  different quantities, and conflating them puts the slot's roll back in charge
  while the ship is still off the axis, which is the case the budget exists for.
- **Do not fade the pitch.** `pitchOnto` is deliberately ungated (126's attempt
  2 measured the nose drifting 6 to 15 degrees off when it was not), and the
  measurement here shows pitch reversing 2–7 times a run against roll's 17.

## Verification

Tier: unit, plus the measured sweep — the same tier 126 used, since this changes
the same control law.

- **Unit, `test/docking.test.ts`:** given a plan whose heading the nose is
  already on, `dockingSticks` asks for the roll the SLOT wants and nothing the
  turn wants — asserted as an angle, not against the implementation's own
  arithmetic. Given a heading well off the nose, the turn's roll is unchanged
  from today, clamped into the letterbox budget as before.
- **Unit:** a ship on the heading with wings already lined up asks for no roll at
  all. This is the reported symptom stated as an assertion, and it fails today.
- **Sweep, `npm run dock-probe`:** roll reversals down by an order of magnitude
  at the median, with docked at 320/320, the median time no worse than ~18s and
  scrapes no higher than 3. Numbers before and after go in the commit.
- **Prove the gate can fail** by reverting the fade in the working tree and
  watching the reversal assertion and the probe's reversal count both go back —
  docs/TODO/49's idiom, and the reason M1 comes first.
- **Fly it.** The whole complaint is about what the approach feels like from the
  cockpit, and no count of sign changes closes that. `⇧T` at the station is the
  door (docs/TODO/121). This reports; it does not block (README).

## Where we are now

**Landed**, M1 and M2 together. M3 did not survive contact and is recorded below
rather than done.

**The diagnosis was right and incomplete, and the incompleteness was the work.**
Fading the turn's claim by the off-nose angle — the fix the plan argued for —
removes the degenerate axis, and on its own it is barely worth having: the
median approach goes from 17 roll reversals to 14, the worst gets *worse*, and
pitch reversals triple. It swaps one thing to chase for another. With the turn
silent near the heading, the roll falls to the slot's alignment, and the slot is
a letterbox on a hull that never stops turning 1,500 units away — so the ship
rolls forever tracking it, and a ship that is always rolling sweeps its own pitch
plane round underneath `pitchOnto` until the nose hunts too.

So the fix is two gates, not one:

1. **`DC_TURN_FADE_ANGLE` (0.10 rad, ~6 degrees)** — the turn's claim on the roll
   axis ramps in over the off-nose angle, because `nose × heading` is degenerate
   at zero and its direction there is numerical residue.
2. **The slot does not ask until the approach commits** — `base` is `slotErr`
   in the `run` phase and nothing in `gate`. The phase is already the "I am going
   in" decision, it already latches, and it leaves the whole corridor to settle
   the wings. Handing the axis over on `lateral` instead was tried twice and both
   ramps arrived at the mouth with the target attitude still moving: 11 scrapes
   over the sweep against 3, which is a worse bug than the one being fixed.

Measured on `npm run dock-probe`, which M1 taught to count the symptom first:

| | docked | median | worst | scrapes | roll reversals | worst | pitch |
| --- | --- | --- | --- | --- | --- | --- | --- |
| before | 320/320 | 16.8s | 30.6s | 3 | 17 | 29 | 3 / 7 |
| after | 320/320 | 16.8s | 25.2s | 1 | **8** | **15** | 3 / 7 |

**The fade angle was chosen on a second grid, not this one.** Swept over 0.05 to
0.35 the median is flat from 0.08 to 0.13 (10, 9, 8, 8, 9) and climbs back to 15
at 0.20 and 0.35 — refuse the turn authority it genuinely needs and it stops
correcting until the error is large, then corrects hard. The worst-case and
fall-back-to-the-gate columns picked a different winner on each of two grids, so
they are one unlucky approach apiece and did not choose anything. 0.10 is the
middle of the flat region. An independent grid — diagonal offsets, different
ranges, spins and seeds, flown for this question — agrees on the part that
matters: median 20 reversals before, 9 after, 320/320 both ways.

**Both gates are proved failable** by reverting each in the working tree:
ungating the turn takes the roll ask for a tenth of a degree off the heading from
0.02 to 0.93 — full stick, the reported bug, as an assertion — and letting the
slot ask from the gate phase makes a ship holding a correct heading roll at
−1.00. The fixture for the first went through one revision that mattered: eased
off the heading in the PITCH plane, the two laws agree and the roll ask is zero
however it is computed, so the test proved nothing. Sideways is where the bug is.

**M3 is not done, and is not closed.** The `run → gate` fall-backs are 7 → 4 on
the shipped grid and 17 → 24 on the second one, at the same setting. The metric
is a handful of approaches either side of noise, and this item cannot say whether
it moved. It is not the reported bug, it costs an approach a lap rather than
producing a symptom anybody has reported, and diagnosing it needs its own
measurement that separates it from grid luck. Recorded in the backlog.

**One thing was tried and rejected on measurement**, worth recording because it
looked right: a second fade where the two laws sit a quarter turn apart, on the
theory that `rollErrorTo`'s fold makes the turn's ask ambiguous there (it does —
`turnErr` jumps a fold 2,955 times over 320 approaches). Fading it to zero is
catastrophic: in the gate phase the turn is the *only* law, and a ship that needs
a 90-degree bank is exactly a ship whose ask is near the fold, so it stopped
turning. 233 scrapes and a median of 29.9s. The fold is real and something still
lives there; suppressing the claim is not the answer.

Landed with `npm run check` clean — including the catalogue, which took two
`@rule` ids in unrelated domains: 0.10 was already spoken for by
`DECISION_INTERVAL` and `CORRIDOR_START`, and equal values that must stay free to
move apart is exactly what a rule id is for.
