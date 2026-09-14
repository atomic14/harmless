// The fixtures the course tests share: a flat view, two arrivals and a flight.
//
// A fixture module rather than a block in one file, for the reason
// `audio-fixtures.ts` is one. `course-pilot.test.ts` and
// `course-arrivals.test.ts` split on 2026-09-12, and both need the same four. A
// second copy would be two fixtures that drift, and a fixture that disagrees
// with its twin measures nothing.

import * as THREE from 'three';
import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { withoutSaving } from '../src/game/storage.ts';
import { seedWorld } from '../src/game/rng.ts';
import type { CourseView } from '../src/game/course-pilot.ts';
import { DOCK_COMPUTER_RANGE } from '../src/constants/docking-computer.ts';
import { dismissBriefing } from './harness.ts';

export /** A ship at the origin, nose down −Z, and a station somewhere. */
const view = (station: THREE.Vector3, over: Partial<CourseView> = {}): CourseView => ({
  course: 'station',
  position: new THREE.Vector3(),
  quaternion: new THREE.Quaternion(),
  pitchRate: 0,
  rollRate: 0,
  speed: 0,
  stationPos: station,
  planetPos: new THREE.Vector3(0, 1e7, 0),
  planetRadius: 5000,
  sunPos: new THREE.Vector3(1e7, 0, 0),
  derelictPos: null,
  derelictSpeed: 0,
  hermitPos: null,
  tankFull: false,
  threats: [],
  obstacles: [],
  loot: [],
  police: [],
  mission: null,
  dcEngaged: false,
  handOverRange: DOCK_COMPUTER_RANGE,
  ...over,
});

export /** A commander who arrives at the witchpoint with an empty sky. */
function arrived(seed: number): Game {
  const g = withoutSaving(() => {
    seedWorld(seed);
    const game = new Game(() => headlessShell());
    dismissBriefing(game);
    game.launch();
    game.arriveInSystem();
    return game;
  }).value;
  g.state.world.clearNpcs();
  return g;
}

export /** A commander at the witchpoint of a system whose sky holds this role. */
function arrivedWith(role: string): Game {
  for (let i = 0; i < 200; i++) {
    const g = withoutSaving(() => {
      seedWorld(4000 + i);
      const game = new Game(() => headlessShell());
      dismissBriefing(game);
      game.launch();
      game.state.commander.systemIndex = (i * 29) % 256;
      game.arriveInSystem();
      return game;
    }).value;
    if (g.state.world.npcs.some((n) => n.role === role)) {
      // Only the target stays, so that no fight or mass lock blurs the claim.
      for (const n of g.state.world.npcs) if (n.role !== role) n.state.alive = false;
      return g;
    }
  }
  throw new Error(`no system in the sample holds a ${role}`);
}

export /** Fly the picked course until it ends, the ship dies, or the time runs out. */
function fly(g: Game, seconds: number, until: () => boolean): number {
  const dt = 1 / 60;
  let f = 0;
  withoutSaving(() => {
    for (let at = 0; f < seconds / dt; f++) {
      g.step(dt, at += dt);
      if (until() || g.mode === 'dead') break;
    }
  });
  return f * dt;
}
