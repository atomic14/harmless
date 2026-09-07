// Q launches the escape pod, and ⇧Q gives up the flight.
//
// GitHub #43: no key fired the pod, and only death did. docs/TODO/195 gives
// the pod one body (`Career.deployEscapePod`) and one key. Death still deploys
// it when it is fitted, and that is the control below: the key and the death
// must cost the same, or the body is not one.
//
// THROUGH THE REAL GAME, with a store installed, because the pod's first move
// is to forget the flight saves. A rig that saves nothing cannot see that.

import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { seedWorld } from '../src/game/rng.ts';
import { NOT_IN_THE_SIMULATOR } from '../src/game/bindings.ts';
import { cargoTonnes } from '../src/game/commander.ts';
import { flightIds } from '../src/game/save-file.ts';
import { readSave } from '../src/game/storage.ts';
import { check, cmds, dismissBriefing, eq, eqc } from './harness.ts';
import { installStore } from './save-fixtures.ts';

// --- the table ---------------------------------------------------------------

console.log('\nQ is the pod, and ⇧Q gives up the flight');
{
  eqc('plain Q launches the pod', cmds('flight', ['KeyQ']), ['launchEscapePod']);
  eqc('...and ⇧Q asks to quit', cmds('flight', ['KeyQ'], ['ShiftLeft']), ['quitFlight']);
  eqc('the arena answers Q with its own way out', cmds('simulator', ['KeyQ']), ['endExercise']);
  check('...because the pod is subtracted from the arena',
    NOT_IN_THE_SIMULATOR.includes('launchEscapePod'));
}

// --- what a press costs ------------------------------------------------------

/** A commander in flight past the launch tunnel, with a store behind her. */
function flying(seed: number): { g: Game; step: () => void } {
  seedWorld(seed);
  const g = new Game(() => headlessShell());
  dismissBriefing(g);
  g.enterDocked();
  g.launch();
  let at = 0;
  const step = () => { g.step(1 / 60, at += 1 / 60); };
  for (let f = 0; f < 400; f++) step();
  return { g, step };
}

console.log('\nthe pod, on the key');
{
  const { restore } = installStore();
  try {
    {
      const { g, step } = flying(1_950);
      eq('we are flying', g.mode, 'flight');
      g.state.commander.equipment.escapePod = true;
      g.state.commander.cargo[0] = 3;
      g.state.session.autoSaveTimer = 0;
      step();
      check('the flight recorded itself',
        flightIds(g.state.career).some((id) => readSave(id) !== null));

      g.input.injectPress('KeyQ');
      step();
      eq('Q with a pod fitted puts you at the station', g.mode, 'docked');
      check('...with the pod spent', !g.state.commander.equipment.escapePod);
      eq('...and the hold empty', cargoTonnes(g.state.commander), 0);
      check('...and it says so', g.state.session.messageText.includes('ESCAPE POD DEPLOYED'));
      check('...and the flight saves are gone, as they are on death',
        flightIds(g.state.career).every((id) => readSave(id) === null));
    }
    {
      const { g, step } = flying(1_951);
      g.state.commander.equipment.escapePod = false;
      g.state.commander.cargo[0] = 3;
      g.input.injectPress('KeyQ');
      step();
      eq('Q with no pod fitted keeps you flying', g.mode, 'flight');
      eq('...with the hold untouched', cargoTonnes(g.state.commander), 3);
      check('...and it says what is missing',
        g.state.session.messageText.includes('NO ESCAPE POD FITTED'));
    }
    {
      const { g, step } = flying(1_952);
      g.state.commander.equipment.escapePod = true;
      g.input.injectPress('KeyP');
      step();
      check('paused', g.state.session.paused);
      g.input.injectPress('KeyQ');
      step();
      eq('a paused Q does not fire the pod', g.mode, 'flight');
      check('...and the pod is still fitted', g.state.commander.equipment.escapePod === true);
      g.input.injectPress('KeyQ', true);
      step();
      eq('...while a paused ⇧Q opens the quit confirmation', g.mode, 'quit');
    }
    {
      // The control: death with a pod fitted costs exactly what the key costs.
      const { g, step } = flying(1_953);
      g.state.commander.equipment.escapePod = true;
      g.state.commander.cargo[0] = 3;
      // straight into the planet: deterministic, and a real death path
      g.state.player.position.copy(g.state.world.planetPos);
      step();
      eq('death with a pod fitted puts you at the station', g.mode, 'docked');
      check('...with the pod spent and the hold empty',
        !g.state.commander.equipment.escapePod
        && cargoTonnes(g.state.commander) === 0);
    }
  } finally {
    restore();
  }
}
