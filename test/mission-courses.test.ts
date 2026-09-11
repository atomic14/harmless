// Every kind of mission has a way to fly it (docs/TODO/208 M1 and M2).
//
// Chris asked for this on 2026-09-11: *"the missions are becoming much more
// important - they need to feel part of the game"*. So a live job is the
// first button over the view, in its own words, and the ship flies it.
//
// These fly the real side jobs in a real headless Game. Each one is accepted
// through the mission machine, moved to the system the ship is in, and then
// flown by its button alone. The pilot's own part is the trigger, which the
// hunt holds down.

import * as THREE from 'three';
import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { withoutSaving } from '../src/game/storage.ts';
import { seedWorld } from '../src/game/rng.ts';
import { runMissions } from '../src/game/mission-bridge.ts';
import { missionCourse } from '../src/game/mission-course.ts';
import { clearOfPolice } from '../src/game/course-pilot.ts';
import { SCAN_RANGE } from '../src/constants/law.ts';
import { COURSE_POLICE_CLEARANCE } from '../src/constants/course.ts';
import { COURSE_KEYS } from '../src/game/bindings.ts';
import { keymap } from '../src/engine/keymap.ts';
import { check, dismissBriefing, eq } from './harness.ts';

console.log('\nthe missions, flown by their own button');

/**
 * A commander at the witchpoint of the system its live job is in, with the
 * job's target in the sky and nothing else.
 */
function onTheJob(skeleton: string, seed: number): Game {
  const g = withoutSaving(() => {
    seedWorld(seed);
    const game = new Game(() => headlessShell());
    dismissBriefing(game);
    return game;
  }).value;
  const c = g.state.commander;
  c.equipment.scoops = true;
  // A side job is on about a third of the worlds' boards (missions/offers.ts).
  // So the commander stands where this one is offered.
  for (let world = 0; world < 256 && c.missions.live.length === 0; world++) {
    c.systemIndex = world;
    withoutSaving(() => runMissions(c, { kind: 'accept', skeleton }, g.state.systems, () => 0.5));
  }
  const live = c.missions.live[0];
  if (!live) throw new Error(`no world offers ${skeleton}`);
  live.target = c.systemIndex;   // its work is here, so the arrival spawns it
  withoutSaving(() => { g.launch(); });
  withoutSaving(() => { for (let f = 0, at = 0; f < 400; f++) g.step(1 / 60, at += 1 / 60); });
  withoutSaving(() => { g.arriveInSystem(); });
  withoutSaving(() => { for (let f = 0, at = 0; f < 400; f++) g.step(1 / 60, at += 1 / 60); });
  // Only the job's own target stays: no traffic to start a fight of its own.
  for (const n of g.state.world.npcs) if (n.state.missionTag === null) n.state.alive = false;
  return g;
}

/** Fly the mission button until `until`, or the seconds run out. */
function fly(g: Game, seconds: number, until: () => boolean, trigger = false): number {
  const fire = keymap().fire[0];
  let flown = 0;
  withoutSaving(() => {
    g.input.injectPress(COURSE_KEYS.mission);
    for (let f = 0; f < seconds * 60; f++) {
      if (trigger) g.input.press(fire);
      g.step(1 / 60, 100 + f / 60);
      flown = f / 60;
      if (until() || g.mode === 'dead') break;
    }
  });
  g.input.release(fire);
  return flown;
}

/** The words the mission's button shows now. */
const words = (g: Game): string | null => missionCourse(
  g.state.commander.missions, g.state.commander.systemIndex,
  g.state.world.npcs, g.state.world.cargo.items, g.state.world.station.position)?.what ?? null;

{
  const g = onTheJob('side-hunt', 20_260_940);
  check('a hunt names the ship on its button', words(g)?.startsWith('HUNT THE ') === true, `${words(g)}`);
  // The hunt's own ship is hostile, so RUN FOR IT leads the list, as
  // docs/TODO/206 M5 decided. The mission is the row under it.
  check('...and the mission is on the list, under the way out',
    g.coursePanel()?.rows?.some((r) => r.kind === 'mission') === true,
    g.coursePanel()?.rows?.map((r) => r.kind).join() ?? 'no list');
  const took = fly(g, 240, () => g.state.commander.missions.live.length === 0
    || g.state.commander.missions.live[0]?.leg !== 'hunt', true);
  check('...and the ship hunts it down, with the pilot holding the trigger',
    g.state.commander.missions.live[0]?.leg !== 'hunt', `after ${took.toFixed(0)}s`);
}

{
  const g = onTheJob('side-scan', 20_260_941);
  check('a scan names the ship on its button', words(g)?.startsWith('SCAN THE ') === true, `${words(g)}`);
  const took = fly(g, 300, () => g.state.commander.missions.live[0]?.leg !== 'watch');
  check('...and the ship holds it in view until the scan is done',
    g.state.commander.missions.live[0]?.leg !== 'watch', `after ${took.toFixed(0)}s`);
}

{
  const g = onTheJob('side-recover', 20_260_942);
  eq('a recover says what it is', words(g), 'RECOVER THE CARGO');
  const took = fly(g, 240, () => g.state.commander.missions.live[0]?.leg !== 'fetch'
    && g.state.commander.missions.live.length > 0);
  check('...and the ship scoops the canister',
    g.state.commander.missions.live[0]?.leg !== 'fetch', `after ${took.toFixed(0)}s`);
}

{
  const g = onTheJob('side-rescue', 20_260_943);
  eq('a rescue says what it is', words(g), 'PICK UP THE SURVIVOR');
  const took = fly(g, 240, () => (g.state.commander.missions.live[0]?.progress ?? 0) > 0);
  check('...and the ship scoops the pod',
    (g.state.commander.missions.live[0]?.progress ?? 0) > 0, `after ${took.toFixed(0)}s`);
}

{
  const g = onTheJob('side-deliver', 20_260_944);
  eq('a delivery needs no button of its own, because it ends at the station', words(g), null);
  check('...and the station is on the list',
    g.coursePanel()?.rows?.some((r) => r.kind === 'station') === true);
}

console.log('\na hunted ship that runs has fled, not escaped');
{
  // Before docs/TODO/208 M3 the world sent `escaped` whichever way a tagged
  // ship left, and a side hunt fails on that. A ship that ran from the
  // commander has fled, and three arcs have a branch for it.
  const flown = (fleeing: boolean): string | undefined => {
    const g = onTheJob('side-hunt', 20_260_945);
    const ship = g.state.world.npcs.find((n) => n.state.missionTag !== null);
    if (!ship) throw new Error('the hunt spawned no ship');
    ship.state.fleeing = fleeing;
    ship.state.wantsDespawn = true;
    withoutSaving(() => g.step(1 / 60, 200));
    return g.state.commander.missions.done['side-hunt'];
  };
  eq('a tagged ship that jumps out escapes, and the side hunt fails', flown(false), 'fail');
  eq('...and one that runs has fled, which a side hunt does not answer', flown(true), undefined);
}

console.log('\na smuggling run keeps wide of the police');
{
  const from = new THREE.Vector3(0, 0, 0);
  const to = new THREE.Vector3(0, 0, -20_000);
  const out = new THREE.Vector3();
  const onTheLine = new THREE.Vector3(0, 0, -10_000);
  clearOfPolice(from, to, [onTheLine], out);
  const miss = out.distanceTo(onTheLine);
  check('a policeman on the line pushes the aim wide of him', out.z !== to.z);
  check('...by more than he can read a hold at', miss > SCAN_RANGE, `${Math.round(miss)} units`);
  check('...and outside his warning band too', miss >= COURSE_POLICE_CLEARANCE,
    `${Math.round(miss)} units`);
  clearOfPolice(from, to, [new THREE.Vector3(30_000, 0, -10_000)], out);
  check('a policeman well off the line changes nothing', out.equals(to));
}

{
  const g = onTheJob('side-smuggle', 20_260_946);
  eq('a smuggling run says what it is', words(g), 'SLIP PAST THE POLICE');
  // A policeman square in the way, half way to the station.
  const station = g.state.world.station.position;
  const half = g.state.player.position.clone().lerp(station, 0.5);
  const cop = g.state.world.spawn('police', half, 3);
  let nearest = Infinity;
  fly(g, 200, () => {
    nearest = Math.min(nearest, g.state.player.position.distanceTo(cop.object.position));
    return g.state.player.position.distanceTo(station) < 4000;
  });
  check('...and the ship goes round a policeman in the way', nearest > SCAN_RANGE,
    `${Math.round(nearest)} units at the nearest`);
}
