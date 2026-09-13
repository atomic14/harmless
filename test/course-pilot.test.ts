// How the ship flies a picked course (docs/TODO/205 M3).
//
// Two halves. The pure half asks the course pilot for one frame, with no world
// behind it. The flown half picks the station course in a real headless game,
// on the real world step, and waits for the dock. That half is the claim that
// matters: a pilot with no hand on the stick gets from the witchpoint into
// the slot.

import * as THREE from 'three';
import { withoutSaving } from '../src/game/storage.ts';
import { CoursePilot } from '../src/game/course-pilot.ts';
import { clearOfPlanet } from '../src/game/course-clearance.ts';
import { COURSE_PLANET_CLEARANCE } from '../src/constants/course.ts';
import { SPAWN_PLANET_ALTITUDE } from '../src/constants/spawn-placement.ts';
import { aboveGround } from '../src/game/spawning.ts';
import { DOCK_COMPUTER_RANGE } from '../src/constants/docking-computer.ts';
import { COURSE_DOCK_HANDOVER } from '../src/constants/course.ts';
import { MASS_LOCK_STATION } from '../src/constants/torus.ts';
import { keyCodeIfBound } from '../src/ui/key-help.ts';
import { arrived, fly, view } from './course-fixtures.ts';
import { check, eq } from './harness.ts';

console.log('\nthe course pilot, one frame at a time');


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


// THE COMPUTER IS A BUTTON, NOT AN AUTOMATIC (Chris, 2026-09-12: *"I have a
// docking computer - but instead of it being activated I still get the lining
// and only once that is done does the computer activate"*). Every commander
// gets the line-up, and a fitted computer flies the rest when she asks for it.
// The block below flies the same course with nobody pressing anything.
{
  const g = arrived(20_260_911);
  g.state.commander.equipment.dockingComputer = true;
  const start = g.state.player.position.distanceTo(g.state.world.station.position);
  check('the ship starts far outside the station\'s mass lock', start > MASS_LOCK_STATION * 4,
    `${Math.round(start)} units`);
  g.state.session.course = 'station';

  let torusSeen = false;
  let handOverAt = -1;
  let dockedAt = -1;
  let pressed = false;
  const dt = 1 / 60;
  const limit = 180 / dt;
  withoutSaving(() => {
    for (let f = 0, at = 0; f < limit; f++) {
      g.step(dt, at += dt);
      if (g.state.session.torusEngaged) torusSeen = true;
      // The pilot presses the button the moment it is offered.
      if (!pressed && g.state.session.dockTrial) {
        g.input.injectPress(keyCodeIfBound('flight', 'toggleDockingComputer') ?? '');
        pressed = true;
      }
      if (handOverAt < 0 && g.state.session.dcEngaged) {
        handOverAt = g.state.player.position.distanceTo(g.state.world.station.position);
      }
      if (g.mode !== 'flight') { dockedAt = f * dt; break; }
    }
  });
  check('the course ran the torus on the way in', torusSeen);
  check('...the button then engaged the computer, inside its range',
    handOverAt > 0 && handOverAt <= DOCK_COMPUTER_RANGE + 50, `${Math.round(handOverAt)} units`);
  check('...and it flew the ship in, inside three minutes',
    dockedAt > 0 && g.mode === 'docked', `mode ${g.mode}, ${dockedAt.toFixed(1)} s`);
  eq('...and the dock ends the visit, so no course is left', g.state.session.course, null);
}

console.log('\nwith no docking computer, the course hands the slot to the pilot');
{
  const g = arrived(20_260_935);
  g.state.session.course = 'station';
  const dt = 1 / 60;
  withoutSaving(() => {
    for (let f = 0, at = 0; f < 240 / dt && !g.state.session.dockTrial; f++) g.step(dt, at += dt);
  });
  const range = g.state.player.position.distanceTo(g.state.world.station.position);
  check('the course flies the ship in and hands it over', g.state.session.dockTrial,
    `${Math.round(range)} units out`);
  check('...at the hand-over range', Math.abs(range - COURSE_DOCK_HANDOVER) < 200,
    `${Math.round(range)} units out`);
  eq('...and the course is over, because the ship is the pilot\'s now',
    g.state.session.course, null);
}

// THE SHIP MUST NOT ROLL ALL THE WAY THERE (docs/TODO/210).
//
// Chris, 2026-09-12: *"we seem to be constantly rotating when heading towards
// something"*. The steering held a cone: the nose circled the target at a
// fixed angle, and the roll never stopped. The measurement is the total roll
// over a whole trip, in full turns. It was 7.8 turns with a clear sky.
console.log('\nthe course does not roll the ship all the way there');
{
  const g = arrived(20_260_935);
  g.state.session.course = 'station';
  const dt = 1 / 60;
  let rolled = 0;
  withoutSaving(() => {
    for (let f = 0, at = 0; f < 240 / dt && !g.state.session.dockTrial; f++) {
      g.step(dt, at += dt);
      rolled += Math.abs(g.state.player.rollRate) * dt;
    }
  });
  const turns = rolled / (2 * Math.PI);
  check('the whole trip to the station costs less than one full turn of roll',
    turns < 1, `${turns.toFixed(2)} turns`);
  check('...and the ship still arrives', g.state.session.dockTrial);
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


console.log('\nthe station course goes round a planet in its way');
{
  const g = arrived(20_260_914);
  g.state.commander.equipment.dockingComputer = true;
  const w = g.state.world;
  // Put the planet square between the ship and the station.
  const through = w.station.position.clone().sub(w.planetPos).normalize();
  g.state.player.position.copy(w.planetPos).addScaledVector(through, -(w.planetRadius * 8));
  g.state.session.course = 'station';
  let lowest = Infinity;
  let pressed = false;
  fly(g, 400, () => {
    lowest = Math.min(lowest, g.state.player.position.distanceTo(w.planetPos) - w.planetRadius);
    // The line-up is the pilot's until she asks for the computer.
    if (!pressed && g.state.session.dockTrial) {
      g.input.injectPress(keyCodeIfBound('flight', 'toggleDockingComputer') ?? '');
      pressed = true;
    }
    return g.mode !== 'flight';
  });
  check('the ship never flies lower than the clearance', lowest > COURSE_PLANET_CLEARANCE * 0.9,
    `${Math.round(lowest)} units up`);
  eq('...and it still docks', g.mode, 'docked');
}

console.log('\na mission target below the clearance is refused');
{
  // docs/TODO/213 M1: a charge that ran flew through the planet, and the
  // escort course followed it. The commander crashed with full shields.
  const v = view(new THREE.Vector3(0, 0, -50_000));
  const low = v.planetPos.clone().add(new THREE.Vector3(0, -(v.planetRadius + 100), 0));
  const refused = new CoursePilot().step(
    view(v.stationPos, { course: 'mission', mission: { at: low, speed: 100, how: 'escort' } }), 1 / 60);
  check('a target 100 units above the planet ends the course', refused.done);
  check('...with a reason for the console', typeof refused.why === 'string' && refused.why.length > 0);
  const clear = v.planetPos.clone().add(new THREE.Vector3(0, -(v.planetRadius + COURSE_PLANET_CLEARANCE * 2), 0));
  const flown = new CoursePilot().step(
    view(v.stationPos, { course: 'mission', mission: { at: clear, speed: 100, how: 'escort' } }), 1 / 60);
  check('...and one well above it is flown (the control)', !flown.done && flown.demand !== null);
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
