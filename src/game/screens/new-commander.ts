// A new commander: who they are, and where the last one goes.
//
// Split from `screens/saves.ts`, because it is a different act from a save on
// the shelf. The name typed here is what `save:auto:<CAREER>:*` is keyed by
// (save-file.ts). So it is the one name in the game that nobody may hand out
// twice. The game ASKS for it rather than generates it. A name already in use
// is REFUSED rather than quietly suffixed: a game that answers JAMESON with
// JAMESON 2 named your character for you.

import { normaliseSaveName } from '../save-file.ts';
import { bootNewCommander, commanderNameTaken } from '../storage.ts';
import {
  renderNewCommander,
} from '../../ui/screens-career.ts';
import { typedName } from './typed-name.ts';
import type { SavesContext } from './saves.ts';
import type { Screen, ScreenOutcome } from '../../ui/screen-host.ts';
import type { Input } from '../../engine/input.ts';
import { sfx } from '../../audio.ts';

/**
 * Put the commander at the stick DOWN, and begin `name` beside them.
 *
 * It writes the checkpoint of the commander it sets aside, which is one of the
 * saves the panel promises stays put. Then it aims the next boot AWAY from the
 * shelf. `bootNewCommander(name)` says "none of the existing records, and here
 * is who to start instead".
 *
 * That is NOT a cleared pointer. `bootSave` reads a cleared pointer as "lost",
 * and answers with the newest record on the shelf: the commander you just put
 * down, autosaves and all. The boot on the far side of the reload builds the
 * new commander (storage.ts).
 *
 * @returns false when the store would not take the pointer. Nothing changed and
 * nothing is lost, but the caller must not claim otherwise.
 */
export function startNewCommander(ctx: SavesContext, name: string): boolean {
  ctx.checkpoint();
  if (!bootNewCommander(name)) return false;
  location.reload();
  return true;
}

/**
 * The prompt that names a new commander. It is the third use of the same
 * keyboard; a save's name and a pilot's new name are the other two (saves.ts).
 *
 * It starts BLANK and refuses an empty name, because the only default it could
 * offer is a suffix of a name somebody else chose. It also refuses a name
 * already at the stick. Two commanders under one name would share an autosave
 * group, and the second one's first dock would evict the first one's way back.
 */
export class NewCommanderScreen implements Screen {
  readonly id = 'new-name' as const;
  private buffer = '';

  private readonly ctx: () => SavesContext;

  constructor(ctx: () => SavesContext) {
    this.ctx = ctx;
  }

  open(): void {
    this.buffer = '';
    this.render();
  }

  render(): void {
    renderNewCommander(this.buffer, this.ctx().commander.name);
  }

  input(i: Input): ScreenOutcome {
    const ctx = this.ctx();
    if (i.pressed('Escape')) return 'back';
    if (i.pressed('Enter')) return this.begin(ctx);
    const typed = typedName(this.buffer, false, i);
    if (typed) {
      this.buffer = typed.buffer;
      this.render();
    }
    return 'stay';
  }

  private begin(ctx: SavesContext): ScreenOutcome {
    const name = normaliseSaveName(this.buffer);
    if (!name) {
      ctx.message('A COMMANDER NEEDS A NAME', 3);
      sfx.refused();
      return 'stay';
    }
    if (commanderNameTaken(name)) {
      // Refused rather than made unique, which is the point of the whole
      // item. A game that silently answers BOB with BOB 2 named the character.
      ctx.message(`${name} IS ALREADY FLYING — CHOOSE ANOTHER NAME`, 4);
      sfx.refused();
      return 'stay';
    }
    // The page is on its way out; whatever this returns is never painted.
    if (startNewCommander(ctx, name)) return 'stay';
    // ...unless the pointer never landed. This session is then still the
    // commander it was. A silence here leaves the player in front of a
    // confirmation that just promised them Lave and 100.0 Cr.
    ctx.message('STORAGE FULL — YOU ARE STILL FLYING THIS COMMANDER', 5);
    sfx.refused();
    return 'back';
  }
}
