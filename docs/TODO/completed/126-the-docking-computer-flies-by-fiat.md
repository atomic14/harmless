# 126 — The docking computer turns the ship without flying it

**Kind:** bug / fidelity · **Severity:** medium · **Size:** medium · **Depends
on:** none · **GitHub:** none — reported by Chris from a real flight, 2026-08-10:
*"Docking computer 'cheats' when flying - it doesn't roll and pitch to change
direction, it just changes the orientation of the ship."*

## Where we are

He is right, and the code says so in one line. `WorldStep.dockingComputerStep`
(`world-step.ts:299-314`) is the whole of the autopilot's flying:

```ts
this.tmpM.lookAt(ZERO, plan.heading, plan.up);
this.tmpQ.setFromRotationMatrix(this.tmpM);
player.quaternion.rotateTowards(this.tmpQ, DC_TURN_RATE * dt);
player.speed += (plan.speed - player.speed) * Math.min(1, dt * DC_THROTTLE_GAIN);
```

It writes `player.quaternion` DIRECTLY. `rotateTowards` is a shortest-arc slerp,
so the ship pivots about whatever axis joins the two orientations — an axis no
stick input can produce. Three things follow:

1. **It does not look like flying.** A Cobra cannot yaw sideways onto a heading;
   it rolls until the target is in its pitch plane and then pulls. That is the
   whole texture of Elite's flight model, and the autopilot is the one pilot the
   player watches from the outside.
2. **`player.pitchRate` and `player.rollRate` are never written**, so every
   reader of the ship's rates — the HUD, the flight readout, anything a future
   instrument asks — sees a ship sitting still while it turns.
3. **It obeys its own turn limit, not the hull's.** `DC_TURN_RATE` (1.2 rad/s) is
   a number of its own; the commander's `TURN.pitch` is 2.0. A shipyard that
   changed the hull would not change how the autopilot flies it.

Two files already claim otherwise, which is how this was found:

- `game/autopilot.ts`'s header: *"both end up as a `FlightDemand` that
  `PlayerShip.update` flies."* True of the combat computer, false of this.
- `constants/docking-computer.ts`'s header: *"The autopilot has to genuinely
  thread the letterbox; it gets no dispensation."* It gets exactly one.

**The vocabulary already exists.** `game/pitch-roll-steer.ts` is the module that
turns "point at this" into pitch and roll, with `test/pitch-roll-steer.test.ts`
behind it; the scripted co-pilot flies on it. The docking computer is the caller
that never used it.

## What to do

**M1 — the autopilot produces a demand.** `dockingComputerStep` builds a
`FlightDemand` — pitch, roll, throttle — from `plan.heading`/`plan.up` via
`pitch-roll-steer.ts`, and `PlayerShip.update` flies it, exactly as the pilot's
own hands are flown. Nothing writes `player.quaternion`. The roll term is what
makes the slot alignment visible rather than instantaneous.

**M2 — the limits become the hull's.** `DC_TURN_RATE` stops being a turn rate
and becomes what it should have been: how hard the autopilot pulls, as a
fraction of what the ship can do. Whether it survives at all is M2's question —
if the demand is clamped by `TURN` anyway, the constant may simply go.

## Watch out for

- **DOCKING IS THE HARDEST THING IN THE GAME AND THIS AID MUST STILL WORK.**
  `test/docking.test.ts` and `dockingOutcome` are the gate: the approach must
  still end inside the slot, at the right roll, within the tolerances the manual
  claims. A demand-flown autopilot that misses the letterbox is a worse bug than
  the one being fixed. Measure the success rate before and after, from several
  starting positions, and put the number in the commit.
- **`planDocking` is not the problem and must not be touched.** The approach —
  the standoff, the corridor, the slot normal — is already right; what changes is
  only how the ship is persuaded onto it.
- **The mid-manoeuvre `phase` latch is saved** (`GameState.dockPlan`,
  snapshot.ts). Restoring mid-approach must still work.
- **Rates are state.** Once the autopilot writes `pitchRate`/`rollRate`, a save
  taken mid-approach carries them, and `handsOn()` — which hands the ship back
  when the pilot touches the controls — must not read its own demand as a human
  touching the stick.

## Verification

Tier: unit plus a measured approach.

- The demand: given a plan whose heading is off to one side, the autopilot asks
  for ROLL and PITCH and no other axis; given a heading dead ahead, it asks for
  neither.
- `player.quaternion` is not assigned anywhere in `world-step.ts` — a source
  scan, paired with a proof it can fail (docs/TODO/49's idiom).
- The rates the HUD reads are non-zero while the autopilot is turning, which is
  the reported symptom stated as an assertion.
- Docking still succeeds: N approaches from spread starting points, all ending
  docked, compared against the same N before the change.
- Prove the gate can fail by reverting the demand to the quaternion write.

## Where we are now

**Landed** (`859790e`), M1 and M2 in one commit — the measurement made them
inseparable, and the plan half-expected it ("whether it survives at all is M2's
question").

`dockingComputerStep` returns a `FlightDemand` and `PlayerShip.update` flies it,
ramped through the commander's own envelope from the ship's current rates, so a
save taken mid-approach carries the manoeuvre. Nothing writes
`player.quaternion`.

**The hard part was not the demand; it was that one stick has two jobs.** A ship
with no yaw turns by rolling the target into its pitch plane and pulling, and
the letterbox wants that same roll spent lining the wings up with a slot on a
spinning hull. Three attempts, measured each time:

1. Crossfade `bankToTurn`'s roll with a slot-alignment roll on the nose error.
   A fixed blend of two laws that disagree has no equilibrium: the ship rolled
   at a steady 1 rad/s all the way into the hull.
2. A null band so the bank asks for nothing near the heading. Better, and it
   exposed the next one: `bankToTurn`'s pitch is gated by ITS OWN roll plan, so
   once the wings were committed to the slot the gate read a roll that would
   never be flown and the nose stopped being corrected at all — drifting from 6
   to 15 degrees off over a run. `pitchOnto` is the ungated half, and new.
3. **What shipped:** the slot's own tolerance as a budget. `ROLL_TOLERANCE` is
   how far from lined up a ship may be and still fit, so the roll the TURN wants
   is clamped into a window that wide around the roll the SLOT wants — bank as
   hard as the turn asks, right to the edge of what the letterbox will take. The
   window opens to a half turn far out, where no slot matters, and closes as
   `plan.lateral` crosses from `LINED_UP_LATERAL` to the channel's own
   half-width. One law, one equilibrium.

`pitch-roll-steer.ts` gained `rollErrorTo`, `rollOnto`, `pitchOnto` and
`steerStick` — the vocabulary the plan said was already there turned out to be
half of it.

**Both constants are gone rather than retuned.** `DC_TURN_RATE` re-expressed as
a fraction of the hull's caps measured worse the lower it went (0.8 → 35 scrapes
over the sweep, 0.9 → 9, 1.0 → 3): a cautious cap does not fly cautiously, it
flies a roll that cannot keep up with the plan and arrives still turning. So the
limit is the commander's own and there is no second number for a shipyard to
contradict. `DC_THROTTLE_GAIN` went with it — a demand has a throttle, so the
plan's speed is held with the hull's thrust and a one-frame deadband.

**The measurement**, `npm run dock-probe` (new, `train/dock-probe.ts`): 320
approaches over five offsets, four off-axis distances, four ranges and four
station rotations.

| | docked | median | worst | scrapes |
| --- | --- | --- | --- | --- |
| before (quaternion slerp) | 320/320 | 15.2s | 36.3s | 2 |
| after (demand-flown) | 320/320 | 16.8s | 30.6s | 3 |

A second and a half slower to the median, a better worst case, one more scrape
across 320 approaches — and it flies like a ship now.
