// A new pilot must see the instructions — docs/TODO/106, milestone 2.
//
// The promise: the briefing opens by itself exactly once per commander, and
// the record of having seen it is SAVED STATE (`CommanderData.briefingSeen`),
// not a browser flag — so it survives export and import, and a save written
// before the marker existed earns the one automatic showing a fresh commander
// gets. Opening counts as shown: abandoning the briefing must not trap a
// player in an onboarding loop, and H is the permanent way back.

import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { withoutSaving, readSave } from '../src/game/storage.ts';
import { dockId, commanderOf } from '../src/game/save-file.ts';
import { seedWorld } from '../src/game/rng.ts';
import { BRIEFING_VERSION } from '../src/constants/commander.ts';
import { check, eq } from './harness.ts';
import { installStore } from './save-fixtures.ts';

console.log('\nthe first-boot briefing');

/** one tap, one fixed step — how a discrete command reaches the Game */
let at = 0;
const tap = (g: Game, code: string): void => {
  g.input.injectPress(code);
  g.step(1 / 60, at += 1 / 60);
};

// --- once per commander, and H afterwards ------------------------------------
{
  const g = withoutSaving(() => {
    seedWorld(1);
    return new Game(() => headlessShell());
  }).value;

  eq('a first boot opens the briefing over the docked menu', g.mode, 'briefing');
  eq('...and opening it IS being shown it, at the current edition',
    g.state.commander.briefingSeen, BRIEFING_VERSION);

  tap(g, 'Escape');
  eq('Escape abandons it to the docked menu — no onboarding trap',
    g.mode, 'docked');

  withoutSaving(() => g.enterDocked());
  eq('docking again does not reopen it', g.mode, 'docked');

  // ride out the 1.4s docking tunnel — while it runs, handleInput is on its
  // paused-only path and no key is read (same run-out as help-overlay.test.ts)
  withoutSaving(() => { for (let f = 0; f < 120; f++) g.step(1 / 60, at += 1 / 60); });
  tap(g, 'KeyH');
  eq('H remains the permanent way back in', g.mode, 'briefing');
  tap(g, 'Escape');
  eq('...and Escape still leaves', g.mode, 'docked');
}

// --- the marker rides the ordinary save path ---------------------------------
{
  const { store, restore } = installStore();
  try {
    seedWorld(2);
    const g1 = new Game(() => headlessShell());
    eq('a fresh commander boots into the briefing', g1.mode, 'briefing');
    tap(g1, 'Escape');
    g1.enterDocked(); // a real arrival: the checkpoint that persists the marker
    const career = g1.state.career;
    check('the arrival checkpoint carries the marker',
      commanderOf(readSave(dockId(career))!)?.briefingSeen === BRIEFING_VERSION);

    seedWorld(2);
    const g2 = new Game(() => headlessShell());
    eq('the next session resumes past it, straight to the station',
      g2.mode, 'docked');

    // A save from before the marker existed: strip it from the record, as an
    // import or an old shelf would arrive. The repair answers 0 — never
    // briefed — so this commander is shown it once, not trapped forever.
    const key = [...store.held.keys()].find((k) => k.includes('save:auto'))!;
    const raw = JSON.parse(store.held.get(key)!) as {
      world: { commander: { briefingSeen?: number } };
    };
    delete raw.world.commander.briefingSeen;
    store.held.set(key, JSON.stringify(raw));

    seedWorld(2);
    const g3 = new Game(() => headlessShell());
    eq('a save from before the marker earns the briefing once', g3.mode, 'briefing');
    eq('...and is re-marked at the current edition',
      g3.state.commander.briefingSeen, BRIEFING_VERSION);
    tap(g3, 'Escape');
    g3.enterDocked();
    check('...whose next checkpoint persists the marker',
      commanderOf(readSave(dockId(career))!)?.briefingSeen === BRIEFING_VERSION);

    seedWorld(2);
    const g4 = new Game(() => headlessShell());
    eq('...so the session after that boots clean', g4.mode, 'docked');

    // A hand-edited marker is repaired, not trusted: absence is answered by
    // the `newCommander()` spread above; a WRONG TYPE is what the storage.ts
    // guard answers, and both land on the same safe 0.
    const raw2 = JSON.parse(store.held.get(key)!) as {
      world: { commander: { briefingSeen?: unknown } };
    };
    raw2.world.commander.briefingSeen = 'A LONG TIME AGO';
    store.held.set(key, JSON.stringify(raw2));
    seedWorld(2);
    const g5 = new Game(() => headlessShell());
    eq('a hand-edited marker is repaired to never-briefed, and shown once',
      g5.mode, 'briefing');
  } finally {
    restore();
  }
}
