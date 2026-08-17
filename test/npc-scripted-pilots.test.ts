// The two scripted pilots fly a narrow view of a ship, and one holds its own
// state.
//
// `game/npc-attack-run.ts` and `game/npc-pursuit.ts` came out of `game/npc.ts`
// in docs/TODO/183 M2. `test/npc-brain-pilot.test.ts` next door holds the same
// claim for the trained brain, and the two files differ in one way that is the
// whole point of this one.
//
// ONE PILOT IS AN OBJECT AND THE OTHER IS NOT, AND IT IS NOT ABOUT
// POLYMORPHISM. `PursuitPilot` holds two fields that are NOT in `NpcState`: the
// break-off phase it carries across frames, and the slash-or-hold hysteresis
// bit. The attack run holds none — every field it reads is saved — so it stays
// free functions. A ship therefore holds ONE pursuit pilot for its life, and
// two ships never share one.
//
// THREE KINDS OF EVIDENCE:
//
//  1. A SOURCE SCAN, in `test/npc-brain-pilot.test.ts`'s shape: the ship each
//     pilot FLIES is a `PilotShip`, and every import from `npc.ts` is
//     `import type`. A control reads a file that imports a value.
//  2. A FIXTURE, off an object literal with no hull and no roster row.
//  3. THE STATE CLAIM. Two pursuit pilots do not share a break-off phase, and
//     that is what a shared module-level field would break. It is the beacon
//     clock of docs/TODO/182 M1 at a second site.
//
// WHAT IS NOT HERE. Whether the run reads RIGHT in a fight is
// `test/break-off.test.ts`'s, `test/pursuit.test.ts`'s and
// `test/separation.test.ts`'s, and each drives a real `NpcShip`.

import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { attack } from '../src/game/npc-attack-run.ts';
import { PursuitPilot } from '../src/game/npc-pursuit.ts';
import type { PilotShip } from '../src/game/npc-pilot.ts';
import { freshNpcState } from '../src/game/npc-state.ts';
import { seedWorld } from '../src/game/rng.ts';
import { check, eq } from './harness.ts';

// --- both pilots fly a PilotShip --------------------------------------------

console.log('\nthe scripted pilots fly a narrow view of a ship');
{
  const src = (path: string) =>
    readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  for (const f of ['game/npc-attack-run.ts', 'game/npc-pursuit.ts']) {
    const pilot = src(f);
    check(`${f} flies a PilotShip`, /ship: PilotShip/.test(pilot));
    const npcImports = [...pilot.matchAll(/^import(.*?)from '\.\/npc\.ts';$/gm)]
      .map((m) => m[1]);
    check(`...and its npc.ts imports are type-only (${npcImports.length})`,
      npcImports.length > 0 && npcImports.every((i) => i.trim().startsWith('type')));
  }

  // The control, in the shape the sibling file uses.
  check('...and the scan is not vacuous — game/world.ts imports a VALUE from it',
    /^import \{[^}]*NpcShip[^}]*\} from '\.\/npc\.ts';$/m.test(src('game/world.ts')));

  // THE PURSUIT PILOT KEEPS ITS OWN STATE, and the ship keeps none of it.
  check('the pursuit pilot declares the two transient fields',
    /private readonly brk/.test(src('game/npc-pursuit.ts'))
    && /private slashing/.test(src('game/npc-pursuit.ts')));
  check('...and game/npc.ts declares neither any more',
    !/pursuitBrk|pursuitSlashing/.test(src('game/npc.ts')));
}

// --- ...flown off an object literal -----------------------------------------

console.log('two scripted pilots, flown off an object literal');
{
  seedWorld(20_260_819);

  const ship = (): PilotShip & { advanced: () => number } => {
    let advanced = 0;
    const state = freshNpcState(128);
    state.pos = new THREE.Vector3();
    state.quat = new THREE.Quaternion();
    state.speed = 100;
    return {
      object: new THREE.Object3D(),
      role: 'pirate',
      maxSpeed: 250,
      turnRate: 1.2,
      accel: 40,
      speedFloor: 50,
      healthFraction: 1,
      tacticHull: { radius: 30, maxSpeed: 250, turnRate: 1.2 },
      npcTarget: null,
      state,
      facing: () => 0,
      steerToward: () => {},
      advance(dt: number) { advanced += dt; },
      advanced: () => advanced,
    };
  };

  const DT = 1 / 60;
  const ahead = new THREE.Vector3(0, 0, -600);

  {
    const it = ship();
    attack(it, DT, ahead, 600, true);
    eq('the attack run stamps what flew the ship', it.state.flownBy, 'scripted');
    eq('...and it advanced the ship it was given', it.advanced(), DT);
  }

  {
    const it = ship();
    const player = {
      position: ahead, quaternion: new THREE.Quaternion(), speed: 120,
    };
    new PursuitPilot().fly(it, DT, player, 600, []);
    check('the pursuit pilot stamps one of its two flights',
      it.state.flownBy === 'pursuit' || it.state.flownBy === 'scripted');
    eq('...and it advanced the ship too', it.advanced(), DT);
  }

  {
    // THE STATE CLAIM, AND THE FIRST DRAFT OF IT WAS VACUOUS. It asserted that
    // two fresh pilots both start out of the break, which is true whether the
    // field is per pilot or shared. So it is driven instead: one pilot is flown
    // close enough to break off, and the OTHER must be untouched.
    const a = new PursuitPilot();
    const b = new PursuitPilot();
    const near = { position: new THREE.Vector3(0, 0, -40), quaternion: new THREE.Quaternion(), speed: 0 };
    a.fly(ship(), DT, near, 40, []);
    check('a pursuit pilot flown into a target breaks off', a.breaking);
    check('...and a second pilot is untouched by it', !b.breaking);
  }
}
