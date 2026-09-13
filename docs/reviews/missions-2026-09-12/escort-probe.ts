// Why an escort stalls: a trace of the charge and the commander, ten seconds
// at a time, on the seeds flight-probe.ts saw time out or die.
//
//   node --experimental-strip-types --no-warnings docs/reviews/missions-2026-09-12/escort-probe.ts

import { Game } from '../../../src/game/game.ts';
import { headlessShell } from '../../../src/engine/shell.ts';
import { withoutSaving } from '../../../src/game/storage.ts';
import { seedWorld } from '../../../src/game/rng.ts';
import { runMissions } from '../../../src/game/mission-bridge.ts';
import { COURSE_KEYS } from '../../../src/game/bindings.ts';
import { keymap } from '../../../src/engine/keymap.ts';
import { hostilesNear } from '../../../src/game/hostility.ts';

const DT = 1 / 60;
const FIRE = keymap().fire[0];

function escortGame(k: number): Game {
  const g = withoutSaving(() => {
    seedWorld(20_260_950 + k);
    const game = new Game(() => headlessShell());
    if (game.mode === 'briefing') { game.input.injectPress('Escape'); game.step(DT, DT); }
    return game;
  }).value;
  const c = g.state.commander;
  for (let world = 0; world < 256 && c.missions.live.length === 0; world++) {
    c.systemIndex = world;
    c.kills = 16;   // the board gates the escort by kills since docs/TODO/217 M2
    withoutSaving(() => runMissions(c, { kind: 'accept', skeleton: 'side-escort' }, g.state.systems, () => 0.5));
  }
  c.missions.live[0].target = c.systemIndex;
  c.day += k * 3;
  withoutSaving(() => {
    g.launch();
    for (let f = 0, at = 0; f < 400; f++) g.step(DT, at += DT);
    g.arriveInSystem();
    for (let f = 0, at = 0; f < 400; f++) g.step(DT, at += DT);
  });
  return g;
}

for (const k of [1, 2, 5, 7, 0]) {
  const g = escortGame(k);
  const s = g.state;
  const charge = s.world.npcs.find((n) => n.state.missionTag !== null)!;
  const st = s.world.station.position;
  console.log(`\nseed ${k}: the charge starts ${Math.round(charge.object.position.distanceTo(st)).toLocaleString()} from the station, `
    + `${Math.round(charge.object.position.distanceTo(s.player.position)).toLocaleString()} from the commander`);
  console.log('   t  | charge: phase     flee  speed  to-station | commander: to-charge  energy  shields   course     | hostile');
  let minGap = Infinity;
  let rams = 0;
  let lastEnergy = s.sys.energy;
  withoutSaving(() => {
    g.input.injectPress(COURSE_KEYS.mission);
    for (let f = 0; f < 600 * 60; f++) {
      const hostile = hostilesNear(s.world.npcs, s.player.position, s.commander.legalStatus, s.player.position.distanceTo(st));
      if (s.session.ccEngaged) g.input.press(FIRE); else g.input.release(FIRE);
      if (!hostile && s.session.course === null && !s.session.dockTrial && g.mode === 'flight') g.input.injectPress(COURSE_KEYS.mission);
      g.step(DT, 100 + f * DT);
      const gap = s.player.position.distanceTo(charge.object.position);
      minGap = Math.min(minGap, gap);
      if (s.sys.energy < lastEnergy - 5 && gap < 200) rams += 1;
      lastEnergy = s.sys.energy;
      if (f % 600 === 0 || g.mode === 'dead' || s.commander.missions.done['side-escort']) {
        console.log(`${String(Math.round(f * DT)).padStart(4)} | ${charge.state.traderPhase.padEnd(9)} ${String(charge.state.fleeing).padEnd(5)} ${String(Math.round(charge.state.speed)).padStart(5)}  ${Math.round(charge.object.position.distanceTo(st)).toLocaleString().padStart(9)} | `
          + `${Math.round(gap).toLocaleString().padStart(10)}  ${String(s.sys.energy).padStart(6)}  ${String(s.sys.foreShield).padStart(3)}/${String(s.sys.aftShield).padEnd(3)}  ${String(s.session.course).padEnd(9)} | ${hostile}`);
      }
      if (g.mode === 'dead') {
        const w = s.world;
        console.log(`  THE COMMANDER DIED at ${Math.round(f * DT)} s; ${rams} energy drops within 200 units of the charge; nearest ${Math.round(minGap)}`);
        console.log(`  at death: ${Math.round(s.player.position.distanceTo(w.planetPos) - w.planetRadius).toLocaleString()} above the planet, ${Math.round(s.player.position.distanceTo(st)).toLocaleString()} from the station, ${Math.round(s.player.position.distanceTo(w.sunPos)).toLocaleString()} from the sun, speed ${Math.round(s.player.speed)}`);
        break;
      }
      if (s.commander.missions.done['side-escort']) { console.log(`  ESCORT ${s.commander.missions.done['side-escort'].toUpperCase()} at ${Math.round(f * DT)} s; nearest ${Math.round(minGap)}`); break; }
      if (!charge.state.alive) { console.log(`  the charge died at ${Math.round(f * DT)} s`); break; }
    }
  });
  g.input.release(FIRE);
  if (!s.commander.missions.done['side-escort'] && g.mode !== 'dead') console.log(`  still going at 600 s; nearest ${Math.round(minGap)}; ${rams} energy drops within 200 units of the charge`);
}
