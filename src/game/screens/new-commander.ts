// Starting a new commander: asking who they are, and putting the last one down.
//
// Split from `screens/saves.ts` because it is a different act from filing a
// save. The name typed here is what `save:auto:<CAREER>:*` is keyed by
// (save-file.ts), so it is the one name in the game that cannot be handed out
// twice. It is ASKED for, not generated, and a name already in use is REFUSED
// rather than quietly suffixed: a game that answers JAMESON with JAMESON 2 has
// named your character for you.

import { normaliseSaveName } from '../save-file.ts';
import { bootNewCommander, commanderNameTaken } from '../storage.ts';
import { renderNewCommander } from '../../ui/screens.ts';
import { typedName } from './typed-name.ts';
import type { SavesContext } from './saves.ts';
import type { Screen, ScreenOutcome } from '../../ui/screen-host.ts';
import type { Input } from '../../engine/input.ts';
import { sfx } from '../../audio.ts';

/**
 * Put the commander you are flying DOWN, and begin `name` beside them.
 *
 * Writes the checkpoint of the one being set aside (one of the saves the panel
 * promises stays put), then aims the next boot AWAY from the shelf.
 * `bootNewCommander(name)` says "none of the existing records, and here is who
 * to start instead" — NOT a cleared pointer, which `bootSave` reads as "lost"
 * and answers with the newest record on the shelf (the commander you just put
 * down, autosaves and all). The boot on the far side of the reload builds the
 * new commander (storage.ts).
 *
 * @returns false when the store would not take the pointer — nothing has
 * changed and nothing has been lost, but the caller must not claim otherwise.
 */
export function startNewCommander(ctx: SavesContext, name: string): boolean {
  ctx.checkpoint();
  if (!bootNewCommander(name)) return false;
  location.reload();
  return true;
}

/**
 * The prompt that names a new commander. The third use of the same keyboard —
 * naming a save and renaming a pilot are the other two (saves.ts).
 *
 * It starts BLANK and refuses an empty name, because the only default it could
 * offer is a suffix of a name somebody else chose. And it refuses a name that is
 * already flying: two commanders under one name would share an autosave group,
 * and the second one's first docking would evict the first one's way back.
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
      // Refused rather than made unique, which is the point of the whole item:
      // a game that silently answers BOB with BOB 2 has named the character.
      ctx.message(`${name} IS ALREADY FLYING — CHOOSE ANOTHER NAME`, 4);
      sfx.refused();
      return 'stay';
    }
    // The page is on its way out; whatever this returns is never painted.
    if (startNewCommander(ctx, name)) return 'stay';
    // ...unless the pointer never landed, in which case this session is still
    // the commander it was, and saying nothing would leave the player looking
    // at a confirmation that had just promised them Lave and 100.0 Cr.
    ctx.message('STORAGE FULL — YOU ARE STILL FLYING THIS COMMANDER', 5);
    sfx.refused();
    return 'back';
  }
}
