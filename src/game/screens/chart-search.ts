// Type-to-find on a chart: the letters, the match, and what the page shows
// while the search runs.
//
// A sub-mode of the chart rather than a screen on the stack. It swallows the
// keyboard while it runs, and Escape ends it rather than the chart. It lived
// in `screens/chart.ts` until the key grid put that file over the size gate
// (docs/TODO/216). The chart still owns the cursor: this returns the match,
// and the chart moves its cursor to it.
//
// It reads keys and it paints. The page it paints is the one the two chart
// painters made. That page holds the info line under its id, an empty
// element for the key grid, and the button row under `chart-buttons`.

import type { Input } from '../../engine/input.ts';
import type { StarSystem } from '../../galaxy/galaxy.ts';
import { keyGrid } from '../../ui/key-grid.ts';
import { maybeById } from '../../ui/screen-shell.ts';

export class ChartSearch {
  /** typed prefix while the search runs, or null when it does not */
  private prefix: string | null = null;
  /**
   * Whether the key grid is on the page (docs/TODO/216 M2). A phone types
   * the search on it. The chart repaints on every cursor move, so the grid
   * is written when the search starts and cleared when it ends, not on each
   * move.
   */
  private keysShown = false;
  private readonly local: boolean;

  constructor(local: boolean) {
    this.local = local;
  }

  get active(): boolean {
    return this.prefix !== null;
  }

  /** Start with nothing typed. */
  begin(): void {
    this.prefix = '';
  }

  /** End it, at a chart's open. A key ends it through `type`. */
  end(): void {
    this.prefix = null;
  }

  /**
   * One frame of typed keys. A letter extends the prefix, Backspace shortens
   * it, and Enter or Escape end the search and drop the rest of the frame.
   *
   * @returns `changed` when the page needs a repaint, and `match` when the
   * prefix changed and a system's name starts with it.
   */
  type(i: Input, systems: readonly StarSystem[]): { changed: boolean; match: StarSystem | null } {
    let changed = false;
    for (const code of i.drainPresses()) {
      if (code.startsWith('Key')) {
        this.prefix += code.slice(3);
        changed = true;
      } else if (code === 'Backspace') {
        this.prefix = this.prefix!.slice(0, -1);
        changed = true;
      } else if (code === 'Enter' || code === 'Escape') {
        this.prefix = null;
        return { changed: true, match: null };
      }
    }
    if (!changed || !this.prefix) return { changed, match: null };
    const want = this.prefix.toUpperCase();
    return { changed, match: systems.find((s) => s.name.toUpperCase().startsWith(want)) ?? null };
  }

  /**
   * What the page shows. The FIND line while the search runs, the key grid
   * with it, and the button row hidden for as long. The search reads every
   * key as a letter, so a tap on DATA ON SYSTEM would type a D. The grid's
   * ENTER ends the search, and the row comes back.
   *
   * Through the seam, and not through `document`. The two painters read
   * these same ids the same way. A direct lookup here threw under node, so
   * no headless test could drive type-to-find at all (docs/TODO/163).
   */
  paint(): void {
    const wanted = this.prefix !== null;
    if (wanted) {
      const info = maybeById(this.local ? 'local-info' : 'chart-info');
      if (info) info.textContent = `FIND: ${this.prefix}_`;
    }
    if (wanted === this.keysShown) return;
    this.keysShown = wanted;
    const keys = maybeById(this.local ? 'local-keys' : 'chart-keys');
    if (keys) keys.innerHTML = wanted ? keyGrid('find') : '';
    maybeById('chart-buttons')?.classList.toggle('hidden', wanted);
  }

  /** A full paint wrote the page anew, with an empty grid element. */
  repainted(): void {
    this.keysShown = false;
    this.paint();
  }
}
