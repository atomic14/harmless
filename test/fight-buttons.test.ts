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
import { gunButtonsFor, targetButtonsFor, targetRowFor } from '../src/game/cockpit-buttons.ts';
import { attachHoldButtons } from '../src/engine/hold-buttons.ts';
import { TARGET_NONE_KEY, TARGETS_KEY } from '../src/game/bindings.ts';
import { pickedTarget } from '../src/game/targets.ts';
import { check, dismissBriefing, eq } from './harness.ts';

console.log('\nthe gun row (docs/TODO/215 M1)');

const base = {
  fireKey: 'KeyA', missiles: 3, armed: false, locked: false,
  armKey: 'KeyT', disarmKey: 'KeyU', launchKey: 'KeyM', ecmKey: null, cloakKey: null, cloaked: false, targets: null, missileInbound: false, dockKey: null,
  trial: false, rails: false, accelKey: 'Space', decelKey: 'KeyX', rollStripCode: 'roll',
};
{
  const b = gunButtonsFor(base);
  // Five since docs/TODO/219 M5: the cloak, which no shop sells, keeps its place
  // so a thumb learns the row.
  eq('the row is five buttons, left to right', b.map((x) => x.label).join('|'), 'FIRE LASER|ARM MISSILE|FIRE MISSILE|E.C.M.|CLOAK');
  check('the laser button is the first, and it holds the fire key rather than tapping it', b[0].hold === true && b[0].code === 'KeyA');
  eq('an unarmed missile button arms one', b.find((x) => x.code === 'KeyT')?.label, 'ARM MISSILE');
  eq('...and says how many are left', b.find((x) => x.code === 'KeyT')?.hint, '3 LEFT');
  eq('...and the fire button waits, dim', b[2].note, 'NOT ARMED');
  const armed = gunButtonsFor({ ...base, armed: true, locked: true });
  eq('armed, the second button disarms, lit', armed[1].label + (armed[1].lit ? ' lit' : ''), 'DISARM lit');
  eq('...and it still says how many are left', armed[1].hint, '3 LEFT');
  eq('...and the fire button is live, and says it has a lock', armed[2].code + ' ' + armed[2].hint, 'KeyM LOCKED ON');
  const none = gunButtonsFor({ ...base, missiles: 0 });
  eq('with no missiles the row keeps its shape', none.length, 5);
  eq('...and the arm button says why it is dim', none[1].note, 'NONE LEFT');
  eq('with no E.C.M. fitted the button says so', b[3].note, 'NOT FITTED');
  eq('with no cloak fitted the button says so too', b[4].note, 'NOT FITTED');
  const cloaked = gunButtonsFor({ ...base, cloakKey: 'KeyZ', cloaked: true });
  check('a cloak that runs is lit, and says what it costs', cloaked[4].lit === true && /DRAINS THE BANK/.test(cloaked[4].hint ?? ''));
  check('...and with one it is live', gunButtonsFor({ ...base, ecmKey: 'KeyE' })[3].code === 'KeyE');
  check('...and lit while a missile is inbound', gunButtonsFor({ ...base, ecmKey: 'KeyE', cloakKey: null, cloaked: false, missileInbound: true })[3].lit === true);
  // The target list is its own column, on the left (Chris, 2026-09-13).
  const row = { code: 'VirtTarget1', row: { ship: {} as never, name: 'KRAIT', range: 1000, standing: 'HOSTILE', hostile: true, picked: false, cost: '' } };
  const trader = { code: 'VirtTarget2', row: { ship: {} as never, name: 'PYTHON', range: 2000, standing: 'TRADER', hostile: false, picked: false, cost: '' } };
  const listed = { ...base, targets: { open: false, rows: [row, trader], picked: null } };
  check('the targets button is in its own column, and not among the guns',
    targetButtonsFor(listed).some((x) => x.code === TARGETS_KEY) && !gunButtonsFor(listed).some((x) => x.code === TARGETS_KEY));
  // An icon with the count (docs/TODO/222), red while a hostile is on the scanner.
  const header = targetButtonsFor(listed)[0];
  check('closed, the header is an icon with the count', header?.icon === true && header.label === '\u25CE 2' && header.hint === undefined);
  check('...red, because the Krait attacks', header?.hostile === true);
  check('...and green with the trader alone', targetButtonsFor({ ...base, targets: { open: false, rows: [trader], picked: null } })[0]?.hostile === false);
  eq('...and the row is empty', targetRowFor(listed).length, 0);
  const open = { ...base, targets: { open: true, rows: [row, trader], picked: null } };
  eq('open, the header is lit, and the row lists the ships (docs/TODO/215 M2)',
    String(targetButtonsFor(open)[0]?.lit) + ' / ' + targetRowFor(open).map((x) => x.label).join('|'), 'true / KRAIT|PYTHON');
  check('...and the hostile row reads red, and the trader\'s does not',
    targetRowFor(open)[0].hostile === true && targetRowFor(open)[1].hostile === false);
  eq('...and while the pilot flies the slot, both are empty',
    targetButtonsFor({ ...open, trial: true }).length + targetRowFor({ ...open, trial: true }).length, 0);
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
