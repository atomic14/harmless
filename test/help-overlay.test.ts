// The `?` controls guide is a topmost overlay — docs/TODO/106, milestone 1.
//
// Two claims, and BOTH have to hold or the fix is cosmetic:
//
//  - VISIBILITY. `#screen` carries z-index 10, so a `#help` with none was
//    painted underneath the 92%-opaque station screen: while docked, `?`
//    toggled a panel nobody could see and appeared to do nothing.
//  - SUPPRESSION. While the guide covers a screen, keys must not operate that
//    screen; `?` or Escape closes the guide. A CSS-only fix would leave every
//    letter silently driving the hidden menu — which is why this file drives
//    the real Game and not just the stylesheet.

import { readFileSync } from 'node:fs';
import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { withoutSaving } from '../src/game/storage.ts';
import { seedWorld } from '../src/game/rng.ts';
import { check, dismissBriefing, eq } from './harness.ts';

console.log('\nthe ? guide overlay');

// --- visibility: the guide paints above the screen ---------------------------
{
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  // the z-index declared in a selector's OWN block — `#screen {`, not
  // `#screen .chartrow {`, which the \s*\{ refuses to reach across
  const zOf = (selector: string): number => {
    const m = css.match(new RegExp(`^${selector}\\s*\\{[^}]*z-index:\\s*(\\d+)`, 'ms'));
    return m ? Number(m[1]) : NaN;
  };
  const help = zOf('#help');
  const screen = zOf('#screen');
  check('#help declares a z-index', Number.isFinite(help));
  check('#screen declares a z-index', Number.isFinite(screen));
  check('the guide paints above the station screen', help > screen,
    `#help ${help} vs #screen ${screen} — equal or missing means the docked menu covers the guide`);
}

// --- suppression: an open guide takes the whole keyboard ---------------------
{
  const game = () => {
    const g = withoutSaving(() => {
      seedWorld(1);
      return new Game(() => headlessShell());
    }).value;
    // past the first-boot briefing (docs/TODO/106) — this file is about the
    // ? guide, and briefing-onboarding.test.ts pins the briefing itself
    dismissBriefing(g);
    return g;
  };
  /** one tap, one fixed step — how every discrete command reaches the Game */
  let at = 0;
  const tap = (g: Game, code: string) => {
    g.input.injectPress(code);
    g.step(1 / 60, at += 1 / 60);
  };

  {
    const g = game();
    eq('a fresh Game starts docked with the guide closed',
      `${g.mode}/${g.helpVisible}`, 'docked/false');

    tap(g, 'KeyM');
    eq('M opens the market (the screen the guide must cover)', g.mode, 'market');
    tap(g, 'Question');
    check('? opens the guide over the open screen', g.helpVisible);
    eq('...without disturbing that screen', g.mode, 'market');

    // a letter under the guide reaches nothing — and is not banked either:
    // input.ts carries only a tap something read, so after the step the key
    // must be gone rather than waiting to strike the market when the guide closes
    tap(g, 'KeyB');
    eq('a letter under the guide does not operate the screen', g.mode, 'market');
    check('...and the unread tap is dropped, not carried to the screen',
      !g.input.pressed('KeyB'));

    tap(g, 'Escape');
    check('Escape closes the guide first', !g.helpVisible);
    eq('...leaving the covered screen still open', g.mode, 'market');
    tap(g, 'Escape');
    eq('with the guide closed, Escape reaches the screen again (the control)',
      g.mode, 'docked');

    tap(g, 'Question');
    tap(g, 'KeyM');
    eq('the docked menu under an open guide ignores its own keys', g.mode, 'docked');
    check('...with the guide still up', g.helpVisible);
    tap(g, 'Question');
    check('? closes the guide it opened', !g.helpVisible);
    tap(g, 'KeyM');
    eq('...and the menu answers again', g.mode, 'market');
  }

  // --- and the same guide flies: the ? binding is global, not docked ---------
  {
    const g = game();
    withoutSaving(() => g.launch());
    // fly clear of the launch tunnel first: while that animation runs,
    // handleInput is on its paused-only path and no global binding is read
    for (let f = 0; f < 300; f++) g.step(1 / 60, at += 1 / 60);
    tap(g, 'Question');
    check('? opens the guide in flight', g.helpVisible && g.mode === 'flight');
    tap(g, 'KeyP');
    check('a cockpit command under the guide is refused (P does not pause)',
      !g.state.session.paused);
    tap(g, 'Question');
    check('? closes it in flight', !g.helpVisible);
    tap(g, 'KeyP');
    check('...after which P pauses again (the control)', g.state.session.paused);
  }
}
