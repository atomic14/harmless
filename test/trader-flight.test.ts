// A trader's working life names no ship class, and a fixture proves it.
//
// `game/trader-flight.ts` came out of `game/npc.ts` in docs/TODO/176 M2. The
// move had the same choice docs/TODO/169 M2 had: keep `NpcShip` in the
// signature, or take a narrow interface. It took the interface, so this file
// holds the claim that buys.
//
// TWO KINDS OF EVIDENCE, and neither one is enough alone:
//
//  1. A SOURCE SCAN. The word `NpcShip` is nowhere in the file's CODE, and the
//     file imports nothing from `npc.ts`. The scan strips the comments first,
//     so the prose may still name the class, and it does. A scan can also go
//     green because the scan itself is broken. So a file that DOES name the
//     class is read by the same code, as the control.
//  2. A FIXTURE. A transform, two hull numbers and ten state fields drive all
//     four phases. It is an object literal, and it constructs no ship at all. A
//     scan cannot say whether the type is honestly narrow. This can.
//
// WHAT IS NOT HERE. Whether a trader's life reads RIGHT in the world is
// asserted in `npc.test.ts`, `deep-space-traffic.test.ts` and
// `dock-traffic`, and each of those drives a real `NpcShip`. A moved function
// pinned against itself is the check `CLAUDE.md` forbids.

import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { seedWorld } from '../src/game/rng.ts';
import { makeDockPlan } from '../src/game/docking.ts';
import { DEEP_TRADER_RUN } from '../src/constants/spawn-placement.ts';
import { stepTrader, type TraderShip } from '../src/game/trader-flight.ts';
import { check } from './harness.ts';

// --- the trader's life names no ship class ----------------------------------

console.log('\nthe trader\'s working life names no ship class');
{
  const code = (path: string) =>
    readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  const life = code('game/trader-flight.ts');
  check('game/trader-flight.ts never writes NpcShip', !/\bNpcShip\b/.test(life));
  check('...and it imports nothing from npc.ts', !life.includes('npc.ts'));

  // The control. Without it a scan that reads the wrong file, or a regular
  // expression that matches nothing, would report exactly the same green.
  const reader = code('game/npc.ts');
  check('...and the scan is not vacuous — game/npc.ts writes it',
    /\bNpcShip\b/.test(reader));
}

// --- a ship that trades is not a ship ---------------------------------------
//
// The narrowest thing `TraderShip` describes. There is no hull here, no
// geometry, no energy bank and no weapon. `NpcShip` satisfies the same
// interface, and this fixture shows that it does not have to.

console.log('\nthe four phases of a trader, off an object literal');
{
  // Seeded, because the `trading` phase pulls a waypoint and a timer from the
  // world stream. Without this the block inherits whatever position the tests
  // before it left behind.
  seedWorld(20_260_817);

  const STATION_OUT = 12_000;
  const station = new THREE.Object3D();
  station.position.set(0, 0, STATION_OUT);
  station.updateMatrixWorld(true);
  const sunPos = new THREE.Vector3(0, 0, 320_000);
  const world = { station, dockZ: 160, sunPos };

  const trader = (
    at: THREE.Vector3, phase: TraderShip['state']['traderPhase'],
    fields: Partial<TraderShip['state']> = {},
  ): TraderShip => {
    const object = new THREE.Object3D();
    object.position.copy(at);
    return {
      object,
      maxSpeed: 250,
      turnRate: 1.2,
      state: {
        traderPhase: phase,
        speed: 0,
        waypoint: new THREE.Vector3(),
        waypointTimer: 0,
        tradeTimer: 20,
        docksHere: false,
        docking: false,
        docked: false,
        wantsDespawn: false,
        dockPlan: makeDockPlan(),
        ...fields,
      },
    };
  };

  const DT = 1 / 60;
  const fly = (ship: TraderShip, frames: number) => {
    for (let i = 0; i < frames; i++) {
      stepTrader(ship, DT, world);
      // `stepTrader` steers and sets a speed. `NpcShip.update` moves the ship,
      // and this stands in for that one line, so the fixture flies.
      ship.object.translateZ(-ship.state.speed * DT);
    }
    return ship;
  };

  // 1. ARRIVING. It comes in from deep space and it speeds up.
  {
    const far = trader(new THREE.Vector3(0, 0, 60_000), 'arriving');
    fly(far, 1);
    check('an arriving trader accelerates from rest', far.state.speed > 0);
    check('...and it is still arriving a long way out',
      far.state.traderPhase === 'arriving');

    const close = trader(new THREE.Vector3(0, 0, STATION_OUT + 800), 'arriving');
    fly(close, 1);
    check('...and it starts trading inside 900 units of the station',
      close.state.traderPhase === 'trading');
  }

  // 2. TRADING. It works the lane, and the timer decides how it leaves.
  {
    const potter = trader(station.position.clone(), 'trading');
    fly(potter, 1);
    check('a trader at the station picks a waypoint off the lane',
      potter.state.waypoint.lengthSq() > 0);
    check('...and the lane waypoint is nearer the planet than the station is',
      potter.state.waypoint.length() < STATION_OUT * 1.4);
    check('...and its business clock runs down', potter.state.tradeTimer < 20);

    const leaver = trader(station.position.clone(), 'trading', { tradeTimer: DT / 2 });
    fly(leaver, 1);
    check('a trader with no business here departs when its clock runs out',
      leaver.state.traderPhase === 'departing');
    // THE DISTANCE IS `DEEP_TRADER_RUN` AND NOT A NUMBER WRITTEN OUT HERE.
    // It was a bare 30000 in the rule until docs/TODO/179, beside a constant
    // that already held the same value for the other way into `departing`.
    // `test/deep-space-traffic.test.ts` pins that other way. The sun is
    // straight out along +Z here, so the waypoint is the station plus the run.
    check('...and it runs for the sun to jump out, exactly the stated run',
      Math.abs(leaver.state.waypoint.z - (STATION_OUT + DEEP_TRADER_RUN)) < 1);

    const caller = trader(station.position.clone(), 'trading',
      { tradeTimer: DT / 2, docksHere: true });
    fly(caller, 1);
    check('a trader with business here goes for the slot instead',
      caller.state.traderPhase === 'docking');
  }

  // 3. DEPARTING. It flies at its waypoint and it jumps out on arrival.
  {
    const out = new THREE.Vector3(0, 0, 90_000);
    const going = trader(new THREE.Vector3(0, 0, 87_000), 'departing',
      { waypoint: out.clone(), speed: 250 });
    // Pointed at the waypoint already, so this asserts the arrival rather than
    // the turn. A hull is built nose-down −Z, so +Z is half a turn about Y.
    going.object.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
    check('a departing trader has not jumped yet', !going.state.wantsDespawn);
    // 3,000 units out, and it jumps at 2,500. So 500 units at 250 units per
    // second is 2 seconds, and 240 frames is twice that.
    fly(going, 240);
    check('...and it jumps out once it reaches the waypoint',
      going.state.wantsDespawn);
  }

  // 4. DOCKING. The plan is `game/docking.ts`'s, and this phase applies it. The
  //    claim is that the phase reads the plan back, rather than that the plan
  //    is right — `docking.test.ts` owns that.
  {
    const inbound = trader(new THREE.Vector3(0, 0, STATION_OUT - 3000), 'docking');
    const before = inbound.object.quaternion.clone();
    fly(inbound, 1);
    check('a docking trader takes its speed from the plan', inbound.state.speed > 0);
    check('...and it rolls toward the slot rather than at its target',
      !inbound.object.quaternion.equals(before));
    check('...and it is not docked from three kilometres out',
      !inbound.state.docked && !inbound.state.wantsDespawn);
  }
}
