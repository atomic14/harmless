// A hunt's target that is nearly dead runs for the edge, and the chase is the
// commander's (docs/TODO/214 M4).
//
// Two claims about the ship. `NpcShip.takeDamage` sets the run on a ship the
// world step marked, and on no other pirate, while a trader still runs on the
// first hit. And the fighter behaviour flies the run: straight at the
// waypoint, at full speed, and off the edge `TRADER_JUMP_OUT` short of it.
//
// The mission's side of it is `test/mission-courses.test.ts`, through a real
// world step: the stamp, the row's words, the line on the console, and the
// leg that fails when the ship jumps out.

import * as THREE from 'three';
import { NpcShip } from '../src/game/npc.ts';
import { seedWorld } from '../src/game/rng.ts';
import { SHIPPED_BRAINS } from '../src/game/brain-names.ts';
import { HUNT_FLEE_FRACTION } from '../src/constants/attack-run.ts';
import { DEEP_TRADER_RUN, TRADER_JUMP_OUT } from '../src/constants/spawn-placement.ts';
import { check, eq } from './harness.ts';

const origin = new THREE.Vector3();
const station = new THREE.Object3D();
const player = { position: origin, quaternion: new THREE.Quaternion(), speed: 0 } as never;
const view = {
  station, dockZ: 160, fleet: [], playerLegal: 0, brains: SHIPPED_BRAINS,
  missileInbound: false, playerToStation: Infinity,
} as never;

/** A pirate 2,000 units down the nose, with this much of its energy left. */
function pirate(fraction: number, canFlee: boolean): NpcShip {
  seedWorld(7);
  const npc = new NpcShip('pirate', new THREE.Vector3(0, 0, -2000), 3);
  npc.state.energy = Math.floor(npc.maxEnergy * fraction);
  npc.state.canFlee = canFlee;
  return npc;
}

console.log('\na hunt\'s target runs when it is nearly dead, and no other pirate does');
{
  const marked = pirate(HUNT_FLEE_FRACTION, true);
  marked.takeLaserHit(1, origin.clone(), true);
  check('a marked pirate hit under the fraction runs', marked.state.fleeing && marked.state.alive);
  const run = marked.state.waypoint.clone().sub(marked.object.position);
  check(`...straight away from the shot, ${DEEP_TRADER_RUN} out`,
    run.z < 0 && Math.abs(run.length() - DEEP_TRADER_RUN) < 1, `${run.length().toFixed(0)} along z ${run.z.toFixed(0)}`);

  const whole = pirate(1, true);
  whole.takeLaserHit(1, origin.clone(), true);
  check('...and one hit at full energy stands and fights', !whole.state.fleeing);

  const unmarked = pirate(HUNT_FLEE_FRACTION, false);
  unmarked.takeLaserHit(1, origin.clone(), true);
  check('a pirate the world step never marked fights to the end', !unmarked.state.fleeing);

  seedWorld(7);
  const trader = new NpcShip('trader', new THREE.Vector3(0, 0, -2000), 3);
  trader.takeLaserHit(1, origin.clone(), true);
  check('a trader still runs on the first hit, as before', trader.state.fleeing);
  check('...and a trader\'s run sets no waypoint', trader.state.waypoint.lengthSq() === 0);
}

console.log('\nthe fighter flies the run, and jumps out short of the waypoint');
{
  const npc = pirate(HUNT_FLEE_FRACTION, true);
  npc.takeLaserHit(1, origin.clone(), true);
  const start = npc.object.position.clone();
  for (let f = 0; f < 5 * 60; f++) npc.update(1 / 60, player, view);
  const moved = npc.object.position.clone().sub(start);
  eq('a ship on the run reports the flight it flew', npc.state.flownBy, 'fleeing');
  check('...and five seconds on it is well down the run, away from the shot',
    moved.z < -500 && moved.length() > 500, `${moved.length().toFixed(0)} units, z ${moved.z.toFixed(0)}`);
  check('...at its top speed', Math.abs(npc.state.speed - npc.maxSpeed) < 1, `${npc.state.speed.toFixed(0)} of ${npc.maxSpeed}`);
  check('...and it has not left yet', !npc.state.wantsDespawn);

  // The waypoint brought within reach: one more second, and the ship asks to go.
  npc.state.waypoint.copy(npc.object.position).add(new THREE.Vector3(0, 0, -(TRADER_JUMP_OUT + 100)));
  for (let f = 0; f < 60 && !npc.state.wantsDespawn; f++) npc.update(1 / 60, player, view);
  check(`inside ${TRADER_JUMP_OUT} of the waypoint it jumps out`, npc.state.wantsDespawn);
  check('...alive, so the leg reads a ship that fled and not a wreck', npc.state.alive && npc.state.fleeing);
}
