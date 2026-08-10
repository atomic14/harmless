// Test mode: the door, and the mark it leaves on the career.
//
// `GameState.cheat` already had a passing test — test/trade.test.ts fits a
// galactic drive with no money — and nothing in the shipped game could set it.
// So what is asserted here is the half that was missing: that the SCREEN sets
// it, that switching it on marks the career for good, and that a save written
// before the mark existed reads as an unmarked one rather than as undefined.
//
// Everything runs headlessly through the real Screen interface: the screen is
// given a context, driven with taps the way `ScreenHost` drives it, and the
// state is read back. No Game, no DOM, no renderer.

import { TestModeScreen, type TestModeContext } from '../src/game/screens/test-mode.ts';
import { freshState } from '../src/game/state.ts';
import { markTested, newCommander, type CommanderData } from '../src/game/commander.ts';
import { BINDINGS } from '../src/game/controls.ts';
import { COMMAND_HELP } from '../src/game/command-help.ts';
import { commanderOf, fileId } from '../src/game/save-file.ts';
import { makeRecord, readSave, writeSave } from '../src/game/storage.ts';
import type { Input } from '../src/engine/input.ts';
import { check, cmds, eq, eqc } from './harness.ts';
import { installStore } from './save-fixtures.ts';

// --- the door ----------------------------------------------------------------

console.log('\n⇧T is the door, and T is still the simulator');
{
  eqc('⇧T at the station asks for test mode', cmds('docked', ['KeyT'], ['ShiftLeft']),
    ['openTestMode']);
  // The reason the shifted entry has to come FIRST in the table: the plain one
  // is the fallback and `pressed()` consumes, so a plain entry ahead of it eats
  // the tap and the training simulator opens with shift held.
  eqc('...and T on its own is still the training simulator', cmds('docked', ['KeyT']),
    ['openCombatSim']);
  // A development door belongs on the keyline — keys that work here but are not
  // controls you arrow onto — not among the menu's rows. Invariant 9's own test
  // holds that it is one or the other; this says WHICH.
  check('the door is a keyline caption, not a menu row',
    COMMAND_HELP.openTestMode.keyline === 'TEST MODE'
    && COMMAND_HELP.openTestMode.menu === undefined);
  check('...and it is bound at the station and nowhere else',
    BINDINGS.docked.some((b) => b.command === 'openTestMode')
    && !BINDINGS.flight.some((b) => b.command === 'openTestMode')
    && !BINDINGS.simulator.some((b) => b.command === 'openTestMode'));
}

// --- the toggle, driven through the screen -----------------------------------

/** A keyboard that has already been pressed, as `Input` — taps are consumed. */
function taps(): { press(code: string): void; input: Input } {
  const queued: string[] = [];
  return {
    press: (code) => { queued.push(code); },
    input: {
      pressed: (code: string) => {
        const at = queued.indexOf(code);
        if (at < 0) return false;
        queued.splice(at, 1);
        return true;
      },
      held: () => false,
    } as unknown as Input,
  };
}

console.log('\nthe screen is what sets GameState.cheat');
{
  const state = freshState(newCommander());
  let checkpoints = 0;
  const screen = new TestModeScreen(() => ({
    state,
    checkpoint: () => { checkpoints += 1; },
  } satisfies TestModeContext));

  const kb = taps();
  screen.open();
  check('a fresh career starts with the mode off and unmarked',
    state.cheat === false && state.commander.tested === false);

  kb.press('Enter');
  eq('ENTER on the first row switches it on', screen.input(kb.input), 'stay');
  check('...and `cheat` is now the true the outfitters read', state.cheat === true);
  check('...and the career is marked', state.commander.tested === true);
  check('...and the mark is written down rather than left for the next autosave',
    checkpoints === 1);

  // The latch. A live toggle can be switched off before a screenshot, which is
  // the whole reason the career carries a second, one-way field.
  kb.press('ArrowLeft');
  screen.input(kb.input);
  check('switching it off again clears `cheat`', state.cheat === false);
  check('...and does NOT clear the mark', state.commander.tested === true);

  // ESC leaves; it does not toggle anything on the way out.
  kb.press('Escape');
  eq('ESC closes the screen', screen.input(kb.input), 'back');
  check('...and changed nothing', state.cheat === false && checkpoints === 2);
}

console.log('\nthe mark is one way, wherever it is asked for');
{
  const c = newCommander();
  check('marking an unmarked career moves it', markTested(c) === true && c.tested === true);
  check('...and marking it again does not', markTested(c) === false && c.tested === true);
  // The control: the rule is the only writer that matters, so a career that
  // never called it is not marked by anything else here.
  check('...and a career nobody tested is unmarked', newCommander().tested === false);
}

// --- an old save has no such key ---------------------------------------------

console.log('\na save written before the mark reads as an unmarked career');
{
  const { restore } = installStore();
  try {
    // A commander exactly as an older build wrote one: every field it had, and
    // no `tested` key at all. `repairCommander` spreads `newCommander()` under
    // whatever it loaded, which is what makes the default false rather than
    // undefined — asserted through the real read path, not by reasoning.
    const old = { ...newCommander() } as Partial<CommanderData>;
    delete old.tested;
    check('the fixture really is missing the key', !('tested' in old));

    const id = fileId('OLD CAREER');
    // A commander-only record ('file' with no world) is the one shape a save
    // can be in without one — an imported file, which is exactly the route an
    // old career takes back into a new build (save-file.ts).
    writeSave(id, makeRecord('OLD CAREER', 'OLD CAREER', 'file', null,
      old as CommanderData));
    const loaded = commanderOf(readSave(id)!);
    check('it loads', loaded !== null);
    eq('...and reads as never having been tested', loaded?.tested, false);
  } finally {
    restore();
  }
}
