// The cockpit console's game-facing rules. Four of them:
//
//   1. what the scanner and the compass can see;
//   2. what the aim aid assumes;
//   3. where the sight sits;
//   4. when a gauge turns red.
//
// Every number here is both a simulation range and a display rule. Pure drawing —
// the bracket radii, the arrow polygons, the phosphor colours — stays in
// `hud/hud.ts`. The painters that spend these are `hud/hud.ts`,
// `hud/hud-binding.ts`, `hud/hud-model.ts` and `engine/render-stack.ts`.

/**
 * Scanner range. It is also the distance at which the console's 'S' lights.
 *
 * It is the same 6,000 as `PIRATE_HUNT_RANGE` and `HUNTER_RANGE`
 * (hunt-ranges.ts), and it is deliberately NOT merged with them. "They engage at
 * scanner range" is not a rule that anything states. If it ever becomes one, both
 * files are one edit apart.
 *
 * @rule console.scannerRange
 */
export const SCANNER_RANGE = 6000;

/** A ship further out than this gets no bracket. The HUD would be a mess. */
export const TARGET_BRACKET_RANGE = 5000;

/**
 * How many key prompts the cockpit offers at once (`game/prompts.ts`).
 *
 * TWO, and the number is the design rather than a fitting. One prompt is an
 * instruction. Two is a choice: pay him, or dump the evidence. Three is a menu,
 * which is not a thing to read while something closes on you. The rule module
 * ranks by urgency, and this takes the top of that list, so the cap can never
 * hide the most pressing one.
 *
 * It shares the value 2 with `FUGITIVE` (a legal rung), `MISSILE_RELOAD`
 * (seconds), `CHART_Y_SQUASH` and a dozen other counts. This one is a number of
 * offers on a screen, and none of them moves with it.
 *
 * @rule console.promptLimit
 */
export const PROMPT_LIMIT = 2;

/** Closer than this to the sun, the compass switches to it for a sun-skim. */
export const SUNSKIM_COMPASS_RANGE = 130_000;

/** The station takes the compass within this many planet radii. */
export const STATION_COMPASS_RADII = 3;

/** Notional bolt speed, for the lead marker only. A real shot is instant. */
export const BOLT_SPEED = 8000;

/**
 * The laser gauge turns red above this fraction of the heat scale. It is an early
 * warning, deliberately well below the real cut-out (`LASER_CUTOUT` 0.98,
 * constants/player-gun.ts), so it warns before the shutdown rather than at it.
 */
export const LASER_GAUGE_WARN = 0.8;

/**
 * ...and the cabin gauge above this fraction, against a fatal `CABIN_TEMP_FATAL`
 * of 0.99 (constants/sun.ts). It has more margin than the laser's, because cabin
 * heat climbs on its own during a sun-skim. The warning must therefore arrive
 * early enough to act on.
 */
export const CABIN_GAUGE_WARN = 0.72;

/**
 * The gun axis sits above the canvas centre, as a fraction of half the view's
 * height, because the console eats the bottom of the screen.
 *
 * It MUST match `#crosshair { top: 42% }` in style.css, and it CANNOT be
 * expressed there, because CSS cannot import from this directory. The twin
 * therefore stays duplicated, as a decided exception. The shot goes where this
 * says. `BEAM_Z` in render-stack.ts converges on the camera axis that this sight
 * defines.
 */
export const SIGHT_Y = 0.42;

/**
 * How near a ship has to be for the console to name it on the ship-ID line.
 *
 * THREE HUD RANGES SIT WITHIN 1,500 OF EACH OTHER, and they are three rules.
 * `SCANNER_RANGE` is 6,000 and draws the blip. `TARGET_BRACKET_RANGE` is 5,000
 * and draws the bracket. This is 4,500, and it writes the ship's name and
 * distance. So a pilot sees a contact, then a bracket on it, then what it is.
 *
 * `shipIdUnderView` in `hud/hud-model.ts` spends it, and it also asks that the
 * ship is near the view axis. It was a bare 4,500 there until docs/TODO/180.
 *
 * @rule console.shipIdRange
 * @domain console
 */
export const SHIP_ID_RANGE = 4500;

/**
 * How near the station the docking aid and the slot marker appear.
 *
 * Tighter than `MARKER_RANGE` above, because the aid is about lining up rather
 * than about noticing. It also asks that the commander is on the slot side of
 * the hull, and `hud/hud-model.ts` owns that half.
 *
 * It was a bare 3,000 there until docs/TODO/180.
 *
 * @rule console.dockAidRange
 * @domain console
 */
export const DOCK_AID_RANGE = 3000;
