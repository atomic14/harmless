// Every docked screen ends in a button a finger can press (docs/TODO/198).
//
// A phone has no key. `ui/screen-host.ts` turns a tap on a `data-key` button
// into the keystroke it names, so a button row is how a phone leaves a screen.
// The briefing, the short range chart and the galactic chart carried none, and
// Chris was stuck on the briefing in the preview of PR #44.
//
// This file paints each of the three under the capture helper, and it asks for
// the buttons by the key each one injects. It does not ask for the label. The
// key is what the host reads, and a label is free to change.

import { renderBriefing } from '../src/ui/briefing.ts';
import { renderNaming, renderNewCommander, renderSavePrompt } from '../src/ui/screens-career.ts';
import { ChartScreen, type ChartContext } from '../src/game/screens/chart.ts';
import { newCommander } from '../src/game/commander.ts';
import { g1 } from './fixtures.ts';
import { capture, captureById } from './screen-capture.ts';
import { Input } from '../src/engine/input.ts';
import { check } from './harness.ts';

/** The smallest context a chart paints from, at Tibedied. */
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

/** Does the painted screen carry a button that injects this key? */
const hasButton = (html: string, code: string): boolean =>
  new RegExp(`<button[^>]*data-key="${code}"`).test(html);

console.log('\nevery docked screen ends in a button a finger can press');
{
  const briefing = capture(() => renderBriefing(0));
  check('the briefing closes by a button', hasButton(briefing, 'Escape'));
  check('...and turns a page forward by a button', hasButton(briefing, 'ArrowRight'));
  check('...and back by a button', hasButton(briefing, 'ArrowLeft'));

  for (const id of ['chart', 'local'] as const) {
    const ctx = context();
    const screen = new ChartScreen(id, () => ctx);
    const html = capture(() => screen.render());
    const name = id === 'chart' ? 'galactic' : 'short range';
    check(`the ${name} chart leaves by a button`, hasButton(html, 'Escape'));
    check(`...and opens the data screen by a button`, hasButton(html, 'KeyD'));
    check(`...and cycles the overlay by a button`, hasButton(html, 'KeyT'));
    check('...and opens the market estimate by a button', hasButton(html, 'KeyM'));
    check('...and starts a search by a button', hasButton(html, 'KeyF'));
  }
}

// --- the search types on the key grid (docs/TODO/216 M2) --------------------
//
// The grid is written into an empty element when the search starts, and
// cleared when it ends. `captureById` reads that element, as the chart
// tests read the info line.

console.log('\nthe chart search carries its letters while it runs');
{
  const press = (screen: ChartScreen, code: string): void => {
    const i = new Input();
    i.injectPress(code);
    screen.input(i);
  };
  for (const id of ['chart', 'local'] as const) {
    const ctx = context();
    const screen = new ChartScreen(id, () => ctx);
    const keysId = id === 'chart' ? 'chart-keys' : 'local-keys';
    const name = id === 'chart' ? 'galactic' : 'short range';

    const idle = captureById(() => screen.open());
    check(`the ${name} chart opens with no letters on it`, !(idle.get(keysId) ?? '').includes('data-key'));

    const found = captureById(() => { screen.open(); press(screen, 'KeyF'); });
    const grid = found.get(keysId) ?? '';
    check('...F puts the letters on it', hasButton(grid, 'KeyA') && hasButton(grid, 'KeyZ'));
    check('...with DEL and ENTER, and no SPACE',
      hasButton(grid, 'Backspace') && hasButton(grid, 'Enter') && !hasButton(grid, 'Space'));

    const ended = captureById(() => { screen.open(); press(screen, 'KeyF'); press(screen, 'Enter'); });
    check('...and ENTER takes them off again', !(ended.get(keysId) ?? '').includes('data-key'));
  }
}

// --- a typed name, by a grid of keys (docs/TODO/216 M1) ---------------------
//
// Three screens read a name through `Input.drainPresses`. A phone sends no
// letter. So each paints the key grid, whose buttons carry the codes the
// screens already read. The one with no button at all was the rename.

console.log('\nevery screen that takes a name carries the keys to type it');
{
  const NAME_KEYS = ['KeyA', 'KeyZ', 'Digit1', 'Digit0', 'Space', 'Backspace'];
  const screens: [string, () => void][] = [
    ['the save prompt', () => renderSavePrompt('JAM', false)],
    ['the rename', () => renderNaming('JAM', 'JAMESON', 'JAMESON')],
    ['the new commander', () => renderNewCommander('', 'JAMESON')],
  ];
  for (const [name, paint] of screens) {
    const html = capture(paint);
    check(`${name} carries a letter, a digit, SPACE and DEL`,
      NAME_KEYS.every((k) => hasButton(html, k)));
    check('...one button per key of the alphabet', (html.match(/data-key="Key[A-Z]"/g) ?? []).length === 26);
    check('...and confirms by a button', hasButton(html, 'Enter'));
    check('...and leaves by a button', hasButton(html, 'Escape'));
  }
  const asking = capture(() => renderSavePrompt('JAM', true));
  check('the save prompt that asks to replace offers Y and ESC, and no letter',
    hasButton(asking, 'KeyY') && hasButton(asking, 'Escape') && !hasButton(asking, 'KeyA'));
}
