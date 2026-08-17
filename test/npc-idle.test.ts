// The ships that never fight name no ship class, and a fixture flies them.
//
// `game/npc-behaviour.ts` and `game/npc-idle.ts` came out of `game/npc.ts` in
// docs/TODO/182 M1. That item is the head of a programme, and this file holds
// the claim the whole programme rests on: **a behaviour needs a narrow view of
// a ship, and not the class**.
//
// TWO KINDS OF EVIDENCE, and neither one is enough alone:
//
//  1. A SOURCE SCAN. Neither file writes `NpcShip` in its CODE, and neither
//     imports the class. The scan strips comments first, so the prose may still
//     name it, and both headers do — one of them explains a type-only import
//     that is a cycle on paper and not at runtime. A scan can also go green
//     because the scan itself is broken, so a file that DOES name the class is
//     read by the same code, as the control.
//  2. A FIXTURE. Each behaviour is flown off an object literal with no hull, no
//     geometry, no energy bank and no flight model. A scan cannot say whether
//     the context is honestly narrow. This can.
//
// WHAT IS NOT HERE. Whether a rock LOOKS right is nobody's test. What these
// hold is that each behaviour touches the ship it is given, in the way the
// branch it replaced did: the rock rolls and goes nowhere, and the derelict
// rolls AND moves.

import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import {
  derelictIdle, hermitIdle, inertTumble, rockIdle,
} from '../src/game/npc-idle.ts';
import type { BehaviourShip } from '../src/game/npc-behaviour.ts';
import { check, eq } from './harness.ts';

// --- the behaviours name no ship class --------------------------------------

console.log('\nthe ships that never fight name no ship class');
{
  const code = (path: string) =>
    readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  for (const f of ['game/npc-idle.ts', 'game/npc-behaviour.ts']) {
    check(`${f} never writes NpcShip`, !/\bNpcShip\b/.test(code(f)));
  }
  check('game/npc-idle.ts imports nothing from npc.ts',
    !code('game/npc-idle.ts').includes('npc.ts'));

  // The control. Without it a scan that reads the wrong file, or a regular
  // expression that matches nothing, would report exactly the same green.
  check('...and the scan is not vacuous — game/npc.ts writes it',
    /\bNpcShip\b/.test(code('game/npc.ts')));
}

// --- a ship a behaviour accepts is not a ship -------------------------------
//
// The narrowest thing `BehaviourShip` describes. `NpcShip` satisfies the same
// interface, and this fixture shows that it does not have to.

console.log('four derelicts, flown off an object literal');
{
  const ship = (role: BehaviourShip['role'], maxSpeed = 0) => {
    let advanced = 0;
    const object = new THREE.Object3D();
    const it: BehaviourShip & { readonly advanced: () => number } = {
      object,
      role,
      maxSpeed,
      state: { speed: 0, tumbleAxis: new THREE.Vector3(0, 1, 0) },
      advance(dt: number) { advanced += dt; },
      advanced: () => advanced,
    };
    return it;
  };

  const DT = 1 / 60;
  const turned = (s: { object: THREE.Object3D }) =>
    Math.abs(2 * Math.acos(Math.min(1, Math.abs(s.object.quaternion.w))));

  // 1. A ROCK ROLLS AND GOES NOWHERE. Both halves matter: a rock that advanced
  //    would drift out of the field it was scattered into.
  {
    const rock = ship('asteroid');
    const event = rockIdle().fly(rock, DT);
    check('a rock rolls', turned(rock) > 0);
    eq('...and it goes nowhere', rock.advanced(), 0);
    check('...and it reports no shot', event === null);
  }

  // 2. A DERELICT ROLLS AND MOVES, and it holds its top speed for ever.
  {
    const hulk = ship('generation', 90);
    derelictIdle().fly(hulk, DT);
    check('a generation ship rolls', turned(hulk) > 0);
    eq('...and it takes its top speed', hulk.state.speed, 90);
    eq('...and it advances', hulk.advanced(), DT);
  }

  // 3. A HERMIT ROLLS, and its beacon blinks on its own clock. The clock is the
  //    behaviour's, not the ship's, which is why a hermit is an object rather
  //    than a rate.
  {
    const beacon = { visible: false } as unknown as THREE.Mesh;
    const rock = ship('hermit');
    const hermit = hermitIdle(beacon);
    hermit.fly(rock, DT);
    check('a hermit rolls', turned(rock) > 0);
    check('...and its beacon is lit early in the pulse', beacon.visible);
    // Far enough into the period to be dark again. The clock belongs to this
    // object, so a second hermit is not carried along with it.
    for (let i = 0; i < 240; i++) hermit.fly(rock, DT);
    const other = { visible: false } as unknown as THREE.Mesh;
    hermitIdle(other).fly(ship('hermit'), DT);
    check('...and a second hermit keeps its own clock', other.visible);
  }

  // 4. AN INERT DRONE ROLLS SLOWER THAN A ROCK, and that is the one thing the
  //    four rates are for. Asserted as an ordering rather than as a number, so
  //    a change to the look is not a failure and a change to the ORDER is.
  {
    const drone = ship('thargon');
    const rock = ship('asteroid');
    inertTumble().fly(drone, DT);
    rockIdle().fly(rock, DT);
    check('an inert drone rolls slower than a rock', turned(drone) < turned(rock));
    eq('...and it goes nowhere either', drone.advanced(), 0);
  }
}
