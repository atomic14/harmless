// The station as a place in the sky: which hull a system gets, how it spins,
// and where it puts your ship when you leave, fluff the slot, or sit in the
// docked menu.
//
// The scene spending the spin is `world/system-scene.ts`; launching is
// `Station.launch` (game/station.ts), the bounce is `checkStation`
// (game/world-step.ts), slot geometry is ./docking.ts, and the mass-lock is
// `MASS_LOCK_STATION` in ./torus.ts.

/**
 * How fast the station spins about its slot axis, in radians a second. This is
 * the difficulty of docking: the roll a ship must match to thread the slot
 * (`ROLL_TOLERANCE` in ./docking.ts is how far off you may be). A full turn
 * every 24 seconds, close to the original's stately spin.
 */
export const STATION_SPIN = 0.26;

/**
 * The tech level, in SHOWN one-based units, at which a system's station is the
 * dodecahedral Dodo rather than the Coriolis. Raw `techLevel` is zero-based and
 * every reader adds one (see ./tech-level.ts), so the test is
 * `techLevel + 1 >= DODO_TECH_LEVEL`; roughly the top third rate the Dodo.
 */
export const DODO_TECH_LEVEL = 10;

// THE NEXT THREE ARE ONE PHRASE — "just outside the slot" — WITH THREE ANSWERS,
// kept adjacent so the disagreement stays visible. Three events, three
// distances: a fluffed docking bounces you to 420, the bay spits you out at
// 450, the docked menu parks you 900 out for the backdrop. The bounce leaves
// you NEARER the hull than the bay: a failed docking is meant to dump you close
// to the thing you just hit, shields dented and nose out of line.

/**
 * Where a fluffed docking bounces you to — distance from the station's CENTRE,
 * in world units, with your speed zeroed. The scrape cost is `IMPACT.stationScrape`.
 */
export const BOUNCE_STANDOFF = 420;

/** How far off the slot you sit when the bay spits you out, in world units. */
export const LAUNCH_STANDOFF = 450;

/** ...and how fast, in world units a second — a firm push, not a cruise. */
export const LAUNCH_SPEED = 120;

/**
 * Where the docked menu parks your ship, along the slot normal in world units —
 * far enough out that the station fills the backdrop rather than clipping the
 * camera. A backdrop, not the launch point (`LAUNCH_STANDOFF` is that).
 */
export const DOCKED_BACKDROP_DISTANCE = 900;
