// The standing orders, driven through a real Game: the dock's transmission,
// the acceptance on the MISSIONS screen, and the station menu that names the
// order (docs/TODO/144, docs/TODO/190).
//
// This is the wiring half of test/standing-orders.test.ts, and it is where
// docs/TODO/140 M2's defect lives: a correct function that nothing calls.
// It left that file when docs/TODO/191 pushed it over the size ceiling, and
// it is one claim: the order a machine set reaches the console and the menu.

import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { withoutSaving } from '../src/game/storage.ts';
import { seedWorld } from '../src/game/rng.ts';
import { keyPointer } from '../src/ui/key-help.ts';
import { dossierFor } from '../src/missions/dossiers.ts';
import { legReward } from '../src/missions/queries.ts';
import { fillSlots, lineSlots } from '../src/missions/text.ts';
import { captureById } from './screen-capture.ts';
import { check, consoleWatcher, dismissBriefing, eq } from './harness.ts';

console.log('\nthe station line and the briefing, through a real Game');
{
  const g = withoutSaving(() => {
    seedWorld(11);
    const game = new Game(() => headlessShell());
    dismissBriefing(game);
    return game;
  }).value;

  const c = g.state.commander;
  c.kills = 16;
  c.galaxy = 1;
  c.contracts = [
    { kind: 'courier', destination: 42, qty: 1, reward: 5000, deadlineDay: c.day + 6},
    { kind: 'courier', destination: 11, qty: 1, reward: 5000, deadlineDay: c.day + 12},
  ];
  c.equipment.laser = 'beam';

  const said = consoleWatcher(g);
  g.enterDocked();
  const lines = said(150);   // the docking tunnel plays before a key lands

  const briefing = lines.find((t) => t.startsWith('INCOMING NAVY TRANSMISSION'));
  check('the transmission still fires at the dock', briefing !== undefined);
  check('...and it now says where the rest of the briefing lives',
    briefing?.includes('MISSIONS') === true);
  check('...naming the key off the binding table rather than a letter in prose',
    briefing?.includes(keyPointer('docked', 'openMissions')) === true);
  eq('...and nothing starts until she accepts', c.missions.live.length, 0);

  // She accepts on the MISSIONS screen, as she signs for a contract.
  g.input.injectPress('KeyR');
  g.step(1 / 60, 1);
  eq('R opens the missions screen', g.mode, 'missions');
  g.input.injectPress('KeyA');
  g.step(1 / 60, 1 + 1 / 60);
  eq('A accepts the offer', c.missions.live[0]?.leg, 'hunt');

  // The gun warning EXPLAINS the order, so it queues behind it (session.ts).
  // Said in the same frame it took the console away, and a commander with
  // the wrong gun never saw that the Navy had called. The board's own line
  // about its side jobs waits in the same queue, and so does the governor
  // of Lave's hail since docs/TODO/192, so the window is long.
  const after = said(1800);
  // The dossier's arrive line where one ships (docs/TODO/191), else the skeleton's.
  const d = dossierFor('constrictor');
  const live = c.missions.live[0];
  const order = d
    ? fillSlots(d.legs.hunt.arrive, lineSlots(g.state.systems, live.target, legReward(live))).toUpperCase()
    : 'NAVY MISSION';
  check('the order is said on acceptance', after.some((t) => t.startsWith(order)));
  check('the gun warning arrives after the line it explains, not instead of it',
    after.some((t) => t.includes('MILITARY LASER')));

  // The MENU, painted by the Game itself. The question is whether the line a
  // docked pilot reads carries both kinds. A second dock re-paints it and
  // advances nothing: the hunt leg has no branch for a dock.
  g.input.injectPress('Escape');
  g.step(1 / 60, 9);
  const menu = captureById(() => { g.enterDocked('resumed'); }).get('screen') ?? '';
  const target = g.state.systems[c.missions.live[0].target as number].name.toUpperCase();
  eq('the machine briefed her, so there is a mission order to hide', c.missions.live[0].leg, 'hunt');
  check('the station menu names the mission, with two contracts held',
    menu.includes(target));
  check('...and still names the work she signed for', menu.includes('SEALED DATA'));
  check('...and the count of the job it did not print', menu.includes('(+1 MORE)'));
}
