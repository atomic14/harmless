// The cockpit console's game-facing rules: what the scanner and the compass
// can see, what the aim aid assumes, where the sight sits, and when a gauge
// turns red.
//
// Every number here is both a simulation range and a display rule. Pure
// drawing (bracket radii, arrow polygons, phosphor colours) stays in
// `hud/hud.ts`; the painters that spend these are `hud/hud.ts`,
// `hud/hud-binding.ts`, `hud/hud-model.ts` and `engine/render-stack.ts`.

/**
 * Scanner range — also the distance at which the console's 'S' lights.
 *
 * The same 6,000 as `PIRATE_HUNT_RANGE` and `HUNTER_RANGE` (hunt-ranges.ts)
 * and deliberately NOT merged: "they engage at scanner range" is not a rule
 * anything states. If it ever becomes one, both files are one edit apart.
 */
export const SCANNER_RANGE = 6000;

/** Ships further out than this get no bracket — the HUD would be a mess. */
export const TARGET_BRACKET_RANGE = 5000;

/** Closer than this to the sun, the compass switches to it for a sun-skim. */
export const SUNSKIM_COMPASS_RANGE = 130_000;

/** The station takes the compass within this many planet radii. */
export const STATION_COMPASS_RADII = 3;

/** Assumed target cruise for the lead marker, in world units a second. */
export const ASSUMED_TARGET_SPEED = 220;

/** Notional bolt speed, for the lead marker only; real shots are instant. */
export const BOLT_SPEED = 8000;

/**
 * The laser gauge turns red above this fraction of the heat scale — an early
 * warning, deliberately well below the real cut-out (`LASER_CUTOUT` 0.98,
 * constants/player-gun.ts), so it warns before the shutdown rather than at it.
 */
export const LASER_GAUGE_WARN = 0.8;

/**
 * ...and the cabin gauge above this fraction, against a fatal `CABIN_TEMP_FATAL`
 * of 0.99 (constants/sun.ts) — more margin than the laser's because cabin heat
 * climbs on its own during a sun-skim, so the warning must arrive early enough
 * to act on.
 */
export const CABIN_GAUGE_WARN = 0.72;

/**
 * The gun axis sits above the canvas centre, as a fraction of half the view's
 * height, because the console eats the bottom of the screen.
 *
 * MUST match `#crosshair { top: 42% }` in style.css and CANNOT be expressed
 * there (CSS cannot import from this directory), so the twin stays duplicated
 * as a decided exception. The shot goes where this says; `BEAM_Z` in
 * render-stack.ts converges on the camera axis this sight defines.
 */
export const SIGHT_Y = 0.42;
