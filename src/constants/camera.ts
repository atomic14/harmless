// The one camera, and the pretend viewport that a headless run sees. Both stacks
// build the same camera — `engine/render-stack.ts` (browser) and
// `engine/shell.ts` (headless) — so the pairs below must agree across the seam.

/**
 * Vertical field of view, in degrees. It is load-bearing beyond the looks. The
 * trainer's `IN_VIEW_DEG` arc is argued from this, so a change moves what "the
 * pilot can see it" means.
 */
export const CAMERA_FOV = 60;

/** Near plane — 1 unit, about a wingtip. */
export const CAMERA_NEAR = 1;

/**
 * Far plane — a million units. That keeps the banished witch-space furniture
 * (`BANISHED`, 1e8) genuinely invisible, rather than a distant dot.
 */
export const CAMERA_FAR = 1_000_000;

/**
 * The viewport that a run with no window pretends to have. It serves
 * `inert-dom.ts`'s fallback and the headless shell's `size()`. The two must
 * agree, because the aspect ratio reaches the projection matrix. A mismatch
 * leaves browser and headless in disagreement about what is on screen.
 */
export const HEADLESS_WIDTH = 1280;
export const HEADLESS_HEIGHT = 720;
