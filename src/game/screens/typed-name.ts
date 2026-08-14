// One frame of a typed name, Elite-style: letters straight in, no DOM focus to
// fight, and no text field to select.
//
// ONE HOME, because THREE screens take a name. They are a save's and a rename
// (screens/saves.ts), and a new commander's (screens/new-commander.ts). The
// keys all three accept have to be the alphabet `normaliseSaveName` keeps.
// Otherwise a name is one thing on the way in and another on the way out.
//
// It lived in `saves.ts` until docs/TODO/55. That file is about the shelf, and
// the keyboard belongs to the screen that takes the name, not to the list.

import { MAX_SAVE_NAME } from '../../constants/saves.ts';
import type { Input } from '../../engine/input.ts';

/**
 * @param pristine true while the buffer still holds an offered default. The
 * first keystroke REPLACES that default rather than appends to it. There is no
 * way to select text on these screens. A pre-filled field would otherwise put
 * the new name on the end of the old one. A screen that offers no default
 * passes false, and can ignore the flag on the way back.
 * @returns the buffer after the frame. It returns null when nothing this
 * function accepts was pressed, so a caller re-renders only after a change.
 */
export function typedName(
  buffer: string, pristine: boolean, i: Input,
): { buffer: string; pristine: boolean } | null {
  let next = buffer;
  let fresh = pristine;
  let changed = false;
  if (i.pressed('Backspace')) {
    if (fresh) { next = ''; fresh = false; } else next = next.slice(0, -1);
    changed = true;
  }
  for (const code of i.drainPresses()) {
    const m = /^(?:Key([A-Z])|Digit([0-9])|Space)$/.exec(code);
    if (!m) continue;
    if (fresh) { next = ''; fresh = false; }
    if (next.length >= MAX_SAVE_NAME) break;
    next += code === 'Space' ? ' ' : (m[1] ?? m[2]);
    changed = true;
  }
  return changed ? { buffer: next, pristine: fresh } : null;
}
