// The station as a place in the sky. Four things live here:
//
//   1. which hull a system gets;
//   2. how it spins;
//   3. where it puts your ship on a launch, and after a fluffed slot;
//   4. where it parks you in the docked menu.
//
// The scene that spends the spin is `world/system-scene.ts`. The launch is
// `Station.launch` (game/station.ts). The bounce is `checkStation`
// (game/world-step.ts). The slot geometry is ./docking.ts, and the mass-lock is
// `MASS_LOCK_STATION` in ./torus.ts.

/**
 * How fast the station spins about its slot axis, in radians a second. This is
 * the difficulty of a dock: it is the roll that a ship must match to thread the
 * slot. `ROLL_TOLERANCE` in ./docking.ts is how far off you may be. It is a full
 * turn every 24 seconds, close to the original's stately spin.
 */
export const STATION_SPIN = 0.26;

/**
 * The tech level at which a system's station is the dodecahedral Dodo rather than
 * the Coriolis, in SHOWN one-based units. Raw `techLevel` is zero-based, and
 * every reader adds one (see ./tech-level.ts). Roughly the top third rate the
 * Dodo.
 *
 * TWO READERS, ONE BIT. `galaxy/tech.ts` owns the comparison. The released game
 * asked this question once and spent the answer twice. It picked the station
 * hull. It also picked bit 0 of the blueprint-set number, which is which ships
 * a system flies (docs/TODO/138). Nothing may restate the test.
 */
export const DODO_TECH_LEVEL = 10;

// THE NEXT THREE ARE ONE PHRASE — "just outside the slot" — WITH THREE ANSWERS.
// They are kept adjacent, so the disagreement stays visible. Three events, three
// distances. A fluffed docking bounces you to 420. The bay spits you out at 450.
// The docked menu parks you 900 out, for the backdrop.
//
// The bounce leaves you NEARER the hull than the bay does. A failed docking is
// meant to dump you close to the thing you hit, with your shields dented and
// your nose out of line.

/**
 * Where a fluffed docking bounces you to. It is a distance from the station's
 * CENTRE, in world units, and your speed goes to zero. The scrape cost is
 * `IMPACT.stationScrape`.
 */
export const BOUNCE_STANDOFF = 420;

/** How far off the slot you sit when the bay spits you out, in world units. */
export const LAUNCH_STANDOFF = 450;

/** ...and how fast, in world units a second — a firm push, not a cruise. */
export const LAUNCH_SPEED = 120;

/**
 * Where the docked menu parks your ship, along the slot normal, in world units.
 * It is far enough out that the station fills the backdrop rather than clips the
 * camera. It is a backdrop, not the launch point; `LAUNCH_STANDOFF` is that.
 */
export const DOCKED_BACKDROP_DISTANCE = 900;
