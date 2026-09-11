// What the Game does with the target list: the list it shows, and the pick it
// applies (docs/TODO/206 M3).
//
// `targets.ts` decides the list, and it holds the pick as a flag on a ship.
// This file joins the list to the buttons. It gives each ship a code for its
// button, and it applies a press. It is the target list's twin of
// `course-actions.ts`.
//
// A ROW'S CODE NAMES ONE SHIP, not a place in the list. The list is in order
// of range, and the order moves every frame. A code built from a row's place
// could pick the ship that moved into that place between the paint and the
// tap. So each ship gets a number the first time it is listed, and keeps it
// while it lives. The number is for the buttons only, and no save carries it.

import type { Input } from '../engine/input.ts';
import type { NpcShip } from './npc.ts';
import type { GameState } from './state.ts';
import { pickTarget, pickedTarget, targetList, type TargetRow } from './targets.ts';
import { TARGET_NONE_KEY, TARGET_ROW_PREFIX, TARGETS_KEY } from './bindings.ts';

/** What the target buttons show. */
export interface TargetPanel {
  /** the list is open */
  readonly open: boolean;
  /** each row with the code its button sends */
  readonly rows: readonly { readonly code: string; readonly row: TargetRow }[];
  /** the picked ship's row, if the pick still lives and is listed */
  readonly picked: TargetRow | null;
}

export class TargetActions {
  private readonly state: () => GameState;
  /** the list is open. It is what the buttons show, so no save carries it */
  private opened = false;
  private readonly ids = new WeakMap<NpcShip, number>();
  private next = 1;

  constructor(state: () => GameState) {
    this.state = state;
  }

  private codeFor(ship: NpcShip): string {
    let id = this.ids.get(ship);
    if (id === undefined) {
      id = this.next++;
      this.ids.set(ship, id);
    }
    return `${TARGET_ROW_PREFIX}${id}`;
  }

  private list(): TargetRow[] {
    const s = this.state();
    return targetList({
      npcs: s.world.npcs,
      playerPos: s.player.position,
      legalStatus: s.commander.legalStatus,
      playerToStation: s.player.position.distanceTo(s.world.station.position),
    });
  }

  panel(): TargetPanel {
    const rows = this.list();
    return {
      open: this.opened,
      rows: rows.map((row) => ({ code: this.codeFor(row.ship), row })),
      picked: rows.find((r) => r.picked) ?? null,
    };
  }

  /**
   * A target button was pressed. A row picks its ship and hands the stick to
   * the computer, as a course pick does. The last row lets the computer choose
   * again. A pick closes the list.
   */
  read(i: Input): void {
    const s = this.state();
    if (i.pressed(TARGETS_KEY)) {
      this.opened = !this.opened;
      return;
    }
    if (i.pressed(TARGET_NONE_KEY)) {
      pickTarget(s.world.npcs, null);
      this.opened = false;
      return;
    }
    for (const row of this.list()) {
      if (i.pressed(this.codeFor(row.ship))) {
        pickTarget(s.world.npcs, row.ship);
        s.session.handFlown = false;
        this.opened = false;
        return;
      }
    }
  }

  /** The picked ship, for a caller that needs the ship rather than a row. */
  picked(): NpcShip | null {
    return pickedTarget(this.state().world.npcs);
  }
}
