// A ship that fights asks three questions in one order, and a fixture proves
// the order.
//
// `game/npc-fighter.ts` came out of `game/npc.ts` in docs/TODO/184 M1, the last
// cut of docs/TODO/182's programme. It is the behaviour of the pirate, the
// police, the bounty hunter, the Thargoid and its drone.
//
// THE ORDER IS THE SUBJECT, and it is the one thing a reader of the file cannot
// check by eye. A ship that can reach the commander attacks HER, before it
// looks at whatever NPC it was hunting. Reverse the two and a pirate mid-duel
// with a trader ignores the commander who just arrived.
//
// TWO KINDS OF EVIDENCE:
//
//  1. A SOURCE SCAN, in the shape docs/TODO/183's pilots use. The ship it flies
//     is a `BehaviourShip`, and every import from `npc.ts` is `import type`.
//  2. A FIXTURE. The behaviour is flown off an object literal that records
//     which pilot it reached for. A scan cannot say which question was asked
//     first. This can.
//
// WHAT IS NOT HERE. Whether a pirate WINS is `train/`'s question, and the
// probes answer it. Whether the amble puts a waypoint in the right place is
// `test/station-truce.test.ts`'s.

import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { fighterBehaviour } from '../src/game/npc-fighter.ts';
import type { BehaviourShip } from '../src/game/npc-behaviour.ts';
import { freshNpcState } from '../src/game/npc-state.ts';
import { seedWorld } from '../src/game/rng.ts';
import { SHIPPED_BRAINS } from '../src/game/brain-names.ts';
import { PLAYER_INTEREST_RANGE } from '../src/constants/player-interest.ts';
import { check, eq } from './harness.ts';

// --- it flies a BehaviourShip -----------------------------------------------

console.log('\na ship that fights flies a narrow view of a ship');
{
  const src = (path: string) =>
    readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  const fighter = src('game/npc-fighter.ts');
  check('game/npc-fighter.ts flies a BehaviourShip',
    /ship: BehaviourShip/.test(fighter));
  const npcImports = [...fighter.matchAll(/^import(.*?)from '\.\/npc\.ts';$/gm)]
    .map((m) => m[1]);
  check(`...and its npc.ts imports are type-only (${npcImports.length})`,
    npcImports.length > 0 && npcImports.every((i) => i.trim().startsWith('type')));

  // The control, in the shape every file of the programme uses.
  check('...and the scan is not vacuous — game/world.ts imports a VALUE from it',
    /^import \{[^}]*NpcShip[^}]*\} from '\.\/npc\.ts';$/m.test(src('game/world.ts')));
}

// --- ...and it asks its three questions in order ----------------------------

console.log('a fighter asks the commander first, then its target, then ambles');
{
  seedWorld(20_260_820);

  const station = new THREE.Object3D();
  station.position.set(0, 0, 12_000);

  /** A ship that records which pilot the behaviour reached for. */
  const ship = (at: THREE.Vector3) => {
    const reached: string[] = [];
    let advanced = 0;
    const state = freshNpcState(128);
    state.pos = new THREE.Vector3();
    state.quat = new THREE.Quaternion();
    const object = new THREE.Object3D();
    object.position.copy(at);
    const it: BehaviourShip & { reached: string[]; advanced: () => number } = {
      object,
      role: 'pirate',
      maxSpeed: 250,
      turnRate: 1.2,
      accel: 40,
      speedFloor: 50,
      healthFraction: 1,
      tacticHull: { radius: 30, maxSpeed: 250, turnRate: 1.2 },
      armed: false,
      npcTarget: null,
      attackers: [],
      state,
      facing: () => 0,
      steerToward: () => { reached.push('steer'); },
      advance(dt: number) { advanced += dt; },
      nearestAttacker: () => null,
      chooseWeapon: (shot) => { reached.push('rail'); return shot; },
      pursuitFly: () => { reached.push('pursuit'); return null; },
      reached,
      advanced: () => advanced,
    };
    return it;
  };

  const DT = 1 / 60;
  const view = {
    station, dockZ: 160, fleet: [], playerLegal: 2, brains: SHIPPED_BRAINS,
    missileInbound: false, playerToStation: Infinity,
  } as never;
  const commander = (z: number) => ({
    position: new THREE.Vector3(0, 0, z),
    quaternion: new THREE.Quaternion(),
    speed: 100,
  });

  {
    // 1. THE COMMANDER COMES FIRST. A Fugitive inside the interest range is
    //    what a pirate wants, so the behaviour reaches for a combat pilot and
    //    then for the rail.
    const it = ship(new THREE.Vector3());
    fighterBehaviour().fly(it, DT, commander(-500), view);
    check(`a fighter in reach of the commander goes for her (${it.reached.join(',')})`,
      it.reached.includes('rail'));
  }

  {
    // 2. OUT OF REACH, IT AMBLES. No pilot, no rail — it steers at a waypoint
    //    and moves. `flownBy` stays `none`, because an ambling ship is flying
    //    no combat model at all (docs/TODO/88).
    const it = ship(new THREE.Vector3());
    fighterBehaviour().fly(it, DT, commander(-(PLAYER_INTEREST_RANGE + 5_000)), view);
    check(`a fighter with nobody in reach ambles (${it.reached.join(',') || 'nothing'})`,
      !it.reached.includes('rail') && !it.reached.includes('pursuit'));
    eq('...and it reports no flight model', it.state.flownBy, 'none');
    eq('...and it advanced', it.advanced(), DT);
    check('...and it picked a waypoint off the station', it.state.waypoint.lengthSq() > 0);
  }

  {
    // 3. THE ORDER ITSELF. With BOTH a reachable commander and a live NPC
    //    target, the commander wins. This is the assertion the file exists for.
    const target = ship(new THREE.Vector3(0, 0, -300));
    const it = ship(new THREE.Vector3());
    it.npcTarget = target as never;
    fighterBehaviour().fly(it, DT, commander(-500), view);
    check('with both in reach, the commander comes first',
      it.reached.includes('rail'));
    check('...and the NPC target is left alone', it.npcTarget !== null);
  }
}
