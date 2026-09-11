// The course buttons over the flight view (docs/TODO/205 M5).
//
// In flight the course list is a set of buttons, not a screen, because the
// flight world stops under a screen. Each button sends its code as a menu row
// does. These press the codes in a real headless Game, as a click would.

import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { withoutSaving } from '../src/game/storage.ts';
import { seedWorld } from '../src/game/rng.ts';
import { COURSE_KEYS, COURSE_TOGGLE_KEY } from '../src/game/bindings.ts';
import { courseButtonsFor } from '../src/game/cockpit-view.ts';
import { check, dismissBriefing, eq } from './harness.ts';

console.log('\nthe course buttons in flight');

/** A commander at the witchpoint of a system, with no course. */
function arrived(): Game {
  const g = withoutSaving(() => {
    seedWorld(20_260_917);
    const game = new Game(() => headlessShell());
    dismissBriefing(game);
    game.launch();
    return game;
  }).value;
  // The launch and the arrival each play a tunnel, and the cockpit reads only
  // a few keys while one runs. So the test presses once the tunnel is over.
  const settle = (): void => {
    withoutSaving(() => { for (let f = 0, at = 0; f < 400; f++) g.step(1 / 60, at += 1 / 60); });
  };
  settle();
  g.arriveInSystem();
  // Only the rocks stay: they are what the mining button needs, and they
  // start no fight.
  const quiet = (): void => {
    for (const n of g.state.world.npcs) if (n.role !== 'asteroid') n.state.alive = false;
  };
  quiet();
  settle();
  quiet();
  return g;
}

function press(g: Game, code: string): void {
  g.input.injectPress(code);
  withoutSaving(() => g.step(1 / 60, 1));
}

{
  const g = arrived();
  const panel = g.coursePanel();
  check('with no course, the list shows by itself after an arrival',
    panel !== null && panel.rows !== null && panel.rows.some((c) => c.kind === 'station'));

  press(g, COURSE_KEYS.station);
  eq('the station button picks the station course', g.state.session.course, 'station');
  eq('...and the list folds away', g.coursePanel()?.rows ?? null, null);
  eq('...leaving one button that says what the ship is doing',
    courseButtonsFor(g.coursePanel()!, null).map((b) => b.label).join(), 'HEADING TO THE STATION');

  press(g, COURSE_TOGGLE_KEY);
  check('that button opens the list again over the course', (g.coursePanel()?.rows?.length ?? 0) > 0);
  check('...and the list ends with a button that closes it',
    courseButtonsFor(g.coursePanel()!, 'KeyG').at(-1)?.label === 'CLOSE');

  g.state.commander.equipment.scoops = true;
  g.state.commander.fuel = 10;
  press(g, COURSE_KEYS.skim);
  eq('another button changes the course', g.state.session.course, 'skim');
  eq('...and folds the list away again', g.coursePanel()?.rows ?? null, null);
}

{
  const g = arrived();
  press(g, COURSE_KEYS.mine);
  eq('a button the ship cannot fly picks nothing', g.state.session.course, null);
  eq('...and the console says what the ship needs', g.state.session.messageText,
    'NEEDS A MINING LASER AND FUEL SCOOPS');
  const dim = courseButtonsFor(g.coursePanel()!, null).find((b) => b.code === COURSE_KEYS.mine);
  eq('...which its button also says, under its label', dim?.note, 'NEEDS A MINING LASER AND FUEL SCOOPS');
}

{
  const g = arrived();
  g.state.session.paused = true;
  g.input.injectPress(COURSE_KEYS.station);
  withoutSaving(() => g.step(1 / 60, 1));
  eq('a paused cockpit reads no course button', g.state.session.course, null);
}

{
  const g = withoutSaving(() => {
    seedWorld(20_260_918);
    const game = new Game(() => headlessShell());
    dismissBriefing(game);
    return game;
  }).value;
  g.startExercise({ mode: 'sparring', scenario: 'single-pirate', tier: 1, seed: 1 });
  eq('an exercise shows no course buttons', g.coursePanel(), null);
  g.endExercise();
}
