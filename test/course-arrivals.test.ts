// THE COURSES THAT FLY TO A THING AND STOP THERE.
//
// Split from `course-pilot.test.ts` on 2026-09-12, when that file passed the
// 400-line ceiling. The seam is `CoursePilot.arrive`, one function with four
// callers: the derelict, the hermit, the star and the loose cargo. Each flies
// to a standoff from something and settles at a speed.
//
// What stays next door is the STATION course, and the rules every line obeys:
// the hand-over to the pilot, the planet detour, the roll and the flight key.

import * as THREE from 'three';
import { CoursePilot } from '../src/game/course-pilot.ts';
import { HERMIT_DOCK_SPEED } from '../src/constants/hermit-market.ts';
import { COURSE_COLLECT_CAP, COURSE_DERELICT_STANDOFF } from '../src/constants/course.ts';
import { CABIN_TEMP_FATAL } from '../src/constants/sun.ts';
import { MAX_FUEL } from '../src/constants/commander.ts';
import { PLAYER_FLIGHT } from '../src/constants/player-flight.ts';
import { SCOOP_RANGE } from '../src/constants/scoop.ts';
import { derelictReport } from '../src/game/derelict.ts';
import { generateGalaxy } from '../src/galaxy/galaxy.ts';
import { arrived, arrivedWith, fly, view } from './course-fixtures.ts';
import { check, eq } from './harness.ts';

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

// ...AND IT DOES NOT FLY AT IT TOO FAST TO CORRECT.
//
// Chris, 2026-09-12: *"collecting cargo seems to be broken sometimes. I seem to
// run at maximum speed, then slow down and then miss it and then run at maximum
// speed."* A trace showed exactly that: 400 units a second with a canister 250
// units off, a sail past, and a loop. `arrive` picks its speed from a braking
// curve, which is right for a big target on a straight line. At 400 the ship's
// tightest turn has a radius of 276 units, and the scoop reaches 45.
//
// Holding one canister (above) made the loop permanent rather than causing it.
// The old course switched away, which looked like progress.
{
  const adrift = { at: new THREE.Vector3(0, 0, -4000), velocity: new THREE.Vector3() };
  const collect = new CoursePilot()
    .step(view(new THREE.Vector3(0, 0, -50_000), { course: 'collect', loot: [adrift] }), 1 / 60);
  check('a canister 4,000 units off still opens the throttle',
    collect.demand?.throttle === 1);
  check('...and the cap is under half what the ship can fly',
    COURSE_COLLECT_CAP < PLAYER_FLIGHT.maxSpeed / 2,
    `${COURSE_COLLECT_CAP} against ${PLAYER_FLIGHT.maxSpeed}`);
  check('...and its turning circle is inside twice the scoop',
    COURSE_COLLECT_CAP / PLAYER_FLIGHT.maxPitch < SCOOP_RANGE * 2,
    `${(COURSE_COLLECT_CAP / PLAYER_FLIGHT.maxPitch).toFixed(0)} units against ${SCOOP_RANGE}`);
  check('...while still fast enough to catch a canister at its top drift',
    COURSE_COLLECT_CAP > 45, `${COURSE_COLLECT_CAP}`);
}
