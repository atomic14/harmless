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
import { ChartScreen, type ChartContext } from '../src/game/screens/chart.ts';
import { newCommander } from '../src/game/commander.ts';
import { g1 } from './fixtures.ts';
import { capture } from './screen-capture.ts';
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
  }
}
