// The LAUNCH row asks where the ship goes (docs/TODO/205 M4).
//
// Chris's rule of 2026-09-11: no ship leaves without somewhere to go. So the
// row opens a list of courses. A jump starts its countdown at the launch. A
// local course leaves on its work. A row the ship cannot fly refuses, and the
// console says why. These run the real Game through the row's own code.

import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { withoutSaving } from '../src/game/storage.ts';
import { seedWorld } from '../src/game/rng.ts';
import { COURSE_CHART_KEY, COURSE_KEYS } from '../src/game/bindings.ts';
import { checkJump } from '../src/game/hyperspace.ts';
import { check, dismissBriefing, eq } from './harness.ts';

console.log('\nthe LAUNCH row asks where the ship goes');

/** A fresh commander on the pad, with the menu up. */
function docked(): Game {
  return withoutSaving(() => {
    seedWorld(20_260_916);
    const game = new Game(() => headlessShell());
    dismissBriefing(game);
    return game;
  }).value;
}

/** Press one code, and give the game one frame to answer it. */
function press(g: Game, code: string): void {
  g.input.injectPress(code);
  withoutSaving(() => g.step(1 / 60, 1));
}

/** The first system the tank can reach, as the chart would set it. */
function reachable(g: Game): number {
  const c = g.state.commander;
  const i = g.state.systems.findIndex((_, n) =>
    checkJump(c, g.state.systems, n, false, false).ok);
  if (i < 0) throw new Error('no system in range of a full tank');
  return i;
}

{
  const g = docked();
  press(g, 'VirtLaunch');
  eq('the LAUNCH row opens the course list rather than leaving', g.mode, 'courses');

  press(g, COURSE_KEYS.jump);
  eq('a jump with no target refuses, and the ship stays on the pad', g.mode, 'courses');
  eq('...and the console says why', g.state.session.messageText, 'NO HYPERSPACE TARGET SET');

  press(g, COURSE_CHART_KEY);
  eq('the chart row opens the galactic chart', g.mode, 'chart');
  press(g, 'Escape');
  eq('...and ESC from the chart comes back to the list', g.mode, 'courses');

  press(g, 'Escape');
  eq('ESC from the list stays docked', g.mode, 'docked');
}

{
  const g = docked();
  g.state.chart.targetIndex = reachable(g);
  press(g, 'VirtLaunch');
  press(g, COURSE_KEYS.jump);
  eq('a jump with a target leaves the station', g.mode, 'flight');
  eq('...on the jump course', g.state.session.course, 'jump');
  check('...with the countdown already running', g.state.session.hyperCountdown >= 0);
}

{
  const g = docked();
  g.state.commander.equipment.scoops = true;
  g.state.commander.fuel = 10;
  press(g, 'VirtLaunch');
  press(g, COURSE_KEYS.skim);
  eq('a commander with no target but scoops can leave to skim the star', g.mode, 'flight');
  eq('...on the star course', g.state.session.course, 'skim');
  check('...and no countdown runs', g.state.session.hyperCountdown < 0);
}

{
  const g = docked();
  press(g, 'VirtLaunch');
  press(g, COURSE_KEYS.mine);
  eq('the rocks with no mining laser refuse', g.mode, 'courses');
  eq('...and the console names what is missing', g.state.session.messageText,
    'NEEDS A MINING LASER AND FUEL SCOOPS');
}
