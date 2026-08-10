// Does the docking computer still get in? — approaches flown, and how they end.
//
//   npm run dock-probe
//
// docs/TODO/126 changes HOW the autopilot flies: it produced no `FlightDemand`
// at all, writing `player.quaternion` through a shortest-arc slerp about an axis
// no stick can make. Replacing that with pitch and roll is the fix, and it is
// also the one change in this codebase that can quietly ruin the hardest thing
// in the game — the plan's own warning: "a demand-flown autopilot that misses
// the letterbox is a worse bug than the one being fixed."
//
// So the claim needs a NUMBER, before and after, and it needs to be the same
// number: this flies the shipped `WorldStep` — the real plan, the real slot
// test, the real bounce — from a spread of starting geometries, and reports how
// many of them end up docked and how long each took.
//
// WHAT IT SPREADS OVER, and why each matters:
//
//   offset    dead on the axis, and 400 to 2,400 units off it in four
//             directions. Off-axis is the case the roll term exists for: the
//             ship has to bank round to the gate and then arrive rolled with
//             the slot.
//   range     900 to 3,000 units out — inside the gate and well outside it, so
//             both approach phases are exercised from cold.
//   spin      the station turned by four different angles before the run, so
//             the slot is not in the same place every time. A letterbox that
//             only worked at one rotation would otherwise pass every case.
//
// 320 approaches, about a second. WHAT IT MEASURED, for docs/TODO/126: the old
// quaternion slerp docked 320/320, median 15.2s, worst 36.3s, 2 scrapes; the
// demand-flown autopilot docks 320/320, median 16.8s, worst 30.6s, 3 scrapes.
//
// The ship starts at rest, pointing along world -Z whatever direction the
// station happens to be, which is deliberately unhelpful: the first thing every
// run has to do is turn.

import * as THREE from 'three';

import { freshState } from '../src/game/state.ts';
import { newCommander } from '../src/game/commander.ts';
import { WorldStep, type StepHost } from '../src/game/world-step.ts';
import { Ordnance } from '../src/game/ordnance.ts';
import { seedWorld } from '../src/game/rng.ts';

/** Hands off the stick: the autopilot is the only pilot in these runs. */
const COAST = { rollRate: 0, pitchRate: 0, throttle: 0, fire: false };

/** Give up on a run after this long — a circling autopilot is a failed one. */
const PATIENCE_SECONDS = 120;

interface Run {
  docked: boolean;
  seconds: number;
  /** scrapes: the hull box or a fluffed slot, each of which costs damage */
  bumps: number;
}

function approach(seed: number, offAxis: THREE.Vector3, out: number, spin: number): Run {
  seedWorld(seed);
  const state = freshState(newCommander());
  state.world.build(state.systems[state.commander.systemIndex]);
  let docked = false;
  let bumps = 0;
  const host: StepHost = {
    inFlight: () => !docked,
    applyPlayerDamage: () => { bumps += 1; },
    destroyNpc: () => {}, wreckNpc: () => {}, fireLaser: () => {},
    raiseLegal: () => {}, die: () => {}, dock: () => { docked = true; },
    completeHyperspace: () => {}, completeRescue: () => {},
    openHermitTrade: () => {}, autoSave: () => {},
  };
  const step = new WorldStep(state, new Ordnance(state.world), host);

  const station = state.world.station;
  station.rotateZ(spin);
  station.updateMatrixWorld(true);
  const normal = new THREE.Vector3(0, 0, -1).applyQuaternion(station.quaternion);
  state.player.position.copy(station.position).addScaledVector(normal, out).add(offAxis);
  state.player.quaternion.identity();
  state.player.speed = 0;
  state.session.dcEngaged = true;

  const dt = 1 / 60;
  let frames = 0;
  for (; frames < PATIENCE_SECONDS * 60 && !docked; frames++) {
    // An empty sky every frame: this measures the autopilot, not a dogfight.
    // (The station's own traders spawn and dock, and a Viper on the pad would
    // be a collision the probe would score against the approach.)
    state.world.clearNpcs();
    step.step(dt, frames * dt, { demand: COAST, handsOn: false });
  }
  return { docked, seconds: frames / 60, bumps };
}

const OFFSETS: [string, THREE.Vector3][] = [
  ['on-axis', new THREE.Vector3(0, 0, 0)],
  ['right  ', new THREE.Vector3(1, 0, 0)],
  ['left   ', new THREE.Vector3(-1, 0, 0)],
  ['above  ', new THREE.Vector3(0, 1, 0)],
  ['below  ', new THREE.Vector3(0, -1, 0)],
];

const cases = OFFSETS.flatMap(([name, dir]) =>
  [400, 900, 1_500, 2_400].flatMap((off) =>
    [900, 1_200, 2_000, 3_000].flatMap((out) =>
      [0, 0.4, 0.9, 2.2].map((spin) => ({
        label: `${name} ${String(off).padStart(4)} off · ${out} out · spin ${spin}`,
        offAxis: dir.clone().multiplyScalar(off),
        out,
        spin,
      })))));

let docked = 0;
let scrapes = 0;
const times: number[] = [];
for (const [i, c] of cases.entries()) {
  const r = approach(90_100 + i, c.offAxis, c.out, c.spin);
  if (r.docked) { docked += 1; times.push(r.seconds); }
  scrapes += r.bumps;
  console.log(`${r.docked ? 'DOCKED' : 'FAILED'} ${r.seconds.toFixed(1).padStart(6)}s`
    + ` · ${String(r.bumps).padStart(2)} scrape(s) · ${c.label}`);
}
times.sort((a, b) => a - b);
console.log(`\n${docked}/${cases.length} docked · median ${
  times.length ? times[times.length >> 1].toFixed(1) : '—'}s · ${
  times.length ? times[times.length - 1].toFixed(1) : '—'}s worst · ${scrapes} scrapes`);
