// The saved shape of a ship names no ship, and a snapshot can walk it.
//
// `game/npc-state.ts` came out of `game/npc.ts` in docs/TODO/181. The move had
// the same choice docs/TODO/169 M2 and docs/TODO/176 M2 had, and took the same
// answer: the shape leaves and the class stays.
//
// TWO KINDS OF EVIDENCE, and neither one is enough alone:
//
//  1. A SOURCE SCAN. The word `NpcShip` is nowhere in the file's CODE, and the
//     file imports nothing from `npc.ts`. The scan strips the comments first,
//     so the prose may still name the class, and it does — the header explains
//     which two siblings stayed behind and why. A scan can also go green
//     because the scan itself is broken, so a file that DOES name the class is
//     read by the same code, as the control.
//  2. A FIXTURE. `freshNpcState` is driven, and the state it returns is handed
//     to the REAL `serialiseState`. A scan cannot say whether a snapshot can
//     still walk the shape. This can.
//
// WHY THE SECOND ONE MATTERS. `game/snapshot.ts` walks `NpcState` generically
// and never names the type, so nothing in the type system connects the two. A
// field that stopped being serialisable would compile, pass the scan, and lose
// a career's state on the next save.
//
// WHAT IS NOT HERE. Whether each field holds the RIGHT value in a live ship is
// `test/npc.test.ts`'s and `test/snapshot.test.ts`'s. This file holds one claim
// about the shape and one about its opening value.

import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { freshNpcState } from '../src/game/npc-state.ts';
import { serialiseState } from '../src/game/snapshot.ts';
import { random, seedWorld } from '../src/game/rng.ts';
import { check, eq } from './harness.ts';

// --- the shape names no ship ------------------------------------------------

console.log('\nthe saved shape of a ship names no ship');
{
  const code = (path: string) =>
    readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  const shape = code('game/npc-state.ts');
  check('game/npc-state.ts never writes NpcShip', !/\bNpcShip\b/.test(shape));
  check('...and it imports nothing from npc.ts', !shape.includes('npc.ts'));

  // The control. Without it a scan that reads the wrong file, or a regular
  // expression that matches nothing, would report exactly the same green.
  check('...and the scan is not vacuous — game/npc.ts writes it',
    /\bNpcShip\b/.test(code('game/npc.ts')));
}

// --- ...and the factory it opens with -------------------------------------

console.log('what a fresh state opens with');
{
  seedWorld(20_260_818);
  const state = freshNpcState(128);

  eq('the energy it opens with is the one it was handed', state.energy, 128);
  check('...and the fields the HULL decides are left for the constructor',
    state.speed === 0 && state.missiles === 0 && state.hasEcm === false);
  check('...and the transform is left for bindTransform',
    state.pos === null && state.quat === null);

  // THE DRAW COUNT IS THE CLAIM THAT MATTERS, and nothing else in the suite
  // makes it. A draw added here, or one moved across a branch, shifts every
  // seeded outcome in the game — every pirate's hull, every wreck's cargo,
  // every shot that connects (invariant 11). The probes report that as a wall
  // of changed numbers. This says which line did it.
  //
  // THREE, NOT TWO, AND THE FIRST DRAFT OF THIS CLAIM SAID TWO. `docksHere`
  // takes one. `tumbleAxis` looks like one call and `randomDirection` spends
  // TWO inside it, for the height and the bearing of a point on a sphere
  // (game/rng.ts). A number that has to be measured is exactly the kind this
  // file exists to hold still.
  const DRAWS = 3;
  const SEED = 20_260_819;
  seedWorld(SEED);
  freshNpcState(128);
  const afterFactory = random();

  seedWorld(SEED);
  for (let i = 0; i < DRAWS; i++) random();
  const afterDraws = random();

  eq(`the factory draws exactly ${DRAWS} values from the seeded stream`,
    afterFactory, afterDraws);
}

// --- ...and a snapshot can still walk it ------------------------------------
//
// ONE CLAIM ONLY, because `test/snapshot.test.ts` already holds the whole walk
// and drives a REAL flown ship through it: every field reaches the snapshot,
// and every field survives serialise, JSON and restore. A second copy of that
// here would be the weaker of the two and would agree with itself.
//
// What is left is the one thing that file cannot say: a state built by the
// FACTORY, rather than one flown into existence, is walkable too.

console.log('a fresh state is a state a snapshot can walk');
{
  seedWorld(20_260_818);
  const state = freshNpcState(128);
  state.pos = new THREE.Vector3(1, 2, 3);
  state.quat = new THREE.Quaternion();

  const wire = JSON.stringify(
    serialiseState(state as unknown as Record<string, unknown>));
  check('the real serialiser walks a factory-built state',
    wire.length > 0 && !wire.includes('undefined'));
  check('...and it kept the fields the walk is for',
    wire.includes('traderPhase') && wire.includes('tumbleAxis'));
}
