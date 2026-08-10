// The question the station asks before it will do anything else: there is
// somebody in your crew spaces — what happens to them?
//
// It opens on docking with a survivor aboard and IT CANNOT BE ESCAPED. Docking
// used to file them with station medical in the same breath as resetting your
// shields (station.ts), so the one genuinely moral act in the game cost nothing
// and meant nothing (docs/TODO/127). A prompt that Escape dismissed would put
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
  /** Hand them to station medical: costs nothing, pays nothing. */
  handOver(): void;
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
    renderSurvivors(this.ctx().people);
  }

  input(i: Input): ScreenOutcome {
    if (i.pressed('KeyM')) {
      this.ctx().handOver();
      return 'back';
    }
    // Everything else, Escape included, is refused and re-asked. The station
    // is not going to forget about the person in your ship, and the noise is
    // how a player learns that this one is not a screen they can leave.
    if (i.pressed('Escape')) {
      sfx.refused();
      this.render();
    }
    return 'stay';
  }
}
