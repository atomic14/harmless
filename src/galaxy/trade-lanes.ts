// Which routes the charts draw as trade lanes — the model half of the routes
// overlay.
//
// There are ~240 convoys in flight at any moment across ~175 distinct pairs of
// systems, and drawing every one of them turns the galactic chart into a
// scribble. What makes a NETWORK legible is the busy lanes: the pairs with more
// than one load on them right now. That is `BUSY_LANE_CONVOYS`, and it lands on
// ~45 lanes at every sample the plan measured.
//
// Same shape and same reasons as `danger-overlay.ts`: a model that decides,
// beside the rule rather than in the painter (docs/ARCHITECTURE.md, invariant
// 10), so the rule can be tested without a canvas.
//
// It reads `convoys`, which is a plain public array — a pure read, unlike
// `LivingGalaxy.state()`, which would insert.

import { BUSY_LANE_CONVOYS } from '../constants/living-galaxy.ts';
import { distanceSqToSegment } from './navigation.ts';
import type { StarSystem } from './galaxy.ts';
import type { Convoy } from './living.ts';

/** One route with freight on it, both directions folded together. */
export interface TradeLane {
  /** the lower system index of the pair — lanes are undirected */
  a: number;
  b: number;
  /** how many convoys are on it right now */
  convoys: number;
  /** how much they are carrying, in tonnes */
  tonnes: number;
  /**
   * What is on it: commodity indices, distinct, heaviest cargo first — so a
   * detail line that runs out of room drops the shipment nobody would have
   * asked about.
   */
  commodities: number[];
  /** the day the next of them lands, for "next arrival in N days" */
  soonestEta: number;
}

/**
 * The lanes worth drawing, heaviest first.
 *
 * UNDIRECTED, because direction changes per convoy and a 30–40 px line at
 * chart scale cannot carry an arrowhead; folding the two ways a pair trades
 * into one lane also halves the lines where trade runs both ways.
 *
 * Cargo already lost (`intact: false`) is skipped: it never arrives, so drawing
 * it would promise freight that is not coming. Those losses surface instead as
 * the danger ring at the destination, which is what a lost convoy actually
 * leaves behind.
 *
 * Heaviest first so a painter that ever caps the list drops the least
 * interesting lanes rather than an arbitrary tail.
 */
export function busyLanes(convoys: readonly Convoy[]): TradeLane[] {
  const lanes = new Map<number, TradeLane>();
  /** tonnage per commodity per lane, so the cargo list can be ranked */
  const cargo = new Map<number, Map<number, number>>();
  for (const c of convoys) {
    if (!c.intact) continue;
    const a = Math.min(c.from, c.to);
    const b = Math.max(c.from, c.to);
    // one key per unordered pair; 256 systems, so the high index is safe to
    // pack into the upper bits rather than build a string per convoy
    const key = a * 256 + b;
    const lane = lanes.get(key)
      ?? { a, b, convoys: 0, tonnes: 0, commodities: [], soonestEta: c.etaDay };
    lane.convoys += 1;
    lane.tonnes += c.tonnes;
    lane.soonestEta = Math.min(lane.soonestEta, c.etaDay);
    lanes.set(key, lane);
    const byCommodity = cargo.get(key) ?? new Map<number, number>();
    byCommodity.set(c.commodity, (byCommodity.get(c.commodity) ?? 0) + c.tonnes);
    cargo.set(key, byCommodity);
  }
  for (const [key, lane] of lanes) {
    lane.commodities = [...(cargo.get(key) ?? new Map<number, number>())]
      .sort((x, y) => y[1] - x[1])
      .map(([commodity]) => commodity);
  }
  return [...lanes.values()]
    .filter((lane) => lane.convoys >= BUSY_LANE_CONVOYS)
    .sort((x, y) => y.tonnes - x.tonnes);
}

/**
 * The lane under a chart coordinate, or null — what turns pointing at a line
 * into reading it.
 *
 * `within` is a tolerance in chart units, because a pixel is a different
 * distance on each chart; the caller converts, as `clickAt`'s snap radius
 * already does. Nearest wins, and a tie goes to the heavier lane: `lanes`
 * arrives heaviest-first, and only a STRICTLY nearer lane displaces one, so
 * where two cross at a point the eye was more likely aiming at the busier.
 */
export function nearestLane(
  lanes: readonly TradeLane[],
  systems: readonly StarSystem[],
  x: number,
  y: number,
  within: number,
): TradeLane | null {
  let best: TradeLane | null = null;
  let bestD = within * within;
  for (const lane of lanes) {
    const a = systems[lane.a];
    const b = systems[lane.b];
    if (!a || !b) continue;
    const d = distanceSqToSegment(a, b, x, y);
    if (d < bestD) { bestD = d; best = lane; }
  }
  return best;
}
