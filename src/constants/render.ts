// What the picture is rendered AT: the glow on the wireframe, and how many
// device pixels a canvas is willing to pay for.
//
// Three entry points draw this game's ships — the cockpit
// (`engine/render-stack.ts`), the ship viewer and the gallery
// (`viewer/stage.ts`), and the encyclopaedia's 2D chart
// (`encyclopaedia/chart.ts`) — and the first two are supposed to look the same,
// because the whole point of the viewer is to look at a hull the way the
// cockpit will. They agreed by coincidence until docs/TODO/118: the bloom's
// three arguments and the pixel clamp were written out in both, byte-identical
// and free to drift.
//
// NOT STYLING, which docs/TODO/90 ruled out of this directory by name and which
// keeps `encyclopaedia/chart.ts`'s `THEME` where it is. The line is between a
// look chosen per surface — a palette, a canvas theme — and a number two
// surfaces have to agree on or the same ship looks like two ships.

/**
 * The bloom pass, after its resolution vector: `strength`, `radius` and
 * `threshold` as `UnrealBloomPass` takes them.
 *
 * ONE constant rather than three, the shape `PLAYER_FLIGHT` uses and for its
 * reason: they are read together, tuned together by eye, and a caller wanting
 * one of them alone would be doing something the others should know about.
 *
 * The values are the shipped look and are unchanged by the move — the glow that
 * makes a wireframe read as a phosphor tube rather than as three lines.
 */
export const BLOOM = {
  strength: 0.55,
  radius: 0.5,
  threshold: 0.15,
} as const;

/**
 * The most device pixels per CSS pixel any canvas in the project will render.
 *
 * A cost ceiling, not a look: a 3× phone display would otherwise ask a WebGL
 * context for nine times the fragments to draw the same picture, and the
 * wireframe gains nothing past 2. Every canvas obeys it — the cockpit, the two
 * dev pages and the encyclopaedia's chart — so a device that is expensive to
 * draw on is expensive in one place.
 *
 * Its own rule id, and this is the collision worth naming: `2` is a dozen other
 * constants in the catalogue, and every one of them is a count, a multiplier or
 * a tech level. None of them is a rendering budget, and none should move
 * because a phone got sharper.
 *
 * @rule render.maxPixelRatio
 */
export const MAX_PIXEL_RATIO = 2;
