// The mission desk: what is on offer where she stands, and the two things
// she can do about a mission from the MISSIONS screen.
//
// A mission STARTS here, and nowhere else, since docs/TODO/190. Acceptance is
// the station's, as a contract's is. Abandonment is hers anywhere. Both go
// through the bridge (`mission-bridge.ts`), which installs the record and
// applies what the machine paid, and the checkpoint follows.
//
// It is a child of the Game rather than a part of `docked.ts`. Docked work is
// the station's business, and this desk opens in flight too, because that is
// where the commander who met the Constrictor was.

import { offersFor } from '../missions/machine.ts';
import type { Skeleton } from '../missions/model.ts';
import { missionFacts, missionWarning, runMissions } from './mission-bridge.ts';
import type { GameState } from './state.ts';

export interface MissionDeskHost {
  baseMode(): 'dead' | 'docked' | 'flight';
  /** a message event, said or queued as it asks — see game.ts's `sayEvent` */
  sayEvent(e: { text: string; seconds: number; queued?: boolean }): void;
  queueMessage(text: string, seconds: number): void;
  /** write the docked checkpoint, after the record and its effects landed */
  checkpoint(): void;
}

export class MissionDesk {
  private readonly state: GameState;
  private readonly host: MissionDeskHost;

  constructor(state: GameState, host: MissionDeskHost) {
    this.state = state;
    this.host = host;
  }

  /** The skeletons on offer where she stands. Empty in flight, as the board is. */
  offers(): Skeleton[] {
    if (this.host.baseMode() !== 'docked') return [];
    const c = this.state.commander;
    return offersFor(c.missions, { commander: missionFacts(c), systems: this.state.systems, rng: () => 0 });
  }

  /**
   * Start a mission. The machine places its first leg with the world's own
   * generator, the bridge installs the record, and the checkpoint follows
   * both. The gun warning is QUEUED behind the order it explains. A line said
   * in the same frame takes the console from the line before it (session.ts,
   * found by docs/TODO/144 M3).
   */
  accept(index: number): void {
    const offer = this.offers()[index];
    if (!offer) return;
    const c = this.state.commander;
    for (const m of runMissions(c, { kind: 'accept', skeleton: offer.id }, this.state.systems)) {
      this.host.sayEvent(m);
    }
    const live = c.missions.live.find((l) => l.skeleton === offer.id);
    const warning = live ? missionWarning(c, live) : '';
    if (warning) this.host.queueMessage(warning, 8);
    this.host.checkpoint();
  }

  /**
   * Give a mission up. It fails by its own final outcome, and the slot frees.
   * Its lead survives the failure (docs/TODO/190, failure rule 3). The
   * checkpoint is written only at a station, where a checkpoint means a dock.
   */
  abandon(index: number): void {
    const c = this.state.commander;
    const live = c.missions.live[index];
    if (!live) return;
    for (const m of runMissions(c, { kind: 'abandon', skeleton: live.skeleton }, this.state.systems)) {
      this.host.sayEvent(m);
    }
    if (this.host.baseMode() === 'docked') this.host.checkpoint();
  }
}
