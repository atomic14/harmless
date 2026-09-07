// A dead Thargon is a tonne of alien items.
//
// GitHub #41: the original let a ship with fuel scoops collect a Thargon once
// its mothership died. Here the drones went inert and stayed in the sky,
// where the scoop reaches nothing. docs/TODO/196 moves each one into the
// cargo field as a `drone`, with the Thargon's hull and bank, carrying
// `ALIEN_ITEMS`.
//
// THROUGH THE REAL SCOOP PATH, as test/world-step.test.ts flies a pod: the
// field reports what the commander reached, and the step decides what it is
// worth. The conversion itself is pinned in test/combat.test.ts, beside the
// line it says.

import * as THREE from 'three';
import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { withoutSaving } from '../src/game/storage.ts';
import { seedWorld } from '../src/game/rng.ts';
import { ALIEN_ITEMS } from '../src/constants/commodities.ts';
import { SCOOP_RANGE } from '../src/constants/scoop.ts';
import { CLEAN } from '../src/constants/law.ts';
import { cargoCapacity, cargoTonnes } from '../src/game/commander.ts';
import { canisterMaxEnergy } from '../src/game/cargo.ts';
import { scannerContacts } from '../src/hud/hud-model.ts';
import { COMMODITIES } from '../src/galaxy/galaxy.ts';
import { check, consoleWatcher, dismissBriefing, eq } from './harness.ts';

/** A commander in flight, out of the tunnel, at rest in an empty sky. */
function flying(seed: number, scoops: boolean): { g: Game; fly: (steps: number) => string[] } {
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
  g.state.commander.equipment.scoops = scoops;
  return { g, fly };
}

/** A dead drone `d` units ahead of the nose. */
function adrift(g: Game, d: number): void {
  const at = g.state.player.position.clone()
    .add(new THREE.Vector3(0, 0, -1).applyQuaternion(g.state.player.quaternion).multiplyScalar(d));
  g.state.world.cargo.spawnDrone(at, g.state.player.quaternion.clone());
}

console.log('\na dead drone is scooped as a tonne of alien items');
{
  eq('the last row of the table is Alien Items', COMMODITIES[ALIEN_ITEMS]!.name, 'Alien Items');
  const { g, fly } = flying(1_960, true);
  adrift(g, 0);
  const said = fly(1);
  eq('inside the reach with scoops, it is a tonne in the hold',
    g.state.commander.cargo[ALIEN_ITEMS], 1);
  check('...and it says so', said.includes('SCOOPED 1t ALIEN ITEMS'));
  check('...and the field is empty', g.state.world.cargo.items.length === 0);
}
{
  const { g, fly } = flying(1_961, true);
  adrift(g, SCOOP_RANGE + 20);
  fly(1);
  eq('outside the reach it stays adrift', g.state.commander.cargo[ALIEN_ITEMS], 0);
  eq('...as a drone, in the field', g.state.world.cargo.items[0]?.kind, 'drone');
  const blips = scannerContacts(
    g.state.world.station.position, [], [], g.state.world.cargo.items, CLEAN, Infinity);
  check('...and the scanner shows it as cargo, because that is what it is now',
    blips.some((b) => b.kind === 'cargo') && !blips.some((b) => b.kind === 'thargoid'));
}
{
  const { g, fly } = flying(1_962, false);
  adrift(g, 0);
  const said = fly(1);
  check('without scoops it breaks on the hull, named for what it was',
    said.includes('THARGON DESTROYED ON HULL'));
  eq('...and nothing enters the hold', g.state.commander.cargo[ALIEN_ITEMS], 0);
}
{
  const { g, fly } = flying(1_963, true);
  g.state.commander.cargo[0] = cargoCapacity(g.state.commander);
  adrift(g, 0);
  const said = fly(1);
  check('a full hold loses it, and says which thing it lost',
    said.includes('HOLD FULL — THARGON LOST'));
  eq('...at the same tonnage', cargoTonnes(g.state.commander), cargoCapacity(g.state.commander));
}
{
  // The bank is the Thargon's own, so a shot at a dead drone costs what it
  // cost alive, and a save keeps the drone as a drone.
  const { g } = flying(1_964, true);
  adrift(g, 500);
  const before = g.state.world.cargo.items[0]!;
  check('a dead drone keeps the Thargon\'s bank',
    before.energy === canisterMaxEnergy('drone') && before.energy > canisterMaxEnergy('cargo'));
  const saved = g.state.world.cargo.capture();
  g.state.world.cargo.restoreAll(saved);
  const after = g.state.world.cargo.items[0]!;
  check('a snapshot round trip keeps a drone as a drone',
    g.state.world.cargo.items.length === 1 && after.kind === 'drone'
    && after.commodity === ALIEN_ITEMS && after.energy === before.energy);
}
