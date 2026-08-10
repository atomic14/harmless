// The trade overlays: which lanes the charts draw, which prices they mark, and
// the promise 111 made that looking at the galaxy never changes it.
//
// The two models are tested against a REAL advanced galaxy rather than
// hand-built convoy lists, because the numbers the thresholds were chosen
// against (docs/TODO/114) are properties of the simulation, not of a fixture:
// ~240 convoys across ~175 lanes, of which ~45 are busy, and 12-17 systems
// trading far enough off baseline to be worth the jump. A fixture would let
// both the rule and the threshold drift without a test noticing.
//
// Sampled at two advance lengths throughout, per the house rule for anything a
// sampled number decides.

import { generateGalaxy, COMMODITIES } from '../src/galaxy/galaxy.ts';
import { LivingGalaxy, type Convoy } from '../src/galaxy/living.ts';
import { busyLanes } from '../src/galaxy/trade-lanes.ts';
import { divergentSystems } from '../src/galaxy/price-divergence.ts';
import {
  nextOverlay, OVERLAY_CYCLE, overlayLegend, type ChartOverlay,
} from '../src/game/chart-overlay.ts';
import { BUSY_LANE_CONVOYS, PRICE_DIVERGENCE_VISIBLE } from '../src/constants/living-galaxy.ts';
import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { withoutSaving } from '../src/game/storage.ts';
import { makeRng } from '../src/game/rng.ts';
import { check, dismissBriefing, eq } from './harness.ts';

const systems = generateGalaxy(1);
const gradients = COMMODITIES.map((c) => c.gradient);

const drifted = (days: number, seed: number): LivingGalaxy => {
  const living = new LivingGalaxy(systems);
  living.advance(days, gradients, makeRng(seed));
  return living;
};

// --- which lanes are busy ---------------------------------------------------

console.log('\nthe chart draws the lanes with freight on them');

for (const days of [120, 365]) {
  const living = drifted(days, 999);
  const lanes = busyLanes(living.convoys);

  check(`${days} days: every lane drawn carries at least ${BUSY_LANE_CONVOYS} convoys`,
    lanes.length > 0 && lanes.every((l) => l.convoys >= BUSY_LANE_CONVOYS));

  // The point of the threshold: a network, not a scribble. The control is the
  // unfiltered count — without it this passes on an overlay that draws nothing.
  const allPairs = new Set(living.convoys.filter((c) => c.intact)
    .map((c) => `${Math.min(c.from, c.to)}-${Math.max(c.from, c.to)}`));
  check(`${days} days: ${lanes.length} lanes drawn out of ${allPairs.size} with any freight`,
    lanes.length >= 20 && lanes.length <= 80 && lanes.length < allPairs.size / 2);

  // Undirected: no pair may appear twice, in either order.
  const keys = lanes.map((l) => `${l.a}-${l.b}`);
  check(`${days} days: lanes are undirected — no pair drawn twice`,
    new Set(keys).size === keys.length && lanes.every((l) => l.a < l.b));

  // Heaviest first, so a painter that caps the list drops the least freight.
  check(`${days} days: lanes come back heaviest first`,
    lanes.every((l, i) => i === 0 || lanes[i - 1].tonnes >= l.tonnes));

  // The tonnage is the sum of what is actually on the lane, both ways round.
  const heaviest = lanes[0];
  const onIt = living.convoys.filter((c) => c.intact
    && Math.min(c.from, c.to) === heaviest.a && Math.max(c.from, c.to) === heaviest.b);
  eq(`${days} days: the heaviest lane sums its own convoys' tonnage`,
    heaviest.tonnes, onIt.reduce((sum, c) => sum + c.tonnes, 0));
  eq(`${days} days: ...and counts them`, heaviest.convoys, onIt.length);
}

// Both directions of one route are one lane, and lost cargo is not drawn.
{
  const convoy = (from: number, to: number, tonnes: number, intact = true): Convoy =>
    ({ from, to, commodity: 0, tonnes, etaDay: 1, intact });

  const folded = busyLanes([convoy(7, 30, 10), convoy(30, 7, 15)]);
  eq('a route traded both ways is one lane', folded.length, 1);
  eq('...carrying the sum of both directions', folded[0].tonnes, 25);

  check('a lane held up only by lost cargo is not drawn',
    busyLanes([convoy(7, 30, 10), convoy(30, 7, 15, false)]).length === 0);

  check('...and one convoy alone is not a lane',
    busyLanes([convoy(7, 30, 10)]).length === 0);
}

// --- which prices are worth a jump ------------------------------------------

console.log('\nthe chart marks the prices worth a jump');

for (const days of [120, 365]) {
  const living = drifted(days, 999);
  const drift = divergentSystems(systems, (i, c) => living.priceMultiplier(i, c));

  /** The strongest drift at a system, signed — what the model ranks on. */
  const strongest = (index: number): number => {
    let best = 0;
    for (let i = 0; i < COMMODITIES.length; i++) {
      const d = living.priceMultiplier(index, i) - 1;
      if (Math.abs(d) > Math.abs(best)) best = d;
    }
    return best;
  };

  const expected = systems.filter((s) => Math.abs(strongest(s.index)) > PRICE_DIVERGENCE_VISIBLE);
  check(`${days} days: exactly the systems over the threshold are marked `
    + `(${drift.size} of 256)`,
  drift.size === expected.length && expected.every((s) => drift.has(s.index)));

  check(`${days} days: each mark points the way its strongest pressure does`,
    [...drift].every(([index, way]) =>
      way === (strongest(index) > 0 ? 'dear' : 'cheap')));

  // Sparse, and the control: nearly every system has SOME drift, so a model
  // that forgot its threshold would mark almost all 256.
  const anyDrift = systems.filter((s) => Math.abs(strongest(s.index)) > 0).length;
  check(`${days} days: ${drift.size} marked out of ${anyDrift} with any drift at all`,
    drift.size >= 5 && drift.size <= 40 && anyDrift > 200);
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
  const g = withoutSaving(() => {
    const game = new Game(() => headlessShell());
    dismissBriefing(game);
    return game;
  }).value;
  const living = g.state.living;
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
