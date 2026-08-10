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
