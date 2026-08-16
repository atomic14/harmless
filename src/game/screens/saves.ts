// The commander file: the saves you made, the saves the game made, and the
// three screens over them.
//
// `storage.ts` owns where a save lives. `save-file.ts` owns what one is, and
// what one costs to take. What lives here is the half above both:
//
//   - the list;
//   - the deliberate act that gives a save a name;
//   - a commander renamed;
//   - the keyboard state machine for each, behind the Screen contract
//     (invariant 13).
//
// Three neighbours take the rest. A name typed in is `typed-name.ts`. A save
// that leaves the browser is `save-transfer.ts`. A commander STARTED is
// `new-commander.ts`.
//
// It follows the same discipline as NpcShip. These screens decide nothing about
// game state. They return an OUTCOME and the host applies it, so the mode
// machine stays in one place.
//
// NOTHING HERE WRITES BECAUSE SOMEBODY LOOKED (docs/TODO/55). The run in
// progress is a LINE ABOVE THE TABLE, read out of state. It is not a checkpoint
// filed on open. A screen that files a save the moment you press S is one you
// cannot open merely to check something.

import { generateGalaxy } from '../../galaxy/galaxy.ts';
import type { CommanderData } from '../commander.ts';
import { deleteSave, listSaves, setBootId } from '../storage.ts';
import {
  loadCost, newestFirst, saveLabel, summariseSave,
  type LiveRun, type SaveSummary,
} from '../save-file.ts';
import { rating } from '../rating.ts';
import type { WorldSnapshot } from '../snapshot.ts';
import {
  renderSaves,
} from '../../ui/screens-career.ts';
import type { Screen, ScreenOutcome } from '../../ui/screen-host.ts';
import type { StarSystem } from '../../galaxy/galaxy.ts';
import type { Input } from '../../engine/input.ts';
import { sfx } from '../../audio.ts';

/** The slice of the Game the screens over the shelf are allowed to see. */
export interface SavesContext {
  readonly commander: CommanderData;
  readonly systems: StarSystem[];
  /** which career's autosaves this session writes — see state.ts */
  readonly career: string;
  /**
   * The ship is destroyed. It is read, and never set here.
   *
   * This screen is reachable over a wreck, because the game-over panel offers
   * it. Three of its promises hold only for a commander who still has a ship:
   *
   *   1. a checkpoint that can be written;
   *   2. a run that can be lost;
   *   3. a name worth a change.
   */
  readonly dead: boolean;
  message(text: string, seconds: number): void;
  /** the whole world right now, for a save that is about to be written */
  capture(): WorldSnapshot;
  /**
   * Write the career's docked checkpoint before we leave it.
   * @returns whether the bytes landed — false for a full store, and false for a
   * dead commander, who has nothing to check-point.
   */
  checkpoint(): boolean;
  /** write a save the player named. The result is the reply, not an exception. */
  saveNamed(name: string): 'ok' | 'full' | 'failed';
}

/**
 * A save need not sit in the galaxy this session plays. So the system name
 * resolves per galaxy, and it is cached for the length of one render.
 */
function systemNamer(ctx: SavesContext): (galaxy: number, index: number) => string {
  const cache = new Map<number, StarSystem[]>([[ctx.commander.galaxy, ctx.systems]]);
  return (galaxy, index) => {
    let systems = cache.get(galaxy);
    if (!systems) {
      systems = generateGalaxy(galaxy);
      cache.set(galaxy, systems);
    }
    return systems[index]?.name.toUpperCase() ?? '?';
  };
}

/** Every save on the shelf, as rows: named saves first, then autosaves. */
function saveRows(ctx: SavesContext): SaveSummary[] {
  const name = systemNamer(ctx);
  const now = Date.now();
  const rows = listSaves()
    .map(({ id, record }) => summariseSave(id, record, now, name))
    .filter((s): s is SaveSummary => s !== null);
  const named = rows.filter((r) => r.kind === 'file').sort(newestFirst);
  // The docked checkpoint leads the autosaves because it is the one that is
  // always safe to take — decision 3.
  const auto = rows.filter((r) => r.kind !== 'file')
    .sort((a, b) => (a.kind === b.kind ? newestFirst(a, b) : a.kind === 'dock' ? -1 : 1));
  return [...named, ...auto];
}

/**
 * The way back after a death: this career's docked checkpoint.
 *
 * By construction the state you left the station in, because it is written on
 * docking AND immediately before launch (station.ts).
 */
export function checkpointSummary(ctx: SavesContext): SaveSummary | null {
  const rows = saveRows(ctx);
  return rows.find((r) => r.kind === 'dock' && r.career === ctx.career) ?? null;
}

/**
 * The run in progress, for the line above the table.
 *
 * Read out of state rather than filed as a checkpoint on open: costs nothing and
 * cannot lose anything (docs/TODO/55).
 */
function liveRun(ctx: SavesContext): LiveRun {
  const c = ctx.commander;
  return {
    career: ctx.career,
    name: c.name,
    place: systemNamer(ctx)(c.galaxy, c.systemIndex),
    credits: c.credits,
    rating: rating(c.combatScore ?? c.kills ?? 0).toUpperCase(),
    day: c.day ?? 0,
    over: ctx.dead,
  };
}

/** The commander file: everything on the shelf, and what you can do to it. */
export class SavesScreen implements Screen {
  readonly id = 'saves' as const;
  private selected = 0;
  private rows: SaveSummary[] = [];
  /** a delete that needs a Y — no delete of a save can be undone */
  private pendingDelete: SaveSummary | null = null;
  /**
   * ...and a load that needs a second Enter, for a worse reason. A delete costs
   * you a save you can see. A load can cost you the run you are in, and that
   * run is not on the list at all (docs/TODO/55). The panel names both sides
   * first, and ESC backs out.
   */
  private pendingLoad: SaveSummary | null = null;

  private readonly ctx: () => SavesContext;

  constructor(ctx: () => SavesContext) {
    this.ctx = ctx;
  }

  /** A look at the shelf. It writes NOTHING — see this file's header. */
  open(): void {
    this.selected = 0;
    this.pendingDelete = null;
    this.pendingLoad = null;
    this.render();
  }

  render(): void {
    const ctx = this.ctx();
    this.rows = saveRows(ctx);
    if (this.selected >= this.rows.length) this.selected = Math.max(0, this.rows.length - 1);
    const live = liveRun(ctx);
    renderSaves(this.rows, this.selected, live, {
      deleting: this.pendingDelete,
      loading: this.pendingLoad && { row: this.pendingLoad, cost: loadCost(this.pendingLoad, live) },
    });
  }

  select(row: number): void {
    // A confirmation is modal: the question names a row, so the row it names
    // must not move under it.
    if (this.pendingDelete || this.pendingLoad) return;
    this.selected = Math.max(0, Math.min(this.rows.length - 1, row));
    this.render();
  }

  input(i: Input): ScreenOutcome {
    const ctx = this.ctx();
    if (this.pendingDelete) return this.confirmDelete(i, ctx);
    if (this.pendingLoad) return this.confirmLoad(i, ctx);
    const n = this.rows.length;
    // Arrows only. Every other list screen also takes W/S, and this is the one
    // screen where S means something else — it SAVES.
    if (n > 0 && i.pressed('ArrowUp')) {
      this.selected = (this.selected + n - 1) % n;
      this.render();
    }
    if (n > 0 && i.pressed('ArrowDown')) {
      this.selected = (this.selected + 1) % n;
      this.render();
    }
    if (i.pressed('KeyS')) {
      // A wreck captures as a DOCKED world at the point of death. So a save of
      // one, loaded back, would be a way to un-die. The panel does not offer S
      // over a wreck. This is the same answer, for the key.
      if (ctx.dead) {
        ctx.message('YOUR SHIP IS GONE — THERE IS NOTHING LEFT TO SAVE', 4);
        sfx.refused();
        return 'stay';
      }
      return { open: 'save-name' };
    }
    if (i.pressed('KeyR')) {
      // A rename writes a checkpoint, to hold the new name. A dead commander
      // has none to write. So the panel offers it to a live one only.
      if (ctx.dead) return 'stay';
      return { open: 'naming' };
    }
    if (i.pressed('KeyD')) {
      const row = this.rows[this.selected];
      if (!row) return 'stay';
      if (row.kind === 'dock' && row.career === ctx.career) {
        ctx.message('THAT AUTOSAVE IS YOUR WAY BACK — IT CANNOT BE DELETED', 4);
        sfx.refused();
        return 'stay';
      }
      this.pendingDelete = row;
      this.render();
      return 'stay';
    }
    if (i.pressed('Enter')) {
      const row = this.rows[this.selected];
      if (!row) return 'back';
      this.pendingLoad = row;
      this.render();
      return 'stay';
    }
    if (i.pressed('Escape')) return 'back';
    return 'stay';
  }

  private confirmDelete(i: Input, ctx: SavesContext): ScreenOutcome {
    if (i.pressed('KeyY')) {
      deleteSave(this.pendingDelete!.id);
      ctx.message(`DELETED ${saveLabel(this.pendingDelete!)}`, 3);
      sfx.commanderDeleted();
      this.pendingDelete = null;
      this.render();
      return 'stay';
    }
    if (i.pressed('Escape') || i.pressed('KeyN')) {
      this.pendingDelete = null;
      this.render();
    }
    return 'stay';
  }

  /**
   * The second Enter. Every load in this file is a `location.reload()`, so the
   * whole act is: keep where we are, aim the boot pointer, and go.
   */
  private confirmLoad(i: Input, ctx: SavesContext): ScreenOutcome {
    const row = this.pendingLoad!;
    if (i.pressed('Escape') || i.pressed('KeyN')) {
      this.pendingLoad = null;
      this.render();
      return 'stay';
    }
    // The remedy the panel offers, and it stacks. The prompt returns here, and
    // the run carries a name by the second Enter.
    if (i.pressed('KeyS') && !ctx.dead) return { open: 'save-name' };
    if (!i.pressed('Enter')) return 'stay';
    // Write the run we leave, before we leave it. A commander just told "PUT
    // DOWN AT LAVE AS YOU ARE NOW" must not lose that quietly. A refused
    // checkpoint is the one case where a load really does cost the run. So a
    // refused checkpoint refuses the load instead (docs/TODO/44's rule).
    if (!ctx.dead && !ctx.checkpoint()) {
      ctx.message('STORAGE FULL — COULD NOT KEEP THIS RUN, SO NOTHING WAS LOADED', 5);
      sfx.refused();
      this.pendingLoad = null;
      this.render();
      return 'stay';
    }
    if (!setBootId(row.id)) {
      // A refused pointer would reload into the NEWEST save rather than the
      // one that was picked, which is a load nobody asked for. Say so and
      // stay: the shelf is untouched either way.
      ctx.message('STORAGE FULL — COULD NOT SWITCH SAVES', 4);
      sfx.refused();
      this.pendingLoad = null;
      this.render();
      return 'stay';
    }
    location.reload();
    return 'stay';
  }
}
