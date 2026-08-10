// The galactic chart and the short-range chart.
//
// One class, two instances. They differ only in scale, in which render/draw
// pair they call, and in how a click maps to chart coordinates — everything
// else (the cursor, targeting, type-to-find, the market estimate) is identical,
// and was already written once and branched on `mode === 'local'` throughout.
//
// The most involved screen in the game, and the two contract additions it
// needed are both genuine: `tick(dt)` because the cursor moves while an arrow
// is HELD, where every other screen acts on discrete taps, and `clickAt`
// because a canvas has to turn pixels into its own coordinate space.
//
// Two sub-modes live here rather than on the stack. Type-to-find and the
// market estimate are not places you navigate to — they are states of the
// chart itself, they swallow the keyboard while active, and Escape leaves the
// sub-mode rather than the screen. Pushing them would make Escape ambiguous.

import type { ChartState } from '../chart-state.ts';
import {
  renderChart, drawChart, renderLocalChart, drawLocalChart, renderMarketEstimate,
  nearestSystem, chartCoordsFromClick, localCoordsFromClick,
} from '../../ui/screens.ts';
import type { Screen, ScreenOutcome, ScreenId } from '../../ui/screen-host.ts';
import type { CommanderData } from '../commander.ts';
import type { StarSystem } from '../../galaxy/galaxy.ts';
import type { Input } from '../../engine/input.ts';
import { marketEstimate } from '../market.ts';
import { dangerousSystems } from '../../galaxy/danger-overlay.ts';
import { busyLanes, nearestLane, type TradeLane } from '../../galaxy/trade-lanes.ts';
import { divergentSystems } from '../../galaxy/price-divergence.ts';
import type { Convoy } from '../../galaxy/living.ts';
import type { ChartOverlay, ChartOverlays } from '../chart-overlay.ts';
import { sfx } from '../../audio.ts';
import {
  LOCAL_SCALE, CHART_SPAN_X, CHART_CANVAS_W, LANE_PICK_PX,
} from '../../constants/chart-metric.ts';

export interface ChartContext {
  readonly commander: CommanderData;
  readonly systems: StarSystem[];
  /** where you are now — the short-range chart centres on it */
  readonly system: StarSystem;
  /** cursor and hyperspace target, shared by both charts */
  readonly chart: ChartState;
  /** remember which system the data screen should read about */
  viewData(sys: StarSystem): void;
  /** the living galaxy's ±25% price pressure THERE, for the market estimate */
  priceMultiplier(systemIndex: number, commodity: number): number;
  /**
   * That system's pirate reputation, 0..1, for the danger overlay. The
   * READ-ONLY accessor: `LivingGalaxy.state()` would insert an entry for every
   * system a redraw looks at, which is a draw path mutating the world.
   */
  danger(systemIndex: number): number;
  /** convoys in flight, for the routes overlay — a read of a public array */
  readonly convoys: readonly Convoy[];
  /** the galaxy's day, which turns a convoy's `etaDay` into "in 2 days" */
  readonly day: number;
  /**
   * Which trade overlay is up, and the key that cycles it. Held by the Game
   * rather than by either screen, exactly as `viewData` holds the data
   * screen's subject: both charts then show the same thing, so `G` and `N`
   * cannot disagree. Not saved — `SNAPSHOT_VERSION` is checked strictly, and a
   * view mode is not worth invalidating every existing save.
   */
  readonly overlay: ChartOverlay;
  cycleOverlay(): void;
}

export class ChartScreen implements Screen {
  readonly id: ScreenId;
  private readonly local: boolean;
  private readonly ctx: () => ChartContext;
  /** typed prefix while type-to-find is active, or null when it is not */
  private find: string | null = null;
  /**
   * Where the mouse last was, in chart coordinates, or null when it has not
   * been over this canvas. Kept beside the cursor rather than moved INTO it:
   * the cursor also chooses the hyperspace target, and a pointer crossing the
   * chart on its way somewhere else must not retarget the ship.
   */
  private pointer: { x: number; y: number } | null = null;
  /** the lane the last repaint described, so a move that changes nothing costs nothing */
  private described: TradeLane | null = null;
  /** the market-estimate panel is up, and owns Escape */
  private estimate = false;

  constructor(id: 'chart' | 'local', ctx: () => ChartContext) {
    this.id = id;
    this.local = id === 'local';
    this.ctx = ctx;
  }

  open(): void {
    const { chart, system } = this.ctx();
    this.find = null;
    this.estimate = false;
    // the mouse has not been over THIS canvas yet, whatever it did on the other
    this.pointer = null;
    this.described = null;
    chart.cursorX = system.x;
    chart.cursorY = system.y;
    this.render();
  }

  render(): void {
    const { systems, commander, chart } = this.ctx();
    const overlays = this.overlays();
    if (this.local) renderLocalChart(systems, commander, chart, overlays);
    else renderChart(systems, commander, chart, overlays);
  }

  /**
   * Everything drawn over the stars, recomputed per repaint. Cheap and always
   * current: the charts repaint on open, cursor move or click, never per frame,
   * and the galaxy only drifts when the clock moves.
   *
   * Only the active overlay's model is run. The danger rings are always on —
   * they are a warning, not a view.
   */
  private overlays(): ChartOverlays {
    const { systems, danger, convoys, priceMultiplier, overlay, day } = this.ctx();
    const lanes = overlay === 'routes' ? busyLanes(convoys) : [];
    // what this paint describes, remembered so a pointer move that changes
    // nothing does not repaint
    this.described = this.laneAtPointer(lanes);
    return {
      mode: overlay,
      danger: dangerousSystems(systems, danger),
      lanes,
      prices: overlay === 'prices'
        ? divergentSystems(systems, priceMultiplier) : new Map(),
      hovered: this.described,
      day,
    };
  }

  /**
   * The lane being pointed at: under the mouse if it has moved over the chart,
   * otherwise under the cursor the arrow keys drive.
   *
   * BOTH, because nothing else on these charts is mouse-only — a click and the
   * arrows move the same cursor — and the detail should not be the first thing
   * a keyboard cannot reach. The mouse wins while it is over the canvas,
   * because a pointer is a deliberate act and the cursor may be parked.
   */
  private laneAtPointer(lanes: readonly TradeLane[]): TradeLane | null {
    if (!lanes.length) return null;
    const { systems, chart } = this.ctx();
    const at = this.pointer ?? { x: chart.cursorX, y: chart.cursorY };
    return nearestLane(lanes, systems, at.x, at.y, this.pickRadius());
  }

  /**
   * How near counts as pointing at a lane, in chart units — `LANE_PICK_PX`
   * pixels on whichever chart this is. The same conversion `clickAt` makes for
   * its snap radius, and for the same reason: a pixel is ~13x more chart on
   * the galactic chart than on the short-range one.
   */
  private pickRadius(): number {
    return this.local
      ? LANE_PICK_PX / LOCAL_SCALE
      : LANE_PICK_PX / (CHART_CANVAS_W / CHART_SPAN_X);
  }

  /** Repaint the canvas only, keeping the surrounding chrome. */
  private redraw(): void {
    const { systems, commander, chart } = this.ctx();
    const overlays = this.overlays();
    if (this.local) drawLocalChart(systems, commander, chart, overlays);
    else drawChart(systems, commander, chart, overlays);
    if (this.find !== null) {
      const info = document.getElementById(this.local ? 'local-info' : 'chart-info');
      if (info) info.textContent = `FIND: ${this.find}_`;
    }
  }

  /** The system under the cursor, if any. */
  private underCursor(radius?: number): StarSystem | null {
    const { systems, chart } = this.ctx();
    return nearestSystem(systems, chart.cursorX, chart.cursorY, radius);
  }

  tick(dt: number, i: Input): void {
    if (this.find !== null || this.estimate) return;
    this.moveCursor(dt, i);
  }

  input(i: Input): ScreenOutcome {
    if (this.estimate) {
      if (i.pressed('Escape') || i.pressed('KeyM')) {
        this.estimate = false;
        this.render();
      }
      return 'stay';
    }
    if (this.find !== null) {
      this.typeToFind(i);
      return 'stay';
    }
    if (i.pressed('KeyM')) {
      const near = this.underCursor();
      if (near) {
        this.estimate = true;
        const ctx = this.ctx();
        // contracts.ts owns what the estimate IS; this screen only asks for it
        renderMarketEstimate(
          near,
          marketEstimate(near, (c) => ctx.priceMultiplier(near.index, c)),
          ctx.commander);
      }
      return 'stay';
    }
    if (i.pressed('KeyD')) {
      const near = this.underCursor();
      if (!near) return 'stay';
      this.ctx().viewData(near);
      // pushed ON TOP: Escape from the data screen comes back to this chart,
      // with its cursor and target where they were
      return { open: 'data' };
    }
    if (i.pressed('KeyF')) {
      this.find = '';
      this.redraw();
      return 'stay';
    }
    if (i.pressed('KeyT')) {
      // The Game owns the mode, so the other chart is already showing this
      // when you open it. A full render: the keyline names the overlay.
      this.ctx().cycleOverlay();
      this.render();
      return 'stay';
    }
    if (i.pressed('Enter')) {
      const near = this.underCursor();
      if (near) {
        this.ctx().chart.targetIndex = near.index;
        sfx.chartTargetSelected();
        this.redraw();
      }
    }
    if (i.pressed('Escape')) return 'back';
    return 'stay';
  }

  /**
   * The pointer moved. Report only — nothing here selects, targets or spends.
   *
   * Repaints only when the described lane CHANGES: `mousemove` fires on every
   * pixel of travel, where this chart has never repainted more than once per
   * cursor step.
   */
  hoverAt(target: HTMLElement, e: MouseEvent): void {
    if (this.estimate || this.find !== null) return;
    const was = this.described;
    this.pointer = target instanceof HTMLCanvasElement
      ? this.chartCoords(target, e)
      // off the canvas — fall back to the cursor, so the line does not go
      // stale describing a lane the pointer left
      : null;
    const now = this.laneAtPointer(this.routeLanes());
    // BY ITS SYSTEMS, not by identity: `busyLanes` folds fresh objects out of
    // the convoy list on every call, so two reads of the same lane are never
    // the same object and an identity test would repaint on every pixel.
    const same = was === now
      || (!!was && !!now && was.a === now.a && was.b === now.b);
    if (!same) this.redraw();
  }

  /** The lanes currently drawn, or none when the routes overlay is off. */
  private routeLanes(): TradeLane[] {
    const { overlay, convoys } = this.ctx();
    return overlay === 'routes' ? busyLanes(convoys) : [];
  }

  /** Canvas pixels to chart coordinates, whichever chart this is. */
  private chartCoords(canvas: HTMLCanvasElement, e: MouseEvent): { x: number; y: number } {
    return this.local
      ? localCoordsFromClick(canvas, e.clientX, e.clientY, this.ctx().system)
      : chartCoordsFromClick(canvas, e.clientX, e.clientY);
  }

  clickAt(target: HTMLElement, e: MouseEvent): boolean {
    if (this.estimate || this.find !== null) return false;
    if (!(target instanceof HTMLCanvasElement)) return false;
    const { chart, system, systems } = this.ctx();

    const coords = this.local
      ? localCoordsFromClick(target, e.clientX, e.clientY, system)
      : chartCoordsFromClick(target, e.clientX, e.clientY);
    chart.cursorX = Math.max(0, Math.min(255, coords.x));
    chart.cursorY = Math.max(0, Math.min(255, coords.y));

    // snap radius of ~28 screen px on either chart, so clicking a star targets
    // it while clicking empty sky just moves the cursor
    const pxPerUnit = this.local ? LOCAL_SCALE : target.width / CHART_SPAN_X;
    const near = nearestSystem(systems, chart.cursorX, chart.cursorY, 28 / pxPerUnit);
    if (near) {
      chart.cursorX = near.x;
      chart.cursorY = near.y;
      chart.targetIndex = near.index;
      sfx.chartTargetSelected();
    }
    this.redraw();
    return true;
  }

  /** Discrete step per tap, plus continuous motion while a key is held. */
  private moveCursor(dt: number, i: Input): void {
    const { chart } = this.ctx();
    // the local chart is ~13x zoomed, so the cursor moves proportionally finer
    const tapStep = this.local ? 1 : 3;
    const speed = (this.local ? 12 : 55) * dt;
    let moved = false;
    const taps = {
      left: i.pressedCount('ArrowLeft'),
      right: i.pressedCount('ArrowRight'),
      up: i.pressedCount('ArrowUp'),
      down: i.pressedCount('ArrowDown'),
    };
    if (taps.left) { chart.cursorX -= tapStep * taps.left; moved = true; }
    if (taps.right) { chart.cursorX += tapStep * taps.right; moved = true; }
    if (taps.up) { chart.cursorY -= 2 * tapStep * taps.up; moved = true; }
    if (taps.down) { chart.cursorY += 2 * tapStep * taps.down; moved = true; }
    if (i.held('ArrowLeft', 'KeyA')) { chart.cursorX -= speed; moved = true; }
    if (i.held('ArrowRight', 'KeyD')) { chart.cursorX += speed; moved = true; }
    if (i.held('ArrowUp', 'KeyW')) { chart.cursorY -= speed * 2; moved = true; }
    if (i.held('ArrowDown', 'KeyS')) { chart.cursorY += speed * 2; moved = true; }
    if (moved) {
      chart.cursorX = Math.max(0, Math.min(255, chart.cursorX));
      chart.cursorY = Math.max(0, Math.min(255, chart.cursorY));
      this.redraw();
    }
  }

  /** Letters filter, the cursor jumps to the first match. */
  private typeToFind(i: Input): void {
    const { systems, chart } = this.ctx();
    let changed = false;
    for (const code of i.drainPresses()) {
      if (code.startsWith('Key')) {
        this.find += code.slice(3);
        changed = true;
      } else if (code === 'Backspace') {
        this.find = this.find!.slice(0, -1);
        changed = true;
      } else if (code === 'Enter' || code === 'Escape') {
        this.find = null;
        this.redraw();
        return;
      }
    }
    if (changed && this.find) {
      const match = systems.find((s) => s.name.toUpperCase().startsWith(this.find!.toUpperCase()));
      if (match) {
        chart.cursorX = match.x;
        chart.cursorY = match.y;
      }
    }
    if (changed) this.redraw();
  }
}
