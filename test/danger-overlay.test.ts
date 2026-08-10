// The charts' danger overlay: the rule that flags a system, and the promise
// that looking at the galaxy does not change it.
//
// Two things are worth testing here and they are not the same thing.
//
//   1. THE RULE. `dangerousSystems` must flag exactly the systems the data
//      screen would call dangerous — one threshold, two surfaces, so the ring
//      and the news line can never disagree. Sampled at two advance lengths,
//      per the house rule that a sampled number is checked at two sizes.
//   2. THE READ. `LivingGalaxy.state()` INSERTS a system state when one is
//      missing. A painter that reached for it would quietly write 256 entries
//      into the save every time the player opened a chart. The existing
//      draw-twice snapshot test cannot see this — `save()` skips untouched
//      systems — so the assertion here is the gate, and it is written against
//      the wiring (ChartContext → ChartScreen), which is where the mistake
//      would actually be made.

import { generateGalaxy, COMMODITIES } from '../src/galaxy/galaxy.ts';
import { LivingGalaxy } from '../src/galaxy/living.ts';
import { dangerousSystems } from '../src/galaxy/danger-overlay.ts';
import { DANGER_VISIBLE } from '../src/constants/living-galaxy.ts';
import { ChartScreen, type ChartContext } from '../src/game/screens/chart.ts';
import { newCommander } from '../src/game/commander.ts';
import { inertElement } from '../src/engine/inert-dom.ts';
import { makeRng } from '../src/game/rng.ts';
import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { withoutSaving } from '../src/game/storage.ts';
import { check, dismissBriefing } from './harness.ts';

console.log('\nthe charts ring the danger the news already reports');

const systems = generateGalaxy(1);
const gradients = COMMODITIES.map((c) => c.gradient);

/** A galaxy left to trade (and lose convoys) for `days`, on a pinned seed. */
const drifted = (days: number, seed: number): LivingGalaxy => {
  const living = new LivingGalaxy(systems);
  living.advance(days, gradients, makeRng(seed));
  return living;
};

// --- the rule ---------------------------------------------------------------

for (const days of [120, 365]) {
  const living = drifted(days, 999);
  const flagged = dangerousSystems(systems, (i) => living.danger(i));
  const expected = systems.filter((s) => living.danger(s.index) > DANGER_VISIBLE);

  check(`${days} days: the flagged set is exactly the systems over the threshold `
    + `(${flagged.size} of 256)`,
  flagged.size === expected.length && expected.every((s) => flagged.has(s.index)));

  // The ring and the headline are the same fact. If one drifts off the shared
  // constant this is what notices.
  const reported = systems.filter((s) =>
    living.headline(s.index) === 'Merchants report heavy pirate activity in this system.');
  check(`${days} days: every system the data screen calls dangerous is ringed`,
    reported.length === 0 || reported.every((s) => flagged.has(s.index)));

  // A sparse overlay is the whole legibility argument: 256 dots at ~3px on the
  // galactic chart, and a ring on most of them would say nothing.
  check(`${days} days: the overlay stays sparse (${flagged.size} rings)`,
    flagged.size < 40);

  // Lave is where every commander starts. galaxy.test.ts pins danger(7) < 0.35;
  // the threshold is 0.4, so a new commander's home must never be ringed.
  check(`${days} days: Lave is not ringed for a new commander `
    + `(danger ${living.danger(7).toFixed(3)})`,
  !flagged.has(7));
}

// A control: without it the assertions above pass on an overlay that flags
// nothing at all.
{
  const living = drifted(365, 999);
  const flagged = dangerousSystems(systems, (i) => living.danger(i));
  check(`the overlay finds something to flag (${flagged.size} systems)`, flagged.size > 0);
}

// --- drawing does not create state ------------------------------------------

console.log('\nopening a chart does not write to the galaxy');
{
  const globals = globalThis as unknown as { document?: unknown };
  const previous = globals.document;
  // A document whose every element is the inert sink: `show()` writes markup
  // nowhere and both canvases hand back a no-op 2D context.
  globals.document = {
    getElementById: () => inertElement(),
    body: { classList: { add: () => {}, remove: () => {} } },
  };

  /** Open both charts on this galaxy and report how many states appeared. */
  const inserted = (living: LivingGalaxy): number => {
    const before = living.states.size;
    const commander = newCommander();
    const context: ChartContext = {
      commander,
      systems,
      system: systems[commander.systemIndex],
      chart: { cursorX: 0, cursorY: 0, targetIndex: null },
      viewData: () => {},
      priceMultiplier: (index, commodity) => living.priceMultiplier(index, commodity),
      danger: (index) => living.danger(index),
      convoys: living.convoys,
      day: living.day,
      overlay: 'none',
      cycleOverlay: () => {},
    };
    new ChartScreen('chart', () => context).open();
    new ChartScreen('local', () => context).open();
    return living.states.size - before;
  };

  // NOT a freshly advanced galaxy: `advance` walks all 256 systems and so
  // materialises all 256 states, and against that map the assertion would hold
  // no matter what the painter did. Two sparse maps instead.

  // 1. A near-empty galaxy. The loudest form of the gate: a painter reading
  //    `state()` takes this from 2 to 256.
  const seeded = new LivingGalaxy(systems);
  seeded.state(30).danger = 0.7;
  seeded.state(60).danger = 0.5;
  const seededBefore = seeded.states.size;
  const seededGrew = inserted(seeded);
  check(`a two-system galaxy stays two systems after both charts are drawn `
    + `(${seededBefore} + ${seededGrew})`,
  seededBefore === 2 && seededGrew === 0);

  // 2. And the shape a returning player actually has: a year of trade, saved
  //    (which drops the systems that came back to rest) and loaded again.
  const loaded = new LivingGalaxy(systems);
  loaded.load(drifted(365, 999).save());
  const loadedBefore = loaded.states.size;
  const loadedGrew = inserted(loaded);
  check(`a loaded save of ${loadedBefore} drifted systems is not already all 256 `
    + '(the control)', loadedBefore > 0 && loadedBefore < 256);
  check(`drawing both charts over it inserted nothing (${loadedGrew} new states)`,
    loadedGrew === 0);

  globals.document = previous;
}

// The same promise, through the wiring the player actually uses. The block
// above builds its own ChartContext, so it cannot see a `game.ts` that hands
// the screen `state(i).danger` instead of `danger(i)` — and that is exactly
// where the mistake would be made.
{
  const g = withoutSaving(() => {
    const game = new Game(() => headlessShell());
    dismissBriefing(game);
    return game;
  }).value;
  const living = g.state.living;
  living.state(30).danger = 0.7;
  living.state(60).danger = 0.5;
  const before = living.states.size;

  withoutSaving(() => {
    g.openChart('docked');
    g.step(1 / 60, 0);
    g.openLocalChart('docked');
    g.step(1 / 60, 0);
  });

  check(`a real Game opens both charts without touching the galaxy `
    + `(${before} systems before, ${living.states.size} after)`,
  before === 2 && living.states.size === before);
}
