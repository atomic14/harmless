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
import { clearOfPolice } from '../src/game/course-clearance.ts';
import { SCAN_RANGE } from '../src/constants/law.ts';
import { COURSE_ESCORT_STANDOFF, COURSE_POLICE_CLEARANCE, ESCORT_LEASH } from '../src/constants/mission-course.ts';
import { HUNT_FLEE_FRACTION, TRADER_CALM_SECONDS } from '../src/constants/attack-run.ts';
import { GANG_BOUNTY, GANG_BROKEN_BOUNTY } from '../src/constants/missions.ts';
import { TRADER_JUMP_OUT } from '../src/constants/spawn-placement.ts';
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
  g.state.world.npcs, g.state.world.cargo.items, g.state.world.station.position, g.state.player.position)?.what ?? null;

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

console.log('\nthe escort course does not ram its charge, and a grazed charge goes back to work');
{
  // docs/TODO/213 M1. The approach braked from full speed to the charge's
  // own at the standoff and overshot into the hull. A ram is a hit from the
  // commander, and a trader that is hit ran for the rest of its life.
  const g = onTheJob('side-escort', 20_260_947);
  // The charge alone: the pair that flies with it since 214 M1 would start
  // a fight, and the approach is the subject.
  const live = g.state.commander.missions.live[0];
  for (const n of g.state.world.npcs) if (n.state.missionTag !== live.tag) n.state.alive = false;
  const charge = g.state.world.npcs.find((n) => n.state.missionTag === live.tag);
  if (!charge) throw new Error('the escort spawned no charge');
  const shields = g.state.sys.foreShield;
  let nearest = Infinity;
  fly(g, 90, () => {
    nearest = Math.min(nearest, g.state.player.position.distanceTo(charge.object.position));
    return false;
  });
  check('ninety seconds beside the charge cost no shield', g.state.sys.foreShield === shields,
    `${g.state.sys.foreShield} of ${shields}`);
  check('...and the ship never came inside a quarter of the standoff',
    nearest > COURSE_ESCORT_STANDOFF / 4, `${Math.round(nearest)} units at the nearest`);
  check('...and the charge is not on the run', !charge.state.fleeing);
  charge.takeLaserHit(1, g.state.player.position.clone(), false);
  check('a graze sets the charge to flight', charge.state.fleeing);
  fly(g, TRADER_CALM_SECONDS + 5, () => !charge.state.fleeing);
  check('...and it goes back to work once the calm has passed', !charge.state.fleeing);
  eq('...on its way to the station', charge.state.traderPhase, 'arriving');
}

console.log('\nthe charge holds for a commander who falls behind (docs/TODO/214 M3)');
{
  const g = onTheJob('side-escort', 20_260_949);
  const live = g.state.commander.missions.live[0];
  for (const n of g.state.world.npcs) if (n.state.missionTag !== live.tag) n.state.alive = false;
  const charge = g.state.world.npcs.find((n) => n.state.missionTag === live.tag);
  if (!charge) throw new Error('the escort spawned no charge');
  // Beyond the leash, with no course picked: she is not coming.
  charge.object.position.copy(g.state.player.position).add(new THREE.Vector3(0, 0, -(ESCORT_LEASH + 1000)));
  const before = charge.object.position.clone();
  withoutSaving(() => { for (let f = 0; f < 10 * 60; f++) g.step(1 / 60, 100 + f / 60); });
  check('ten seconds on, the charge has held its place',
    charge.object.position.distanceTo(before) < 200, `${Math.round(charge.object.position.distanceTo(before))} units`);
  check('...and says so', charge.state.holding && charge.state.holdSaid);
  const took = fly(g, 120, () => !charge.state.holding);
  check('...until the escort course brings her inside the leash', !charge.state.holding, `after ${took.toFixed(0)}s`);
}

console.log('\nthe canister scooped springs its ambush in the sky (docs/TODO/214 M2)');
{
  const g = onTheJob('side-recover', 20_260_948);
  const live = g.state.commander.missions.live[0];
  // The Krait that circles the canister stays out of it, so the scoop is the
  // only thing that can spring the pair.
  for (const n of g.state.world.npcs) if (n.state.missionTag !== live.tag) n.state.alive = false;
  const pirates = () => g.state.world.npcs.filter((n) => n.state.alive && n.role === 'pirate').length;
  eq('the sky is clear of pirates before the scoop', pirates(), 0);
  // No trigger: a laser held on a canister breaks it, and the job fails.
  const took = fly(g, 240, () => g.state.commander.missions.live[0]?.leg === 'home');
  eq('the ship scoops the canister', g.state.commander.missions.live[0]?.leg, 'home');
  eq('...and the pair jumps in', pirates(), 2, );
  check('...at a pirate wave\'s reach, not on top of the ship',
    g.state.world.npcs.filter((n) => n.state.alive && n.role === 'pirate')
      .every((n) => n.object.position.distanceTo(g.state.player.position) > 4000), `after ${took.toFixed(0)}s`);
}

console.log('\nthe gang is in the sky at the arrival, and a dead member stays dead (docs/TODO/217 M1)');
{
  const g = onTheJob('side-hunt', 20_260_955);
  const tag = g.state.commander.missions.live[0].tag as string;
  const tagged = () => g.state.world.npcs.filter((n) => n.state.alive && n.state.missionTag !== null);
  eq('four tagged pirates wait at the jump-in', tagged().length, 4);
  check('...one of them the leader, and three of them its gang',
    tagged().filter((n) => n.state.missionTag === tag).length === 1
    && tagged().filter((n) => n.state.missionTag?.startsWith(`${tag}#gang-`)).length === 3);
  const member = tagged().find((n) => n.state.missionTag !== tag);
  if (!member) throw new Error('no member');
  member.state.alive = false;
  withoutSaving(() => runMissions(g.state.commander, { kind: 'destroyed', tag: member.state.missionTag as string }));
  // Out, and back in: the arrival spawns the gang from the record.
  withoutSaving(() => { g.arriveInSystem(); });
  eq('...and the next arrival brings three', tagged().length, 3);
}

console.log('\na hunted ship that runs has fled, not escaped');
{
  // Before docs/TODO/208 M3 the world sent `escaped` whichever way a tagged
  // ship left. A ship that ran from the commander has fled. The side hunt
  // is a gang since docs/TODO/217 M1, so a leader that left leaves the gang
  // live, and the record says the leader is gone and why.
  const flown = (fleeing: boolean) => {
    const g = onTheJob('side-hunt', 20_260_945);
    const tag = g.state.commander.missions.live[0].tag as string;
    const ship = g.state.world.npcs.find((n) => n.state.missionTag === tag);
    if (!ship) throw new Error('the hunt spawned no ship');
    ship.state.fleeing = fleeing;
    ship.state.wantsDespawn = true;
    withoutSaving(() => g.step(1 / 60, 200));
    const m = g.state.commander.missions;
    return { done: m.done['side-hunt'], fled: m.entities[tag]?.fled === true, alive: m.entities[tag]?.alive, row: words(g) };
  };
  const jumped = flown(false);
  check('a leader that jumps out is gone from the record, and the gang hunt goes on',
    jumped.done === undefined && jumped.fled && jumped.alive === false);
  eq('...and the row counts the three that are left', jumped.row, 'HUNT THE GANG — 3 LEFT');
  const ran = flown(true);
  check('...and one that ran is gone the same way', ran.done === undefined && ran.fled && ran.alive === false);
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

console.log('\nthe hunt is a chase: a leader that is nearly dead runs, and a gang whose leader got away pays half (docs/TODO/214 M4, 217 M1)');
{
  const g = onTheJob('side-hunt', 20_260_951);
  const tag = g.state.commander.missions.live[0].tag as string;
  // The leader alone in the sky, and its gang reported dead, so the run is
  // the subject and the record agrees.
  gangDown(g, tag);
  const leader = g.state.world.npcs.find((n) => n.state.missionTag === tag);
  if (!leader) throw new Error('the hunt spawned no leader');
  const row = () => missionCourse(g.state.commander.missions, g.state.commander.systemIndex,
    g.state.world.npcs, g.state.world.cargo.items, g.state.world.station.position, g.state.player.position);
  withoutSaving(() => g.step(1 / 60, 100));
  check('the world step marks the hunt\'s leader as one that may run', leader.state.canFlee);
  eq('...and the course row counts the leader alone', row()?.what, 'HUNT THE GANG — 1 LEFT');

  // Shot to under the fraction from where the commander stands.
  leader.state.energy = Math.floor(leader.maxEnergy * HUNT_FLEE_FRACTION) - 1;
  leader.takeLaserHit(1, g.state.player.position.clone(), true);
  check('a hit that leaves it under the fraction sets it to flight', leader.state.fleeing);
  eq('...and the course row says CHASE', row()?.what, 'CHASE THE LEADER — 1 LEFT');
  withoutSaving(() => g.step(1 / 60, 101));
  check('...and the console says so, once', leader.state.runSaid);

  // The edge brought within reach, so the run ends inside the test.
  const away = leader.state.waypoint.clone().sub(leader.object.position).normalize();
  leader.state.waypoint.copy(leader.object.position).addScaledVector(away, TRADER_JUMP_OUT + 600);
  const took = fly(g, 30, () => !g.state.world.npcs.includes(leader));
  check('the leader jumps out at the edge', !g.state.world.npcs.includes(leader), `after ${took.toFixed(1)}s`);
  eq('...and the gang is broken, so the job completes', g.state.commander.missions.done['side-hunt'], 'complete');
  eq('...at half the gang bounty', g.state.commander.credits, 1000 + GANG_BROKEN_BOUNTY);
}

console.log('\n...and a commander who chases can still make the kill');
{
  const g = onTheJob('side-hunt', 20_260_953);
  const tag = g.state.commander.missions.live[0].tag as string;
  gangDown(g, tag);
  const leader = g.state.world.npcs.find((n) => n.state.missionTag === tag);
  if (!leader) throw new Error('the hunt spawned no leader');
  withoutSaving(() => g.step(1 / 60, 100));
  leader.state.energy = Math.floor(leader.maxEnergy * HUNT_FLEE_FRACTION) - 1;
  leader.takeLaserHit(1, g.state.player.position.clone(), true);
  check('the leader runs', leader.state.fleeing);
  // The mission button, and the trigger held: the computer aims, the pilot fires.
  const took = fly(g, 60, () => !leader.state.alive || !g.state.world.npcs.includes(leader), true);
  check('the chase ends in a kill before the edge', !leader.state.alive,
    `after ${took.toFixed(1)}s, alive ${leader.state.alive}, in the sky ${g.state.world.npcs.includes(leader)}`);
  eq('...and the station pays the whole gang', g.state.commander.missions.done['side-hunt'], 'complete');
  check('...in full', g.state.commander.credits >= 1000 + GANG_BOUNTY, `${g.state.commander.credits} tenths`);
}

/**
 * The gang reported dead, through the machine, so the record agrees with an
 * empty sky. A member set dead by hand would still count as left to do.
 */
function gangDown(g: Game, leaderTag: string): void {
  for (const n of g.state.world.npcs) {
    const t = n.state.missionTag;
    if (t === null || t === leaderTag) continue;
    n.state.alive = false;
    withoutSaving(() => runMissions(g.state.commander, { kind: 'destroyed', tag: t }));
  }
}
