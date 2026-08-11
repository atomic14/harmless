// Threading the slot: every threshold in constants/docking.ts, held to the real
// functions, plus what a real `WorldStep` frame does with them.
//
// The HAND that flies the approach is test/docking-computer.test.ts, split off
// on 2026-08-11 along the seam the constants already have: this file is the
// letterbox, that one is the autopilot asking for a stick. What stayed is what
// needs a world — `makeRun` flies the actual step, so the constants are pinned
// where they are SPENT.
//
// The shape throughout is the measured one (docs/TODO/90, slice 5): each
// boundary is BISECTED out of `dockingOutcome`/`planDocking` or SOLVED back
// out of a real `WorldStep` frame, then compared to the constant that claims
// to say it. Probing at `CONSTANT ± 1` would be vacuous — the probe moves with
// the constant — so none of these do; a re-inlined literal in the function
// goes red here however the constant moves. What an outcome MEANS (docked,
// slotMiss, hull) is test/world.test.ts's docking section; this file is about
// WHERE the edges are.

import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import {
  dockingOutcome, planDocking, makeDockPlan, type DockingOutcome,
} from '../src/game/docking.ts';
import {
  GATE_HALF_WIDTHS, LINED_UP_LATERAL, HULL_BOX_MARGIN, NPC_HULL_BOX_MARGIN,
  SLOT_HALF_ACROSS, SLOT_HALF_ALONG, SLOT_DEPTH, ROLL_TOLERANCE,
} from '../src/constants/docking.ts';
import { PLAYER_FLIGHT } from '../src/constants/player-flight.ts';
import { BOUNCE_STANDOFF } from '../src/constants/station.ts';
import { WorldStep, type StepHost } from '../src/game/world-step.ts';
import { Ordnance } from '../src/game/ordnance.ts';
import { freshState } from '../src/game/state.ts';
import { newCommander } from '../src/game/commander.ts';
import { seedWorld } from '../src/game/rng.ts';
import { slotNormal } from '../src/world/slot.ts';
import type { DamageSource } from '../src/game/combat.ts';
import { check } from './harness.ts';

/** The edge between `inside(lo)` and `!inside(hi)`, to a millionth of a unit. */
function bisect(lo: number, hi: number, inside: (x: number) => boolean): number {
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (inside(mid)) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

const near = (a: number, b: number, tol = 1e-3): boolean => Math.abs(a - b) < tol;

// --- the slot's edges, bisected out of dockingOutcome ------------------------

console.log('\ndocking thresholds');
{
  const station = new THREE.Object3D();
  station.updateMatrixWorld(true);
  const DOCK_Z = 160;
  const scratch = { v: new THREE.Vector3(), q: new THREE.Quaternion(), r: new THREE.Vector3() };
  /** wings along the upright slot: the roll a docking wants */
  const quarter = new THREE.Quaternion()
    .setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
  const at = (x: number, y: number, z: number, q = quarter): DockingOutcome =>
    dockingOutcome(new THREE.Vector3(x, y, z), q, station, DOCK_Z, scratch);

  const cube = bisect(DOCK_Z, DOCK_Z + 200, (x) => at(x, 0, 0) !== 'clear');
  check(`the bounding cube ends at dockZ + HULL_BOX_MARGIN (${cube.toFixed(3)})`,
    near(cube, DOCK_Z + HULL_BOX_MARGIN));

  const inMouth = -(DOCK_Z - 20);
  const across = bisect(0, 200, (x) => at(x, 0, inMouth) === 'docked');
  check(`the channel is SLOT_HALF_ACROSS wide (${across.toFixed(3)})`,
    near(across, SLOT_HALF_ACROSS));

  const along = bisect(0, 200, (y) => at(0, y, inMouth) === 'docked');
  check(`...and SLOT_HALF_ALONG tall (${along.toFixed(3)})`,
    near(along, SLOT_HALF_ALONG));

  // walking OUT of the slot mouth: docked until the channel's floor
  const depth = bisect(inMouth, 0, (z) => at(0, 0, z) === 'docked');
  check(`...and starts SLOT_DEPTH into the face (${(DOCK_Z + depth).toFixed(3)})`,
    near(DOCK_Z + depth, SLOT_DEPTH));

  const rolled = (off: number) => new THREE.Quaternion()
    .setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2 + off);
  const roll = bisect(0, Math.PI / 4, (off) => at(0, 0, inMouth, rolled(off)) === 'docked');
  check(`the roll edge is ROLL_TOLERANCE (${roll.toFixed(4)})`,
    near(roll, ROLL_TOLERANCE, 1e-4));
}

// --- the approach's two anchors, out of planDocking --------------------------

{
  const station = new THREE.Object3D();
  station.updateMatrixWorld(true);
  const DOCK_Z = 160;
  // identity quaternion: the slot normal is world -Z and 'across' is world +X
  const plan = (x: number, z: number) =>
    planDocking(new THREE.Vector3(x, 0, z), station, DOCK_Z, 400, makeDockPlan());

  // inside the slot mouth, walking off the axis until `arrived` lets go
  const lateral = bisect(0, 200, (x) => plan(x, -100).arrived);
  check(`a dock arrives within LINED_UP_LATERAL of the axis (${lateral.toFixed(3)})`,
    near(lateral, LINED_UP_LATERAL));

  // Solve the gate distance back out of the heading. From (B, 0, -A) the gate
  // phase aims at slotN * gateDist, so the heading's along/across ratio gives
  // gateDist = A - B * (h.along / h.across) with nothing probed at a constant.
  const A = 3000;
  const B = 500;
  const p = plan(B, -A);
  check('far off the axis is the gate phase', p.phase === 'gate');
  const hAlong = -p.heading.z;             // component along the slot normal
  const hAcross = p.heading.x;
  const gate = A - B * (hAlong / hAcross);
  check(`the gate sits GATE_HALF_WIDTHS half-widths out (${(gate / DOCK_Z).toFixed(4)})`,
    near(gate, DOCK_Z * GATE_HALF_WIDTHS, 1e-6));
}

/**
 * `THREE.Quaternion` methods that only READ — everything else on the player's
 * orientation is a write, and a write is the bug docs/TODO/126 fixed.
 */
const READ_ONLY_QUATERNION = ['clone', 'angleTo', 'dot', 'length', 'lengthSq'];

// --- the computer's hand, solved out of a real WorldStep frame ---------------

// A stub host and a real world: these three blocks fly the actual step, so the
// constants are pinned where they are SPENT — a re-inlined 1.2 or 40 in
// world-step.ts fails here even though planDocking never sees either.

function makeRun() {
  seedWorld(90_101);
  const state = freshState(newCommander());
  state.world.build(state.systems[state.commander.systemIndex]);
  const hits: DamageSource[] = [];
  const host: StepHost = {
    inFlight: () => true,
    applyPlayerDamage: (_amount, _from, source) => { hits.push(source); },
    destroyNpc: () => {},
    wreckNpc: () => {},
    fireLaser: () => {},
    raiseLegal: () => {},
    die: () => {},
    dock: () => {},
    completeHyperspace: () => {},
    completeRescue: () => {},
    openHermitTrade: () => {},
    autoSave: () => {},
  };
  const step = new WorldStep(state, new Ordnance(state.world), host);
  const coast = { rollRate: 0, pitchRate: 0, throttle: 0, fire: false };
  return { state, step, hits, coast };
}

// THE AUTOPILOT FLIES, rather than being teleported round its own axis
// (docs/TODO/126). It used to write `player.quaternion` through a shortest-arc
// slerp: a turn about an axis no stick can produce, which wrote neither of the
// rates the HUD reads and obeyed a turn cap of its own rather than the hull's.
// What is pinned here is that it asks for the two things a hand asks for.
{
  const { state, step, coast } = makeRun();
  const station = state.world.station;
  const n = slotNormal(station);
  const perp = new THREE.Vector3().crossVectors(n, new THREE.Vector3(0, 1, 0)).normalize();
  state.player.position.copy(station.position)
    .addScaledVector(n, 3000).addScaledVector(perp, 500);
  state.player.speed = 0;
  state.session.dcEngaged = true;

  const plan = planDocking(
    state.player.position, station, state.world.stationDockZ, state.player.maxSpeed,
    makeDockPlan());
  const dt = 1 / 60;
  const nose = new THREE.Vector3(0, 0, -1).applyQuaternion(state.player.quaternion);
  check(`the fixture opens far enough off-heading to need a real turn (${
    nose.angleTo(plan.heading).toFixed(3)} rad)`,
    nose.angleTo(plan.heading) > PLAYER_FLIGHT.maxRoll * dt * 4);
  check('...and with a plan speed to throttle toward', plan.speed > 1);

  step.step(dt, 0, { demand: coast, handsOn: false });

  // THE REPORTED SYMPTOM, as an assertion: a ship that is turning says so on
  // the rates every instrument reads. Both, because turning a ship with no yaw
  // axis onto a heading off to one side IS pitch and roll together.
  check(`the turn is on the rates the HUD reads (pitch ${
    state.player.pitchRate.toFixed(3)}, roll ${state.player.rollRate.toFixed(3)})`,
    state.player.pitchRate !== 0 && state.player.rollRate !== 0);
  // ...and it is the commander's own envelope, not a cap of the autopilot's.
  check('...inside the hull\'s own caps',
    Math.abs(state.player.pitchRate) <= PLAYER_FLIGHT.maxPitch
    && Math.abs(state.player.rollRate) <= PLAYER_FLIGHT.maxRoll);
  // The throttle is the hull's thrust, not a gain of the autopilot's: one
  // frame of `PLAYER_FLIGHT.accel` from a standing start.
  check(`...and the throttle is the ship's own thrust (${state.player.speed.toFixed(4)})`,
    near(state.player.speed, PLAYER_FLIGHT.accel * dt, 1e-9));

  // A heading dead ahead asks for neither: the demand is a response to the
  // error and not a permanent stirring of the stick.
  {
    const r = makeRun();
    const s2 = r.state;
    const plan2 = planDocking(s2.player.position, s2.world.station, s2.world.stationDockZ,
      s2.player.maxSpeed, makeDockPlan());
    s2.player.quaternion.setFromRotationMatrix(
      new THREE.Matrix4().lookAt(new THREE.Vector3(), plan2.heading, plan2.up));
    s2.session.dcEngaged = true;
    r.step.step(dt, 0, { demand: r.coast, handsOn: false });
    check(`on the heading and rolled with the slot, it asks for nothing (pitch ${
      s2.player.pitchRate.toFixed(4)}, roll ${s2.player.rollRate.toFixed(4)})`,
      Math.abs(s2.player.pitchRate) < 1e-6 && Math.abs(s2.player.rollRate) < 1e-6);
  }
}

// ...and NOTHING in the step writes the player's orientation any more. The
// source scan is docs/TODO/49's idiom: the rule is about how the ship is
// steered everywhere, not about the one call site a behaviour test can reach.
{
  const src = readFileSync(new URL('../src/game/world-step.ts', import.meta.url), 'utf8')
    .replace(/^\s*(\/\/|\*|\/\*).*$/gm, '');
  const writes = [...src.matchAll(/player\.quaternion\s*\.\s*([a-zA-Z]+)/g)]
    .map((m) => m[1])
    .filter((call) => !READ_ONLY_QUATERNION.includes(call));
  check(`world-step.ts never turns the ship by hand (${writes.join(', ') || 'nothing'})`,
    writes.length === 0);
  // ...and the scan can fail: the call the fix deleted is one of the ones it hunts.
  check('the scan catches the write this item removed',
    !READ_ONLY_QUATERNION.includes('rotateTowards'));
}

// --- what a fluffed slot does to you, through the same step ------------------

{
  const { state, step, hits, coast } = makeRun();
  const station = state.world.station;
  // deep inside the bounding cube, nowhere near the channel: 'hull'
  state.player.position.copy(station.localToWorld(new THREE.Vector3(100, 0, -150)));
  state.player.speed = 0;

  step.step(1 / 60, 0, { demand: coast, handsOn: false });

  const dist = state.player.position.distanceTo(station.position);
  check(`hitting the hull bounces you to BOUNCE_STANDOFF (${dist.toFixed(3)})`,
    near(dist, BOUNCE_STANDOFF, 1e-6));
  check('...with your run ended', state.player.speed === 0);
  check('...and the scrape billed as station damage',
    hits.length === 1 && hits[0] === 'station');
}

// --- the NPCs' smaller cube, bisected out of the same step -------------------

// The 40 is a recorded divergence from the player's 50 (see
// NPC_HULL_BOX_MARGIN); this holds world-step.ts to the constant so that
// FIXING the divergence is one edit and one red test, not an archaeology dig.

{
  const { state, step, coast } = makeRun();
  const station = state.world.station;
  const dockZ = state.world.stationDockZ;
  // parked out of everything's way: no ram, no hazard, no interest
  state.player.position.copy(station.position).addScaledVector(
    slotNormal(station), 20_000);
  state.player.speed = 0;

  const bounced = (d: number): boolean => {
    state.world.clearNpcs();
    const npc = state.world.spawn(
      'pirate', station.localToWorld(new THREE.Vector3(d, 0, 0)), 3);
    step.step(0.001, 0, { demand: coast, handsOn: false });
    // a bounce throws the ship to the cube face plus its radius; one 1ms step
    // of flying moves it a fraction of a unit
    return Math.abs(npc.object.position.distanceTo(station.position) - d) > 5;
  };

  check('the fixture can tell a bounce from a frame of flying',
    bounced(dockZ + 5) && !bounced(dockZ + 150));
  const edge = bisect(dockZ + 5, dockZ + 150, bounced);
  check(`an NPC is solid to the station within dockZ + NPC_HULL_BOX_MARGIN`
    + ` (${(edge - dockZ).toFixed(3)})`,
  near(edge, dockZ + NPC_HULL_BOX_MARGIN, 0.5));
}
