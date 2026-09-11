// The computer lines up every pilot's ship in a fight (docs/TODO/206 M2).
//
// Chris's words of 2026-09-11: timing and tactics are the pilot's. The pilot
// owns the laser, the missiles, the E.C.M. and the choice of target. The
// computer only aims. The bought combat computer takes control of everything
// but the missiles. These fly a real headless Game.

import * as THREE from 'three';
import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { withoutSaving } from '../src/game/storage.ts';
import { seedWorld } from '../src/game/rng.ts';
import { pickTarget } from '../src/game/targets.ts';
import type { NpcShip } from '../src/game/npc.ts';
import { check, dismissBriefing, eq } from './harness.ts';

console.log('\nthe computer lines up every pilot');

/** A commander in open space far from the station, with an empty sky. */
function open(seed: number): Game {
  const g = withoutSaving(() => {
    seedWorld(seed);
    const game = new Game(() => headlessShell());
    dismissBriefing(game);
    game.launch();
    return game;
  }).value;
  withoutSaving(() => { for (let f = 0, at = 0; f < 400; f++) g.step(1 / 60, at += 1 / 60); });
  g.state.world.clearNpcs();
  // Well clear of the station's truce, where pirates attack.
  g.state.player.position.add(new THREE.Vector3(0, 40_000, 0));
  return g;
}

function run(g: Game, frames: number): void {
  withoutSaving(() => { for (let f = 0; f < frames; f++) g.step(1 / 60, 20 + f / 60); });
}

/** How far off the nose a ship sits, in radians. */
function offNose(g: Game, ship: NpcShip): number {
  const nose = new THREE.Vector3(0, 0, -1).applyQuaternion(g.state.player.quaternion);
  return nose.angleTo(ship.object.position.clone().sub(g.state.player.position));
}

/** A ship placed off to one side of the commander. */
function beside(g: Game, role: 'pirate' | 'trader', x: number, seed: number): NpcShip {
  const pos = g.state.player.position.clone()
    .add(new THREE.Vector3(x, 0, -1800).applyQuaternion(g.state.player.quaternion));
  return g.state.world.spawn(role, pos, seed);
}

{
  const g = open(20_260_924);
  const pirate = beside(g, 'pirate', 1400, 1);
  pirate.state.speed = 0;
  const before = offNose(g, pirate);
  let hottest = 0;
  withoutSaving(() => {
    for (let f = 0; f < 150; f++) {
      g.step(1 / 60, 20 + f / 60);
      hottest = Math.max(hottest, g.state.sys.laserTemp);
    }
  });
  check('a fight starts, and the computer takes the stick of a ship with no combat computer',
    g.state.session.ccEngaged);
  check('...and turns the nose onto the threat', offNose(g, pirate) < before * 0.5,
    `${before.toFixed(2)} to ${offNose(g, pirate).toFixed(2)} rad`);
  eq('...and never fires: the trigger is the pilot\'s', hottest, 0);
}

{
  const g = open(20_260_925);
  g.state.commander.equipment.combatComputer = true;
  const pirate = beside(g, 'pirate', 900, 2);
  pirate.state.speed = 0;
  let hottest = 0;
  withoutSaving(() => {
    for (let f = 0; f < 240; f++) {
      g.step(1 / 60, 20 + f / 60);
      hottest = Math.max(hottest, g.state.sys.laserTemp);
    }
  });
  check('the bought combat computer also pulls the trigger', hottest > 0,
    `laser heat peaked at ${hottest.toFixed(3)}; pirate alive ${pirate.state.alive}`);
}

{
  const g = open(20_260_926);
  const pirate = beside(g, 'pirate', -1400, 3);
  const trader = beside(g, 'trader', 1400, 4);
  pirate.state.speed = 0;
  trader.state.speed = 0;
  pickTarget(g.state.world.npcs, trader);
  run(g, 180);
  check('with a target picked, the computer lines up on it rather than on the threat',
    offNose(g, trader) < offNose(g, pirate),
    `trader ${offNose(g, trader).toFixed(2)}, pirate ${offNose(g, pirate).toFixed(2)} rad`);
}

{
  const g = open(20_260_927);
  const pirate = beside(g, 'pirate', 1400, 5);
  pirate.state.speed = 0;
  run(g, 30);
  g.input.press('ArrowUp');
  run(g, 1);
  g.input.release('ArrowUp');
  check('a flight key takes the controls', !g.state.session.ccEngaged && g.state.session.handFlown);
  run(g, 60);
  check('...and the computer does not take them back by itself', !g.state.session.ccEngaged);
  g.state.session.handFlown = false;
  run(g, 1);
  check('a pick hands the stick back, and the aim starts again', g.state.session.ccEngaged);
}

{
  const g = open(20_260_928);
  g.state.session.course = 'station';
  const pirate = beside(g, 'pirate', 1400, 6);
  run(g, 30);
  check('a fight on a course: the aim flies, and the course waits', g.state.session.ccEngaged
    && g.state.session.course === 'station');
  pirate.state.alive = false;
  run(g, 5);
  check('...and when the area is clear, the course flies on', !g.state.session.ccEngaged
    && g.state.session.course === 'station');
}
