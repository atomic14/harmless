// The one camera, and the pretend viewport a headless run sees. Both stacks
// build the same camera — `engine/render-stack.ts` (browser) and
// `engine/shell.ts` (headless) — so the pairs below must agree across the seam.

/**
 * Vertical field of view, in degrees. Load-bearing beyond looks: the trainer's
 * `IN_VIEW_DEG` arc is argued from this, so a change moves what "the pilot can
 * see it" means.
 */
export const CAMERA_FOV = 60;

/** Near plane — 1 unit, about a wingtip. */
export const CAMERA_NEAR = 1;

/**
 * Far plane — a million units, which keeps the banished witch-space furniture
 * (`BANISHED`, 1e8) genuinely invisible rather than a distant dot.
 */
export const CAMERA_FAR = 1_000_000;

/**
 * The viewport a run with no window pretends to have — `inert-dom.ts`'s fallback
 * and the headless shell's `size()`. The two must agree: aspect ratio reaches
 * the projection matrix, so a mismatch has browser and headless disagreeing
 * about what is on screen.
 */
export const HEADLESS_WIDTH = 1280;
export const HEADLESS_HEIGHT = 720;
