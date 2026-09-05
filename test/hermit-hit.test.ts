// Your laser lands on a rock hermit, and the console says whose home it is.
//
// docs/TODO/187, out of GitHub #40: *"It's not obvious enough that you are
// attacking a rock hermit."* The law does not protect a hermit, so
// `harmVerdict` had no line for one, and the first word a commander got was
// the character verdict after the kill. `HERMIT_HIT_LINE` is said on the first
// hit instead, on the frame `provokedByPlayer` latches, as the harm lines are.
//
// The rig is `test/lawful-hit.test.ts`'s: a real `Game`, a ship put in front
// of the nose, one trigger pull, and the console read frame by frame.

import * as THREE from 'three';
import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { withoutSaving } from '../src/game/storage.ts';
import { seedWorld } from '../src/game/rng.ts';
import { HERMIT_HIT_LINE } from '../src/constants/character.ts';
import { HARM_LINES } from '../src/constants/law.ts';
import { WITCHPOINT_RADII } from '../src/constants/planet.ts';
import type { NpcRole } from '../src/game/ship-roles.ts';
import type { NpcShip } from '../src/game/npc.ts';
import { check, consoleWatcher, dismissBriefing, eq } from './harness.ts';

/** Seconds of frames, long enough for a queued line to reach the console. */
const SETTLE = 60 * 14;

/** A commander in flight at the witchpoint, at rest, with an empty sky. */
function flying(seed: number): { g: Game; fly: (steps: number) => string[] } {
  const g = withoutSaving(() => {
    seedWorld(seed);
    const game = new Game(() => headlessShell());
    dismissBriefing(game);
    game.launch();
    return game;
  }).value;
  const fly = consoleWatcher(g);
  fly(400);
  g.state.world.clearNpcs();
  g.state.player.speed = 0;
  g.state.player.position.copy(g.state.world.station.position).normalize()
    .multiplyScalar(g.state.world.planetRadius * WITCHPOINT_RADII);
  return { g, fly };
}

const ahead = (g: Game, d: number): THREE.Vector3 => g.state.player.position.clone()
  .add(new THREE.Vector3(0, 0, -1).applyQuaternion(g.state.player.quaternion)
    .multiplyScalar(d));

/**
 * A ship in front of the nose. A hermit goes OUTSIDE the trade hail's 900
 * units, because the step says that hail every frame inside it, and the
 * console holds one line. Inside the hail the hail is the identification;
 * this line is for the shot from further out, which is the one GitHub #40
 * reported.
 */
function target(g: Game, role: NpcRole, d = 1500): NpcShip {
  const ship = g.spawnNpc(role, ahead(g, d), 9);
  ship.object.updateMatrixWorld(true);
  return ship;
}

console.log('\nthe console says whose rock you just hit');
{
  const { g, fly } = flying(187_000_001);
  const hermit = target(g, 'hermit');
  const energy = hermit.state.energy;
  g.fireLaser();
  const said = fly(SETTLE);
  check('the shot landed', hermit.state.energy < energy);
  check('...and the hermit knows it was the commander', hermit.state.provokedByPlayer);
  eq(`...and the first line is the warning (${said.join(' / ')})`, said[0], HERMIT_HIT_LINE);
  check('...which is not one of the law\'s lines',
    !HARM_LINES.some(([, line]) => line === HERMIT_HIT_LINE));
}

console.log('...once, however many hits land on it');
{
  const { g, fly } = flying(187_000_002);
  const hermit = target(g, 'hermit');
  let hits = 0;
  const said: string[] = [];
  for (let volley = 0; volley < 12; volley++) {
    hermit.state.energy = hermit.maxEnergy;   // keep it standing, not cracked
    const was = hermit.state.energy;
    g.fireLaser();
    hits += hermit.state.energy < was ? 1 : 0;
    said.push(...fly(30));
  }
  said.push(...fly(SETTLE));
  eq(`twelve hits landed (${hits})`, hits, 12);
  eq(`...and the warning was said once (${said.join(' / ')})`,
    said.filter((t) => t === HERMIT_HIT_LINE).length, 1);
}

console.log('...and a kill takes the wreck\'s words instead');
{
  // A destroyed ship comes for nobody, and `destroy` has its own words: the
  // character verdict after the deed. The warning is for a hermit still there
  // to spare.
  const { g, fly } = flying(187_000_003);
  const hermit = target(g, 'hermit');
  hermit.state.energy = 1;
  g.fireLaser();
  const said = fly(SETTLE);
  check('the first shot cracked the hermit', !hermit.state.alive);
  eq(`...and nothing warned of a hit (${said.join(' / ')})`,
    said.filter((t) => t === HERMIT_HIT_LINE).length, 0);
}

console.log('...and a pirate hit says nothing new');
{
  const { g, fly } = flying(187_000_004);
  target(g, 'pirate');
  g.fireLaser();
  const said = fly(SETTLE);
  eq(`a pirate hit explains nothing (${said.join(' / ')})`,
    said.filter((t) => t === HERMIT_HIT_LINE).length, 0);
}
