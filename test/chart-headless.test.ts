// Type-to-find on both charts, with no document at all.
//
// `engine/shell.ts` promises a headless game, and `ui/screen-shell.ts` gives a
// screen the seam that keeps the promise: `maybeById` answers null where there
// is no page. `screens/chart.ts` reached for `document.getElementById` instead,
// so the F key threw under node (docs/TODO/163).
//
// NO DOCUMENT IS INSTALLED HERE, and that is why this is its own file.
// `test/chart-days.test.ts` paints the same two charts through
// `test/screen-capture.ts`, which installs a recording document for the length
// of one paint. The two files want opposite environments.
//
// The last two checks matter more than the first two. A screen that merely
// does not throw is a screen nothing drove. A cursor that lands on a named
// system is the path being REACHABLE by a test, which is the whole cost of the
// defect.

import { ChartScreen, type ChartContext } from '../src/game/screens/chart.ts';
import type { StarSystem } from '../src/galaxy/galaxy.ts';
import { newCommander } from '../src/game/commander.ts';
import { Input } from '../src/engine/input.ts';
import { g1 } from './fixtures.ts';
import { check } from './harness.ts';

/** A commander standing at Tibedied, which is index 0 and is not a match below. */
function context(): ChartContext {
  const commander = newCommander();
  commander.systemIndex = 0;
  return {
    commander,
    systems: g1,
    system: g1[0],
    chart: { cursorX: 0, cursorY: 0, targetIndex: null },
    viewData: () => {},
    priceMultiplier: () => 1,
    danger: () => 0,
    convoys: [],
    day: 0,
    overlay: 'none',
    cycleOverlay: () => {},
  };
}

/** Press one key through the screen's own `input`. Return the error it threw. */
function press(screen: ChartScreen, code: string): string {
  const i = new Input();
  i.injectPress(code);
  try {
    screen.input(i);
    return '';
  } catch (e) {
    return String(e);
  }
}

/** The system with this exact name. It is a lookup, not a repeat of the search. */
function named(name: string): StarSystem {
  return g1.find((s) => s.name === name)!;
}

console.log('\nboth charts find a system with no document');
{
  // The control on every check below. A leaked document from an earlier file
  // would let the old line pass, and this gate would then prove nothing.
  check('there is no document under node', typeof document === 'undefined');

  for (const id of ['chart', 'local'] as const) {
    const ctx = context();
    const screen = new ChartScreen(id, () => ctx);

    let opened = '';
    try {
      screen.open();
    } catch (e) {
      opened = String(e);
    }
    check(`the ${id} screen opens with no document (${opened || 'no error'})`,
      opened === '');
    check(`...and its cursor starts on ${g1[0].name.toUpperCase()}`,
      ctx.chart.cursorX === g1[0].x && ctx.chart.cursorY === g1[0].y);

    // This is the key that threw. It turns type-to-find on, and `redraw` then
    // reads the info element for the first time.
    const find = press(screen, 'KeyF');
    check(`...and F turns type-to-find on (${find || 'no error'})`, find === '');

    // One letter, then a second. Two calls rather than one, because
    // `typeToFind` drains a whole frame of presses at once. Leleer answers L
    // and Lave answers LA, so the second letter is shown to NARROW the match
    // rather than merely to leave it alone.
    const first = named('Leleer');
    const typedL = press(screen, 'KeyL');
    check(`...and L moves the cursor to ${first.name.toUpperCase()} (${typedL || 'no error'})`,
      typedL === '' && ctx.chart.cursorX === first.x && ctx.chart.cursorY === first.y);

    const second = named('Lave');
    const typedA = press(screen, 'KeyA');
    check(`...and A narrows it to ${second.name.toUpperCase()}`,
      typedA === '' && ctx.chart.cursorX === second.x && ctx.chart.cursorY === second.y);
  }
}
