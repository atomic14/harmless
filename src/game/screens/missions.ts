// Standing orders: what the Navy and the bulletin boards are waiting for.
//
// The screen GitHub #27 asked for. A briefing that is said one time, for five
// seconds, and is then unreachable is the same as no briefing at all — so every
// standing order has a home here, and the one amber line under the station menu
// went back to being a summary of this rather than the only copy of it.
//
// It reads, and it changes nothing. `game/orders.ts` owns which orders exist
// and how they sort; `ui/screens.ts` draws them.

import { renderMissions } from '../../ui/screens.ts';
import type { Screen, ScreenOutcome } from '../../ui/screen-host.ts';
import type { CommanderData } from '../commander.ts';
import { standingOrders } from '../orders.ts';
import type { StarSystem } from '../../galaxy/galaxy.ts';
import type { Input } from '../../engine/input.ts';

export interface MissionsContext {
  readonly commander: CommanderData;
  readonly systems: StarSystem[];
}

export class MissionsScreen implements Screen {
  readonly id = 'missions' as const;
  private readonly ctx: () => MissionsContext;

  constructor(ctx: () => MissionsContext) {
    this.ctx = ctx;
  }

  open(): void {
    this.render();
  }

  render(): void {
    const { commander, systems } = this.ctx();
    renderMissions(standingOrders(commander, systems), systems);
  }

  input(i: Input): ScreenOutcome {
    return i.pressed('Escape') ? 'back' : 'stay';
  }
}
