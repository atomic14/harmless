// Quitting a flight: the key, the confirmation, and where it puts you.
//
// The one way out of the cockpit that is not docking, dying or the distress
// beacon. What makes it safe to give every pilot rather than only a marked
// career is that it costs exactly what dying costs — the flight — and lands in
// exactly the place dying lands: the DOCKED checkpoint. There is nothing to
// gain by quitting that flying home would not have paid better, and that is
// asserted here rather than argued: the commander that comes back is the one
// that launched, not the one that was flying.
//
// The sharp edge this file exists for is the SIMULATOR. Q was already the
// arena's way out, and the cockpit table is spread into the arena's ahead of
// its own two entries — so a cockpit Q that was not filtered out would have
// shadowed `endExercise` and offered to abandon the CAREER from inside an
// exercise that must never touch it.

import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { QuitScreen, type QuitContext } from '../src/game/screens/quit.ts';
import { BINDINGS, NOT_IN_THE_SIMULATOR, WHILE_PAUSED } from '../src/game/controls.ts';
import { COMMAND_HELP } from '../src/game/command-help.ts';
import { seedWorld } from '../src/game/rng.ts';
import { commanderOf, dockId, flightIds, type SaveSummary } from '../src/game/save-file.ts';
import { readSave } from '../src/game/storage.ts';
import type { Input } from '../src/engine/input.ts';
import { check, cmds, dismissBriefing, eq, eqc } from './harness.ts';
import { installStore } from './save-fixtures.ts';

// --- the key -----------------------------------------------------------------

console.log('\nQ gives up the flight — and still ends an exercise');
{
  eqc('Q in the cockpit asks to quit', cmds('flight', ['KeyQ']), ['quitFlight']);
  // THE REGRESSION. `BINDINGS.simulator` is the cockpit's table spread in ahead
  // of the arena's own Escape and Q, and the scan stops at the first match — so
  // without the filter, the cockpit's Q would answer here instead.
  eqc('...and Q in an exercise still ENDS THE EXERCISE', cmds('simulator', ['KeyQ']),
    ['endExercise']);
  check('...which is what NOT_IN_THE_SIMULATOR is doing',
    NOT_IN_THE_SIMULATOR.includes('quitFlight')
    && !BINDINGS.simulator.some((b) => b.command === 'quitFlight'));

  // It is a cockpit key and nothing else: docked, Q is the new-commander
  // confirmation, and a table that bound both would be two destructive acts on
  // one letter.
  eqc('Q at the station is still NEW COMMANDER', cmds('docked', ['KeyQ']), ['askNewGame']);
  check('the guide says the pause comes first, and where it puts you',
    COMMAND_HELP.quitFlight.what.includes('pause first')
    && COMMAND_HELP.quitFlight.what.includes('station autosave'));

  // What a stopped world answers: the key that starts it again, and the one
  // that gives up. Two, and no more — pause is not a place you play from.
  eq('a paused cockpit answers exactly two commands',
    [...WHILE_PAUSED].sort().join(','), 'quitFlight,togglePause');
}

// --- the confirmation --------------------------------------------------------

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

console.log('\nthe confirmation asks, and only Y answers yes');
{
  let abandoned = 0;
  let resumedPaused = 0;
  const screen = new QuitScreen(() => ({
    checkpoint: { place: 'LAVE', when: 'JUST NOW', credits: 1000, day: 3 } as SaveSummary,
    abandon: () => { abandoned += 1; },
    keepFlying: () => { resumedPaused += 1; },
  } satisfies QuitContext));
  const kb = taps();
  screen.open();

  // ENTER is deliberately NOT a yes. This screen can open over a fight, and
  // ENTER is the key a hand is already resting on.
  kb.press('Enter');
  eq('ENTER does not confirm it', screen.input(kb.input), 'stay');
  eq('...and nothing was abandoned', abandoned, 0);

  kb.press('KeyN');
  eq('N backs out', screen.input(kb.input), 'back');
  eq('...still nothing abandoned', abandoned, 0);

  kb.press('Escape');
  eq('...and so does ESC', screen.input(kb.input), 'back');
  eq('...still nothing abandoned', abandoned, 0);
  // You paused to get here. Backing out must not drop you live into the fight
  // you stopped to think about.
  eq('...and both put the pause back', resumedPaused, 2);

  kb.press('KeyY');
  eq('Y quits, and closes the whole stack', screen.input(kb.input), 'exit');
  eq('...having abandoned the flight exactly once', abandoned, 1);
  eq('...and did NOT put a pause back on a flight that is over', resumedPaused, 2);
}

// --- what it actually costs, driven through a real Game ----------------------

console.log('\nquitting puts back the commander that launched, not the one flying');
{
  const { restore } = installStore();
  try {
    seedWorld(20_260_811);
    const g = new Game(() => headlessShell());
    dismissBriefing(g);
    const career = g.state.career;

    // A commander worth telling apart from the one who comes back.
    g.state.commander.credits = 500_000;
    g.enterDocked();
    const launched = commanderOf(readSave(dockId(career))!)!;
    eq('a checkpoint on the shelf, from the station', launched.credits, 500_000);

    g.launch();
    // Long enough for the LAUNCH TUNNEL to finish: while it plays, `step`
    // routes input as `pausedOnly` and the only command that applies is P. A
    // shorter flight here tests the tunnel, not the quit.
    let at = 0;
    for (let f = 0; f < 400; f++) g.step(1 / 60, at += 1 / 60);
    eq('...and we are flying', g.mode, 'flight');

    // Everything the flight earned. None of it may survive.
    g.state.commander.credits = 999_999;
    g.state.commander.kills += 7;
    g.state.commander.legalStatus = 2;
    // ...and an in-flight autosave that actually exists, so the assertion below
    // that it is GONE is about something. Due on the session's own clock rather
    // than by calling the writer, so it is the save the game would have made.
    g.state.session.autoSaveTimer = 0;
    g.step(1 / 60, at += 1 / 60);
    check('the flight recorded itself, as it does every 20 seconds',
      flightIds(career).some((id) => readSave(id) !== null));

    g.input.injectPress('KeyP');
    g.step(1 / 60, at += 1 / 60);
    g.input.injectPress('KeyQ');
    g.step(1 / 60, at += 1 / 60);
    eq('paused, Q opens the confirmation rather than quitting', g.mode, 'quit');
    check('...and the world is frozen while it is up — a confirm cannot get you killed',
      g.mode !== 'flight');

    g.input.injectPress('KeyY');
    g.step(1 / 60, at += 1 / 60);
    eq('Y puts you back at the station', g.mode, 'docked');

    const back = g.state.commander;
    eq('...as the commander who LAUNCHED', back.credits, 500_000);
    eq('...with the kills the flight made gone', back.kills, launched.kills);
    eq('...and the record it earned gone with them', back.legalStatus, launched.legalStatus);

    // The in-flight ring must not outlive the flight it recorded, or the next
    // boot would resume the run that was just abandoned. Same first move `die()`
    // makes, for the same reason.
    const stranded = flightIds(career).filter((id) => readSave(id) !== null);
    check('the in-flight autosaves are gone', stranded.length === 0, stranded.join(', '));
    check('...and the docked checkpoint is not',
      commanderOf(readSave(dockId(career))!)?.credits === 500_000);
  } finally {
    restore();
  }
}

console.log('\nQ does nothing until the world is stopped');
{
  const { restore } = installStore();
  try {
    seedWorld(20_260_813);
    const g = new Game(() => headlessShell());
    dismissBriefing(g);
    g.launch();
    let at = 0;
    for (let f = 0; f < 400; f++) g.step(1 / 60, at += 1 / 60);

    // Flying, not paused: the key is bound, reaches its handler, and is refused.
    g.input.injectPress('KeyQ');
    g.step(1 / 60, at += 1 / 60);
    eq('Q while flying does NOT open the confirmation', g.mode, 'flight');
    // ...and says so rather than appearing dead, which is the whole reason the
    // refusal is in the handler instead of in the table.
    check('...it says to pause first, naming both keys',
      g.state.session.messageText.includes('PAUSE FIRST')
      && g.state.session.messageText.includes('P,')
      && g.state.session.messageText.includes('Q'));

    // The same refusal answers the launch tunnel, where nothing is paused
    // either — which is why the gate needs no third state.
    check('...and the pause is still off', !g.state.session.paused);

    g.input.injectPress('KeyP');
    g.step(1 / 60, at += 1 / 60);
    check('P stops the world', g.state.session.paused);
    check('...and the paused line names Q as the way out',
      g.state.session.messageText.includes('TO QUIT THE FLIGHT'));

    g.input.injectPress('KeyQ');
    g.step(1 / 60, at += 1 / 60);
    eq('...and NOW Q asks', g.mode, 'quit');

    // Backing out returns you to the pause you were in, not to a live fight.
    g.input.injectPress('Escape');
    g.step(1 / 60, at += 1 / 60);
    eq('ESC leaves you flying', g.mode, 'flight');
    check('...still paused, as you left it', g.state.session.paused);
  } finally {
    restore();
  }
}

console.log('\n...and backing out of it costs nothing at all');
{
  const { restore } = installStore();
  try {
    seedWorld(20_260_812);
    const g = new Game(() => headlessShell());
    dismissBriefing(g);
    g.launch();
    let at = 0;
    for (let f = 0; f < 400; f++) g.step(1 / 60, at += 1 / 60);
    g.state.commander.credits = 4242;

    g.input.injectPress('KeyP');
    g.step(1 / 60, at += 1 / 60);
    g.input.injectPress('KeyQ');
    g.step(1 / 60, at += 1 / 60);
    g.input.injectPress('Escape');
    g.step(1 / 60, at += 1 / 60);

    eq('ESC leaves you flying', g.mode, 'flight');
    eq('...with everything the flight had', g.state.commander.credits, 4242);
  } finally {
    restore();
  }
}
