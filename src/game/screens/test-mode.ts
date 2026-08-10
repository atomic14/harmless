// Test mode: the development levers, and the door onto them.
//
// `GameState.cheat` was built, saved, validated, threaded into the outfitters
// and covered by a passing test — and nothing in the shipped game could set it,
// because the globals purge deleted `window.__cheat` without building a
// replacement (state.ts:99, console.ts:12). So the mode was never the missing
// piece. THE DOOR WAS, and this is it: a binding and a screen, which is what
// invariant 12 leaves once a URL parameter and a console setter are refused.
//
// The rows are levers, not rules. Each one writes commander or world state
// through the field the game already reads, so the world step, the save and the
// campaign harness all see a legitimate — if implausible — commander, and
// nothing anywhere branches on "is this a test career?".
//
// The one thing it leaves behind is the MARK: switching the mode on latches
// `commander.tested` (commander.ts), which never clears. A live toggle can be
// switched off before a screenshot; a latch cannot, and a bug report from a
// career that spent an afternoon with free equipment fitted is a different
// report.

import type { GameState } from '../state.ts';
import { markTested } from '../commander.ts';
import { renderTestMode } from '../../ui/screens.ts';
import type { Screen, ScreenOutcome } from '../../ui/screen-host.ts';
import type { Input } from '../../engine/input.ts';

/**
 * The slice of the Game this screen is allowed to see.
 *
 * The whole `GameState`, deliberately, where every other screen takes a
 * hand-picked field list. Writing the state IS this screen's job: a narrow
 * context would need one setter per lever, and the levers are meant to grow —
 * fuel, credits, legal status, character, a spawn. A setter each would put half
 * of every lever in game.ts, which is the one place none of them belongs.
 */
export interface TestModeContext {
  readonly state: GameState;
  /**
   * Write the career down where it stands.
   *
   * The mark must survive the tab closing, and `commander.tested` only reaches
   * the shelf on the next automatic write. `SimHost.recordFurthestWave` takes
   * the same view of the one number an exercise leaves behind.
   */
  checkpoint(): void;
}

/** One line of the panel, as the renderer needs it. */
export interface TestModeRow {
  label: string;
  value: string;
  /** shown, but inert — the levers do nothing until the mode is on */
  dim?: boolean;
}

/** The whole panel, as the renderer needs it. */
export interface TestModePanel {
  rows: readonly TestModeRow[];
  /** index into `rows` */
  selected: number;
  /** whether the mode is on, for the banner that says what that costs */
  on: boolean;
}

/**
 * A row, and what pressing a key on it does.
 *
 * `act` takes a DIRECTION rather than a value, so one shape covers a toggle, a
 * cycle and a grant: ← is -1, → and ENTER are +1, and a toggle ignores it.
 */
interface TestCell extends TestModeRow {
  act(d: number): void;
}

const cycle = (n: number, len: number, d: number): number => (n + d + len) % len;
const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));
const onOff = (b: boolean): string => (b ? 'ON' : 'OFF');

export class TestModeScreen implements Screen {
  readonly id = 'test-mode' as const;

  private readonly ctx: () => TestModeContext;
  private row = 0;

  constructor(ctx: () => TestModeContext) {
    this.ctx = ctx;
  }

  open(): void {
    this.render();
  }

  render(): void {
    const cells = this.cells();
    this.row = clamp(this.row, 0, cells.length - 1);
    renderTestMode({
      rows: cells,
      selected: this.row,
      on: this.ctx().state.cheat,
    });
  }

  /** A click on a row selects it — the same path the arrow keys take. */
  select(row: number): void {
    this.row = clamp(row, 0, this.cells().length - 1);
    this.render();
  }

  input(i: Input): ScreenOutcome {
    if (i.pressed('Escape')) return 'back';

    const cells = this.cells();
    const up = i.pressed('ArrowUp');
    const down = i.pressed('ArrowDown');
    if (up || down) {
      this.row = cycle(this.row, cells.length, down ? 1 : -1);
      return this.repaint();
    }
    const left = i.pressed('ArrowLeft');
    const right = i.pressed('ArrowRight');
    // ENTER is → on this screen rather than a launch key: every row is a
    // toggle, a cycle or a fixed grant (no numeric entry), so "do the thing on
    // this row" and "step it forward" are the same gesture. It is also what the
    // menu cursor injects, and what a click on a row lands on.
    const enter = i.pressed('Enter');
    if (left || right || enter) {
      cells[this.row].act(right || enter ? 1 : -1);
      return this.repaint();
    }
    return 'stay';
  }

  /**
   * The panel, as a list.
   *
   * Rebuilt every frame and closed over the LIVE state, so a row reads what the
   * game currently holds rather than a copy taken when the screen opened —
   * there is no draft here, unlike the trainer's setup panel: these levers
   * apply the moment they are pressed.
   */
  private cells(): TestCell[] {
    const { state } = this.ctx();
    return [
      {
        label: 'TEST MODE',
        value: onOff(state.cheat),
        act: () => this.setCheat(!state.cheat),
      },
    ];
  }

  /**
   * Switch the mode, and mark the career the first time it goes on.
   *
   * The checkpoint is unconditional rather than only when the mark moved:
   * `state.cheat` is saved too (snapshot.ts), and a mode switched OFF that a
   * reload switched back on would be the ambient-global failure state.ts:99
   * describes, arrived at from the other direction.
   */
  private setCheat(on: boolean): void {
    const { state, checkpoint } = this.ctx();
    state.cheat = on;
    if (on) markTested(state.commander);
    checkpoint();
  }

  private repaint(): ScreenOutcome {
    this.render();
    return 'stay';
  }
}
