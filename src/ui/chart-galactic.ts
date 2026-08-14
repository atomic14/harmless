// The galactic chart: all 256 systems, and the reach of one tank.
//
// Split out of `ui/screens.ts` by docs/TODO/149, where it shared a file with the
// short range chart and 23 other screens. They are two SCREENS — two projections, two readouts, two
// click surfaces — and the things they genuinely share went to
// `chart-overlays.ts` and `chart-readout.ts` rather than being duplicated.
//
// The y axis is squashed by `CHART_Y_SQUASH`, which is the 1984 map's own
// proportion; `chartCoordsFromClick` undoes exactly that, so a click lands
// where the eye says it should.

import { type StarSystem, ECONOMY_NAMES, GOVERNMENT_NAMES } from '../galaxy/galaxy.ts';
import { HUD, TINT } from '../palette.ts';
import { distanceTenths } from '../galaxy/navigation.ts';
import { type CommanderData } from '../game/commander.ts';
import { orderDestinations } from '../game/orders.ts';
import { type ChartState } from '../game/chart-state.ts';
import { type ChartOverlays } from '../game/chart-overlay.ts';
import { TENTHS_PER_CHART_UNIT, CHART_Y_SQUASH, CHART_CANVAS_W, CHART_CANVAS_H } from '../constants/chart-metric.ts';
import { maybeById, show } from './screen-shell.ts';
import { nearestSystem, journey, daysTerm, contractTerm, chartKeyline } from './chart-readout.ts';
import { drawContractMarks, drawLanes, laneSummary, drawPriceTells } from './chart-overlays.ts';

export function renderChart(
  systems: StarSystem[],
  c: CommanderData,
  chart: ChartState,
  overlays: ChartOverlays,
): void {
  show(`
    <h2>GALACTIC CHART ${c.galaxy}</h2>
    <div class="rule"></div>
    <canvas id="chart-canvas" width="${CHART_CANVAS_W}" height="${CHART_CANVAS_H}"></canvas>
    <div class="keyline" id="chart-info"></div>
    <div class="keyline">${chartKeyline(overlays.mode)}</div>
  `);
  drawChart(systems, c, chart, overlays);
}
/**
 * Redraw only the canvas + info line (cheap, for cursor moves).
 *
 * `overlays` is decided by the models in `galaxy/` — this only paints it, and
 * draws whatever it is handed without knowing which mode is up.
 */
export function drawChart(
  systems: StarSystem[],
  c: CommanderData,
  chart: ChartState,
  overlays: ChartOverlays,
): void {
  const canvas = maybeById('chart-canvas') as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;
  const sx = w / 256;
  const sy = h / 128;
  const px = (s: { x: number; y: number }) => s.x * sx;
  const py = (s: { x: number; y: number }) => (s.y / CHART_Y_SQUASH) * sy;
  const current = systems[c.systemIndex];

  ctx.clearRect(0, 0, w, h);

  // Fuel range. An ellipse is correct HERE — unlike the short-range chart —
  // because sx and sy scale the two axes independently to fit the whole galaxy
  // into the canvas, so a circle in light years is not a circle in pixels.
  // Semi-axes are R*sx and R*sy with R = fuel/TENTHS_PER_CHART_UNIT (the chart
  // metric read backwards, hence the import rather than a literal 4).
  ctx.strokeStyle = TINT.fuelRing;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.ellipse(px(current), py(current), (c.fuel / TENTHS_PER_CHART_UNIT) * sx,
    (c.fuel / TENTHS_PER_CHART_UNIT) * sy, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Trade lanes, UNDER the systems: freight passes beneath the worlds it
  // serves, and a line over a 2.5px dot would swallow it.
  drawLanes(ctx, overlays, systems, px, py);

  // Systems. Given size and light because 256 of them are the whole point of
  // this screen and 1.5px of dim green on near-black is close to invisible.
  for (const s of systems) {
    const within = distanceTenths(current, s) <= c.fuel;
    ctx.fillStyle = within ? TINT.lift : TINT.far;
    const r = s.index === c.systemIndex ? 4.5 : 2.5;
    ctx.fillRect(px(s) - r / 2, py(s) - r / 2, r, r);
  }

  drawPriceTells(ctx, overlays.prices, systems, px, py, 8);

  // Pirate activity: the same fact the system data screen prints in words.
  // Drawn over the dots so a flagged world reads at a glance, in the red the
  // cursor already uses rather than a colour of its own.
  ctx.strokeStyle = HUD.red;
  for (const index of overlays.danger) {
    const s = systems[index];
    if (!s) continue;
    ctx.beginPath();
    ctx.arc(px(s), py(s), 5, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawContractMarks(ctx, orderDestinations(c), systems, px, py, 7);

  // current system crosshair
  ctx.strokeStyle = HUD.green;
  ctx.beginPath();
  ctx.moveTo(px(current) - 8, py(current)); ctx.lineTo(px(current) + 8, py(current));
  ctx.moveTo(px(current), py(current) - 8); ctx.lineTo(px(current), py(current) + 8);
  ctx.stroke();

  // target marker
  if (chart.targetIndex !== null) {
    const t = systems[chart.targetIndex];
    ctx.strokeStyle = HUD.amber;
    ctx.beginPath();
    ctx.arc(px(t), py(t), 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  // cursor
  ctx.strokeStyle = HUD.red;
  const cx = chart.cursorX * sx;
  const cy = (chart.cursorY / 2) * sy;
  ctx.beginPath();
  ctx.moveTo(cx - 6, cy); ctx.lineTo(cx + 6, cy);
  ctx.moveTo(cx, cy - 6); ctx.lineTo(cx, cy + 6);
  ctx.stroke();

  const info = maybeById('chart-info');
  if (info) {
    // A lane under the pointer takes the line: it is what you are pointing at,
    // and the cursor's system comes back the moment you leave it.
    if (overlays.hovered) {
      info.innerHTML = laneSummary(overlays.hovered, systems, overlays.day);
      return;
    }
    const near = nearestSystem(systems, chart.cursorX, chart.cursorY);
    if (near) {
      const d = distanceTenths(current, near);
      const trip = journey(systems, current, near, c.fuel);
      info.innerHTML =
        `${near.name.toUpperCase()} &middot; ${(d / 10).toFixed(1)} LY` +
        daysTerm(trip) +
        ` &middot; ${ECONOMY_NAMES[near.economy]} &middot; ${GOVERNMENT_NAMES[near.government]}` +
        ` &middot; TL ${near.techLevel + 1}` +
        (d > c.fuel ? ' &middot; <span style="color:var(--hud-red)">OUT OF RANGE</span>' : '') +
        // Last, because it is the verdict on everything before it: the world,
        // the distance and what the journey costs.
        contractTerm(c, near, trip);
    } else {
      info.textContent = ' ';
    }
  }
}

// --- Short range (local) chart ---------------------------------------------
/**
 * Inverse of the galactic chart projection: a click on the canvas → chart
 * coordinates. Accounts for CSS scaling of the canvas element.
 */
export function chartCoordsFromClick(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const r = canvas.getBoundingClientRect();
  const px = (clientX - r.left) * (canvas.width / r.width);
  const py = (clientY - r.top) * (canvas.height / r.height);
  return { x: px / (canvas.width / 256), y: (py / (canvas.height / 128)) * 2 };
}
