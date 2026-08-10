// The chart overlays as the player meets them: the key that cycles them, the
// pointer that reads a lane, and the promise 111 made that looking at the
// galaxy never changes it.
//
// Everything here drives a REAL headless Game through its real seams — a key
// press through `input`, a mouse move through the shell's own `onScreenMove` —
// because the mistakes this file exists to catch are wiring mistakes: a T bound
// to nothing, a mode held per screen instead of by the Game, a pointer that
// reaches no chart. Calling the screen's methods directly would pass on all
// three. The MODELS behind the overlays are test/trade-overlay.test.ts.

import { generateGalaxy, COMMODITIES } from '../src/galaxy/galaxy.ts';
import { distanceSq } from '../src/galaxy/navigation.ts';
import {
  CHART_CANVAS_W, CHART_CANVAS_H, CHART_Y_SQUASH,
} from '../src/constants/chart-metric.ts';
import {
  nextOverlay, OVERLAY_CYCLE, overlayLegend, type ChartOverlay,
} from '../src/game/chart-overlay.ts';
import { LivingGalaxy } from '../src/galaxy/living.ts';
import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { withoutSaving } from '../src/game/storage.ts';
import { check, dismissBriefing, eq } from './harness.ts';

const systems = generateGalaxy(1);

/**
 * A Game built with NO document, whatever the file before this one left behind.
 *
 * The Hud reaches for three elements in its field initializers, so a Game must
 * be constructed against either a real document or none — and a PARTIAL stub
 * left global by an earlier test file is neither. Clearing it here makes this
 * file's environment its own declaration rather than a consequence of the
 * order test/run.ts happens to import in.
 */
function headlessGame(shell: () => ReturnType<typeof headlessShell>): Game {
  const globals = globalThis as unknown as { document?: unknown };
  const inherited = globals.document;
  globals.document = undefined;
  try {
    return withoutSaving(() => {
      const game = new Game(shell);
      dismissBriefing(game);
      return game;
    }).value;
  } finally {
    globals.document = inherited;
  }
}

// --- the cycle --------------------------------------------------------------

console.log('\nT cycles one overlay at a time');
{
  let mode: ChartOverlay = 'none';
  const seen: ChartOverlay[] = [];
  for (let i = 0; i < OVERLAY_CYCLE.length; i++) {
    mode = nextOverlay(mode);
    seen.push(mode);
  }
  eq('three presses return to where you started', mode, 'none');
  check('...having passed through both overlays on the way',
    seen.includes('routes') && seen.includes('prices'));
  check('every mode names itself on the keyline, and only one says nothing extra',
    OVERLAY_CYCLE.filter((m) => overlayLegend(m) === 'T TRADE OVERLAY').length === 1);
}

// --- and none of it writes to the galaxy ------------------------------------

console.log('\ncycling the overlays does not write to the galaxy');
{
  const g = headlessGame(() => headlessShell());
  // A COLD galaxy, put back deliberately: a career boots into one with
  // PREWARM_DAYS behind it now (docs/TODO/117), and `advance` materialises all
  // 256 states — against that map "the painter inserted nothing" is true
  // whatever the painter does. The sparse map is what makes the count an
  // assertion; the wiring under test is the same one either way.
  const living = new LivingGalaxy(g.state.systems);
  g.state.living = living;
  // A sparse galaxy with something for every overlay to find: two dangerous
  // systems, a busy lane between two more, and a price well off baseline.
  living.state(30).danger = 0.7;
  living.state(60).danger = 0.5;
  living.state(90).pressure[0] = 0.9;
  living.convoys.push(
    { from: 30, to: 60, commodity: 0, tonnes: 12, etaDay: 99, intact: true },
    { from: 60, to: 30, commodity: 1, tonnes: 9, etaDay: 99, intact: true },
  );
  const before = living.states.size;

  // The Game is built with no document (as game.test.ts does); the stub goes in
  // only for the chart work, so the keyline it paints can be read back. Without
  // reading it, every assertion below would also pass on a `T` that was never
  // wired to anything.
  const globals = globalThis as unknown as { document?: unknown };
  const previous = globals.document;
  // EVERY write, not the last one: a chart repaint writes the whole screen and
  // then overwrites the cursor's info line, so keeping only the latest would
  // capture "LAVE - 0.0 LY - ..." and never the keyline.
  let painted: string[] = [];
  globals.document = {
    getElementById: () => ({
      set innerHTML(html: string) { painted.push(html); },
      get innerHTML() { return painted[painted.length - 1] ?? ''; },
      textContent: '',
      dataset: {},
      classList: { add: () => {}, remove: () => {}, toggle: () => {} },
      getContext: () => new Proxy({}, { get: () => () => undefined, set: () => true }),
      width: 0,
      height: 0,
    }),
    body: { classList: { add: () => {}, remove: () => {} } },
    // the screen host sweeps the painted markup for clickable rows
    querySelectorAll: () => [],
  };

  /** One `T`, through the real input path, and what the chart then said. */
  const pressT = (): string => {
    painted = [];
    withoutSaving(() => {
      g.input.injectPress('KeyT');
      g.step(1 / 60, 0);
    });
    return painted.join('');
  };
  /** Open a chart and return everything it painted. */
  const open = (chart: () => void): string => {
    painted = [];
    withoutSaving(chart);
    return painted.join('');
  };

  const opened = open(() => g.openChart('docked'));
  check('the galactic chart opens with the overlay off',
    opened.includes('T TRADE OVERLAY &middot;'));
  check('T shows the trade routes', pressT().includes('ROUTES IN FLIGHT'));
  check('...T again shows the prices', pressT().includes('UP DEAR, DOWN CHEAP'));
  check('...and T again turns it off', pressT().includes('T TRADE OVERLAY &middot;'));

  // The mode is the Game's, not the screen's: the short-range chart opens
  // already showing what the galactic chart was left on.
  check('T on the galactic chart shows the routes', pressT().includes('ROUTES IN FLIGHT'));
  const local = open(() => g.openLocalChart('docked'));
  check('...and the short range chart opens on the same overlay',
    local.includes('SHORT RANGE CHART') && local.includes('ROUTES IN FLIGHT'));
  check('...still ringing the danger underneath it',
    local.includes('RED RING: PIRATE ACTIVITY'));
  check('...and prices draw on the short range chart too',
    pressT().includes('UP DEAR, DOWN CHEAP'));

  globals.document = previous;

  check(`a three-system galaxy stays three systems after every overlay is drawn `
    + `on both charts (${before} -> ${living.states.size})`,
  before === 3 && living.states.size === before);
}

// --- and pointing at one, through the real seam -----------------------------
//
// Driven through the SHELL, not by calling the screen: the point of this block
// is that a mousemove reaches a chart at all — shell -> game -> screen host ->
// ChartScreen — and that the chart answers in words. Calling `hoverAt` directly
// would pass on a seam that was never wired.

console.log('\npointing at a lane says what it carries');
{
  const globals = globalThis as unknown as {
    document?: unknown; HTMLCanvasElement?: unknown;
  };
  const previousDoc = globals.document;
  const previousCanvas = globals.HTMLCanvasElement;

  /**
   * A canvas the chart will accept. `chart.ts` asks `instanceof
   * HTMLCanvasElement` before mapping pixels — a browser type node does not
   * have — so the test supplies one and hands back a rect the size of the
   * canvas, which makes client pixels and canvas pixels the same numbers.
   */
  class FakeCanvas {
    width = CHART_CANVAS_W;
    height = CHART_CANVAS_H;
    getBoundingClientRect(): { left: number; top: number; width: number; height: number } {
      return { left: 0, top: 0, width: this.width, height: this.height };
    }
    getContext(): unknown {
      return new Proxy({}, { get: () => () => undefined, set: () => true });
    }
  }
  globals.HTMLCanvasElement = FakeCanvas;

  // A shell that keeps the pointer callback, so the test can move a mouse.
  let move: ((target: unknown, event: unknown) => void) | null = null;
  const shell = { ...headlessShell(), onScreenMove: (fn: (t: unknown, e: unknown) => void) => {
    move = fn;
  } };
  const g = headlessGame(() => shell);

  let painted: string[] = [];
  globals.document = {
    getElementById: (id: string) => (id.endsWith('-canvas') ? new FakeCanvas() : {
      set innerHTML(html: string) { painted.push(html); },
      get innerHTML() { return painted[painted.length - 1] ?? ''; },
      textContent: '',
      dataset: {},
      classList: { add: () => {}, remove: () => {}, toggle: () => {} },
      width: 0,
      height: 0,
    }),
    body: { classList: { add: () => {}, remove: () => {} } },
    querySelectorAll: () => [],
  };

  // One lane, and deliberately NOT one touching the commander's own system:
  // the chart opens with its cursor on that system, so a lane with an end
  // there is already being described and pointing at it would (rightly) not
  // repaint — which would make every assertion below read an empty capture.
  const home = g.state.commander.systemIndex;
  const [from, to] = [...systems]
    .sort((p, q) => distanceSq(systems[home], q) - distanceSq(systems[home], p))
    .slice(0, 2).map((s) => s.index);
  const living = g.state.living;
  living.convoys.length = 0;
  living.day = 10;
  living.convoys.push(
    { from, to, commodity: 0, tonnes: 20, etaDay: 13, intact: true },
    { from: to, to: from, commodity: 3, tonnes: 30, etaDay: 12, intact: true },
  );
  const statesBefore = living.states.size;

  const a = systems[from];
  const b = systems[to];
  /** the lane's midpoint, in the galactic chart's own pixels */
  const at = {
    clientX: ((a.x + b.x) / 2) * (CHART_CANVAS_W / 256),
    clientY: (((a.y + b.y) / 2) / CHART_Y_SQUASH) * (CHART_CANVAS_H / 128),
  };

  withoutSaving(() => {
    g.openChart('docked');
    g.input.injectPress('KeyT'); // routes
    g.step(1 / 60, 0);
  });
  check('the shell offered a pointer seam and the Game took it', move !== null);

  painted = [];
  move!(new FakeCanvas(), at);
  const onLane = painted.join('');
  check(`pointing at the lane names both its systems `
    + `(${a.name.toUpperCase()} / ${b.name.toUpperCase()})`,
  onLane.includes(a.name.toUpperCase()) && onLane.includes(b.name.toUpperCase()));
  check('...how many convoys and how much they carry', onLane.includes('2 CONVOYS')
    && onLane.includes('50t'));
  check('...what is on them', onLane.includes(COMMODITIES[3].name.toUpperCase())
    && onLane.includes(COMMODITIES[0].name.toUpperCase()));
  check('...and when the next one lands', onLane.includes('IN 2 DAYS'));

  // Pointing at nothing gives the cursor's system back.
  painted = [];
  move!(new FakeCanvas(), { clientX: 0, clientY: 0 });
  const offLane = painted.join('');
  check('pointing away from every lane repaints, and without the lane line',
    painted.length > 0 && !offLane.includes('CONVOYS'));

  // A move that changes nothing costs nothing.
  painted = [];
  move!(new FakeCanvas(), at);
  const repaints = painted.length;
  painted = [];
  move!(new FakeCanvas(), { clientX: at.clientX + 0.5, clientY: at.clientY });
  check(`a move within the same lane does not repaint `
    + `(${repaints} then ${painted.length})`, repaints > 0 && painted.length === 0);

  check('pointing at lanes inserted no system state',
    living.states.size === statesBefore);

  globals.document = previousDoc;
  globals.HTMLCanvasElement = previousCanvas;
}
