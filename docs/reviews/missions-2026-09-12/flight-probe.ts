// The flight probe behind docs/MISSIONS-REVIEW.md, part two: can the ship's
// own automation finish each kind of job, and how long does it take?
//
//   node --experimental-strip-types --no-warnings docs/reviews/missions-2026-09-12/flight-probe.ts [seeds]
//
// Each run is a real headless Game. A fresh commander (pulse laser, three
// missiles, 100 Cr) is put on one live leg whose work is in the system she
// arrives in. Ordinary traffic stays in the sky. The probe presses the job's
// own button, holds the trigger in a fight, presses the button again when a
// fight drops the course, and presses the docking computer when the station
// course hands over. Scoops are fitted for a scoop, and a docking computer
// for a leg that ends at the station, because the probe has no hands for the
// slot. The output is committed beside it as flight-results.txt.

import { Game } from '../../../src/game/game.ts';
import { headlessShell } from '../../../src/engine/shell.ts';
import { withoutSaving } from '../../../src/game/storage.ts';
import { seedWorld } from '../../../src/game/rng.ts';
import { runMissions } from '../../../src/game/mission-bridge.ts';
import { COURSE_KEYS } from '../../../src/game/bindings.ts';
import { keymap } from '../../../src/engine/keymap.ts';
import { SOURCE_DESIGN, CONSTRICTOR_SPEC } from '../../../src/game/ship-specs.ts';
import { shipDesignIdOf } from '../../../src/game/ship-identity.ts';
import { hostilesNear } from '../../../src/game/hostility.ts';
import type { MissionState } from '../../../src/missions/model.ts';

const SEEDS = Number(process.argv[2] ?? 8);
const DT = 1 / 60;
const FIRE = keymap().fire[0];
const DOCK_KEY = 'KeyC';

interface Kit { scoops?: boolean; dc?: boolean }

function newGame(seed: number, kit: Kit): Game {
  const g = withoutSaving(() => {
    seedWorld(seed);
    const game = new Game(() => headlessShell());
    if (game.mode === 'briefing') { game.input.injectPress('Escape'); game.step(DT, DT); }
    return game;
  }).value;
  const c = g.state.commander;
  c.equipment.scoops = kit.scoops ?? false;
  c.equipment.dockingComputer = kit.dc ?? false;
  return g;
}

/** Accept a side job where a board offers it, and move its work here. */
function onSideJob(g: Game, skeleton: string): void {
  const c = g.state.commander;
  for (let world = 0; world < 256 && c.missions.live.length === 0; world++) {
    c.systemIndex = world;
    withoutSaving(() => runMissions(c, { kind: 'accept', skeleton }, g.state.systems, () => 0.5));
  }
  if (!c.missions.live[0]) throw new Error(`no world offers ${skeleton}`);
  c.missions.live[0].target = c.systemIndex;
}

/** Put a hand-built live leg on the record: an arc's hunt, with its ship here. */
function onArcHunt(g: Game, skeleton: string, leg: string, ship: string): void {
  const c = g.state.commander;
  const here = c.systemIndex;
  const tag = `${skeleton}#1#${leg}`;
  const st: MissionState = c.missions;
  st.live.push({ skeleton, leg, target: here, tag, progress: 0, deadlineDay: null });
  st.journal.push({ skeleton, leg, outcome: 'accepted', day: c.day, world: here });
  st.entities[tag] = { kind: 'ship', ship, hull: 1, lastWorld: here, alive: true };
}

/**
 * Launch, jump, and arrive with the job's target in the sky and the traffic
 * too. The arrival reseeds the world from the system and the day, so each
 * seed lands on a different day to meet a different sky.
 */
function arrive(g: Game, k = 0): void {
  g.state.commander.day += k * 3;
  withoutSaving(() => {
    g.launch();
    for (let f = 0, at = 0; f < 400; f++) g.step(DT, at += DT);
    g.arriveInSystem();
    for (let f = 0, at = 0; f < 400; f++) g.step(DT, at += DT);
  });
}

interface Run {
  outcome: 'done' | 'failed' | 'dead' | 'timeout';
  seconds: number;
  fights: number;
  scanned: boolean;
  kills: number;
  /** energy and the two shields when the run ended, as the HUD reads them */
  energy: number;
  fore: number;
  aft: number;
  /** how far the station was from the witchpoint at the arrival */
  stationAway: number;
}

/**
 * Fly a course button until `until` says the work is done, the leg failed,
 * the ship died, or the seconds ran out. `trigger` holds the laser in a
 * fight. The button is pressed again whenever a fight dropped the course.
 */
function fly(
  g: Game, key: string, seconds: number, until: () => boolean, failed: () => boolean, trigger: boolean,
  then: Phase[] = [],
): Run {
  const s = g.state;
  const kills0 = s.commander.kills;
  let fights = 0;
  let inFight = false;
  let flown = 0;
  let outcome: Run['outcome'] = 'timeout';
  const stationAway = s.player.position.distanceTo(s.world.station.position);
  // The phases still to fly: the first is the case's own, and the rest follow.
  const phases: Phase[] = [{ key, until: () => until(), trigger }, ...then.map((p) => ({ ...p, until: () => p.until(g) }))];
  let phase = 0;
  withoutSaving(() => {
    g.input.injectPress(key);
    for (let f = 0; f < seconds * 60; f++) {
      key = phases[phase].key;
      trigger = phases[phase].trigger;
      const hostile = hostilesNear(s.world.npcs, s.player.position, s.commander.legalStatus,
        s.player.position.distanceTo(s.world.station.position));
      if (hostile && !inFight) fights += 1;
      inFight = hostile;
      if (trigger && s.session.ccEngaged) g.input.press(FIRE); else g.input.release(FIRE);
      // The course dropped for a fight and the fight is over: press it again.
      if (!hostile && s.session.course === null && !s.session.dockTrial && g.mode === 'flight') {
        g.input.injectPress(key);
      }
      // The station course handed over: the docking computer flies the slot.
      if (s.session.dockTrial && !s.session.dcEngaged && s.commander.equipment.dockingComputer) {
        g.input.injectPress(DOCK_KEY);
      }
      g.step(DT, 100 + f * DT);
      flown = f * DT;
      if (g.mode === 'dead') { outcome = 'dead'; break; }
      if (failed()) { outcome = 'failed'; break; }
      if (phases[phase].until()) {
        if (phase === phases.length - 1) { outcome = 'done'; break; }
        phase += 1;
        g.input.injectPress(phases[phase].key);
      }
    }
  });
  g.input.release(FIRE);
  return {
    outcome, seconds: flown, fights, scanned: s.session.policeScanned, kills: s.commander.kills - kills0,
    energy: s.sys.energy, fore: s.sys.foreShield, aft: s.sys.aftShield, stationAway,
  };
}

const done = (g: Game, id: string) => g.state.commander.missions.done[id] === 'complete';
const failed = (g: Game, id: string) => g.state.commander.missions.done[id] === 'fail';
const leg = (g: Game) => g.state.commander.missions.live[0]?.leg;
const isDocked = (g: Game) => g.mode !== 'flight' && g.mode !== 'dead';

interface Phase { key: string; until: (g: Game) => boolean; trigger: boolean }

interface Case {
  name: string;
  kit: Kit;
  put: (g: Game) => void;
  key: string;
  seconds: number;
  until: (g: Game) => boolean;
  failed: (g: Game) => boolean;
  trigger: boolean;
  /** further phases after `until`: a second key, and what ends it (docs/TODO/214 M2) */
  then?: Phase[];
}

const cobra = shipDesignIdOf(SOURCE_DESIGN.cobraMk3);
const asp = shipDesignIdOf(SOURCE_DESIGN.asp);
const fdl = shipDesignIdOf(SOURCE_DESIGN.ferDeLance);

const CASES: Case[] = [
  { name: 'side-hunt: a Krait, pulse laser', kit: {}, put: (g) => onSideJob(g, 'side-hunt'),
    key: COURSE_KEYS.mission, seconds: 300, until: (g) => done(g, 'side-hunt'), failed: (g) => failed(g, 'side-hunt'), trigger: true },
  { name: 'arc-lave runner: a Cobra Mk III, pulse laser', kit: {}, put: (g) => onArcHunt(g, 'arc-lave', 'runner', cobra),
    key: COURSE_KEYS.mission, seconds: 300, until: (g) => leg(g) !== 'runner', failed: (g) => failed(g, 'arc-lave'), trigger: true },
  { name: 'arc-xeer chase: a Fer-de-Lance, pulse laser', kit: {}, put: (g) => onArcHunt(g, 'arc-xeer', 'chase', fdl),
    key: COURSE_KEYS.mission, seconds: 300, until: (g) => leg(g) !== 'chase', failed: (g) => failed(g, 'arc-xeer'), trigger: true },
  { name: 'arc-edle purge: an Asp, pulse laser', kit: {}, put: (g) => onArcHunt(g, 'arc-edle', 'purge', asp),
    key: COURSE_KEYS.mission, seconds: 300, until: (g) => leg(g) !== 'purge', failed: (g) => failed(g, 'arc-edle'), trigger: true },
  { name: 'constrictor hunt, pulse laser', kit: {}, put: (g) => onArcHunt(g, 'constrictor', 'hunt', CONSTRICTOR_SPEC.designId),
    key: COURSE_KEYS.mission, seconds: 300, until: (g) => leg(g) !== 'hunt', failed: (g) => failed(g, 'constrictor'), trigger: true },
  { name: 'side-scan: an Anaconda for 20 s', kit: {}, put: (g) => onSideJob(g, 'side-scan'),
    key: COURSE_KEYS.mission, seconds: 300, until: (g) => done(g, 'side-scan'), failed: (g) => failed(g, 'side-scan'), trigger: true },
  { name: 'side-escort: a Python to station range', kit: {}, put: (g) => onSideJob(g, 'side-escort'),
    key: COURSE_KEYS.mission, seconds: 900, until: (g) => done(g, 'side-escort'), failed: (g) => failed(g, 'side-escort'), trigger: true },
  { name: 'side-recover: scoop a canister (scoops fitted)', kit: { scoops: true }, put: (g) => onSideJob(g, 'side-recover'),
    key: COURSE_KEYS.mission, seconds: 240, until: (g) => leg(g) === 'home', failed: (g) => failed(g, 'side-recover'), trigger: true },
  { name: 'side-rescue: scoop a pod (scoops fitted)', kit: { scoops: true }, put: (g) => onSideJob(g, 'side-rescue'),
    key: COURSE_KEYS.mission, seconds: 240, until: (g) => (g.state.commander.missions.live[0]?.progress ?? 0) > 0, failed: (g) => failed(g, 'side-rescue'), trigger: true },
  { name: 'side-recover: scoop, then fly home and dock (docking computer)', kit: { scoops: true, dc: true }, put: (g) => onSideJob(g, 'side-recover'),
    key: COURSE_KEYS.mission, seconds: 480, until: (g) => leg(g) === 'home', failed: (g) => failed(g, 'side-recover'), trigger: true,
    then: [{ key: COURSE_KEYS.station, until: (g) => done(g, 'side-recover'), trigger: true }] },
  { name: 'side-rescue: scoop, then dock (docking computer)', kit: { scoops: true, dc: true }, put: (g) => onSideJob(g, 'side-rescue'),
    key: COURSE_KEYS.mission, seconds: 480, until: (g) => (g.state.commander.missions.live[0]?.progress ?? 0) > 0, failed: (g) => failed(g, 'side-rescue'), trigger: true,
    then: [{ key: COURSE_KEYS.station, until: (g) => isDocked(g), trigger: true }] },
  { name: 'side-ambush: the lane, then dock (docking computer)', kit: { dc: true }, put: (g) => onSideJob(g, 'side-ambush'),
    key: COURSE_KEYS.station, seconds: 480, until: (g) => done(g, 'side-ambush'), failed: (g) => failed(g, 'side-ambush'), trigger: true },
  { name: 'side-deliver: fly to the station and dock (docking computer)', kit: { dc: true }, put: (g) => onSideJob(g, 'side-deliver'),
    key: COURSE_KEYS.station, seconds: 480, until: (g) => done(g, 'side-deliver'), failed: (g) => failed(g, 'side-deliver'), trigger: true },
  { name: 'side-smuggle: slip past the police and dock (docking computer)', kit: { dc: true }, put: (g) => onSideJob(g, 'side-smuggle'),
    key: COURSE_KEYS.mission, seconds: 480, until: (g) => done(g, 'side-smuggle'), failed: (g) => failed(g, 'side-smuggle'), trigger: true },
];

console.log(`flight probe: ${SEEDS} seeds per case, ordinary traffic in the sky\n`);
for (const c of CASES) {
  const runs: Run[] = [];
  const t0 = Date.now();
  for (let k = 0; k < SEEDS; k++) {
    const g = newGame(20_260_950 + k, c.kit);
    c.put(g);
    arrive(g, k);
    runs.push(fly(g, c.key, c.seconds, () => c.until(g), () => c.failed(g), c.trigger, c.then));
    if (c.name.startsWith('side-escort') && runs[k].outcome !== 'done') {
      const charge = g.state.world.npcs.find((n) => n.state.missionTag !== null);
      const st = g.state.world.station.position;
      console.log(`  escort seed ${k}: ${runs[k].outcome}; the charge is ${charge ? `${charge.state.alive ? 'alive' : 'dead'}, phase ${charge.state.traderPhase}, ${Math.round(charge.object.position.distanceTo(st)).toLocaleString()} units from the station, docked ${charge.state.docked}` : 'gone from the sky'}`);
    }
  }
  const n = (o: Run['outcome']) => runs.filter((r) => r.outcome === o).length;
  const doneRuns = runs.filter((r) => r.outcome === 'done');
  const mean = doneRuns.length ? doneRuns.reduce((a, r) => a + r.seconds, 0) / doneRuns.length : NaN;
  const max = doneRuns.length ? Math.max(...doneRuns.map((r) => r.seconds)) : NaN;
  const fights = runs.reduce((a, r) => a + r.fights, 0) / runs.length;
  console.log(c.name);
  console.log(`  done ${n('done')}  failed ${n('failed')}  dead ${n('dead')}  timeout ${n('timeout')}  of ${runs.length}`
    + `  | time to done: mean ${mean.toFixed(0)} s, worst ${max.toFixed(0)} s`
    + `  | fights per run ${fights.toFixed(1)}  | kills ${runs.reduce((a, r) => a + r.kills, 0)}`
    + (c.name.startsWith('side-smuggle') ? `  | scanned ${runs.filter((r) => r.scanned).length}` : '')
    + `  | wall ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  console.log('  per seed: ' + runs.map((r) => `${r.outcome[0]}${r.seconds.toFixed(0)}`).join(' ')
    + `  | ship after: energy ${(runs.reduce((a, r) => a + r.energy, 0) / runs.length).toFixed(0)}, shields ${(runs.reduce((a, r) => a + r.fore, 0) / runs.length).toFixed(0)}/${(runs.reduce((a, r) => a + r.aft, 0) / runs.length).toFixed(0)}`
    + `  | station ${Math.round(runs[0].stationAway).toLocaleString()} units from the witchpoint`);
}

console.log('\nwithout fuel scoops, the scoop rows refuse:');
{
  // The offer waits for the scoops since docs/TODO/213 M2, so the job is
  // taken with them and flown without, as a sale of the scoops would leave it.
  const g = newGame(20_260_950, { scoops: true });
  onSideJob(g, 'side-recover');
  g.state.commander.equipment.scoops = false;
  arrive(g);
  const row = g.coursePanel()?.rows?.find((r) => r.kind === 'mission');
  console.log(`  side-recover row: "${row?.what}" why: "${row?.why}"`);
}
