// The MISSIONS screen: what is on offer here, what she holds, and the two
// keys that change either.
//
// The screen GitHub #27 asked for. A briefing said one time, for five seconds,
// and then unreachable, is the same as no briefing at all. So every live
// mission has a row here, with its world, its fee and what her gun is worth.
//
// It is also where a mission STARTS, since docs/TODO/190. Nothing starts on
// its own any more, the Constrictor included. An offer is a row until she
// accepts it. Acceptance is the station's, as a contract's is. Abandonment is
// hers anywhere, because a mission she cannot finish should not hold a slot
// until she next docks.
//
// THE PATRONS' ORDERS ONLY, since docs/TODO/145. Board work has its own
// screen. A contract and a mission are two kinds of thing.
//
// It reads and it asks. `game/mission-desk.ts` owns what accepting means.

import { renderMissions, type HeldRow, type OfferRow } from '../../ui/screens.ts';
import type { Screen, ScreenOutcome } from '../../ui/screen-host.ts';
import type { CommanderData } from '../commander.ts';
import { standingOrders, type MissionOrder } from '../orders.ts';
import type { Dossier, Skeleton } from '../../missions/model.ts';
import { dossierFor } from '../../missions/dossiers.ts';
import { leadLine } from '../../missions/hints.ts';
import { patronFor } from '../../missions/patrons.ts';
import { fillSlots } from '../../missions/text.ts';
import { acceptedAt, missionName } from '../../missions/queries.ts';
import { legChoices } from '../../missions/queries.ts';
import { skeletonById } from '../../missions/skeletons/index.ts';
import { missionFacts } from '../mission-bridge.ts';
import type { StarSystem } from '../../galaxy/galaxy.ts';
import type { Input } from '../../engine/input.ts';

export interface MissionsContext {
  readonly commander: CommanderData;
  readonly systems: StarSystem[];
  /** the skeletons on offer where she stands; empty in flight */
  readonly offers: readonly Skeleton[];
  /** a mission starts at a station, as a contract does */
  readonly atStation: boolean;
  /** start `offers[index]` — the Game owns what accepting means */
  accept(index: number): void;
  /** give up the live mission at `index` of the held rows */
  abandon(index: number): void;
  /** answer a choice the live mission at `index` waits on */
  choose(index: number, id: string): void;
  /** the dossier table; a test empties it, and the game uses the committed one */
  readonly dossiers?: (id: string) => Dossier | null;
}

export class MissionsScreen implements Screen {
  readonly id = 'missions' as const;
  private readonly ctx: () => MissionsContext;
  /** the cursor: offers first, then held missions, one row each */
  selected = 0;

  constructor(ctx: () => MissionsContext) {
    this.ctx = ctx;
  }

  open(): void {
    this.selected = 0;
    this.render();
  }

  private held(): MissionOrder[] {
    const { commander, systems } = this.ctx();
    return standingOrders(commander, systems)
      .filter((o): o is MissionOrder => o.kind === 'mission');
  }

  /**
   * The rows, each with its patron's name (docs/TODO/191 M1). An offer's
   * local patron runs this station. A held job's ran the station it was
   * taken at, which is not where she reads the row. An offer shows its
   * dossier's title and briefing, with the patron and this world filled in.
   * It shows the skeleton's plain pitch when no dossier exists (M3).
   */
  render(): void {
    const { commander, systems, offers, atStation, dossiers = dossierFor } = this.ctx();
    const facts = missionFacts(commander);
    const leads = commander.missions.leads.map((l) => leadLine(l, facts, systems, dossiers));
    const offerRows: OfferRow[] = offers.map((s) => {
      const patron = patronFor(s.patron, facts, systems);
      const d = dossiers(s.id);
      const slots = { PATRON: patron.name, HERE: systems[commander.systemIndex].name };
      return {
        pitch: s.pitch, patron: patron.name,
        title: d?.title ?? '', pages: (d?.briefing ?? []).map((p) => fillSlots(p, slots)),
      };
    });
    // A held row keeps the offer's title and pages (docs/TODO/201). The
    // `{HERE}` slot is the world it was accepted at, which is where the
    // patron spoke, and not where she reads the row.
    const heldRows: HeldRow[] = this.held().map((o) => {
      const s = skeletonById(o.live.skeleton);
      const origin = acceptedAt(commander.missions, o.live.skeleton);
      const patron = s ? patronFor(s.patron, facts, systems, origin).name : '';
      const d = dossiers(o.live.skeleton);
      const slots = { PATRON: patron, HERE: systems[origin ?? commander.systemIndex].name };
      return {
        ...o,
        patron,
        choices: s ? legChoices(s, o.live.leg) : [],
        title: d?.title ?? missionName(commander.missions, o.live, systems),
        pages: (d?.briefing ?? []).map((p) => fillSlots(p, slots)),
      };
    });
    renderMissions({
      offers: offerRows, held: heldRows, leads, systems, selected: this.selected, atStation,
    });
  }

  select(row: number): void {
    this.selected = row;
    this.render();
  }

  input(i: Input): ScreenOutcome {
    const { offers, atStation } = this.ctx();
    const rows = offers.length + this.held().length;
    let redraw = false;
    if (i.pressed('ArrowUp') || i.pressed('KeyW')) {
      this.selected = Math.max(0, this.selected - 1);
      redraw = true;
    }
    if (i.pressed('ArrowDown') || i.pressed('KeyS')) {
      this.selected = Math.min(Math.max(0, rows - 1), this.selected + 1);
      redraw = true;
    }
    // REFUSED rather than hidden in flight, as the contracts screen refuses.
    // The key still arrives. A live key behind an absent control is the "dead
    // control that looks alive" failure, the other way round.
    if ((i.pressed('KeyA') || i.pressed('Enter')) && atStation && this.selected < offers.length) {
      this.ctx().accept(this.selected);
      redraw = true;
    }
    if (i.pressed('KeyX') && this.selected >= offers.length) {
      this.ctx().abandon(this.selected - offers.length);
      redraw = true;
    }
    // A choice is a digit on the held row that waits on one. A digit past
    // the last option, or on a row with none, does nothing.
    if (this.selected >= offers.length) {
      const held = this.held()[this.selected - offers.length];
      const s = held ? skeletonById(held.live.skeleton) : null;
      const choices = s ? legChoices(s, held.live.leg) : [];
      choices.forEach((id, k) => {
        if (i.pressed(`Digit${k + 1}`)) { this.ctx().choose(this.selected - offers.length, id); redraw = true; }
      });
    }
    if (redraw) {
      const left = this.ctx().offers.length + this.held().length;
      this.selected = Math.max(0, Math.min(this.selected, left - 1));
      this.render();
    }
    if (i.pressed('Escape')) return 'back';
    return 'stay';
  }
}
