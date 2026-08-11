// The docking computer's HAND: what the autopilot asks for, frame by frame.
//
// Split from test/docking.test.ts on 2026-08-11, along the same seam the
// constants already have — constants/docking.ts is the letterbox, and
// constants/docking-computer.ts is the hand that threads it. What is here is
// every check that calls `planDocking` or `dockingSticks` DIRECTLY and reads the
// answer: no world, no step, no station traffic, because a control law is a
// function and the cheapest way to pin one is to ask it. The checks that need a
// real `WorldStep` frame — that the demand reaches the rates the HUD reads, that
// nothing writes the quaternion by hand, what a fluffed slot costs — stayed with
// the geometry they are solved out of.
//
// Four items live here. docs/TODO/134 (GitHub #23) is the roll: the turn's own
// axis goes degenerate as the nose arrives, and the ship chased it at full
// stick. docs/TODO/135 is the plan underneath it: the aim point used to teleport
// when the run committed, so the ship was asked to reverse. docs/TODO/136
// FLIES: a plan is a function of where the ship is, so walking a point along
// whatever heading it is given asks the whole question without a world to ask it
// in. docs/TODO/137 is the last block and it flies the OTHER half — the ship's
// answer rather than the plan's question, which is one stick, one ramp and no
// world at all.

import * as THREE from 'three';
import { planDocking, makeDockPlan } from '../src/game/docking.ts';
import { dockingSticks } from '../src/game/docking-sticks.ts';
import { rampFlightRate } from '../src/player.ts';
import { PLAYER_FLIGHT } from '../src/constants/player-flight.ts';
import {
  DC_TURN_FADE_ANGLE, DC_SLOT_MARGIN, DC_ROLL_LEAD,
} from '../src/constants/docking-computer.ts';
import { ROLL_TOLERANCE } from '../src/constants/docking.ts';
import { STEER_SATURATION } from '../src/constants/combat-computer.ts';
import { rollErrorTo } from '../src/game/pitch-roll-steer.ts';
import { check } from './harness.ts';

const near = (a: number, b: number, tol = 1e-3): boolean => Math.abs(a - b) < tol;

/**
 * A ship not rolling yet — what every check below the first block asks about.
 *
 * The roll ask reads the rate the ship is already flying (`DC_ROLL_LEAD`), so a
 * check about WHICH bank the law chooses has to hold that at rest, or it is
 * measuring the damping instead. The damping has its own block, which flies.
 */
const AT_REST = 0;

// --- the roll the computer asks for, near the heading (docs/TODO/134, #23) ---
//
// The turn measures its roll against `nose x heading`, whose LENGTH is the sine
// of the off-nose angle: it vanishes as the controller succeeds, and a vanishing
// vector still has a direction. The old law normalised it and asked for a
// proportional roll, so a ship dead on the heading rolled full stick at
// numerical residue. Held here at an angle where the plan flies, not at the
// exact zero the guard in `rollErrorTo` already catches — the bug lived in the
// NEIGHBOURHOOD of the heading, which is why the "asks for nothing" check below
// passed all the way through it.

console.log('\nthe docking computer near its own heading');
{
  const station = new THREE.Object3D();
  station.updateMatrixWorld(true);
  const DOCK_Z = 160;
  /** on the axis and inside the corridor, so the run phase owns the roll */
  const onTheRun = () => {
    const p = makeDockPlan();
    p.phase = 'run';
    return planDocking(new THREE.Vector3(0, 0, -400), station, DOCK_Z, 400, p);
  };

  // Lined up for the letterbox — wings on the slot's long axis, nose on the
  // plan — and then eased off the heading SIDEWAYS, about the ship's own +Y.
  //
  // Sideways is the whole point, and easing off about the pitch axis instead is
  // the mistake that makes this fixture prove nothing: pitching off the heading
  // leaves the axis the turn wants lying along the wings, where the two laws
  // already agree and the roll ask is zero however it is computed. Off to one
  // SIDE, the turn wants a quarter turn of roll for an arbitrarily small error —
  // which is the bug, and full stick for a tenth of a degree is what it did.
  const lined = (offNose: number) => {
    const plan = onTheRun();
    const q = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().lookAt(new THREE.Vector3(), plan.heading, plan.up));
    q.multiply(new THREE.Quaternion()
      .setFromAxisAngle(new THREE.Vector3(0, 1, 0), offNose));
    return { plan, q };
  };

  {
    const { plan, q } = lined(0);
    const s = dockingSticks(q, plan, AT_REST);
    check(`on the heading and rolled with the slot, no roll is asked for (${
      s.roll.toFixed(6)})`, Math.abs(s.roll) < 1e-6);
  }

  // THE REPORTED SYMPTOM. A tenth of a degree off the heading is a ship flying
  // its plan, not a ship that needs to bank; the turn axis is 0.002 long there
  // and points nowhere in particular. Before this item the same geometry asked
  // for as much as full stick.
  {
    const tiny = 0.1 * Math.PI / 180;
    const { plan, q } = lined(tiny);
    const s = dockingSticks(q, plan, AT_REST);
    check(`a tenth of a degree off it, the roll ask stays small (${
      s.roll.toFixed(4)})`, Math.abs(s.roll) < 0.05);
    // ...and the pitch does not paper over it. A ship with no yaw axis cannot
    // pull a SIDEWAYS error out, which `pitchOnto` says of itself; the slot's
    // own rotation sweeps the pitch plane round as the run goes in and that is
    // what reaches it. Pinned so that a future "fix" to the pitch half has to
    // come and change this line deliberately.
    check(`...and the pitch does not pretend to fix a sideways error (${
      s.pitch.toFixed(6)})`, Math.abs(s.pitch) < 1e-9);
  }

  // ...and the fade gives the axis back for a turn that is real. Probed either
  // side of the constant, and against the RATIO the fade claims rather than
  // against a number of its own: a quarter of the way in, the turn gets a
  // quarter of what it gets outside. Both ends move if the constant is
  // re-inlined, and the ratio moves if the ramp stops being proportional.
  {
    const { plan: p1, q: q1 } = lined(DC_TURN_FADE_ANGLE / 4);
    const { plan: p2, q: q2 } = lined(DC_TURN_FADE_ANGLE * 4);
    const inside = dockingSticks(q1, p1, AT_REST).roll;
    const outside = dockingSticks(q2, p2, AT_REST).roll;
    check(`inside the fade the turn gets a quarter of the axis (${
      inside.toFixed(4)} vs ${outside.toFixed(4)} outside it)`,
    near(inside, outside / 4, 1e-6));
    // ...and outside it, the turn is spending the letterbox's whole budget, so
    // the fade is the only thing holding it back and not some other clamp.
    check(`...and outside it spends the budget DC_SLOT_MARGIN allows (${
      outside.toFixed(4)})`,
    near(Math.abs(outside), ROLL_TOLERANCE * DC_SLOT_MARGIN / STEER_SATURATION, 1e-6));
  }

  // The GATE phase hands the whole axis to the turn: a slot on a spinning hull
  // a corridor away is a target that never stops moving, and tracking it is a
  // roll that never stops either.
  {
    const plan = planDocking(new THREE.Vector3(600, 0, -2000), station, DOCK_Z, 400,
      makeDockPlan());
    check('the fixture is off the axis, in the gate phase', plan.phase === 'gate');
    // Nose on the gate heading, so there is nothing to turn for — and wings a
    // long way off the slot's long axis, which is the whole question: out here
    // the slot is on a hull that is still turning, so an attitude matched to it
    // now is stale before the corridor and chasing it is a roll that never ends.
    const q = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().lookAt(new THREE.Vector3(), plan.heading, plan.up));
    q.multiply(new THREE.Quaternion()
      .setFromAxisAngle(new THREE.Vector3(0, 0, 1), ROLL_TOLERANCE * 2));
    const s = dockingSticks(q, plan, AT_REST);
    check(`...so with the nose on the gate heading it holds the wings still (${
      s.roll.toFixed(6)}), rolled ${(ROLL_TOLERANCE * 2).toFixed(2)} off the slot`,
    Math.abs(s.roll) < 1e-6);
  }
}


// --- the roll holds the bank it is given (docs/TODO/137) ---------------------
//
// Everything above decides WHICH bank. Nothing above could hold one: a
// proportional ask driving a rate ramp is a second-order loop with no damping
// term, so the ship overshot every bank it was given and hunted round it at
// about a reversal a second — on a curve, on a dead-straight run in, and either
// side of the approach docs/TODO/136 replaced.
//
// The sweep could not see it for what it was, which is why this fixture exists.
// A ship flying a curve HAS to hold a bank and a controller holding one corrects
// it, so the reversal column mixes the ring in with honest flying; and at the
// letterbox the ring was ±40 degrees of swing that the entry-roll column sampled
// wherever it happened to be. Isolated, the question is one line: hold the
// demand still, roll the ship, and see whether it settles.
//
// It is the loop and not a model of the loop — the shipped roll ask, the
// commander's own ramp and caps, and the same integration `PlayerShip.update`
// does — because a controller that rings is exactly what a fixture written
// against itself would fail to notice.

console.log('\nthe docking computer holds a bank instead of ringing round it');
{
  const station = new THREE.Object3D();
  station.updateMatrixWorld(true);
  const DOCK_Z = 160;
  const dt = 1 / 60;
  const AXIS_Z = new THREE.Vector3(0, 0, 1);

  /** Roll the ship off the slot's attitude by `offset` and let the law fly it. */
  const settle = (offset: number) => {
    const plan = makeDockPlan();
    plan.phase = 'run';
    planDocking(new THREE.Vector3(0, 0, -400), station, DOCK_Z, 400, plan);
    // Nose on the plan and wings on the slot, then rolled off about the nose:
    // rolling does not move the nose, so the turn has no claim throughout and
    // what is being measured is the slot's own law, alone.
    const q = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().lookAt(new THREE.Vector3(), plan.heading, plan.up));
    q.multiply(new THREE.Quaternion().setFromAxisAngle(AXIS_Z, offset));
    const wings = new THREE.Vector3().copy(plan.up)
      .cross(new THREE.Vector3().copy(plan.heading).negate());

    let rollRate = 0;
    let reversals = 0;
    let last = 0;
    let overshoot = 0;
    let settled = 0;
    const from = rollErrorTo(q, wings);
    const spin = new THREE.Quaternion();
    for (let frame = 0; frame < 5 * 60; frame++) {
      const roll = dockingSticks(q, plan, rollRate).roll;
      rollRate = rampFlightRate(rollRate, roll * PLAYER_FLIGHT.maxRoll, roll !== 0, dt);
      // A reversal is a change of direction under power, not every crossing of
      // zero — the same 0.05 rad/s floor `npm run dock-probe` scores with.
      if (Math.abs(rollRate) >= 0.05) {
        if (last !== 0 && Math.sign(rollRate) !== last) reversals += 1;
        last = Math.sign(rollRate);
      }
      q.multiply(spin.setFromAxisAngle(AXIS_Z, rollRate * dt)).normalize();
      const err = rollErrorTo(q, wings);
      // ...how far PAST the target it went, which is the ring's own signature.
      // Measured against the side it STARTED on: rolling the ship one way puts
      // the error the other, so the offset's own sign is no use here.
      if (Math.sign(err) !== Math.sign(from)) overshoot = Math.max(overshoot, Math.abs(err));
      // ...and when it last came inside a degree and stayed.
      if (Math.abs(err) > 1 * Math.PI / 180) settled = (frame + 1) * dt;
    }
    return { reversals, overshoot: overshoot * 180 / Math.PI, settled };
  };

  // A quarter of the letterbox's tolerance out — a real bank, hard enough to
  // saturate the stick on the way. Undamped this overshoots by 7.6 degrees and
  // reverses twice; the numbers here are the whole of what the term buys.
  {
    const { reversals, overshoot, settled } = settle(30 * Math.PI / 180);
    check(`a 30° bank stops where it is put (${overshoot.toFixed(1)}° past it,`
      + ` ${reversals} reversal(s), settled at ${settled.toFixed(2)}s)`,
    overshoot < 3 && reversals <= 1 && settled < 1.2);
  }

  // ...and a bank the size of an ordinary correction does not reverse at all.
  // This is the one that fails first if the term is weakened: undamped it
  // overshoots 2.7 degrees and reverses once for a 10-degree ask.
  {
    const { reversals, overshoot, settled } = settle(10 * Math.PI / 180);
    check(`a 10° bank does not reverse at all (${overshoot.toFixed(1)}° past it,`
      + ` ${reversals} reversal(s), settled at ${settled.toFixed(2)}s)`,
    overshoot < 1.5 && reversals === 0 && settled < 0.8);
  }

  // The rule itself, so the numbers above have a shape behind them: the ask is
  // for where the error WILL be, so a ship already rolling toward the bank asks
  // for exactly one lead-time's worth less stick than one sitting still.
  {
    const plan = makeDockPlan();
    plan.phase = 'run';
    planDocking(new THREE.Vector3(0, 0, -400), station, DOCK_Z, 400, plan);
    const q = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().lookAt(new THREE.Vector3(), plan.heading, plan.up));
    q.multiply(new THREE.Quaternion().setFromAxisAngle(AXIS_Z, 0.2));
    const still = dockingSticks(q, plan, 0).roll;
    const rolling = dockingSticks(q, plan, -1).roll;
    check(`already rolling toward it, the ask is a lead-time smaller (${
      Math.abs(still).toFixed(3)} of stick at rest, ${
      Math.abs(rolling).toFixed(3)} at 1 rad/s toward it)`,
    still < 0 && near(rolling - still, DC_ROLL_LEAD / STEER_SATURATION, 1e-9));
  }
}
