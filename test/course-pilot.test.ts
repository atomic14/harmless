// How the ship flies a picked course (docs/TODO/205 M3).
//
// Two halves. The pure half asks the course pilot for one frame, with no world
// behind it. The flown half picks the station course in a real headless game,
// on the real world step, and waits for the dock. That half is the claim that
// matters: a pilot with no hand on the stick gets from the witchpoint into
// the slot.

import * as THREE from 'three';
import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { withoutSaving } from '../src/game/storage.ts';
import { seedWorld } from '../src/game/rng.ts';
import { CoursePilot, type CourseView } from '../src/game/course-pilot.ts';
import { DOCK_COMPUTER_RANGE } from '../src/constants/docking-computer.ts';
import { MASS_LOCK_STATION } from '../src/constants/torus.ts';
import { check, dismissBriefing, eq } from './harness.ts';

console.log('\nthe course pilot, one frame at a time');

/** A ship at the origin, nose down −Z, and a station somewhere. */
const view = (station: THREE.Vector3, over: Partial<CourseView> = {}): CourseView => ({
  course: 'station',
  position: new THREE.Vector3(),
  quaternion: new THREE.Quaternion(),
  pitchRate: 0,
  rollRate: 0,
  stationPos: station,
  dcEngaged: false,
  ...over,
});

{
  const pilot = new CoursePilot();
  const ahead = pilot.step(view(new THREE.Vector3(0, 0, -50_000)), 1 / 60);
  check('a station dead ahead: the throttle opens', ahead.demand?.throttle === 1);
  check('...and the pilot asks for the torus', ahead.torus);
  check('...and it keeps the ship, rather than hand it over', !ahead.handOver);

  const abeam = new CoursePilot().step(view(new THREE.Vector3(50_000, 0, 0)), 1 / 60);
  check('a station abeam: no torus until the nose is round', !abeam.torus);
  check('...and the sticks move to bring it round',
    (abeam.demand?.rollRate ?? 0) !== 0 || (abeam.demand?.pitchRate ?? 0) !== 0);

  const near = pilot.step(view(new THREE.Vector3(0, 0, -(DOCK_COMPUTER_RANGE - 1))), 1 / 60);
  check('inside the docking computer\'s range, the course hands over', near.handOver);
  eq('...and asks for no flight of its own', near.demand, null);
  check('...and drops the torus', !near.torus);

  const docking = pilot.step(view(new THREE.Vector3(0, 0, -50_000), { dcEngaged: true }), 1 / 60);
  check('once the docking computer has the ship, the course asks for nothing',
    docking.demand === null && !docking.handOver && !docking.torus);

  const jump = pilot.step(view(new THREE.Vector3(50_000, 0, 0), { course: 'jump', rollRate: 1 }), 1 / 60);
  check('the jump course flies on as the ship points: the throttle opens', jump.demand?.throttle === 1);
  check('...and the roll dies away', Math.abs(jump.demand?.rollRate ?? 1) < 1);
  check('...with no torus', !jump.torus);

  eq('a course with no flight yet asks for nothing',
    pilot.step(view(new THREE.Vector3(), { course: 'hermit' }), 1 / 60).demand, null);
}

console.log('\nthe station course, flown from the witchpoint');

/** A commander who arrives at the witchpoint with an empty sky. */
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

{
  const g = arrived(20_260_911);
  const start = g.state.player.position.distanceTo(g.state.world.station.position);
  check('the ship starts far outside the station\'s mass lock', start > MASS_LOCK_STATION * 4,
    `${Math.round(start)} units`);
  g.state.session.course = 'station';

  let torusSeen = false;
  let handOverAt = -1;
  let dockedAt = -1;
  const dt = 1 / 60;
  const limit = 180 / dt;
  withoutSaving(() => {
    for (let f = 0, at = 0; f < limit; f++) {
      g.step(dt, at += dt);
      if (g.state.session.torusEngaged) torusSeen = true;
      if (handOverAt < 0 && g.state.session.dcEngaged) {
        handOverAt = g.state.player.position.distanceTo(g.state.world.station.position);
      }
      if (g.mode !== 'flight') { dockedAt = f * dt; break; }
    }
  });
  check('the course ran the torus on the way in', torusSeen);
  check('...it handed over inside the docking computer\'s range, with none fitted',
    handOverAt > 0 && handOverAt <= DOCK_COMPUTER_RANGE + 50, `${Math.round(handOverAt)} units`);
  check('...and the ship docked inside three minutes, with no hand on the stick',
    dockedAt > 0 && g.mode === 'docked', `mode ${g.mode}, ${dockedAt.toFixed(1)} s`);
  eq('...and the dock ends the visit, so no course is left', g.state.session.course, null);
}

console.log('\n...and a flight key takes the ship back');
{
  const g = arrived(20_260_912);
  g.state.session.course = 'station';
  for (let f = 0, at = 0; f < 30; f++) g.step(1 / 60, at += 1 / 60);
  check('the course holds the ship', g.state.session.course === 'station');
  g.input.press('ArrowUp');
  g.step(1 / 60, 1);
  g.input.release('ArrowUp');
  eq('a flight key suspends the course', g.state.session.course, null);
}
