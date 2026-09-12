// WHERE A COURSE AIMS, so that its line is clear of what is on it.
//
// Split from `course-pilot.test.ts` on 2026-09-12, when that file passed the
// 400-line ceiling, and it follows the split of the code it tests. That file
// asks what a course DOES for one frame. This one asks where the line goes.
//
// `src/game/course-clearance.ts` is the subject. The second block is the flight
// it came from, so the pure geometry above it is held to a real approach.

import * as THREE from 'three';
import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { withoutSaving } from '../src/game/storage.ts';
import { seedWorld } from '../src/game/rng.ts';
import { clearOfObstacles } from '../src/game/course-clearance.ts';
import { COURSE_OBSTACLE_CLEARANCE } from '../src/constants/course.ts';
import { check, dismissBriefing, eq } from './harness.ts';

// --- A COURSE GOES ROUND WHAT IT WOULD HIT ---------------------------------
//
// Chris, 2026-09-12: *"I visited a rock hermit and then when I left clicked fly
// to the station - the computer crashed me straight into the rock hermit - we
// need to have some avoidance of obstacles"*.
//
// The line already went round the planet and, on a smuggling run, round a
// policeman. It went through everything else.
console.log('\na course goes round what it would hit');
{
  const out = new THREE.Vector3();
  const from = new THREE.Vector3();
  const to = new THREE.Vector3(0, 0, -60_000);
  const rock = (at: THREE.Vector3, radius = 120) => ({ at, radius });

  eq('with nothing in the way, the aim is the target',
    clearOfObstacles(from, to, [], out).equals(to), true);
  check('a hermit ON the line moves the aim off it',
    clearOfObstacles(from, to, [rock(new THREE.Vector3(0, 0, -600))], out)
      .distanceTo(to) > 1, `${out.x.toFixed(0)},${out.y.toFixed(0)},${out.z.toFixed(0)}`);
  check('...far enough that the new line clears its hull',
    clearOfObstacles(from, to, [rock(new THREE.Vector3(0, 0, -600))], out)
      .distanceTo(new THREE.Vector3(0, 0, -600)) > 120 + COURSE_OBSTACLE_CLEARANCE,
    `${out.distanceTo(new THREE.Vector3(0, 0, -600)).toFixed(0)} units from its centre`);
  check('a hermit well off the line is left alone',
    clearOfObstacles(from, to, [rock(new THREE.Vector3(9000, 0, -600))], out).equals(to));
  // A thing AT the end of the line is the target, not an obstacle. That is what
  // lets the hermit course fly to a hermit.
  check('a hermit at the far end of the line is not in the way of it',
    clearOfObstacles(from, to, [rock(to.clone())], out).equals(to));
  // The worst is the one with least room, not the one nearest the ship.
  const near = rock(new THREE.Vector3(300, 0, -600));
  const tight = rock(new THREE.Vector3(20, 0, -4000));
  check('the tightest squeeze is the one it steers round, not the nearest',
    clearOfObstacles(from, to, [near, tight], out).distanceTo(tight.at)
      < clearOfObstacles(from, to, [near, tight], out).distanceTo(near.at));
}

// ...and the flight it came from: the station course past the hermit the
// commander just left. Without the detour this kills her outright at 399 units
// a second.
{
  const g = withoutSaving(() => {
    seedWorld(20_260_933);
    const game = new Game(() => headlessShell());
    dismissBriefing(game);
    game.launch();
    return game;
  }).value;
  withoutSaving(() => { for (let f = 0, at = 0; f < 400; f++) g.step(1 / 60, at += 1 / 60); });
  g.state.world.clearNpcs();

  // Out in the belt, with the station on the far side of the hermit, and the
  // nose already down the line — a ship that has just left a hermit.
  const away = new THREE.Vector3(1, 0.2, 0.3).normalize();
  g.state.player.position.copy(g.state.world.station.position).addScaledVector(away, 60_000);
  const toStation = g.state.world.station.position.clone()
    .sub(g.state.player.position).normalize();
  const at = g.state.player.position.clone().addScaledVector(toStation, 600);
  const hermit = g.state.world.spawn('hermit', at, 3);
  hermit.state.speed = 0;
  g.state.player.quaternion.setFromRotationMatrix(new THREE.Matrix4()
    .lookAt(g.state.player.position, g.state.world.station.position, new THREE.Vector3(0, 1, 0)));
  g.state.session.course = 'station';

  let closest = Infinity;
  withoutSaving(() => {
    for (let f = 0; f < 60 * 40; f++) {
      g.step(1 / 60, 20 + f / 60);
      hermit.object.position.copy(at);   // hold it still, so only the RULES move
      closest = Math.min(closest, g.state.player.position.distanceTo(at) - hermit.radius);
      if (g.mode !== 'flight') break;
    }
  });
  check('the station course flies past the hermit rather than into it',
    g.mode === 'flight', `ended as ${g.mode}`);
  check('...clear of its hull by most of a turning circle',
    closest > COURSE_OBSTACLE_CLEARANCE * 0.8,
    `${closest.toFixed(0)} units, against a clearance of ${COURSE_OBSTACLE_CLEARANCE.toFixed(0)}`);
}
