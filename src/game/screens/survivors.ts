// The question the station asks before it will do anything else: there is
// somebody in your crew spaces — what happens to them?
//
// It opens on a dock with a survivor aboard, and IT CANNOT BE ESCAPED. A dock
// used to file them with station medical in the same breath as a shield reset
// (station.ts). So the one genuinely moral act in the game cost nothing and
// meant nothing (docs/TODO/127). A prompt that Escape dismissed would put
// that back: "do nothing" would resolve it in the decent direction for free.
//
// The screen decides nothing itself. `game/survivors.ts` owns what each answer
// DOES, the way the quit confirmation calls `abandon()` — so the campaign
// harness can make the same choice without a keyboard.

import { renderSurvivors } from '../../ui/screens.ts';
import type { Screen, ScreenOutcome } from '../../ui/screen-host.ts';
import type { Input } from '../../engine/input.ts';
import { sfx } from '../../audio.ts';

/** The slice of the Game this screen is allowed to see. */
export interface SurvivorsContext {
  /** how many people are aboard — the prompt pluralises off it */
  readonly people: number;
  /** what the two dirty answers pay here, in tenths (`survivorOffers`) */
  readonly offers: { sale: number; release: number };
  /** Hand them to station medical: costs nothing, pays nothing. */
  handOver(): void;
  /** Sell them on the Slaves row at the local quote. */
  sell(): void;
  /** Take their money and let them walk. */
  release(): void;
}

export class SurvivorsScreen implements Screen {
  readonly id = 'survivors' as const;
  private readonly ctx: () => SurvivorsContext;

  constructor(ctx: () => SurvivorsContext) {
    this.ctx = ctx;
  }

  open(): void {
    this.render();
  }

  render(): void {
    const ctx = this.ctx();
    renderSurvivors(ctx.people, ctx.offers);
  }

  input(i: Input): ScreenOutcome {
    const ctx = this.ctx();
    // Three answers, three letters, and no default: the whole point is that
    // the player says which. M is the decent one; the two below it are not.
    if (i.pressed('KeyM')) {
      ctx.handOver();
      return 'back';
    }
    if (i.pressed('KeyV')) {
      ctx.sell();
      return 'back';
    }
    if (i.pressed('KeyL')) {
      ctx.release();
      return 'back';
    }
    // Everything else, Escape included, is refused and asked again. The
    // station will not forget the person in your ship. The noise is how a
    // player learns that this is not a screen she can leave.
    if (i.pressed('Escape')) {
      sfx.refused();
      this.render();
    }
    return 'stay';
  }
}
