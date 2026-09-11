// The pilot's hands as buttons (docs/TODO/206 M3).
//
// The laser fires while its button is held. The missile arms on one press
// and fires on the next. The E.C.M. shows only when one is fitted. The target
// list opens over them, and a row picks its ship. Chris's rule of 2026-09-11:
// a new control takes a click or a tap, and needs no key.

import * as THREE from 'three';
import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { withoutSaving } from '../src/game/storage.ts';
import { seedWorld } from '../src/game/rng.ts';
import { actionButtonsFor } from '../src/game/cockpit-view.ts';
import { attachHoldButtons } from '../src/engine/hold-buttons.ts';
import { TARGET_NONE_KEY, TARGETS_KEY } from '../src/game/bindings.ts';
import { pickedTarget } from '../src/game/targets.ts';
import { check, dismissBriefing, eq } from './harness.ts';

console.log('\nthe pilot\'s buttons');

const base = {
  fireKey: 'KeyA', missiles: 3, armed: false, locked: false,
  armKey: 'KeyT', launchKey: 'KeyM', ecmKey: null, targets: null,
};
{
  const b = actionButtonsFor(base);
  eq('the laser button is the last, at the bottom where a thumb rests', b.at(-1)?.label, 'FIRE LASER');
  check('...and it holds the fire key rather than tapping it', b.at(-1)?.hold === true && b.at(-1)?.code === 'KeyA');
  eq('an unarmed missile button arms one', b.find((x) => x.code === 'KeyT')?.label, 'ARM A MISSILE');
  eq('...and says how many are left', b.find((x) => x.code === 'KeyT')?.hint, '3 LEFT');
  const armed = actionButtonsFor({ ...base, armed: true, locked: true });
  eq('an armed and locked missile button fires it', armed.find((x) => x.code === 'KeyM')?.hint, 'LOCKED ON');
  check('with no missiles there is no missile button',
    !actionButtonsFor({ ...base, missiles: 0 }).some((x) => x.code === 'KeyT' || x.code === 'KeyM'));
  check('with no E.C.M. fitted there is no E.C.M. button', !b.some((x) => x.label === 'E.C.M.'));
  check('...and with one there is', actionButtonsFor({ ...base, ecmKey: 'KeyE' }).some((x) => x.label === 'E.C.M.'));
}

/** A commander in open space, with a trader and a pirate on the scanner. */
function fight(): Game {
  const g = withoutSaving(() => {
    seedWorld(20_260_929);
    const game = new Game(() => headlessShell());
    dismissBriefing(game);
    game.launch();
    return game;
  }).value;
  withoutSaving(() => { for (let f = 0, at = 0; f < 400; f++) g.step(1 / 60, at += 1 / 60); });
  g.state.world.clearNpcs();
  g.state.player.position.add(new THREE.Vector3(0, 40_000, 0));
  const at = (x: number) => g.state.player.position.clone().add(new THREE.Vector3(x, 0, -2000));
  g.state.world.spawn('pirate', at(-1500), 1);
  g.state.world.spawn('trader', at(1500), 2);
  return g;
}

function press(g: Game, code: string): void {
  g.input.injectPress(code);
  withoutSaving(() => g.step(1 / 60, 30));
}

{
  const g = fight();
  eq('the target list starts closed', g.targetPanel().open, false);
  press(g, TARGETS_KEY);
  eq('the TARGETS button opens it', g.targetPanel().open, true);
  const trader = g.targetPanel().rows.find((r) => r.row.standing === 'TRADER')!;
  g.state.session.handFlown = true;
  press(g, trader.code);
  eq('a row picks its ship', pickedTarget(g.state.world.npcs), trader.row.ship);
  eq('...and hands the stick back to the computer', g.state.session.handFlown, false);
  eq('...and closes the list', g.targetPanel().open, false);
  press(g, TARGETS_KEY);
  press(g, TARGET_NONE_KEY);
  eq('LET THE COMPUTER CHOOSE lets go of the pick', pickedTarget(g.state.world.npcs), null);
}

{
  // A button's code names one ship, and not a place in the list. The list
  // is in order of range, and that order moves.
  const g = fight();
  const before = g.targetPanel().rows.map((r) => r.code);
  const [a, b] = g.targetPanel().rows.map((r) => r.row.ship);
  const pa = a.object.position.clone();
  a.object.position.copy(b.object.position).multiplyScalar(1.0001);
  b.object.position.copy(pa);
  const after = g.targetPanel().rows;
  check('two ships that swap places keep their own codes',
    after.find((r) => r.row.ship === a)?.code === before[0]
    && after.find((r) => r.row.ship === b)?.code === before[1]);
}

{
  // The held button, with a document that is only the two calls it listens to.
  const listeners: Record<string, (e: unknown) => void> = {};
  const doc = { addEventListener: (type: string, fn: (e: unknown) => void) => { listeners[type] = fn; } };
  const held: string[] = [];
  attachHoldButtons({
    press: (c) => held.push(`+${c}`), release: (c) => held.push(`-${c}`),
  }, doc as unknown as Document);
  const button = { dataset: { hold: 'KeyA' } };
  const target = { closest: () => button };
  listeners.pointerdown({ target, pointerId: 1, preventDefault: () => {} });
  listeners.pointerdown({ target, pointerId: 2, preventDefault: () => {} });
  listeners.pointerup({ pointerId: 2 });
  eq('a held button presses its key, and a second finger that lifts lets go of its own only',
    held.join(' '), '+KeyA +KeyA -KeyA');
  listeners.pointercancel({ pointerId: 1 });
  eq('...and a cancelled pointer lets go too', held.at(-1), '-KeyA');
  listeners.pointerdown({ target: { closest: () => null }, pointerId: 3, preventDefault: () => {} });
  eq('a press anywhere else holds nothing', held.length, 4);
}
