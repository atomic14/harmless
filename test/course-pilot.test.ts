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
import { clearOfPlanet } from '../src/game/course-clearance.ts';
import { COURSE_DERELICT_STANDOFF, COURSE_PLANET_CLEARANCE } from '../src/constants/course.ts';
import { HERMIT_DOCK_SPEED } from '../src/constants/hermit-market.ts';
import { CABIN_TEMP_FATAL } from '../src/constants/sun.ts';
import { MAX_FUEL } from '../src/constants/commander.ts';
import { SPAWN_PLANET_ALTITUDE } from '../src/constants/spawn-placement.ts';
import { aboveGround } from '../src/game/spawning.ts';
import { derelictReport } from '../src/game/derelict.ts';
import { generateGalaxy } from '../src/galaxy/galaxy.ts';
import { DOCK_COMPUTER_RANGE } from '../src/constants/docking-computer.ts';
import { COURSE_DOCK_HANDOVER } from '../src/constants/course.ts';
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
  obstacles: [],
  loot: [],
  police: [],
  mission: null,
  dcEngaged: false,
  handOverRange: DOCK_COMPUTER_RANGE,
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
  // A fitted docking computer flies the slot, as it does today. Without one,
  // the course hands the ship to the pilot instead (docs/TODO/207 M1), and
  // the block below flies that.
  const g = arrived(20_260_911);
  g.state.commander.equipment.dockingComputer = true;
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
  check('...it handed over inside the docking computer\'s range',
    handOverAt > 0 && handOverAt <= DOCK_COMPUTER_RANGE + 50, `${Math.round(handOverAt)} units`);
  check('...and the ship docked inside three minutes, with no hand on the stick',
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
  check('...and the scan says what is there, in the world\'s own words',
    g.state.session.messageText.length > 20, `said: ${g.state.session.messageText}`);
}

console.log('\nwhat a derelict\'s scan reports');
{
  // The words come off the world's seed, so a derelict tells the same story
  // on every visit, and two worlds tell different ones (docs/TODO/208 M5).
  const systems = generateGalaxy(1);
  const twice = [derelictReport(systems[7]), derelictReport(systems[7])];
  eq('the same world reports the same thing twice', twice[0], twice[1]);
  const said = new Set(systems.map((sys) => derelictReport(sys)));
  check('...and the galaxy tells more than one story', said.size > 3, `${said.size} of them`);
  check('...each of them a sentence', [...said].every((line) => line.endsWith('.')));
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
  g.state.commander.equipment.dockingComputer = true;
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

// --- THE COLLECT COURSE HOLDS ONE CANISTER, AND LEADS IT -------------------
//
// Chris, 2026-09-12: *"Collecting cargo often seems to be difficult - we miss
// it quite a lot - especially when it is moving."*
//
// Two faults, and a probe named them by flying ONE canister against five. One
// alone was never missed, at any drift. Five were missed seven times with the
// cargo at rest. So the first fault was the PICK: the course took the nearest
// every frame, and turned away from a canister it was nearly on when another
// drifted closer. The second was the AIM, which was where the canister had
// been.
//
// Both are asserted on the RULE rather than through a two-minute flight. The
// flight is what measured them, and its figures are beside
// `COURSE_COLLECT_LEAD`: over 80 runs a drift, the led course took 231 of 240
// canisters against 191 unled.
console.log('\nthe collect course holds one canister, and leads it');
{
  const DT = 1 / 60;
  const far = new THREE.Vector3(0, 0, -50_000);
  const still = (at: THREE.Vector3) => ({ at, velocity: new THREE.Vector3() });
  const ahead = new THREE.Vector3(0, 0, -600);
  const aside = new THREE.Vector3(1400, 0, -600);

  // THE PICK. A canister dead ahead asks for no turn. One off to the side asks
  // for a big one. So the demand says which of the two the course is flying at.
  const turn = (s: { demand: { pitchRate: number; rollRate: number } | null }): number =>
    Math.abs(s.demand?.pitchRate ?? 0) + Math.abs(s.demand?.rollRate ?? 0);

  const fresh = new CoursePilot();
  const onAhead = turn(fresh.step(view(far, { course: 'collect', loot: [still(ahead)] }), DT));
  const onAside = turn(new CoursePilot()
    .step(view(far, { course: 'collect', loot: [still(aside)] }), DT));
  check('the fixture can tell the two apart', onAside > onAhead + 0.01,
    `${onAhead.toFixed(3)} ahead against ${onAside.toFixed(3)} aside`);

  const held = new CoursePilot();
  held.step(view(far, { course: 'collect', loot: [still(aside)] }), DT);
  // ...and now a nearer one turns up, first in the list.
  const kept = turn(held.step(
    view(far, { course: 'collect', loot: [still(ahead), still(aside)] }), DT));
  check('a nearer canister does not steal one the course is already on',
    kept > onAhead + 0.01, `${kept.toFixed(3)}, against ${onAhead.toFixed(3)} for the near one`);

  // ...until it is gone, and then the nearest is the next.
  const moved = turn(held.step(view(far, { course: 'collect', loot: [still(ahead)] }), DT));
  check('...and when it is aboard, the course takes the next', moved <= onAhead + 0.01,
    `${moved.toFixed(3)}`);

  // THE AIM. A canister dead ahead and drifting sideways is not where it was.
  const drifting = { at: ahead.clone(), velocity: new THREE.Vector3(200, 0, 0) };
  const led = turn(new CoursePilot()
    .step(view(far, { course: 'collect', loot: [drifting] }), DT));
  check('a drifting canister is aimed ahead of, not at', led > onAhead + 0.01,
    `${led.toFixed(3)}, against ${onAhead.toFixed(3)} for the same place at rest`);
}
