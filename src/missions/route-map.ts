// The route a commander flew, as a picture: a chart of the galaxy with the
// worlds a story names joined in order.
//
// Pure, and it returns SVG text. The LOG screen puts it in the page, and the
// site page (item 193 of docs/TODO/190) can put the same text in a file. It
// draws the chart's own projection: x across, y at half height, as every
// chart in the game does (constants/chart-metric.ts).

import type { StarSystem } from '../galaxy/galaxy.ts';
import { CHART_SPAN_X, CHART_SPAN_Y, CHART_Y_SQUASH } from '../constants/chart-metric.ts';

/**
 * The map, or '' when there is no world to draw.
 *
 * Every system is a faint dot. The visited worlds are joined by one line and
 * marked, so a reader sees the shape of the journey against the galaxy.
 */
export function routeMapSvg(
  systems: readonly StarSystem[], worlds: readonly number[],
): string {
  if (worlds.length === 0) return '';
  const px = (s: StarSystem): number => s.x;
  const py = (s: StarSystem): number => s.y / CHART_Y_SQUASH;
  const dots = systems.map((s) => `<circle cx="${px(s)}" cy="${py(s)}" r="0.6" class="star"/>`).join('');
  const path = worlds.map((i) => `${px(systems[i])},${py(systems[i])}`).join(' ');
  const marks = worlds.map((i) =>
    `<circle cx="${px(systems[i])}" cy="${py(systems[i])}" r="2" class="visited"/>`).join('');
  return `<svg class="route-map" viewBox="0 0 ${CHART_SPAN_X} ${CHART_SPAN_Y}" role="img" aria-label="the route flown">`
    + `<g fill="currentColor" opacity="0.35">${dots}</g>`
    + `<polyline points="${path}" fill="none" stroke="currentColor" stroke-width="0.8"/>`
    + `<g fill="none" stroke="currentColor" stroke-width="0.8">${marks}</g>`
    + '</svg>';
}
