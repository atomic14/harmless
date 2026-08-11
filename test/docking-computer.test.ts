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
// Three items live here. docs/TODO/134 (GitHub #23) is the roll: the turn's own
// axis goes degenerate as the nose arrives, and the ship chased it at full
// stick. docs/TODO/135 is the plan underneath it: the aim point used to teleport
// when the run committed, so the ship was asked to reverse. docs/TODO/136 is
// the last block, and it is the only one here that FLIES: a plan is a function
// of where the ship is, so walking a point along whatever heading it is given
// asks the whole question without a world to ask it in.

import * as THREE from 'three';
import {
  planDocking, makeDockPlan, dockingSticks, type DockPhase,
} from '../src/game/docking.ts';
import {
  DC_TURN_FADE_ANGLE, DC_SLOT_MARGIN,
} from '../src/constants/docking-computer.ts';
import {
  GATE_HALF_WIDTHS, LINED_UP_LATERAL, ROLL_TOLERANCE, HULL_BOX_MARGIN, SLOT_HALF_ACROSS,
} from '../src/constants/docking.ts';
import { dockPath, makeDockPath } from '../src/game/dock-path.ts';
import { STEER_SATURATION } from '../src/constants/combat-computer.ts';
import { slotNormal } from '../src/world/slot.ts';
import { check } from './harness.ts';

const near = (a: number, b: number, tol = 1e-3): boolean => Math.abs(a - b) < tol;

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
    const s = dockingSticks(q, plan);
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
    const s = dockingSticks(q, plan);
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
    const inside = dockingSticks(q1, p1).roll;
    const outside = dockingSticks(q2, p2).roll;
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
    const s = dockingSticks(q, plan);
    check(`...so with the nose on the gate heading it holds the wings still (${
      s.roll.toFixed(6)}), rolled ${(ROLL_TOLERANCE * 2).toFixed(2)} off the slot`,
    Math.abs(s.roll) < 1e-6);
  }
}

// --- the plan does not change its mind at the commit (docs/TODO/135) ---------
//
// The gate used to be a point to arrive AT rather than pass THROUGH: fly at a
// fixed point 800 units out, then — one frame later, on committing — aim at the
// station. A ship converging from the side cuts the corner and ends up INSIDE
// the gate, so the two aims sat on opposite sides of it and the commanded
// heading reversed through as much as 162 degrees between consecutive frames.
// `pitchOnto` saturates at 20 degrees of error, so what the pilot got was full
// stick, an overshoot and a ring back.

console.log('\nthe approach hands over without changing its mind');
{
  const station = new THREE.Object3D();
  station.updateMatrixWorld(true);
  const DOCK_Z = 160;
  const GATE = DOCK_Z * GATE_HALF_WIDTHS;
  // A hair off the corridor's edge, so one step across `LINED_UP_LATERAL`
  // commits the run — and far enough out that the corridor is what commits it.
  // docs/TODO/136 hands the roll over a gate distance from the slot as well,
  // measured: it gives the wings the length of the dive to settle on the
  // letterbox instead of the length of the run in, and the approach goes
  // through 7.5 degrees off the slot instead of 12.9.
  const at = (lateral: number, phase: DockPhase) => {
    const p = makeDockPlan();
    p.phase = phase;
    return planDocking(new THREE.Vector3(lateral, 0, -(GATE * 1.4)), station,
      DOCK_Z, 400, p);
  };

  const before = at(LINED_UP_LATERAL + 0.5, 'gate');
  const after = at(LINED_UP_LATERAL - 0.5, 'gate');
  check('the fixture straddles the commit',
    before.phase === 'gate' && after.phase === 'run');
  const swing = before.heading.angleTo(after.heading) * 180 / Math.PI;
  check(`...and the heading does not swing across it (${swing.toFixed(1)}°)`,
    swing < 20);

  // ...for the reason the constant states: inside the gate, the gate phase is
  // already aiming INWARD, so there is nothing to reverse. Stated as the sign of
  // the aim along the slot normal — which points OUT of the slot — rather than as
  // an angle, so it cannot pass by being merely small.
  const outward = slotNormal(station);
  check(`the approach points at the station from either side of it (${
    before.heading.dot(outward).toFixed(3)} along the outward normal)`,
  before.heading.dot(outward) < 0 && after.heading.dot(outward) < 0);

  // ...and the lookahead is real: the aim is never a point the ship is sitting
  // on, which is the OTHER half of the fix. Aiming abeam at the axis was
  // measured leaving the jump at 42.8 degrees, because the aim then sat
  // `lateral` away — 44 units — and the heading to it was as ill-conditioned as
  // the arrival it replaced. Nearly on the axis, a lookahead makes the heading
  // almost all axis and almost no lateral; an abeam aim would be the reverse.
  {
    const p = at(10, 'gate');
    const downTheAxis = Math.abs(p.heading.dot(outward));
    check(`...from a lookahead away, not from underfoot (${
      downTheAxis.toFixed(3)} of the heading is down the axis)`,
    downTheAxis > 0.9);
  }
}


// --- the far side of the station (docs/TODO/136) -----------------------------
//
// `along` is SIGNED and `lateral` is measured perpendicular to the slot axis, so
// neither says on its own which side of the station a ship is on. Every check
// above this one starts on the slot side, which is exactly the blind spot the
// probe had: a whole hemisphere nobody measured.

console.log('\nthe approach knows which side of the station it is on');
{
  const station = new THREE.Object3D();
  station.updateMatrixWorld(true);
  const DOCK_Z = 160;
  // identity station: the slot normal is world -Z, so -Z is IN FRONT of the slot
  // and +Z is behind the hull.
  const plan = (x: number, z: number) =>
    planDocking(new THREE.Vector3(x, 0, z), station, DOCK_Z, 400, makeDockPlan());

  // THE BUG: a ship behind the station sits at a NEGATIVE `along`, which passes
  // `along < dockZ` trivially, and on the axis line its `lateral` is 0. Both
  // halves of "arrived" were true from the wrong side, so a trader that drifted
  // there docked through the back of the station and despawned (game/npc.ts
  // reads this flag, and it is the only reader).
  check('a ship in the slot mouth has arrived', plan(0, -100).arrived);
  check('...and the same distance BEHIND the hull has not',
    !plan(0, 100).arrived);
  check('...nor has one a long way behind, on the axis line',
    !plan(0, 3_000).arrived);

  check('the plan from behind is still the gate phase', plan(0, 2_000).phase === 'gate');
}


// --- the plan does not change its mind ANYWHERE (docs/TODO/136) --------------
//
// The check above this one could not be written while the defect stood, and the
// reason is worth keeping: from DIRECTLY behind, the broken aim and a fixed one
// both lie dead ahead through the station, so a single frame's heading cannot
// tell them apart. What tells them apart is FLYING it — the ship moves off the
// axis line, the stand-off branch fires, and the plan reverses.
//
// So this walks the plan instead of sampling it. A point is stepped along
// whatever heading it is given, at the speed it is given, and what is asserted
// is the largest the heading moved between two consecutive frames. It is the
// same shape as `npm run dock-probe`'s jump column and it needs no world: the
// question a plan is asked is a function of where the ship is.
//
// On the approach this replaced, the same walk from directly astern reverses
// through 180 degrees.

console.log('\nthe approach never reverses, from anywhere on the sphere');
{
  const station = new THREE.Object3D();
  station.updateMatrixWorld(true);
  const DOCK_Z = 160;
  const dt = 1 / 60;

  /** Fly the plan from `start` and return the worst single-frame heading turn. */
  const walk = (start: THREE.Vector3): { jump: number; docked: boolean } => {
    const pos = start.clone();
    const plan = makeDockPlan();
    const last = new THREE.Vector3();
    let jump = 0;
    let docked = false;
    for (let frame = 0; frame < 120 * 60 && !docked; frame++) {
      planDocking(pos, station, DOCK_Z, 400, plan);
      if (frame > 0) jump = Math.max(jump, last.angleTo(plan.heading));
      last.copy(plan.heading);
      // A perfect pilot, which is the point: any wobble here would be the
      // FOLLOWER's and this is a claim about the plan.
      pos.addScaledVector(plan.heading, plan.speed * dt);
      docked = plan.arrived;
    }
    return { jump: jump * 180 / Math.PI, docked };
  };

  // Directly astern, the case docs/TODO/136 exists for: `lateral` is 0, so
  // nothing in the ship's own position says which way round to come.
  {
    const { jump, docked } = walk(new THREE.Vector3(0, 0, 2_000));
    check('flown from directly astern, the approach arrives', docked);
    check(`...without the plan ever reversing (worst ${jump.toFixed(1)}° in a frame)`,
      jump < 20);
  }

  // ...and everywhere else. Four azimuths at each bearing, because the plane the
  // ship comes round in is the station's own when it is on the axis line and its
  // own when it is not, and the handover between them is the thing to break.
  {
    let worst = 0;
    let worstAt = '';
    let arrived = 0;
    let flown = 0;
    for (const polar of [0, 30, 60, 90, 120, 150, 180]) {
      const azimuths = polar === 0 || polar === 180 ? [0] : [0, 90, 180, 270];
      for (const az of azimuths) {
        for (const range of [400, 900, 3_000]) {
          const p = polar * Math.PI / 180;
          const a = az * Math.PI / 180;
          const { jump, docked } = walk(new THREE.Vector3(
            Math.sin(p) * Math.cos(a), Math.sin(p) * Math.sin(a), -Math.cos(p),
          ).multiplyScalar(range));
          flown += 1;
          if (docked) arrived += 1;
          if (jump > worst) { worst = jump; worstAt = `${polar}°/${az}° at ${range}`; }
        }
      }
    }
    check(`every approach on the sphere arrives (${arrived}/${flown})`, arrived === flown);
    check(`...and none of their plans jumps (worst ${worst.toFixed(1)}° at ${worstAt})`,
      worst < 20);
  }

  // The path is what makes that true, so the path is what is asserted next: the
  // aim is always a real distance ahead — never a point the ship is sitting on,
  // which is the ill-conditioned heading docs/TODO/135 spent its whole budget
  // removing — and it always leads the ship AROUND the hull rather than through
  // it. Read off the shortest lookahead the walk ever gets, which is the last
  // one before the slot.
  {
    const pos = new THREE.Vector3(0, 0, 2_000);
    const plan = makeDockPlan();
    const path = makeDockPath();
    let closest = Infinity;
    let widest = 0;
    for (let frame = 0; frame < 120 * 60; frame++) {
      planDocking(pos, station, DOCK_Z, 400, plan);
      dockPath(pos, station, DOCK_Z, plan.swing, path);
      closest = Math.min(closest, path.aim.distanceTo(pos));
      // Inside `dockingOutcome`'s box there is nowhere to be but the channel.
      const box = DOCK_Z + HULL_BOX_MARGIN;
      if (Math.abs(pos.z) < box && Math.abs(pos.x) < box && Math.abs(pos.y) < box) {
        widest = Math.max(widest, Math.hypot(pos.x, pos.y));
      }
      if (plan.arrived) break;
      pos.addScaledVector(plan.heading, plan.speed * dt);
    }
    // The nearest it ever comes is the last third of a second, on the axis and
    // inside the corridor, where the lookahead has shortened to what is left of
    // the path — nothing like the gate, where an aim underfoot was a heading
    // that swung through 42 degrees (docs/TODO/135).
    check(`the aim is never underfoot (nearest ${closest.toFixed(1)} units)`,
      closest > DOCK_Z / 8);
    check(`...and the flown path is in the CHANNEL wherever it is in the box (${
      widest.toFixed(1)} against ${SLOT_HALF_ACROSS})`, widest < SLOT_HALF_ACROSS);
  }
}
