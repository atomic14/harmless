// A click on a menu row is the row's keystroke — modifier included.
//
// Invariant 13 says a click becomes the same keystroke as a key press. It could
// not keep that promise for a SHIFTED row until docs/TODO/146: `data-key`
// carried the key alone, `ScreenHost.click` injected a bare tap, and the plain
// entry answered. `⇧I MISSIONS` shipped for an afternoon and clicked through to
// the COMMANDER STATUS screen.
//
// `test/key-help.test.ts` holds the EMITTER — that a shifted row prints
// `data-shift` — and `test/input.test.ts` holds the tap queue underneath. This
// file holds the two paths between them, which are the ones that were broken:
//
//   1. `ScreenHost.click`, for a pointer;
//   2. `runMenuCursor`, for arrowing onto a row and pressing Enter.
//
// ⇧R and R are the cockpit's shifted pair for the log and the missions, so
// they are what these press. The station has no shifted row since
// docs/TODO/202, and the cockpit still has five.

import { Input } from '../src/engine/input.ts';
import { commandsFor } from '../src/game/controls.ts';
import { ScreenHost } from '../src/ui/screen-host.ts';
import { check, eqc } from './harness.ts';

/** An element as `ScreenHost` reads one: a `dataset` and nothing else. */
const row = (key: string, shift?: boolean): unknown =>
  ({ dataset: shift ? { key, shift: '1' } : { key } });

console.log('\na click on a row sends the modifier the row prints');
{
  const host = new ScreenHost(() => {});

  const shifted = new Input();
  check('the click is consumed', host.click(row('KeyR', true), shifted) === true);
  eqc('...and it asks for the SHIFTED command',
    commandsFor('flight', shifted), ['openLog']);

  const plain = new Input();
  host.click(row('KeyR'), plain);
  eqc('a click on a plain row asks for the plain command',
    commandsFor('flight', plain), ['openMissions']);

  // The false fire, through the click path this time. One shifted click must
  // not arm a DIFFERENT shifted binding in the same frame.
  // `KeyZ` is bound to nothing in the cockpit, so the scan runs past it and
  // reaches the Y pair. `KeyT` would arm a missile and stop the scan first.
  const both = new Input();
  host.click(row('KeyZ', true), both);
  host.click(row('KeyY'), both);
  const asked = commandsFor('flight', both);
  check('a shifted click leaves another key unshifted',
    asked.includes('jettison1') && !asked.includes('jettison5'), asked.join('|'));
}

console.log('\nEnter on a row sends it too, which is the same path');
{
  // `runMenuCursor` reaches for the document, so it gets the smallest one that
  // answers what it asks: a `.menu` row list, each with a dataset and a
  // classList it can toggle. Set and restored in the same block, which is the
  // rule test/screen-capture.ts states for every stub of this global.
  const globals = globalThis as unknown as { document?: unknown };
  const had = 'document' in globals;
  const before = globals.document;

  const menuRow = (key: string, shift?: boolean) => ({
    dataset: shift ? { key, shift: '1' } : { key },
    classList: { toggle: () => {} },
  });

  const drive = (rows: unknown[], taps: string[]): Input => {
    globals.document = { querySelectorAll: () => rows };
    const i = new Input();
    for (const t of taps) i.injectPress(t);
    new ScreenHost(() => {}).update(i);
    return i;
  };

  try {
    // The cursor starts on row 0, so Enter presses the first row.
    const shifted = drive([menuRow('KeyR', true)], ['Enter']);
    eqc('Enter on a shifted row asks for the shifted command',
      commandsFor('flight', shifted), ['openLog']);

    const plain = drive([menuRow('KeyR')], ['Enter']);
    eqc('...and on a plain row, the plain one',
      commandsFor('flight', plain), ['openMissions']);
  } finally {
    if (had) globals.document = before;
    else delete globals.document;
  }
}
