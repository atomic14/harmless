// The phosphor: every colour this project paints with, in one file.
//
// It was in fourteen places in three spellings:
//
//   - a hex in a stylesheet;
//   - the same hex twenty lines below its own const;
//   - the same colour again in decimal inside an `rgba()`.
//
// docs/TODO/93 is that sweep, and this is where it swept to.
// `tools/palette.ts check` is the gate that keeps it swept. Nothing outside
// this file and its generated stylesheet may spell one of these values, in
// `#rgb`, `0xrgb` or `rgba()`.
//
// TypeScript owns the values and CSS RECEIVES them, generated into
// `palette.css` by `npm run generate:palette`. Nothing pushes them onto the
// document at boot, which is how `--sight-r` and `--chart-side` reach CSS.
// Those two come out of game rules, and only the live game knows them. A
// colour is known before anything runs. Three of the pages that need it
// execute no JavaScript at all: index.html, novella.html, and the
// encyclopaedia that a crawler reads.
//
// This file imports nothing and touches no platform, so game code, the shell,
// the dev pages and the build-time encyclopaedia can all reach it.

/**
 * The cockpit palette — the game's identity, and the manual's and the landing
 * page's.
 *
 * Four colours, and the restraint is the point. A screen that means something
 * new says it with a shape, a position or a brightness, not with a fifth hue.
 * A new colour here is a change to what HARMLESS looks like, not a detail.
 */
export const HUD = {
  /** Everything legible. Text, the scanner's station blip, a lane you read. */
  green: '#4dff5c',
  /** Present but not read: a contact off the lock, a fuel radius. */
  dim: '#1d6b26',
  /** You asked for this: the jump target, a price on its way up, the docking slot. */
  amber: '#ffb444',
  /** It can hurt you: condition red, a missile lock, pirate activity. */
  red: '#ff4d4d',
} as const;

/**
 * The document palette — the encyclopaedia, and only the encyclopaedia.
 *
 * A SECOND palette on purpose (Chris, 2026-08-10), which is why it is named
 * rather than folded into the one above. The encyclopaedia is a document that
 * scrolls. A reader takes it on a phone, and takes it at length. The cockpit
 * palette is tuned for a glance at a black canvas behind glass.
 *
 * The document green is the harder, squarer terminal green, and its amber is
 * more yellow. Both hold up over 205,000 characters of prose, where `#4dff5c`
 * on `#000` does not.
 *
 * Two palettes are honest. Two palettes under a comment that calls them one
 * are not. That comment is what docs/TODO/93 found at the head of
 * `encyclopaedia.css`.
 */
export const DOC = {
  green: '#33ff33',
  green_dim: '#1f7a1f',
  amber: '#ffcc33',
} as const;

/**
 * The green ladder: the rungs between `HUD.dim` and `HUD.green`, and the one
 * above it.
 *
 * These are not a fifth, sixth and seventh colour. They are the four said
 * louder or quieter. The charts need them, because one canvas draws six things
 * at once:
 *
 *   1. the worlds in reach;
 *   2. the worlds out of reach;
 *   3. the names of the first group;
 *   4. the names of the second;
 *   5. the trade lanes;
 *   6. the fuel radius.
 *
 * The charts separate the six by BRIGHTNESS rather than by hue, so the screen
 * still reads as one instrument. They were six unnamed hex literals in
 * `ui/screens.ts` and a seventh in `landing.css`.
 *
 * Where one rung marks two things it is SAID here rather than spelled twice.
 * That is the whole point of the file, and it is also the honest answer. Three
 * things carry one message — you can go here:
 *
 *   - a world you can reach;
 *   - a price worth the flight;
 *   - a button under the pointer.
 *
 * The game always drew all three one colour. A future change that wants them
 * apart wants two entries here, not a literal somewhere else.
 */
export const TINT = {
  /**
   * Brighter than `HUD.green`. It marks three things:
   *
   *   1. a world inside the tank on the galactic chart;
   *   2. a price that trades CHEAP on either chart;
   *   3. the landing page's PLAY button under the pointer.
   *
   * It is the only rung CSS asks for, so it is the only one with a custom
   * property.
   */
  lift: '#7dff88',
  /** A reachable world's NAME, lighter again so 10px text survives beside a
   *  2.5px dot. */
  liftLabel: '#8affa0',
  /** A world outside the tank, on the galactic chart. */
  far: '#46b354',
  /** Its name. */
  farLabel: '#3f9950',
  /** A trade lane that carries freight — and, on the short-range chart, a world
   *  out of range. Both are context behind whatever the pilot reads. */
  lane: '#2a7a33',
  /** The galactic chart's dashed range ellipse. Brighter than `HUD.dim`, which
   *  the short-range chart uses for the same ring. This ring is dashed across a
   *  screen that holds all 256 worlds, and it vanishes at `HUD.dim`. */
  fuelRing: '#2a8f36',
} as const;

/**
 * The CSS custom properties generated into `palette.css`, in order.
 *
 * The two palettes, and the one rung of the ladder a stylesheet asks for. The
 * other five stay out. `ui/screens.ts` paints them into a canvas, and no
 * stylesheet ever wanted them. A variable that nothing reads is a value with
 * two homes again.
 */
export const CSS_VARS: ReadonlyArray<readonly [string, string]> = [
  ['hud-green', HUD.green],
  ['hud-green-lift', TINT.lift],
  ['hud-dim', HUD.dim],
  ['hud-amber', HUD.amber],
  ['hud-red', HUD.red],
  ['doc-green', DOC.green],
  ['doc-green-dim', DOC.green_dim],
  ['doc-amber', DOC.amber],
];

/**
 * The three channels of a `#rrggbb`, 0-255.
 *
 * Memoised, because a draw loop calls `alpha()` below. The station tunnel
 * builds one stroke colour per ring per frame, and the program holds about ten
 * distinct colours. One parse is cheap. Sixty parses a frame, forever, for an
 * answer that cannot change, is waste.
 */
const CHANNELS = new Map<string, [number, number, number]>();
export function channels(colour: string): [number, number, number] {
  const known = CHANNELS.get(colour);
  if (known) return known;
  const n = rgb24(colour);
  const parsed: [number, number, number] = [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  CHANNELS.set(colour, parsed);
  return parsed;
}

/**
 * A `#rrggbb` as the 24-bit number three.js wants.
 *
 * `viewer/gallery.ts` held the amber twice over for want of this — once as
 * `0xffb444` for a three.js material and once as a string for a canvas.
 */
export function rgb24(colour: string): number {
  const hex = colour.startsWith('#') ? colour.slice(1) : colour;
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) throw new Error(`palette: not a #rrggbb: ${colour}`);
  return parseInt(hex, 16);
}

/**
 * The same colour with an alpha, as a canvas fill or stroke.
 *
 * This is the function that retires sixteen hand-written `rgba(77, 255, 92, x)`
 * spellings. The CSS half of that problem is solved the other way, by the
 * `--*-rgb` triples in `palette.css`, because a stylesheet cannot call this.
 */
export function alpha(colour: string, a: number): string {
  const [r, g, b] = channels(colour);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
