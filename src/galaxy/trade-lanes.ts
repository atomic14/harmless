// Which routes the charts draw as trade lanes — the model half of the routes
// overlay.
//
// About 240 convoys are in flight at any moment, across about 175 distinct
// pairs of systems. Every one of them drawn turns the galactic chart into a
// scribble.
//
// What makes a NETWORK legible is the busy lanes: the pairs with more than one
// load on them right now. That is `BUSY_LANE_CONVOYS`, and it lands on about 45
// lanes at every sample the plan measured.
//
// Same shape and same reasons as `danger-overlay.ts`. It is a model that
// decides, beside the rule rather than in the painter (docs/ARCHITECTURE.md,
// invariant 10). So a test drives the rule with no canvas.
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
  /** how much they hold, in tonnes */
  tonnes: number;
  /**
   * What is on it: commodity indices, distinct, heaviest cargo first. So a
   * detail line that runs out of room drops the shipment nobody asks about.
   */
  commodities: number[];
  /** the day the next of them lands, for "next arrival in N days" */
  soonestEta: number;
}

/**
 * The lanes worth drawing, heaviest first.
 *
 * UNDIRECTED, for two reasons. Direction changes per convoy, and a 30–40 px
 * line at chart scale cannot carry an arrowhead. One lane per pair also halves
 * the lines where trade runs both ways.
 *
 * Cargo already lost (`intact: false`) is skipped. It never arrives, so a line
 * for it would promise freight that will not come. Those losses surface
 * instead as the danger ring at the destination, which is what a lost convoy
 * really leaves behind.
 *
 * Heaviest first, so that a painter which ever caps the list drops the
 * quietest lanes rather than an arbitrary tail.
 */
export function busyLanes(convoys: readonly Convoy[]): TradeLane[] {
  const lanes = new Map<number, TradeLane>();
  /** tonnage per commodity per lane, so the cargo list can be ranked */
  const cargo = new Map<number, Map<number, number>>();
  for (const c of convoys) {
    if (!c.intact) continue;
    const a = Math.min(c.from, c.to);
    const b = Math.max(c.from, c.to);
    // one key per unordered pair. There are 256 systems, so the high index
    // packs safely into the upper bits, and no convoy needs a string key.
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
 * The lane under a chart coordinate, or null. It is what turns a pointer at a
 * line into a line the pilot can read.
 *
 * `within` is a tolerance in chart units, because a pixel is a different
 * distance on each chart. The caller converts, as `clickAt`'s snap radius
 * already does.
 *
 * Nearest wins, and a tie goes to the heavier lane. `lanes` arrives
 * heaviest-first, and only a STRICTLY nearer lane displaces one. So where two
 * lanes cross at a point, the eye more likely meant the busier one.
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
