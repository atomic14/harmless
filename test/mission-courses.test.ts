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

import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { withoutSaving } from '../src/game/storage.ts';
import { seedWorld } from '../src/game/rng.ts';
import { runMissions } from '../src/game/mission-bridge.ts';
import { missionCourse } from '../src/game/mission-course.ts';
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
  g.state.world.npcs, g.state.world.cargo.items)?.what ?? null;

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
