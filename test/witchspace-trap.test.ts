// The Spectrum's cheat: pause, press F, hear a beep, and every jump lands in
// witch-space until you do it again (docs/TODO/189).
//
// Chris chose it on 2026-09-05 over a test-mode row, and quoted the cheat
// list: *"Pause the game. Press 'f' - you'll hear a beep. Un-pause the game,
// and hyperspace, as normal. You'll now appear in Witchspace, and will
// continue to do so until you pause and press 'f' again."* Every claim below
// is one clause of that quote, driven through the real `Game` with a keyboard
// the way `test/quit.test.ts` drives the other paused key.

import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { withoutSaving } from '../src/game/storage.ts';
import { seedWorld } from '../src/game/rng.ts';
import { freshState } from '../src/game/state.ts';
import { newCommander } from '../src/game/commander.ts';
import { HyperspaceActions, type HyperspaceHost } from '../src/game/hyperspace-actions.ts';
import type { WorldBuild } from '../src/game/world-build.ts';
import { distanceTenths } from '../src/galaxy/navigation.ts';
import { COUNTDOWN } from '../src/constants/jump.ts';
import { check, dismissBriefing, eq } from './harness.ts';

console.log('\nthe Spectrum\'s cheat: paused F arms the mis-jump');

// --- the switch, on its own -------------------------------------------------
{
  const state = freshState(newCommander());
  const said: string[] = [];
  const beeps: boolean[] = [];
  let refused = 0;
  const host: HyperspaceHost = {
    showMessage: (t) => { said.push(t); },
    markCharacter: () => {},
    system: () => state.systems[state.commander.systemIndex],
    lookAlong: () => {},
    startTunnel: () => {},
    inSimulator: () => false,
    refused: () => { refused += 1; },
    countdownSound: () => {},
    hyperspaceSound: () => {},
    distressBeaconSound: () => {},
    misjumpArmed: (armed) => { beeps.push(armed); },
  };
  const jump = new HyperspaceActions(state, null as unknown as WorldBuild, host);

  jump.armMisjump();
  check('F while flying arms nothing', !state.session.misjumpArmed);
  check('...and says to pause first, naming both keys',
    said[0]?.startsWith('PAUSE FIRST') === true && said[0].includes('P,') && said[0].includes('F'));
  eq('...and is refused', refused, 1);
  eq('...with no beep', beeps.length, 0);

  state.session.paused = true;
  jump.armMisjump();
  check('paused, F arms it', state.session.misjumpArmed);
  eq('...and beeps high', beeps.join(','), 'true');
  jump.armMisjump();
  check('...and F again disarms it', !state.session.misjumpArmed);
  eq('...and beeps low', beeps.join(','), 'true,false');
  eq('...with no refusal either time', refused, 1);
}

// --- the jump, through the whole game ----------------------------------------
{
  seedWorld(189_000_001);
  const g = withoutSaving(() => new Game(() => headlessShell())).value;
  dismissBriefing(g);
  g.launch();
  let at = 0;
  const fly = (frames: number): void => {
    for (let f = 0; f < frames; f++) g.step(1 / 60, at += 1 / 60);
  };
  fly(400);                                  // past the launch tunnel
  eq('we are flying', g.mode, 'flight');
  const s = g.state;
  const home = s.commander.systemIndex;
  // The nearest system, so a full tank always covers the fare.
  const near = s.systems.reduce((best, sys) => {
    const d = distanceTenths(s.systems[home], sys);
    return sys.index !== home && d > 0 && d < distanceTenths(s.systems[home], best) ? sys : best;
  }, s.systems[(home + 1) % s.systems.length]);
  const jumpTo = (target: number): void => {
    s.commander.fuel = 70;
    s.chart.targetIndex = target;
    g.startHyperspace();
    fly(60 * (COUNTDOWN + 2));
  };

  g.input.injectPress('KeyF');
  fly(1);
  check('F while flying arms nothing', !s.session.misjumpArmed);
  check('...and the console says to pause first', s.session.messageText.includes('PAUSE FIRST'));

  g.input.injectPress('KeyP');
  fly(1);
  check('P stops the world', s.session.paused);
  g.input.injectPress('KeyF');
  fly(1);
  check('paused, F arms the mis-jump', s.session.misjumpArmed);
  check('...and the world is still stopped', s.session.paused);
  g.input.injectPress('KeyP');
  fly(1);
  check('P starts it again', !s.session.paused);

  jumpTo(near.index);
  check('the jump lands in witch-space', s.session.witchspace);
  eq('...and you went nowhere', s.commander.systemIndex, home);
  check('...among Thargoids', s.world.npcs.some((n) => n.role === 'thargoid'));

  jumpTo(near.index);
  check('the escape jump lands in witch-space again while armed', s.session.witchspace);
  check('...with a fresh ambush', s.world.npcs.some((n) => n.role === 'thargoid' && n.state.alive));

  // The trap is saved with the session, so a reload keeps it set.
  const snap = withoutSaving(() => g.captureSnapshot()).value;
  s.session.misjumpArmed = false;
  withoutSaving(() => g.restoreSnapshot(snap));
  check('a snapshot carries the armed trap', s.session.misjumpArmed);

  g.input.injectPress('KeyP');
  fly(1);
  g.input.injectPress('KeyF');
  fly(1);
  check('paused, F again disarms it', !s.session.misjumpArmed);
  g.input.injectPress('KeyP');
  fly(1);

  jumpTo(near.index);
  check('the escape jump then leaves limbo', !s.session.witchspace);
  eq('...and lands at the target', s.commander.systemIndex, near.index);
}
