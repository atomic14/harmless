// A trader chooses between two lives, and `update` chooses between behaviours.
//
// `game/npc-trader.ts` came out of `game/npc.ts` in docs/TODO/184 M2, the last
// cut of docs/TODO/182's programme. After it, `NpcShip.update` is 37 lines and
// decides nothing about flight.
//
// THIS FILE HOLDS TWO SUBJECTS, and the second one is a defect.
//
//  1. THE TRADER'S CHOICE. A fleeing trader defends itself. A trader that is
//     not fleeing gets on with the working life, and `game/trader-flight.ts`
//     still holds that. The claim is that the behaviour CALLS the working life
//     rather than absorbing it.
//  2. THE DISPATCH ORDER, AND `inert` COMES FIRST. docs/TODO/184 M1 gave every
//     fighting role a behaviour. It left the behaviour ahead of the `inert`
//     check, so a drone whose mothership died flew the fighter's amble instead
//     of tumbling. Nine probes and the campaign stayed byte-identical, because
//     no probe kills a Thargoid mothership. Only a fixture says so.
//
// THE SECOND CLAIM DRIVES A REAL `NpcShip`, and it has to. The defect was in
// the ORDER of two lines in `update`, and no object literal can reach that.
//
// WHAT IS NOT HERE. Whether the working life picks the right waypoint is
// `test/trader-flight.test.ts`'s. Whether an armed trader WINS is `train/`'s.

import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { traderBehaviour } from '../src/game/npc-trader.ts';
import type { BehaviourShip } from '../src/game/npc-behaviour.ts';
import { freshNpcState } from '../src/game/npc-state.ts';
import { World } from '../src/game/world.ts';
import { seedWorld } from '../src/game/rng.ts';
import { SHIPPED_BRAINS } from '../src/game/brain-names.ts';
import { check, eq } from './harness.ts';

// --- it flies a BehaviourShip, and it calls the working life ----------------

console.log('\na trader flies a narrow view of a ship');
{
  const src = (path: string) =>
    readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  const trader = src('game/npc-trader.ts');
  check('game/npc-trader.ts flies a BehaviourShip',
    /ship: BehaviourShip/.test(trader));
  const npcImports = [...trader.matchAll(/^import(.*?)from '\.\/npc\.ts';$/gm)]
    .map((m) => m[1]);
  check(`...and its npc.ts imports are type-only (${npcImports.length})`,
    npcImports.length > 0 && npcImports.every((i) => i.trim().startsWith('type')));

  // The control, in the shape every file of the programme uses.
  check('...and the scan is not vacuous — game/world.ts imports a VALUE from it',
    /^import \{[^}]*NpcShip[^}]*\} from '\.\/npc\.ts';$/m.test(src('game/world.ts')));

  // IT CALLS THE WORKING LIFE RATHER THAN ABSORBING IT. This is the plan's own
  // constraint: `game/trader-flight.ts` takes four handles and stays that way.
  check('...and it calls stepTrader', /\bstepTrader\(/.test(trader));
  check('...and game/trader-flight.ts still takes a TraderShip',
    /ship: TraderShip/.test(src('game/trader-flight.ts')));
}

// --- ...and it chooses between two lives ------------------------------------

console.log('a trader, flown off an object literal');
{
  seedWorld(20_260_821);

  const station = new THREE.Object3D();
  station.position.set(0, 0, 12_000);

  const ship = (fleeing: boolean) => {
    const reached: string[] = [];
    let advanced = 0;
    const state = freshNpcState(128);
    state.pos = new THREE.Vector3();
    state.quat = new THREE.Quaternion();
    state.speed = 90;
    state.fleeing = fleeing;
    state.fleeFrom = new THREE.Vector3(0, 0, -400);
    const it: BehaviourShip & { reached: string[]; advanced: () => number } = {
      object: new THREE.Object3D(),
      role: 'trader',
      maxSpeed: 200,
      turnRate: 0.9,
      accel: 30,
      speedFloor: 40,
      healthFraction: 1,
      tacticHull: { radius: 40, maxSpeed: 200, turnRate: 0.9 },
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
  const commander = {
    position: new THREE.Vector3(0, 0, -400),
    quaternion: new THREE.Quaternion(),
    speed: 100,
  };

  // 1. A FLEEING TRADER RUNS, and it is the only flight allowed to say so.
  //    docs/TODO/88's readout is the reason: a report of the BRANCH rather than
  //    of the flight made an armed trader mid-duel read as a ship on the run.
  {
    const it = ship(true);
    const event = traderBehaviour().fly(it, DT, commander, view);
    eq('a fleeing trader reports the flight it flew', it.state.flownBy, 'fleeing');
    eq('...and it advanced', it.advanced(), DT);
    check('...and it steered', it.reached.includes('steer'));
    check('...and it fired nothing', event === null);
    check('...and it set no waypoint', it.state.waypoint.lengthSq() === 0);
  }

  // 2. A TRADER THAT IS NOT FLEEING WORKS, and the working life leaves a mark
  //    the defence never leaves. `game/trader-flight.ts` steers at a WAYPOINT,
  //    and the fleeing tail steers away from `fleeFrom` and sets none. So the
  //    waypoint is what says which of the two branches ran.
  //
  //    IT STAMPS NO FLIGHT MODEL, and `none` is correct. A trader minding its
  //    own business flies no combat model at all, the same as the fighter's
  //    amble (docs/TODO/88).
  {
    const it = ship(false);
    traderBehaviour().fly(it, DT, commander, view);
    check('a working trader picked a waypoint', it.state.waypoint.lengthSq() > 0);
    eq('...and it reports no flight model', it.state.flownBy, 'none');
    eq('...and it advanced too', it.advanced(), DT);
  }
}

// --- the dispatch asks `inert` first ----------------------------------------
//
// THE ONE CLAIM IN THIS FILE THAT DRIVES A REAL SHIP. A Thargon holds the
// fighter behaviour since docs/TODO/184 M1. The flag is a STATE, so nothing in
// the constructor can carry it, and only the ORDER of two lines in `update`
// keeps a shut-down drone tumbling.

console.log('a drone whose mothership died tumbles, and goes nowhere');
{
  seedWorld(20_260_822);

  const world = new World();
  const drone = world.spawn('thargon', new THREE.Vector3(), 2);
  drone.state.inert = true;

  const station = new THREE.Object3D();
  station.position.set(0, 0, 12_000);
  const at = drone.object.position.clone();
  const facing = drone.object.quaternion.clone();

  drone.update(1 / 60,
    { position: new THREE.Vector3(0, 0, -500), quaternion: new THREE.Quaternion(), speed: 100 },
    {
      station, dockZ: 160, fleet: [], playerLegal: 2, brains: SHIPPED_BRAINS,
      missileInbound: false, playerToStation: Infinity,
    } as never);

  const moved = drone.object.position.distanceTo(at);
  const turned = 2 * Math.acos(Math.min(1, Math.abs(drone.object.quaternion.dot(facing))));

  // BOTH HALVES MATTER, AND THE FIRST IS THE ONE M1 BROKE. Under M1's order the
  // drone flew the fighter's amble: it moved 2.89 units in this one frame, and
  // it turned nine times as far.
  eq(`an inert drone goes nowhere (${moved.toFixed(4)})`, moved, 0);
  check(`...and it still rolls (${turned.toFixed(5)})`, turned > 0 && turned < 0.01);
  eq('...and it reports no flight model', drone.state.flownBy, 'none');
}
