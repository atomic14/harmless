// What the picture is rendered AT: the glow on the wireframe, and how many device
// pixels a canvas is willing to pay for.
//
// Three entry points draw this game's ships: the cockpit
// (`engine/render-stack.ts`), the ship viewer and the gallery
// (`viewer/stage.ts`), and the encyclopaedia's 2D chart
// (`encyclopaedia/chart.ts`). The first two are meant to look the same. The
// whole point of the viewer is a hull seen the way the cockpit will show it.
//
// They agreed by coincidence until docs/TODO/118. The bloom's three
// arguments and the pixel clamp were written out in both, byte-identical and free
// to drift.
//
// This is NOT STYLING. docs/TODO/90 ruled styling out of this directory by name,
// which is what keeps `encyclopaedia/chart.ts`'s `THEME` where it is. The line
// runs between a look chosen per surface — a palette, a canvas theme — and a
// number that two surfaces have to agree on. Without agreement, the same ship
// looks like two ships.

/**
 * The bloom pass, after its resolution vector: `strength`, `radius` and
 * `threshold`, as `UnrealBloomPass` takes them.
 *
 * It is ONE constant rather than three. That is the shape `PLAYER_FLIGHT` uses,
 * and for its reason. The code reads them together. Somebody tunes them
 * together by eye. A caller that wanted one of them alone would do something
 * the others should know about.
 *
 * The values are the shipped look, and the move did not change them. They are the
 * glow that makes a wireframe read as a phosphor tube rather than as three lines.
 */
export const BLOOM = {
  strength: 0.55,
  radius: 0.5,
  threshold: 0.15,
} as const;

/**
 * The most device pixels per CSS pixel that any canvas in the project will
 * render.
 *
 * It is a cost ceiling, not a look. Without it, a 3× phone display would ask a
 * WebGL context for nine times the fragments to draw the same picture. The
 * wireframe gains nothing past 2.
 *
 * Every canvas obeys it: the cockpit, the two dev pages, and the
 * encyclopaedia's chart. So a device that is expensive to draw on is expensive
 * in one place.
 *
 * It has its own rule id, and this is the collision worth a name. `2` is a dozen
 * other constants in the catalogue, and every one of them is a count, a
 * multiplier or a tech level. None of them is a rendering budget, and none should
 * move because a phone got sharper.
 *
 * @rule render.maxPixelRatio
 */
export const MAX_PIXEL_RATIO = 2;
