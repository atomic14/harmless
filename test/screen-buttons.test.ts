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
import { renderTestMode } from '../src/ui/screens-career.ts';
import { renderCombatSimCompare, renderCombatSimReport, renderCombatSimSetup } from '../src/ui/screens-trainer.ts';
import { compareReports } from '../src/game/combat-sim-compare.ts';
import { CombatSimRecorder, type CombatSimReport, type ExerciseSetup } from '../src/game/combat-sim-report.ts';
import { NO_OPENING } from '../src/game/combat-sim-opening.ts';
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

// --- the levers and the trainer step by a button (docs/TODO/216 M3) ---------
//
// Each row carries a left and a right arrow, and each arrow carries its
// row. `ScreenHost.click` selects the row first, and then sends the key
// (test/menu-click.test.ts holds that route).

/** Does the painted screen carry an arrow button for this row? */
const hasRowKey = (html: string, row: number, code: string): boolean =>
  new RegExp(`<button data-row="${row}" data-key="${code}"`).test(html);

/** One exercise, flown to a record with nothing in it. */
function flown(): CombatSimReport {
  const setup: ExerciseSetup = {
    seed: 90210, scenario: 'Pirate pair', mode: 'scenario', sampleHz: 10,
    opening: NO_OPENING, coPilot: 'scripted',
    player: { shipId: 'elite-a:player:7', laser: 'beam', missiles: 4, ecm: true, energyUnit: true, energyBomb: false },
    opponents: [{
      hull: 'Sidewinder', designId: 'elite-a:design:17', profileId: 'elite-a:variant:D:17',
      brain: 'pirate-attack-g3', role: 'pirate', tier: 1,
    }],
  };
  return new CombatSimRecorder(setup).report('quit');
}

console.log('\nevery row of levers carries its own two arrows');
{
  const levers = capture(() => renderTestMode({
    rows: [{ label: 'TEST MODE', value: 'OFF' }, { label: 'CREDITS', value: '100.0', heading: 'MONEY', dim: true }],
    selected: 0, on: false,
  }));
  check('the test mode carries a left and a right arrow on each row, each with its row',
    [0, 1].every((r) => hasRowKey(levers, r, 'ArrowLeft') && hasRowKey(levers, r, 'ArrowRight')));
  check('...and leaves by a button', hasButton(levers, 'Escape'));

  const setup = capture(() => renderCombatSimSetup({
    rows: [{ label: 'MODE', value: 'SCENARIO', heading: 'THE FIGHT' }, { label: 'SEED', value: 'RANDOM' }],
    selected: 1, notes: [], notesReserve: [], brainNote: null, brainReserve: '', hasReport: false,
  }));
  check('the trainer\'s setup carries the two arrows on each row',
    [0, 1].every((r) => hasRowKey(setup, r, 'ArrowLeft') && hasRowKey(setup, r, 'ArrowRight')));
  check('...and rerolls the seed by a button', hasButton(setup, 'KeyR'));
  check('...and launches by a button', hasButton(setup, 'Enter'));

  const one = capture(() => renderCombatSimReport(flown(), 0, 1));
  check('a report with no other record walks nowhere',
    !hasButton(one, 'ArrowLeft') && !hasButton(one, 'Enter') && !/data-shift="1"/.test(one));
  const two = capture(() => renderCombatSimReport(flown(), 0, 2));
  check('a report with a second record walks the ring by a button',
    hasButton(two, 'ArrowLeft') && hasButton(two, 'ArrowRight'));
  check('...and opens a comparison by a button', hasButton(two, 'Enter'));
  check('...and exports every record by a shifted button',
    /<button data-key="KeyX" data-shift="1"/.test(two) && hasButton(two, 'KeyC') && hasButton(two, 'KeyX'));

  const pair = (total: number): string => capture(() => renderCombatSimCompare({
    compare: compareReports(flown(), flown()), thisIndex: 0, thatIndex: 1, total,
  }));
  check('a comparison of the only two records walks nowhere', !hasButton(pair(2), 'ArrowLeft'));
  check('...and one with a third record walks the other column by a button',
    hasButton(pair(3), 'ArrowLeft') && hasButton(pair(3), 'ArrowRight') && hasButton(pair(3), 'Escape'));
}
