// Mining and collecting (docs/TODO/206 M6).
//
// Chris's words of 2026-09-11: the same fight works on asteroids, and
// collecting needs fuel scoops. The ship flies round the cargo, and the pilot
// can stop it. So MINE THE ASTEROIDS keeps a rock picked, the computer aims,
// and the pilot fires. COLLECT EVERYTHING then flies onto each canister.

import * as THREE from 'three';
import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { withoutSaving } from '../src/game/storage.ts';
import { seedWorld } from '../src/game/rng.ts';
import { COURSE_KEYS } from '../src/game/bindings.ts';
import { pickedTarget } from '../src/game/targets.ts';
import { keymap } from '../src/engine/keymap.ts';
import { check, dismissBriefing, eq } from './harness.ts';

console.log('\nmining and collecting');

/** A commander in open space with scoops, a mining laser, and an empty sky. */
function outThere(seed: number): Game {
  const g = withoutSaving(() => {
    seedWorld(seed);
    const game = new Game(() => headlessShell());
    dismissBriefing(game);
    game.launch();
    return game;
  }).value;
  withoutSaving(() => { for (let f = 0, at = 0; f < 400; f++) g.step(1 / 60, at += 1 / 60); });
  g.state.world.clearNpcs();
  g.state.world.cargo.clear();
  g.state.player.position.add(new THREE.Vector3(0, 50_000, 0));
  g.state.commander.equipment.scoops = true;
  g.state.commander.equipment.miningLaser = true;
  return g;
}

function run(g: Game, frames: number, hold = false): void {
  const fire = keymap().fire[0];
  withoutSaving(() => {
    for (let f = 0; f < frames; f++) {
      if (hold) g.input.press(fire);
      g.step(1 / 60, 40 + f / 60);
    }
  });
  g.input.release(fire);
}

function press(g: Game, code: string): void {
  g.input.injectPress(code);
  withoutSaving(() => g.step(1 / 60, 39));
}

/** A point in front of the ship. */
function ahead(g: Game, z: number, x = 0): THREE.Vector3 {
  return g.state.player.position.clone()
    .add(new THREE.Vector3(x, 0, -z).applyQuaternion(g.state.player.quaternion));
}

{
  const g = outThere(20_260_932);
  g.state.world.cargo.spawn(ahead(g, 900), 1, [0]);
  g.state.world.cargo.spawn(ahead(g, 1500, 400), 1, [0]);
  const held = g.state.commander.cargo.reduce((a, b) => a + b, 0);
  check('with cargo adrift and a clear scanner, the list offers to collect it',
    g.coursePanel()?.rows?.some((c) => c.kind === 'collect' && c.why === null) === true);

  press(g, COURSE_KEYS.collect);
  eq('the button sets the ship collecting', g.state.session.course, 'collect');
  withoutSaving(() => {
    for (let f = 0; f < 60 * 120 && g.state.session.course === 'collect'; f++) {
      g.step(1 / 60, 40 + f / 60);
    }
  });
  eq('...and every canister is aboard', g.state.world.cargo.items.length, 0);
  check('...in the hold', g.state.commander.cargo.reduce((a, b) => a + b, 0) > held);
  eq('...and the console says so', g.state.session.messageText, 'EVERYTHING IS ABOARD');
}

{
  const g = outThere(20_260_933);
  g.state.commander.equipment.scoops = false;
  g.state.world.cargo.spawn(ahead(g, 900), 1, [0]);
  const row = g.coursePanel()?.rows?.find((c) => c.kind === 'collect');
  eq('with no fuel scoops the row says what the ship needs', row?.why, 'NEEDS FUEL SCOOPS');
}

{
  const g = outThere(20_260_934);
  const rock = g.state.world.spawn('asteroid', ahead(g, 1200), 1);
  press(g, COURSE_KEYS.mine);
  run(g, 2);
  eq('the mining course picks a rock as the target', pickedTarget(g.state.world.npcs), rock);
  check('...and the computer takes the stick to line the ship up', g.state.session.ccEngaged);
  // The ship has scoops, and it flies on through what the rock leaves. So
  // the ore is counted in the hold rather than in the sky.
  const said: string[] = [];
  const fire = keymap().fire[0];
  withoutSaving(() => {
    for (let f = 0; f < 60 * 40 && g.state.session.course === 'mine'; f++) {
      g.input.press(fire);
      g.step(1 / 60, 40 + f / 60);
      const line = g.state.session.messageText;
      if (line && said.at(-1) !== line) said.push(line);
    }
  });
  g.input.release(fire);
  check('...and the pilot\'s trigger breaks it', !rock.state.alive);
  check('...which leaves ore adrift', g.state.world.cargo.items.length > 0);
  eq('...and with no rock left, the mining course ends', g.state.session.course, null);
  check('...and says why', said.includes('NO ROCKS LEFT WITHIN RANGE'), said.join(' | '));

  // ...and the ore is collected by the other course, which is the pair as a
  // player flies it.
  const held = g.state.commander.cargo.reduce((a, b) => a + b, 0);
  press(g, COURSE_KEYS.collect);
  withoutSaving(() => {
    for (let f = 0; f < 60 * 120 && g.state.session.course === 'collect'; f++) {
      g.step(1 / 60, 90 + f / 60);
    }
  });
  check('the collect course then takes the ore aboard',
    g.state.commander.cargo.reduce((a, b) => a + b, 0) > held);
}

// --- THE SHIP STOPS AT THE ROCK, IT DOES NOT DRIFT INTO IT (docs/TODO/211) --
//
// Chris, 2026-09-12: *"when targeting asteroids or the derelict. We fly
// towards - and just keep flying towards until we hit it."* A trace of a
// picked rock 53,000 units out showed the whole fault: the ship flew in at
// 397 units a second, braked to 4.3, and then coasted the last 500 units into
// the hull over two minutes. This flies the real game and watches the gap.
console.log('\nthe ship stops short of a picked rock');
{
  const g = outThere(20_260_941);
  const rock = g.state.world.spawn('asteroid', ahead(g, 3000), 7);
  press(g, COURSE_KEYS.mine);
  eq('the mining course picks the rock', pickedTarget(g.state.world.npcs), rock);
  run(g, 60 * 90);
  const gap = g.state.player.position.distanceTo(rock.object.position) - rock.radius;
  check('the ship holds off the rock rather than arrive at it',
    rock.state.alive && gap > 100, `${gap.toFixed(0)} units of clear space`);
  check('...and it is stopped, not still closing',
    g.state.player.speed < 1, `${g.state.player.speed.toFixed(1)} units a second`);
  const then = g.state.player.position.distanceTo(rock.object.position);
  run(g, 60 * 60);
  const now = g.state.player.position.distanceTo(rock.object.position);
  check('...and a minute later it is still there', Math.abs(now - then) < 10,
    `${(now - then).toFixed(1)} units in a minute`);
}
