// Giving up on a flight: the confirmation, and where it puts you.
//
// The one way out of the cockpit that is not docking, dying or the distress
// beacon. It costs exactly what dying costs — the flight — because it lands you
// in exactly the place dying does: this career's DOCKED checkpoint, written when
// you last docked and again immediately before you launched. Nothing since is
// kept, which is what stops "quit" being a way to bank a hold full of cargo
// without flying it home.
//
// It is a SCREEN and not a `ControlMode` confirmation, for two reasons. The
// screen stack already freezes the world while an overlay is up (`Game.mode` is
// `screens.topId ?? baseMode`, and only `'flight'` steps), so nothing can shoot
// you while you are deciding — a confirmation that could get you killed is not
// one. And a new mode would need a binding table, a `?` guide section and a host
// in play.html to be documented in, for two keys that are already every
// overlay's two keys.
//
// The screen never abandons anything itself: it says what it would cost and
// calls `abandon()`, the way the trainer's picker calls `begin()`.

import type { SaveSummary } from '../save-file.ts';
import {
  renderQuit,
} from '../../ui/screens-career.ts';
import type { Screen, ScreenOutcome } from '../../ui/screen-host.ts';
import type { Input } from '../../engine/input.ts';

/** The slice of the Game this screen is allowed to see. */
export interface QuitContext {
  /**
   * The checkpoint you would come back to, or null for a career that has never
   * docked — the same summary the game-over screen offers, from the same place,
   * so the two cannot describe the same save differently.
   */
  readonly checkpoint: SaveSummary | null;
  /** Do it: forget the flight and restore that checkpoint. */
  abandon(): void;
  /**
   * Changed your mind. You reached this screen from a PAUSED cockpit, so this
   * is what puts the pause back — a confirmation you backed out of must not
   * drop you live into the fight you stopped to think about.
   */
  keepFlying(): void;
}

export class QuitScreen implements Screen {
  readonly id = 'quit' as const;
  private readonly ctx: () => QuitContext;

  constructor(ctx: () => QuitContext) {
    this.ctx = ctx;
  }

  open(): void {
    this.render();
  }

  render(): void {
    renderQuit(this.ctx().checkpoint);
  }

  input(i: Input): ScreenOutcome {
    // Y to give up, ESC or N to keep flying. NOT Enter: this screen can open
    // over a fight, and Enter is the key a hand rests on — the same argument
    // `controls.ts` makes for putting NEW COMMANDER on Q rather than a shifted
    // letter. Nothing here is confirmed by the key you were already pressing.
    if (i.pressed('KeyY')) {
      this.ctx().abandon();
      return 'exit';
    }
    if (!i.pressed('Escape') && !i.pressed('KeyN')) return 'stay';
    this.ctx().keepFlying();
    return 'back';
  }
}
