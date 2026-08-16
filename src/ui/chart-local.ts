// The short range chart: the neighbours a full tank can reach.
//
// Split out of `ui/screens.ts` by docs/TODO/149 — see `chart-galactic.ts` for
// why the two charts are two files.
//
// Centred on where she stands rather than on the galaxy, so this is the chart
// that answers "where can I go next". It carries the market estimate beside it
// for that reason: the question a player asks of a neighbour is what it pays.

import { type StarSystem, ECONOMY_NAMES, GOVERNMENT_NAMES, speciesName } from '../galaxy/galaxy.ts';
import { planetDescription } from '../galaxy/goatsoup.ts';
import { systemDescription } from '../galaxy/descriptions.ts';
import { escapeHtml } from '../engine/escape-html.ts';
import { HUD, TINT } from '../palette.ts';
import { distanceTenths } from '../galaxy/navigation.ts';
import { type CommanderData } from '../game/commander.ts';
import { orderDestinations } from '../game/orders.ts';
import { type MarketEstimate } from '../game/market.ts';
import { type ChartState } from '../game/chart-state.ts';
import { type ChartOverlays } from '../game/chart-overlay.ts';
import { TENTHS_PER_CHART_UNIT, CHART_Y_SQUASH, LOCAL_SCALE, LOCAL_CANVAS } from '../constants/chart-metric.ts';
import { maybeById, show } from './screen-shell.ts';
import { portraitUrl } from './portrait.ts';
import { nearestSystem, journey, daysTerm, contractTerm, chartKeyline } from './chart-readout.ts';
import { drawContractMarks, drawLanes, laneSummaryParts, drawPriceTells } from './chart-overlays.ts';

export function renderLocalChart(
  systems: StarSystem[],
  c: CommanderData,
  chart: ChartState,
  overlays: ChartOverlays,
): void {
  show(`
    <h2>SHORT RANGE CHART</h2>
    <div class="rule"></div>
    <div class="chartrow" style="--chart-side:${LOCAL_CANVAS}px">
      <canvas id="local-canvas" width="${LOCAL_CANVAS}" height="${LOCAL_CANVAS}"></canvas>
      <div class="info" id="local-info"></div>
    </div>
    <div class="keyline">${chartKeyline(overlays.mode)}</div>
  `, true);
  drawLocalChart(systems, c, chart, overlays);
}
export function drawLocalChart(
  systems: StarSystem[],
  c: CommanderData,
  chart: ChartState,
  overlays: ChartOverlays,
): void {
  const canvas = maybeById('local-canvas') as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const current = systems[c.systemIndex];
  // x in chart units; y at half-weight so screen distance matches LY distance
  const px = (s: { x: number; y: number }) => cx + (s.x - current.x) * LOCAL_SCALE;
  const py = (s: { x: number; y: number }) =>
    cy + ((s.y - current.y) / CHART_Y_SQUASH) * LOCAL_SCALE;

  ctx.clearRect(0, 0, w, h);

  // fuel range circle (isotropic in this projection)
  ctx.strokeStyle = HUD.dim;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  // A CIRCLE, and it has to be one. distanceTenths divides dy by
  // CHART_Y_SQUASH, and so does py(). So the plotted space is isotropic: equal
  // pixels mean equal light years in every direction. What is reachable is then
  // a circle of radius (fuel/TENTHS_PER_CHART_UNIT)*LOCAL_SCALE. The canvas is
  // square (see renderLocalChart), so the circle fits with no clip.
  ctx.arc(cx, cy, (c.fuel / TENTHS_PER_CHART_UNIT) * LOCAL_SCALE, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Trade lanes, under the systems as on the galactic chart. Lanes run up to
  // 7 LY, so one end is often off this zoom. The canvas simply clips the line,
  // and that reads correctly: freight on its way out of the neighbourhood.
  drawLanes(ctx, overlays, systems, px, py);

  ctx.font = '10px Menlo, Consolas, monospace';
  for (const s of systems) {
    const x = px(s);
    const y = py(s);
    if (x < -20 || x > w + 20 || y < -12 || y > h + 12) continue;
    const within = distanceTenths(current, s) <= c.fuel;
    ctx.fillStyle = within ? HUD.green : TINT.lane;
    ctx.beginPath();
    ctx.arc(x, y, s.index === c.systemIndex ? 3.5 : 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = within ? TINT.liftLabel : TINT.farLabel;
    ctx.fillText(s.name.toUpperCase(), x + 7, y - 6);
  }

  drawPriceTells(ctx, overlays.prices, systems, px, py, 8);

  // Pirate activity, as on the galactic chart. Same cull as the dots above. A
  // ring for a system this zoom left off the edge would land at a coordinate
  // outside the canvas anyway.
  ctx.strokeStyle = HUD.red;
  for (const index of overlays.danger) {
    const s = systems[index];
    if (!s) continue;
    const x = px(s);
    const y = py(s);
    if (x < -20 || x > w + 20 || y < -12 || y > h + 12) continue;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawContractMarks(ctx, orderDestinations(c), systems, px, py, 8);

  // current system crosshair
  ctx.strokeStyle = HUD.green;
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy); ctx.lineTo(cx + 10, cy);
  ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy + 10);
  ctx.stroke();

  // target marker
  if (chart.targetIndex !== null) {
    const t = systems[chart.targetIndex];
    ctx.strokeStyle = HUD.amber;
    ctx.beginPath();
    ctx.arc(px(t), py(t), 7, 0, Math.PI * 2);
    ctx.stroke();
  }

  // cursor
  ctx.strokeStyle = HUD.red;
  const ux = cx + (chart.cursorX - current.x) * LOCAL_SCALE;
  const uy = cy + ((chart.cursorY - current.y) / 2) * LOCAL_SCALE;
  ctx.beginPath();
  ctx.moveTo(ux - 7, uy); ctx.lineTo(ux + 7, uy);
  ctx.moveTo(ux, uy - 7); ctx.lineTo(ux, uy + 7);
  ctx.stroke();

  // The lane under the pointer is painted INTO the canvas, bottom-left, and
  // not into any row of chrome. `#local-info` is a 440px column, measured to
  // fit all 256 planet descriptions with no scroll (style.css), so it cannot
  // grow a row. A new keyline pushed this screen's own keys under the controls
  // banner. The canvas has empty sky down there, and costs no layout at all.
  if (overlays.hovered) {
    const [head, tail] = laneSummaryParts(overlays.hovered, systems, overlays.day);
    ctx.fillStyle = HUD.amber;
    ctx.fillText(head, 6, h - 20);
    ctx.fillText(tail, 6, h - 8);
  }

  // data on system (the nearest to the cursor)
  const info = maybeById('local-info');
  if (info) {
    const near = nearestSystem(systems, chart.cursorX, chart.cursorY);
    if (!near) {
      info.textContent = ' ';
      delete info.dataset.system;
      return;
    }
    // Rebuild ONLY when the cursor lands on a different system. This runs on
    // every cursor move. A fresh innerHTML re-creates the <img>, and the
    // portrait then flickers as you sweep the chart. Cheap guard.
    if (info.dataset.system === String(near.index)) return;
    info.dataset.system = String(near.index);

    const d = distanceTenths(current, near);
    const out = d > c.fuel && near.index !== c.systemIndex;
    const portrait = portraitUrl(near, c.galaxy);
    const more = systemDescription(near, c.galaxy);
    const trip = journey(systems, current, near, c.fuel);
    info.innerHTML =
      `<div class="sysname">${near.name.toUpperCase()}` +
      `<span class="dist"> &middot; ${(d / 10).toFixed(1)} LY` +
        `${daysTerm(trip)}</span>` +
      (out ? ' <span class="oor">OUT OF RANGE</span>' : '') +
      contractTerm(c, near, trip) +
      '</div>' +
`<div class="sysrow">` +
      `<dl class="sysfacts">
         <dt>Economy</dt><dd>${ECONOMY_NAMES[near.economy]}</dd>
         <dt>Government</dt><dd>${GOVERNMENT_NAMES[near.government]}</dd>
         <dt>Tech level</dt><dd>${near.techLevel + 1}</dd>
         <dt>Population</dt><dd>${(near.population / 10).toFixed(1)} Billion` +
           (portrait ? '' : ` (${speciesName(near)})`) + `</dd>
         <dt>Productivity</dt><dd>${near.productivity} M CR</dd>
         <dt>Radius</dt><dd>${near.radius} km</dd>
       </dl>` +
      (portrait
        ? `<figure class="chartface">
             <img src="${portrait}" alt="Inhabitant of ${near.name}"
                  onerror="this.parentElement.remove()"/>
             <figcaption>${speciesName(near)}</figcaption>
           </figure>`
        : '') +
      `</div>` +
      `<div class="sysblurb">${planetDescription(near)}</div>` +
      // The world half of the extended entry, under the 1984 line. The PEOPLE
      // half is not here. The portrait and its species caption above already
      // say who lives here. Both paragraphs together would scroll a panel that
      // changes on every cursor move. `D` opens the full entry.
      (more ? `<div class="sysblurb sysmore">${escapeHtml(more.description)}</div>` : '');
  }
}
/**
 * Market estimate for a system you haven't visited. Opened from the charts
 * with M.
 *
 * A painter. `market.ts` owns what the numbers ARE (`marketEstimate`). What
 * it draws is a distribution: the AVERAGE of every quote the system can roll,
 * and the range those quotes span. So no row promises a price the destination
 * will honour on the day.
 */
export function renderMarketEstimate(
  sys: StarSystem, est: MarketEstimate[], c: CommanderData,
): void {
  const rows = est.map((m, i) => {
    const inHold = c.cargo[i] > 0 ? `${c.cargo[i]}${m.unit}` : '-';
    return `<tr><td>${m.name.toUpperCase()}</td><td class="num">${m.price.toFixed(1)}</td>` +
      `<td class="num">${m.low.toFixed(1)}&ndash;${m.high.toFixed(1)}</td>` +
      `<td class="num">${m.quantity}${m.unit}</td><td class="num">${inHold}</td></tr>`;
  }).join('');
  show(`
    <h2>${sys.name.toUpperCase()} — MARKET ESTIMATE</h2>
    <div class="rule"></div>
    <div class="info" style="text-align:center">
      ${ECONOMY_NAMES[sys.economy]} &middot; ${GOVERNMENT_NAMES[sys.government]} &middot;
      averaged over every price this market can roll &mdash; one visit lands
      somewhere in the range
    </div>
    <table>
      <tr><th>PRODUCT</th><th class="num">AVG PRICE (Cr)</th><th class="num">RANGE (Cr)</th><th class="num">AVG STOCK</th><th class="num">IN HOLD</th></tr>
      ${rows}
    </table>
    <div class="buttons"><button data-key="Escape">BACK TO CHART</button></div>
  `);
}
/** Inverse of the short-range chart projection (centred on the current system). */
export function localCoordsFromClick(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  current: StarSystem,
): { x: number; y: number } {
  const r = canvas.getBoundingClientRect();
  const px = (clientX - r.left) * (canvas.width / r.width);
  const py = (clientY - r.top) * (canvas.height / r.height);
  return {
    x: current.x + (px - canvas.width / 2) / LOCAL_SCALE,
    y: current.y + ((py - canvas.height / 2) / LOCAL_SCALE) * 2,
  };
}
