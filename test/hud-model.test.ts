// The lead marker leads with the target's REAL speed.
//
// docs/TODO/92: it used to lead every locked ship at a constant 220 — the
// armed trader's cruise — so the one ship it aimed truly at was the one not
// shooting back, and a Fer-de-Lance at 330 was under-led by a third. The
// marker now reads `npc.state.speed` through the same `velocityOf` the ships
// aim with. A fast ship and a slow one on the same bearing must therefore get
// different lead points — the assertion below goes red if the speed is ever
// pinned to a constant again.

import * as THREE from 'three';
import { seedWorld } from '../src/game/rng.ts';
import { NpcShip } from '../src/game/npc.ts';
import { screenTargets } from '../src/hud/hud-model.ts';
import { check } from './harness.ts';

console.log('\nhud model');
{
  const camera = new THREE.PerspectiveCamera(60, 1, 1, 50_000);
  camera.updateMatrixWorld();
  const scratch = new THREE.Vector3();
  const origin = new THREE.Vector3(0, 0, 0);
  const ahead = new THREE.Vector3(0, 0, -1);

  /** A locked pirate dead ahead, crossing right to left at `speed`. */
  const lockedAt = (speed: number) => {
    seedWorld(92);
    const npc = new NpcShip('pirate', new THREE.Vector3(0, 0, -2000), 0);
    npc.object.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    npc.state.speed = speed;
    return screenTargets([npc], origin, ahead, camera, 0, npc, scratch)[0];
  };

  const slow = lockedAt(100);
  const fast = lockedAt(350);
  check('a fast ship and a slow one on the same bearing lead differently',
    !!slow?.lead && !!fast?.lead && Math.abs(fast.lead.x - slow.lead.x) > 1e-4,
    `slow ${slow?.lead?.x?.toFixed(4)}, fast ${fast?.lead?.x?.toFixed(4)}`);
  check('...and the faster ship asks for MORE lead, along its heading',
    !!slow?.lead && !!fast?.lead
    && fast.lead.x < slow.lead.x && slow.lead.x < slow.x,
    'crossing toward -X, so more speed pushes the lead further left');

  // Chris rejected a floor for the stopped case: the marker on the hull IS the
  // answer — a stopped target needs no lead, and a floor would be a new
  // constant lying about where the shot lands.
  const still = lockedAt(0);
  check('a stopped target\'s lead collapses onto the bracket',
    !!still?.lead
    && Math.abs(still.lead.x - still.x) < 1e-9
    && Math.abs(still.lead.y - still.y) < 1e-9);
}
