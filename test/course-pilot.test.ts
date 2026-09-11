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
import { CoursePilot, clearOfPlanet, type CourseView } from '../src/game/course-pilot.ts';
import { COURSE_DERELICT_STANDOFF, COURSE_PLANET_CLEARANCE } from '../src/constants/course.ts';
import { HERMIT_DOCK_SPEED } from '../src/constants/hermit-market.ts';
import { CABIN_TEMP_FATAL } from '../src/constants/sun.ts';
import { MAX_FUEL } from '../src/constants/commander.ts';
import { SPAWN_PLANET_ALTITUDE } from '../src/constants/spawn-placement.ts';
import { aboveGround } from '../src/game/spawning.ts';
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
  loot: [],
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

  const gone = pilot.step(view(new THREE.Vector3(), { course: 'hermit' }), 1 / 60);
  check('a hermit course with no hermit in the sky ends at once', gone.done && gone.demand === null);
  eq('a course with no flight yet asks for nothing',
    pilot.step(view(new THREE.Vector3(), { course: 'mine' }), 1 / 60).demand, null);
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

console.log('\nevery line goes round the planet');
{
  const planet = new THREE.Vector3(0, 0, -50_000);
  const out = new THREE.Vector3();
  const to = new THREE.Vector3(0, 0, -100_000);
  clearOfPlanet(new THREE.Vector3(), to, planet, 5000, out);
  const alt = out.distanceTo(planet) - 5000;
  check('a line through the planet aims beside it instead', !out.equals(to));
  check('...above the clearance, so the detour holds no mass lock',
    alt > COURSE_PLANET_CLEARANCE, `${Math.round(alt)} units up`);
  const clear = new THREE.Vector3(40_000, 0, -100_000);
  clearOfPlanet(new THREE.Vector3(40_000, 0, 0), clear, planet, 5000, out);
  check('a line that clears the planet aims at the target itself', out.equals(clear));
}

/** A commander at the witchpoint of a system whose sky holds this role. */
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

/** Fly the picked course until it ends, the ship dies, or the time runs out. */
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

console.log('\nthe derelict course');
{
  const g = arrivedWith('generation');
  g.state.session.course = 'derelict';
  fly(g, 300, () => g.state.session.course === null);
  const gen = g.state.world.npcs.find((n) => n.role === 'generation')!;
  const dist = g.state.player.position.distanceTo(gen.object.position);
  check('the ship stops at the standoff from the generation ship',
    Math.abs(dist - COURSE_DERELICT_STANDOFF) < 200, `${Math.round(dist)} units`);
  check('...at the derelict\'s own drift', Math.abs(g.state.player.speed - gen.state.speed) < 10,
    `${g.state.player.speed.toFixed(1)} u/s against ${gen.state.speed.toFixed(1)}`);
  check('...and the course is done for the visit', g.state.session.coursesDone.includes('derelict'));
}

console.log('\nthe hermit course');
{
  const g = arrivedWith('hermit');
  g.state.session.course = 'hermit';
  fly(g, 400, () => g.state.session.hermitTrading);
  check('the hermit opens his trade at the end of the course', g.state.session.hermitTrading);
  check('...with the ship slow enough for the hermit\'s rule',
    g.state.player.speed < HERMIT_DOCK_SPEED, `${g.state.player.speed.toFixed(1)} u/s`);
  check('...and the ship never struck the rock', g.state.sys.foreShield > 0 && g.mode !== 'dead');
}

console.log('\nthe star course');
{
  const g = arrived(20_260_913);
  g.state.commander.equipment.scoops = true;
  g.state.commander.fuel = 5;
  g.state.session.course = 'skim';
  let peak = 0;
  fly(g, 400, () => {
    peak = Math.max(peak, g.state.sys.cabinTemp);
    return g.state.session.course === null;
  });
  eq('the star course fills the tank', g.state.commander.fuel, MAX_FUEL);
  check('...the ship lives, and the cabin stays short of fatal',
    g.mode !== 'dead' && peak < CABIN_TEMP_FATAL * 0.6, `peak ${peak.toFixed(3)}`);
  check('...and the course is done for the visit', g.state.session.coursesDone.includes('skim'));
}

console.log('\nthe station course goes round a planet in its way');
{
  const g = arrived(20_260_914);
  const w = g.state.world;
  // Put the planet square between the ship and the station.
  const through = w.station.position.clone().sub(w.planetPos).normalize();
  g.state.player.position.copy(w.planetPos).addScaledVector(through, -(w.planetRadius * 8));
  g.state.session.course = 'station';
  let lowest = Infinity;
  fly(g, 400, () => {
    lowest = Math.min(lowest, g.state.player.position.distanceTo(w.planetPos) - w.planetRadius);
    return g.mode !== 'flight';
  });
  check('the ship never flies lower than the clearance', lowest > COURSE_PLANET_CLEARANCE * 0.9,
    `${Math.round(lowest)} units up`);
  eq('...and it still docks', g.mode, 'docked');
}

console.log('\nnothing appears inside the planet');
{
  // docs/TODO/205 M3 found a hermit 1,545 units inside the planet, and a
  // course flew the ship into the ground after it. The world lifts such a
  // spawn out to a set height, and only such a spawn.
  const g = arrived(20_260_915);
  const w = g.state.world;
  const inside = w.planetPos.clone().add(new THREE.Vector3(w.planetRadius * 0.5, 0, 0));
  const lifted = aboveGround(w, inside);
  const alt = lifted.distanceTo(w.planetPos) - w.planetRadius;
  check('a ship placed inside the planet appears above it', Math.abs(alt - SPAWN_PLANET_ALTITUDE) < 1,
    `${Math.round(alt)} units up`);
  const high = w.planetPos.clone().add(new THREE.Vector3(w.planetRadius * 3, 0, 0));
  check('...and a ship placed well clear of it appears where it was placed (the control)',
    aboveGround(w, high).distanceTo(high) < 1e-6);
}
