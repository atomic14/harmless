// The trade overlay's MODELS: which lanes the charts draw, which systems they
// mark for price, and which lane a point on the chart is pointing at.
//
// Tested against a REAL advanced galaxy rather than hand-built convoy lists,
// because the numbers the thresholds were chosen against (docs/TODO/114) are
// properties of the simulation, not of a fixture: ~240 convoys across ~175
// lanes, of which ~45 are busy, and 12-17 systems trading far enough off
// baseline to be worth the jump. A fixture would let both the rule and the
// threshold drift without a test noticing.
//
// Sampled at two advance lengths throughout, per the house rule for anything a
// sampled number decides. The SCREEN that uses all of this — the T cycle, the
// hover, and the promise that drawing never writes to the galaxy — is
// test/chart-overlay.test.ts, which drives a headless Game instead.

import { generateGalaxy, COMMODITIES, type StarSystem } from '../src/galaxy/galaxy.ts';
import { LivingGalaxy, type Convoy } from '../src/galaxy/living.ts';
import { busyLanes, nearestLane, type TradeLane } from '../src/galaxy/trade-lanes.ts';
import { distanceSqToSegment } from '../src/galaxy/navigation.ts';
import { divergentSystems } from '../src/galaxy/price-divergence.ts';
import { BUSY_LANE_CONVOYS, PRICE_DIVERGENCE_VISIBLE } from '../src/constants/living-galaxy.ts';
import { makeRng } from '../src/game/rng.ts';
import { check, eq } from './harness.ts';

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

// --- pointing at a lane -----------------------------------------------------
//
// The hit-test is the whole interaction: it is what makes a drawn line
// something you can ask a question of. It runs in the chart metric (y at half
// weight, `CHART_Y_SQUASH`), so a lane is picked at the distance it LOOKS on
// either chart rather than at its distance in raw chart units.

console.log('\npointing at a lane finds it');
{
  const near = (ax: number, ay: number, bx: number, by: number, x: number, y: number): number =>
    distanceSqToSegment({ x: ax, y: ay }, { x: bx, y: by }, x, y);

  // y is halved by the metric, so a lane along y is half as long as it looks
  eq('a point on the lane is on the lane', near(0, 0, 10, 0, 5, 0), 0);
  eq('...as is either end', near(0, 0, 10, 0, 10, 0), 0);
  eq('the perpendicular distance is the distance', near(0, 0, 10, 0, 5, 6), 9);

  // A SEGMENT, not the infinite line through it: past the end, the end is what
  // is measured. Without the clamp this would still read 0.
  eq('past the end, the end is measured, not the line it lies on',
    near(0, 0, 10, 0, 14, 0), 16);
  eq('...at the other end too', near(0, 0, 10, 0, -3, 0), 9);

  // A lane whose two systems sit at the same chart point is a point.
  eq('a zero-length lane is a point', near(5, 5, 5, 5, 5, 9), 4);
}

console.log('\nthe nearest lane wins, and only within reach');
{
  const lane = (a: number, b: number, tonnes: number): TradeLane =>
    ({ a, b, convoys: 2, tonnes, commodities: [0], soonestEta: 1 });
  // four systems making two lanes that cross near (5, 0)
  const grid = [
    { index: 0, x: 0, y: 0 }, { index: 1, x: 10, y: 0 },
    { index: 2, x: 5, y: -20 }, { index: 3, x: 5, y: 20 },
  ] as StarSystem[];
  const lanes = [lane(0, 1, 90), lane(2, 3, 40)];

  check('the lane under the point is the one returned',
    nearestLane(lanes, grid, 2, 0, 3) === lanes[0]);
  check('...and the other one when the point is on it',
    nearestLane(lanes, grid, 5, 8, 3) === lanes[1]);
  check('out of reach is no lane at all', nearestLane(lanes, grid, 40, 40, 3) === null);
  check('an empty overlay picks nothing', nearestLane([], grid, 0, 0, 3) === null);
}

// --- what the lane says it carries ------------------------------------------

console.log('\na lane knows its cargo and when the next load lands');
{
  const convoy = (from: number, to: number, commodity: number, tonnes: number, eta: number) =>
    ({ from, to, commodity, tonnes, etaDay: eta, intact: true });

  const [lane] = busyLanes([
    convoy(7, 30, 0, 5, 9),
    convoy(30, 7, 3, 20, 4),
    convoy(7, 30, 3, 6, 7),
  ]);
  eq('the cargo is listed heaviest first', lane.commodities.join(','), '3,0');
  eq('...distinctly, however many convoys carry it', lane.commodities.length, 2);
  eq('the soonest arrival is the soonest', lane.soonestEta, 4);
}

for (const days of [120, 365]) {
  const living = drifted(days, 999);
  const lanes = busyLanes(living.convoys);
  check(`${days} days: every lane names cargo and an arrival still to come`,
    lanes.every((l) => l.commodities.length > 0 && l.commodities.length <= COMMODITIES.length
      && l.soonestEta >= living.day));
}
