// The phosphor: every colour this project paints with, in one file.
//
// It was in fourteen places in three spellings — a hex in a stylesheet, the
// same hex twenty lines below its own const, and the same colour again in
// decimal inside an `rgba()`. docs/TODO/93 is that sweep, and this is where it
// swept to. `tools/palette.ts check` is the gate that keeps it swept: nothing
// outside this file and its generated stylesheet may spell one of these
// values, in `#rgb`, `0xrgb` or `rgba()`.
//
// TypeScript owns the values and CSS RECEIVES them, generated into
// `palette.css` by `npm run generate:palette`. Not pushed onto the document at
// boot, which is how `--sight-r` and `--chart-side` reach CSS: those are
// computed from game rules and only the running game knows them, whereas a
// colour is known before anything runs — and three of the pages that need it
// (index.html, novella.html, and the encyclopaedia read by a crawler) execute
// no JavaScript at all.
//
// This file imports nothing and touches no platform, so game code, the shell,
// the dev pages and the build-time encyclopaedia can all reach it.

/**
 * The cockpit palette — the game's identity, and the manual's and the landing
 * page's.
 *
 * Four colours, and the restraint is the point: a screen that means something
 * new says it with a shape, a position or a brightness, not with a fifth hue.
 * Adding one here is a change to what HARMLESS looks like, not a detail.
 */
export const HUD = {
  /** Everything legible. Text, the scanner's station blip, a lane being read. */
  green: '#4dff5c',
  /** Present but not being read: a contact off the lock, a fuel radius. */
  dim: '#1d6b26',
  /** You asked for this: the jump target, a price rising, the docking slot. */
  amber: '#ffb444',
  /** It can hurt you: condition red, a missile lock, pirate activity. */
  red: '#ff4d4d',
} as const;

/**
 * The document palette — the encyclopaedia, and only the encyclopaedia.
 *
 * A SECOND palette on purpose (Chris, 2026-08-10), which is why it is named
 * rather than folded into the one above. The encyclopaedia is a document that
 * scrolls, is read on a phone and is read at length; the cockpit palette is
 * tuned for glances at a black canvas behind glass. Its green is the harder,
 * squarer terminal green and its amber is more yellow, and both hold up over
 * 205,000 characters of prose in a way `#4dff5c` on `#000` does not.
 *
 * Two palettes are honest; two palettes and a comment claiming they are one
 * are not, and that comment is what docs/TODO/93 found at the head of
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
 * These are not a fifth, sixth and seventh colour — they are the four said
 * louder or quieter. The charts need them because they draw six things at once
 * on one canvas (worlds in reach, worlds out of it, both their names, the
 * trade lanes, the fuel radius) and separate them by BRIGHTNESS rather than by
 * hue, so the screen still reads as one instrument. They were six unnamed hex
 * literals in `ui/screens.ts` and a seventh in `landing.css`.
 *
 * Where one rung marks two things it is SAID here rather than spelled twice.
 * That is the whole point of the file, and it is also the honest reading: a
 * world you can reach, a price worth flying to and a button under the pointer
 * are one message — you can go here — and the game has always drawn them one
 * colour. If a future change wants them apart, it wants two entries here, not
 * a literal somewhere else.
 */
export const TINT = {
  /**
   * Brighter than `HUD.green`. A world inside the tank on the galactic chart,
   * a price trading CHEAP on both charts, and the landing page's PLAY button
   * under the pointer — which is the only rung CSS asks for, so it is the only
   * one with a custom property.
   */
  lift: '#7dff88',
  /** A reachable world's NAME, lighter again so 10px text survives beside a
   *  2.5px dot. */
  liftLabel: '#8affa0',
  /** A world outside the tank, on the galactic chart. */
  far: '#46b354',
  /** Its name. */
  farLabel: '#3f9950',
  /** A trade lane carrying freight — and, on the short-range chart, a world out
   *  of range. Both are context behind whatever is actually being read. */
  lane: '#2a7a33',
  /** The galactic chart's dashed range ellipse. Brighter than `HUD.dim`, which
   *  the short-range chart uses for the same ring, because this one is dashed
   *  across a screen holding all 256 worlds and vanishes at `HUD.dim`. */
  fuelRing: '#2a8f36',
} as const;

/**
 * The CSS custom properties generated into `palette.css`, in order.
 *
 * The two palettes, and the one rung of the ladder a stylesheet asks for. The
 * other five stay out: they are painted into a canvas by `ui/screens.ts` and
 * no stylesheet has ever wanted them, and a variable nothing reads is a value
 * with two homes again.
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
 * Memoised because `alpha()` below is called from inside draw loops — the
 * station tunnel builds one stroke colour per ring per frame — and there are
 * about ten distinct colours in the program. Parsing is cheap; parsing sixty
 * times a frame forever, for an answer that cannot change, is waste.
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
