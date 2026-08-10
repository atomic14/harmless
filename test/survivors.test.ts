// The person in your crew spaces: the choice docking used to make for you.
//
// You scoop someone out of a capsule and docking filed them with station
// medical in the same breath as resetting your shields — no choice, no payment,
// no consequence, and the one genuinely moral act in the game cost nothing and
// meant nothing (docs/TODO/127). What is asserted here is the CHOICE: that it
// is asked, that it cannot be dodged, and that the answer is what resolves it.
//
// Three surfaces, three kinds of check: the rule (`game/survivors.ts`, pure),
// the screen's keyboard (a stub Input, the way quit.test.ts drives its
// confirmation), and a real Game docking with somebody aboard.

import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { withoutSaving } from '../src/game/storage.ts';
import { seedWorld } from '../src/game/rng.ts';
import { newCommander } from '../src/game/commander.ts';
import { cargoTonnes } from '../src/game/commander.ts';
import { handOverSurvivors, survivorMessage } from '../src/game/survivors.ts';
import { SurvivorsScreen, type SurvivorsContext } from '../src/game/screens/survivors.ts';
import type { Input } from '../src/engine/input.ts';
import { check, dismissBriefing, eq } from './harness.ts';

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

// --- the rule ----------------------------------------------------------------

console.log('\nhanding a survivor over costs nothing and pays nothing');
{
  const c = newCommander();
  c.survivors = 2;
  const before = { credits: c.credits, disrepute: c.disrepute ?? 0, hold: cargoTonnes(c) };

  const e = handOverSurvivors(c);
  check('the rule reports what happened', e?.kind === 'handed' && e.people === 2);
  eq('...and the crew spaces are clear', c.survivors, 0);
  eq('...for nothing', c.credits, before.credits);
  eq('...and no mark on the name: being decent is not a trade',
    c.disrepute ?? 0, before.disrepute);
  eq('...and it is not a hold operation', cargoTonnes(c), before.hold);
  eq('the console line counts them', survivorMessage(e!), '2 SURVIVORS HANDED TO STATION MEDICAL');

  const one = newCommander();
  one.survivors = 1;
  eq('...and pluralises off the count',
    survivorMessage(handOverSurvivors(one)!), '1 SURVIVOR HANDED TO STATION MEDICAL');

  // A caller must not be able to announce a rescue that did not happen.
  eq('nobody aboard is not an answer', handOverSurvivors(newCommander()), null);
}

// --- the keyboard ------------------------------------------------------------

console.log('\nthe prompt cannot be escaped');
{
  let handed = 0;
  const screen = new SurvivorsScreen(() => ({
    people: 1,
    handOver: () => { handed += 1; },
  } satisfies SurvivorsContext));
  const kb = taps();
  screen.open();

  // THE CLAIM OF THE MILESTONE. Escape is how every other overlay in the game
  // closes; here it is refused, because "do nothing" would resolve the choice
  // in the decent direction for free and put the old bug straight back.
  kb.press('Escape');
  eq('ESC does not dismiss it', screen.input(kb.input), 'stay');
  eq('...and nothing was decided', handed, 0);

  for (const key of ['Enter', 'KeyQ', 'KeyY', 'Space']) {
    kb.press(key);
    eq(`...and neither does ${key}`, screen.input(kb.input), 'stay');
  }
  eq('...still nothing decided', handed, 0);

  kb.press('KeyM');
  eq('M hands them over, and closes the prompt', screen.input(kb.input), 'back');
  eq('...having answered exactly once', handed, 1);
}

// --- and the real docking ----------------------------------------------------

console.log('\ndocking with somebody aboard asks before it resolves');
{
  const g = withoutSaving(() => {
    seedWorld(20_270_810);
    const game = new Game(() => headlessShell());
    dismissBriefing(game);
    return game;
  }).value;
  const c = g.state.commander;
  c.survivors = 1;

  withoutSaving(() => { g.enterDocked('resumed'); });
  eq('the prompt is what is on screen', g.screens.topId, 'survivors');
  // THE OTHER HALF: `Station.dock` no longer resolves them. If it did, the
  // screen would be asking about somebody who had already been handed over.
  eq('...and nobody has been handed over yet', c.survivors, 1);

  // ...and the station's own business is finished underneath it: the prompt is
  // on TOP of a docked game, not instead of docking.
  eq('the ship is docked behind it', g.state.session.hyperCountdown, -1);

  const kb = taps();
  kb.press('KeyM');
  g.screens.top!.screen.input(kb.input);
  eq('the answer clears the crew spaces', c.survivors, 0);
  eq('...and the console says so', g.state.session.messageText,
    '1 SURVIVOR HANDED TO STATION MEDICAL');
}
