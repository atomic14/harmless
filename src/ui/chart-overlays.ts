// What is painted OVER the stars, on either chart.
//
// Split out of `ui/screens.ts` by docs/TODO/149. Both maps draw the same marks:
// the contract and mission diamonds, the trade lanes, and the price tells. They
// are here rather than in either chart, so that one overlay rule has one home.
// Two copies of a diamond is the failure the size gate exists to prevent.
//
// A DIAMOND, NOT A SECOND RING, and the shape carries which fact it is. The
// jump target is already an amber circle, so a ring here would read as the
// target. That reasoning travels with `drawContractMarks` below.
//
// Which systems are marked, which lanes exist and which prices drifted are all
// decided elsewhere — `game/orders.ts`, `galaxy/trade-lanes.ts` and
// `galaxy/price-divergence.ts`. This file paints what it is handed.

import { type StarSystem, COMMODITIES } from '../galaxy/galaxy.ts';
import { HUD, TINT } from '../palette.ts';

import { type ChartOverlays } from '../game/chart-overlay.ts';
import { type PriceDrift } from '../galaxy/price-divergence.ts';
import { type TradeLane } from '../galaxy/trade-lanes.ts';
import { LANE_CARGO_NAMED, LANE_FADE_FLOOR } from '../constants/chart-overlay.ts';

/**
 * A diamond around every system a standing order sends this commander to — on
 * both charts. The set is `orderDestinations` (game/orders.ts).
 *
 * ALWAYS DRAWN, beside the danger ring and for the same reason. A commitment
 * you accepted is a warning rather than a view. 111's one-picture rule governs
 * the overlays that `T` cycles.
 *
 * A DIAMOND, and not a second amber circle. The jump target is already an amber
 * circle, so a ring here would read as the target. The shape carries which fact
 * it is, and the colour carries the tone. Both marks on one system still read,
 * because the diamond's points sit outside the target ring.
 */
export function drawContractMarks(
  ctx: CanvasRenderingContext2D,
  marks: ReadonlySet<number>,
  systems: StarSystem[],
  px: (s: { x: number; y: number }) => number,
  py: (s: { x: number; y: number }) => number,
  reach: number,
): void {
  ctx.strokeStyle = HUD.amber;
  for (const index of marks) {
    const s = systems[index];
    if (!s) continue;
    const x = px(s);
    const y = py(s);
    ctx.beginPath();
    ctx.moveTo(x, y - reach);
    ctx.lineTo(x + reach, y);
    ctx.lineTo(x, y + reach);
    ctx.lineTo(x - reach, y);
    ctx.closePath();
    ctx.stroke();
  }
}
/**
 * The trade lanes, faded by how much freight is on them — on both charts.
 *
 * Alpha rather than a second green. The busiest lane in the galaxy and the
 * quietest one drawn must not read alike. A brightness ramp spelled in new hex
 * would be four more rungs on the chart ladder in src/palette.ts.
 *
 * The floor keeps the quietest lane visible. Without it the tail vanishes, and
 * the threshold might as well drop it.
 *
 * The lane under the pointer is drawn last, at full strength. So the line you
 * read about is the one that stands out.
 */
export function drawLanes(
  ctx: CanvasRenderingContext2D,
  overlays: ChartOverlays,
  systems: StarSystem[],
  px: (s: { x: number; y: number }) => number,
  py: (s: { x: number; y: number }) => number,
): void {
  if (!overlays.lanes.length) return;
  // heaviest first out of busyLanes(), so the head is the scale
  const heaviest = overlays.lanes[0].tonnes || 1;
  const stroke = (lane: TradeLane, alpha: number): void => {
    const a = systems[lane.a];
    const b = systems[lane.b];
    if (!a || !b) return;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(px(a), py(a));
    ctx.lineTo(px(b), py(b));
    ctx.stroke();
  };

  ctx.strokeStyle = TINT.lane;
  for (const lane of overlays.lanes) {
    if (lane === overlays.hovered) continue;
    stroke(lane, LANE_FADE_FLOOR + (1 - LANE_FADE_FLOOR) * (lane.tonnes / heaviest));
  }
  if (overlays.hovered) {
    // the one the pilot reads about, in the brighter green an in-range system
    // takes
    ctx.strokeStyle = HUD.green;
    stroke(overlays.hovered, 1);
  }
  // EVERY dot, ring, tick and crosshair after this shares the context
  ctx.globalAlpha = 1;
}
/**
 * What the lane under the pointer holds, in one line.
 *
 * Presentation, not a rule. `galaxy/trade-lanes.ts` decided which lane it is
 * and what is on it. This only spells it. That is why the commodity NAMES and
 * the "in N days" arithmetic live here rather than in the model.
 */
export function laneSummaryParts(lane: TradeLane, systems: StarSystem[], day: number): [string, string] {
  const cargo = lane.commodities.slice(0, LANE_CARGO_NAMED)
    .map((c) => COMMODITIES[c]?.name.toUpperCase()).filter(Boolean);
  const more = lane.commodities.length - cargo.length;
  const days = lane.soonestEta - day;
  const arrival = days <= 0 ? 'ARRIVING NOW'
    : days === 1 ? 'NEXT ARRIVAL TOMORROW'
      : `NEXT ARRIVAL IN ${days} DAYS`;
  // Literal · and ↔ rather than &middot; and &harr;. This reads as HTML on the
  // galactic chart's keyline, and it is painted into the canvas on the
  // short-range one. Only the characters themselves work in both.
  return [
    `${systems[lane.a]?.name.toUpperCase()} ↔ ${systems[lane.b]?.name.toUpperCase()}`
      + ` · ${lane.convoys} CONVOYS · ${lane.tonnes}t`,
    `${cargo.join(', ')}${more > 0 ? ` +${more}` : ''} · ${arrival}`,
  ];
}
/**
 * The whole line, for the galactic chart's keyline — which has the page's full
 * width. The short-range chart paints the two halves on two lines instead: its
 * canvas is 560px and the joined line runs off the end of it.
 */
export const laneSummary = (lane: TradeLane, systems: StarSystem[], day: number): string =>
  laneSummaryParts(lane, systems, day).join(' · ');
/**
 * A tick above a system trading dear, below one trading cheap — on both charts.
 *
 * The tell is a SHAPE and a DIRECTION rather than a second colour scale. The
 * palette is green and amber, and src/palette.ts owns it. It has no blue. A
 * blue made up for a price would be a fifth colour in a game that has four.
 *
 * Amber is the one the target marker already uses. Cheap borrows the green a
 * world in range is drawn in: the same invitation, said twice.
 *
 * Up and down carry the sense. So a reader who cannot separate the two greens
 * still gets it right.
 */
export function drawPriceTells(
  ctx: CanvasRenderingContext2D,
  prices: ReadonlyMap<number, PriceDrift>,
  systems: StarSystem[],
  px: (s: { x: number; y: number }) => number,
  py: (s: { x: number; y: number }) => number,
  reach: number,
): void {
  for (const [index, drift] of prices) {
    const s = systems[index];
    if (!s) continue;
    const up = drift === 'dear';
    ctx.strokeStyle = up ? HUD.amber : TINT.lift;
    const x = px(s);
    const y = py(s);
    // The tail starts clear of the dot rather than on it. At 2.5px a system, a
    // tick that began at the centre read as a blob rather than an arrow.
    const tip = up ? y - reach : y + reach;
    const base = up ? y - reach * 0.55 : y + reach * 0.55;
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.lineTo(x, tip);
    // the arrowhead, two strokes off the tip
    ctx.moveTo(x - 2.5, up ? tip + 2.5 : tip - 2.5);
    ctx.lineTo(x, tip);
    ctx.lineTo(x + 2.5, up ? tip + 2.5 : tip - 2.5);
    ctx.stroke();
  }
}
