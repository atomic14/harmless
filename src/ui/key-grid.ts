// The key grid: the letters a finger types on a screen that takes a name.
//
// A phone has no keyboard. Three screens take a typed name, and the two
// charts find a system by typed letters. Each reads the keys through
// `Input.drainPresses`, and a tap on a `data-key` button is the same
// keystroke (invariant 13). So the grid is buttons that carry the key codes
// the screens already read, and no screen changes for it (docs/TODO/216 M1).
//
// Ten columns, so the digits are one row and the alphabet is three. The
// fourth row ends in two wide keys. The stylesheet holds the shape under
// `#screen .keys`.
//
// Two kinds. A NAME takes digits, letters, SPACE and DEL, which is the
// alphabet `normaliseSaveName` keeps. A FIND takes letters, DEL and ENTER,
// because the chart's search (game/screens/chart-search.ts) ends on Enter
// and keeps the cursor on the match. It takes no digit, because no system's
// name has one.

/** What the grid offers: the alphabet of a name, or the letters of a search. */
export type KeyGridKind = 'name' | 'find';

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const digits = '1234567890';

/** One key. `wide` spans two columns, for a word rather than a letter. */
const key = (code: string, label: string, wide = false): string =>
  `<button data-key="${code}"${wide ? ' class="wide"' : ''}>${label}</button>`;

/** The grid, as markup. `show()` paints it with the rest of the screen. */
export function keyGrid(kind: KeyGridKind): string {
  const numbers = kind === 'name' ? [...digits].map((d) => key(`Digit${d}`, d)) : [];
  const letters = [...alphabet].map((l) => key(`Key${l}`, l));
  const tail = kind === 'name'
    ? [key('Space', 'SPACE', true), key('Backspace', 'DEL', true)]
    : [key('Backspace', 'DEL', true), key('Enter', 'ENTER', true)];
  return `<div class="keys">${[...numbers, ...letters, ...tail].join('')}</div>`;
}
