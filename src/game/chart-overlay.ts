// What the charts are drawing over the stars, and what `T` cycles through.
//
// A neutral module on purpose. `game.ts` owns the current mode, the chart
// screen cycles it and `ui/screens.ts` paints the result, and if the type lived
// in any of those three the other two would have to import it from there —
// which is how `ui/screens.ts` ended up in four of the project's five import
// cycles before `chart-state.ts` was split out. This is the same fix.
//
// The MODEL for each overlay lives beside its rule in `galaxy/`
// (`danger-overlay.ts`, `trade-lanes.ts`, `price-divergence.ts`). This file
// only names the modes and carries the finished result to the painter.

import type { TradeLane } from '../galaxy/trade-lanes.ts';
import type { PriceDrift } from '../galaxy/price-divergence.ts';

/**
 * Off, the trade lanes, or the price tells — one at a time.
 *
 * One at a time is the legibility rule 111 established: the galactic chart is
 * 780x400 with 256 systems on it, and two overlays plus the danger rings is
 * three pictures at once.
 */
export type ChartOverlay = 'none' | 'routes' | 'prices';

/** The order `T` walks, so a third press returns you to where you started. */
export const OVERLAY_CYCLE: readonly ChartOverlay[] = ['none', 'routes', 'prices'];

/** The next mode after this one. */
export function nextOverlay(overlay: ChartOverlay): ChartOverlay {
  return OVERLAY_CYCLE[(OVERLAY_CYCLE.indexOf(overlay) + 1) % OVERLAY_CYCLE.length];
}

/**
 * Everything a chart repaint draws on top of the stars: decided by the models,
 * painted by `ui/screens.ts`, which chooses nothing.
 *
 * `danger` is always populated — a warning, not a view (111). The other two are
 * empty unless their mode is up, which is what lets the painter draw whatever
 * it is given without knowing the mode.
 */
export interface ChartOverlays {
  readonly mode: ChartOverlay;
  readonly danger: ReadonlySet<number>;
  readonly lanes: readonly TradeLane[];
  readonly prices: ReadonlyMap<number, PriceDrift>;
}

/**
 * What the keyline says the overlay is showing. One home for the wording, used
 * by both charts' keylines.
 */
export function overlayLegend(mode: ChartOverlay): string {
  if (mode === 'routes') return 'T TRADE OVERLAY: ROUTES IN FLIGHT';
  if (mode === 'prices') return 'T TRADE OVERLAY: PRICES &mdash; UP DEAR, DOWN CHEAP';
  return 'T TRADE OVERLAY';
}
