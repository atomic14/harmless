// A name typed at the station: the name of a SAVE, and the name of the
// COMMANDER.
//
// Two screens, one keyboard (`typed-name.ts`), and one thing to keep straight.
// They act on different nouns. A save's name IS its identity on the shelf, so a
// name that already exists replaces the save it names. A commander's name is
// what the pilot is CALLED today, and it deliberately moves no save at all.
//
// Split out of `saves.ts` in docs/TODO/55. That file is about the list of saves
// and what you can do to it. The list took on a load confirmation there, and a
// name was never the same subject. "The list AND naming AND renaming" is the
// sort of header that says a file holds more than one subject.
//
// `SavesContext` is still `saves.ts`'s. It is the slice of the Game every
// screen over the shelf sees. A second copy of it would be a second answer to
// what these screens may touch.

import { DEFAULT_NAME } from '../../constants/commander.ts';
import { namedSaveExists } from '../storage.ts';
import { normaliseSaveName } from '../save-file.ts';
import { typedName } from './typed-name.ts';
import type { SavesContext } from './saves.ts';
import {
  renderNaming, renderSavePrompt,
} from '../../ui/screens-career.ts';
import type { Screen, ScreenOutcome } from '../../ui/screen-host.ts';
import type { Input } from '../../engine/input.ts';
import { sfx } from '../../audio.ts';

/**
 * The name of a save, typed. Elite-style: letters straight in, no DOM focus to
 * fight.
 *
 * The name IS the identity of a manual save, so a name that already exists
 * REPLACES the save it names. The default offered is the commander's own name.
 * So a second career would otherwise overwrite the first on two presses of
 * Enter. It asks first (decision 4).
 */
export class SavePromptScreen implements Screen {
  readonly id = 'save-name' as const;
  private buffer = '';
  /** true until the player types: the offered default is replaced, not appended */
  private pristine = true;
  private confirming = false;

  private readonly ctx: () => SavesContext;

  constructor(ctx: () => SavesContext) {
    this.ctx = ctx;
  }

  open(): void {
    this.buffer = normaliseSaveName(this.ctx().commander.name) || DEFAULT_NAME;
    this.pristine = true;
    this.confirming = false;
    this.render();
  }

  render(): void {
    renderSavePrompt(this.buffer, this.confirming);
  }

  input(i: Input): ScreenOutcome {
    const ctx = this.ctx();
    if (i.pressed('Escape')) {
      if (!this.confirming) return 'back';
      this.confirming = false;
      this.render();
      return 'stay';
    }
    if (this.confirming) {
      if (i.pressed('KeyY') || i.pressed('Enter')) return this.write(ctx);
      if (i.pressed('KeyN')) { this.confirming = false; this.render(); }
      return 'stay';
    }
    if (i.pressed('Enter')) {
      const name = normaliseSaveName(this.buffer);
      if (!name) {
        ctx.message('A SAVE NEEDS A NAME', 3);
        sfx.refused();
        return 'stay';
      }
      if (namedSaveExists(name)) {
        this.confirming = true;
        this.render();
        return 'stay';
      }
      return this.write(ctx);
    }
    const typed = typedName(this.buffer, this.pristine, i);
    if (typed) {
      this.buffer = typed.buffer;
      this.pristine = typed.pristine;
      this.render();
    }
    return 'stay';
  }

  private write(ctx: SavesContext): ScreenOutcome {
    const name = normaliseSaveName(this.buffer);
    const result = ctx.saveNamed(name);
    if (result === 'ok') {
      ctx.message(`SAVED AS ${name}`, 3);
      sfx.commanderNamed();
      return 'back';
    }
    ctx.message(result === 'full'
      ? 'NO ROOM FOR ANOTHER SAVE — DELETE ONE FIRST'
      : 'SAVE FAILED — STORAGE FULL. NOTHING WAS CHANGED', 5);
    sfx.refused();
    return 'back';
  }
}

/**
 * A new name for the COMMANDER, which is not the same act as a name for a save.
 *
 * WHAT IT DOES is stated on the screen rather than left to be found out. It
 * changes what you are CALLED, which is `CommanderData.name`. The status
 * screen, the docked menu and the save prompt all show that name. It does NOT
 * move your saves. They stay filed under the name you were created with, which
 * is what `save:auto:<CAREER>:*` is keyed by (save-file.ts).
 *
 * That is a decision, not an omission (docs/TODO/56). A move would be a write
 * across five keys: the checkpoint, three flight slots and the boot pointer.
 * It would hold a half-done state in the middle. TODO 44's rule is that nothing
 * may be deleted on the strength of a write that failed. A rename that half
 * succeeded would leave a commander addressable under two names, or under
 * neither. So the cheap act stays cheap, and the screen says what it did.
 *
 * It is pushed on top of the file list rather than a peer mode beside it. So a
 * cancel is just `back`, and the list underneath re-paints itself. It owns its
 * own buffer, because nothing else has any business to read a half-typed name.
 */
export class NamingScreen implements Screen {
  readonly id = 'naming' as const;
  private buffer = '';

  private readonly ctx: () => SavesContext;

  constructor(ctx: () => SavesContext) {
    this.ctx = ctx;
  }

  open(): void {
    // Start blank. A default in the buffer looks helpful, but there is no
    // way to select it. A new name would then go on the end of the old one.
    this.buffer = '';
    this.render();
  }

  render(): void {
    const ctx = this.ctx();
    renderNaming(this.buffer, ctx.commander.name, ctx.career);
  }

  input(i: Input): ScreenOutcome {
    const ctx = this.ctx();
    if (i.pressed('Escape')) return 'back';
    if (i.pressed('Enter')) {
      const name = normaliseSaveName(this.buffer) || DEFAULT_NAME;
      ctx.commander.name = name;
      ctx.checkpoint();
      // Both halves, because the second half is the one that surprises. A
      // player who just took a new name is about to look at the list.
      ctx.message(`COMMANDER ${name} — SAVES STAY FILED UNDER ${ctx.career}`, 4);
      sfx.commanderNamed();
      return 'back';
    }
    const typed = typedName(this.buffer, false, i);
    if (typed) {
      this.buffer = typed.buffer;
      this.render();
    }
    return 'stay';
  }
}
