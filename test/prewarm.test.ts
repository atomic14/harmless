// The galaxy was trading before you arrived (docs/TODO/117).
//
// A new commander used to open the chart and see nothing moving — not because
// the overlays were broken but because they were telling the truth: day 0, no
// convoys, no system a credit off the 1984 baseline. `prewarm` spends
// PREWARM_DAYS of the real simulation before the first launch, and this file is
// what that number is held to.
//
// Two claims, and they pull in opposite directions:
//
//   ENOUGH HISTORY   a trade network, a few hotspots, prices that have moved —
//                    otherwise the warm-up buys the player nothing.
//   NOT SO MUCH      that LAVE, the world every career starts in, crosses
//                    `DANGER_VISIBLE` and greets a brand-new commander with a
//                    red ring. That is the risk PREWARM_DAYS actually carries,
//                    and raising it is what this file exists to catch.
//
// Sampled at two sizes throughout, per the house rule for a number a sample
// decided. The three seams that must NOT warm — a restored save, a reload, the
// world's own rng stream — are asserted at the end, through a real Game.

import { generateGalaxy, COMMODITIES } from '../src/galaxy/galaxy.ts';
import { LivingGalaxy, prewarm } from '../src/galaxy/living.ts';
import { busyLanes } from '../src/galaxy/trade-lanes.ts';
import { distanceTenths } from '../src/galaxy/navigation.ts';
import { DANGER_VISIBLE, PREWARM_DAYS } from '../src/constants/living-galaxy.ts';
import { MAX_FUEL } from '../src/constants/commander.ts';
import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { random, seedWorld } from '../src/game/rng.ts';
import { withoutSaving } from '../src/game/storage.ts';
import { installStore } from './save-fixtures.ts';
import { check, dismissBriefing, eq } from './harness.ts';

const g1 = generateGalaxy(1);
const gradients = COMMODITIES.map((c) => c.gradient);

/** A galaxy with a past, as a new career gets one. */
const warmed = (seed: number): LivingGalaxy => {
  const living = new LivingGalaxy(g1);
  prewarm(living, seed);
  return living;
};

/** How many of the 256 have moved off the 1984 price baseline at all. */
const driftedSystems = (living: LivingGalaxy): number =>
  g1.filter((sys) => COMMODITIES
    .some((_, i) => living.priceMultiplier(sys.index, i) !== 1)).length;

const ringed = (living: LivingGalaxy): number =>
  g1.filter((sys) => living.danger(sys.index) > DANGER_VISIBLE).length;

// --- a new career inherits a working economy --------------------------------

console.log('\na new commander inherits a galaxy with a history');

for (const seed of [12_345, 4_242]) {
  const living = warmed(seed);
  const lanes = busyLanes(living.convoys).length;
  const rings = ringed(living);
  const drifted = driftedSystems(living);

  eq(`seed ${seed}: the warm-up spends exactly PREWARM_DAYS`, living.day, PREWARM_DAYS);
  check(`seed ${seed}: the chart has a trade network to draw (${lanes} busy lanes)`,
    lanes > 20);
  check(`seed ${seed}: somewhere has already earned a red ring (${rings} systems)`,
    rings >= 1);
  check(`seed ${seed}: prices have moved at more than half the galaxy (${drifted}/256)`,
    drifted > 128);
  // The control: none of the above is true of the galaxy this replaced.
  const cold = new LivingGalaxy(g1);
  check(`seed ${seed}: ...where a cold galaxy has none of it (the control)`,
    cold.day === 0 && busyLanes(cold.convoys).length === 0
    && ringed(cold) === 0 && driftedSystems(cold) === 0);
}

// --- and Lave is still somewhere to start -----------------------------------
//
// The bound on PREWARM_DAYS, and the one number that is worth 200 warm-ups a
// run. Measured over 400 seeds while choosing it: at 30 days Lave's worst is
// 0.347 and it NEVER crosses 0.4; at 60 days one seed in 400 reaches 0.479 and
// at 90 days three in 200 do (worst 0.507) — a brand-new save whose starting
// world the chart rings in red.
//
// So the check bites where it matters: this file's 200 seeds fail outright at
// 90 days (seed 53 alone, 0.422), and at 60 they run to 0.372 — 93% of the
// threshold, on a margin that is 0.347 at the shipped 30. It is the sample size
// that decides whether the gate catches a doubling, which is why the smaller
// one is here beside it rather than instead of it.

console.log('\nLave is safe to start in, whatever the seed');

for (const seeds of [24, 200]) {
  let worst = 0;
  let worstSeed = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const d = warmed(seed).danger(7);
    if (d > worst) { worst = d; worstSeed = seed; }
  }
  check(`${seeds} seeds: Lave is never ringed (worst ${worst.toFixed(3)} at seed ${
    worstSeed}, against ${DANGER_VISIBLE})`, worst < DANGER_VISIBLE);
}

// Not a vacuous pass: Lave DOES take convoy losses at some seeds, so this is a
// margin rather than a constant zero.
check('...and the measurement can move at all — some seed leaves Lave marked',
  [...Array(24)].some((_, i) => warmed(i + 1).danger(7) > 0));

// --- the same seed is the same galaxy ---------------------------------------

console.log('\nthe warm-up is reproducible, and off the world\'s own stream');
{
  const a = JSON.stringify(warmed(777).save());
  const b = JSON.stringify(warmed(777).save());
  check('the same seed warms to the same galaxy, byte for byte', a === b);
  check('...and a different seed does not (the control)',
    a !== JSON.stringify(warmed(778).save()));
}

// THE WORLD STREAM IS UNTOUCHED. The warm-up runs on `makeRng`, so the seeded
// pins that hold the rest of the game still — test/game.test.ts's 400-frame
// trace, test/galaxy.test.ts's determinism block — are pinning the same draws
// they always were. Move it onto `random()` and this fails.
{
  seedWorld(31_415);
  const untouched = [...Array(20)].map(() => random());
  seedWorld(31_415);
  prewarm(new LivingGalaxy(g1), 999);
  const afterWarming = [...Array(20)].map(() => random());
  check('warming a galaxy draws nothing from the world stream',
    untouched.join() === afterWarming.join());
  // The control: something that DOES draw from it moves those same 20 numbers.
  seedWorld(31_415);
  new LivingGalaxy(g1).advance(1, gradients);
  check('...where one day on the world stream does move them (the control)',
    untouched.join() !== [...Array(20)].map(() => random()).join());
}

// --- through a real Game: warmed once, and only where nothing was saved ------

console.log('\na career warms once; a reload resumes the galaxy it saved');
{
  const globals = globalThis as unknown as { document?: unknown };
  const inherited = globals.document;
  globals.document = undefined;
  const { restore } = installStore();
  try {
    seedWorld(20_260_810);
    const first = new Game(() => headlessShell());
    dismissBriefing(first);
    eq('a fresh career boots into a galaxy with a past',
      first.state.living.day, PREWARM_DAYS);
    check('...with freight in flight and hotspots on the chart',
      busyLanes(first.state.living.convoys).length > 20 && ringed(first.state.living) >= 1);

    // Fly it on a few days, then take the checkpoint that writes `galaxyState`.
    first.state.living.advance(11, gradients);
    first.enterDocked();
    const saved = first.state.living.day;
    eq('the galaxy the checkpoint saved is 11 days past the warm-up',
      saved, PREWARM_DAYS + 11);

    seedWorld(20_260_810);
    const reloaded = new Game(() => headlessShell());
    dismissBriefing(reloaded);
    eq('a reload resumes THAT galaxy, not a second warm-up on top of it',
      reloaded.state.living.day, saved);
    check('...and its convoys came off the shelf, not out of a fresh 30 days',
      JSON.stringify(reloaded.state.living.save().convoys)
      === JSON.stringify(first.state.living.save().convoys));
  } finally {
    restore();
    globals.document = inherited;
  }
}

// --- a galactic jump arrives in a galaxy of its own --------------------------
//
// `galacticJump` used to swap `state.systems` and keep the SAME LivingGalaxy,
// so galaxy 2's system 7 wore galaxy 1's danger and price pressure and every
// convoy in flight named two systems it had never flown between. Cold that was
// a quiet wrong; warmed it is a loud one.

console.log('\na galactic jump lands in a galaxy whose economy is its own');
{
  const globals = globalThis as unknown as { document?: unknown };
  const inherited = globals.document;
  globals.document = undefined;
  const { restore } = installStore();
  try {
    seedWorld(20_260_811);
    const g = withoutSaving(() => {
      const game = new Game(() => headlessShell());
      dismissBriefing(game);
      return game;
    }).value;
    g.state.living.advance(11, gradients);   // so the old day is distinguishable
    const before = g.state.living;
    const strandedConvoys = [...before.convoys];
    withoutSaving(() => {
      g.state.commander.equipment.galacticDrive = true;
      g.launch();
      g.galacticJump();
    });

    eq('the jump landed in galaxy 2', g.state.commander.galaxy, 2);
    check('the living galaxy was rebuilt, not carried across',
      g.state.living !== before);
    eq('...and its clock starts at the warm-up, not the day it left',
      g.state.living.day, PREWARM_DAYS);
    check('...with an economy of its own to arrive into',
      busyLanes(g.state.living.convoys).length > 20);

    // Trade is local by construction: `LivingGalaxy` only ships between systems
    // within one tank of each other. Convoys carried over from another galaxy
    // are not, which is what makes this an assertion rather than a tautology.
    const local = (from: number, to: number): boolean =>
      distanceTenths(g.state.systems[from], g.state.systems[to]) <= MAX_FUEL;
    check('every convoy in flight names two systems in THIS galaxy',
      g.state.living.convoys.every((c) => local(c.from, c.to)));
    check('...where the galaxy left behind had convoys that make no sense here '
      + '(the control)',
    strandedConvoys.length > 0 && strandedConvoys.some((c) => !local(c.from, c.to)));
  } finally {
    restore();
    globals.document = inherited;
  }
}
