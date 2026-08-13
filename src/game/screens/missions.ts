// The Navy's orders: what it wants doing, where, and what her gun is worth.
//
// The screen GitHub #27 asked for. A briefing that is said one time, for five
// seconds, and is then unreachable is the same as no briefing at all — so the
// mission has a home here, and the one amber line under the station menu went
// back to being a summary rather than the only copy of it.
//
// THE NAVY'S ORDERS ONLY, since docs/TODO/145. Board work has its own screen: a
// contract and a mission are two kinds of thing, and one screen holding both
// left the bulletin board saying the same thing twice (Chris, 2026-08-13).
//
// It reads, and it changes nothing. `game/missions.ts` owns what the leg is.

import { renderMissions } from '../../ui/screens.ts';
import type { Screen, ScreenOutcome } from '../../ui/screen-host.ts';
import type { CommanderData } from '../commander.ts';
import { missionLeg } from '../missions.ts';
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
    renderMissions(missionLeg(commander, systems), systems);
  }

  input(i: Input): ScreenOutcome {
    return i.pressed('Escape') ? 'back' : 'stay';
  }
}
