// Where a ship with nothing to do goes.
//
// A ship that is not fighting, not fleeing and not running a trade route ambles
// between waypoints near the station (`game/npc.ts`). That is the police, the
// bounty hunter, a pirate that found nobody, and a Thargoid. The trader is the
// one role with a route of its own.
//
// It is NOT `spawn-placement.ts`, which says where a ship APPEARS. These say
// where it ends up, and the difference matters. Whatever the sky puts a ship
// down at, the amble decides where it spends the next ten minutes.
//
// The floor for a role the station's truce covers is `STATION_TRUCE`
// (`constants/law.ts`), and it is not repeated here. A pirate and a bounty
// hunter can do nothing inside the truce. An amble that took them there would
// park scenery over the port (docs/TODO/158).

/**
 * The nearest a waypoint sits to the station, for a role the truce does not
 * cover. It is close enough that a Viper reads as station traffic, and outside
 * the slot the commander is threading.
 *
 * It shares the value 800 with `TARGET_DIST_WEIGHT` (combat-computer.ts), which
 * is an exchange rate between world units and radians. This is a distance from
 * a station. The two have nothing to say to each other.
 *
 * @rule amble.near
 */
export const AMBLE_NEAR = 800;

/**
 * ...and how much further out a waypoint may be drawn, flat.
 *
 * It is the width for BOTH floors: `AMBLE_NEAR` for the police, and
 * `STATION_TRUCE` for a pirate or a bounty hunter. It says how far a ship
 * wanders, rather than anything about either floor. A truced role ambles
 * between
 * 7,000 and 9,500 units out, which keeps it inside `PLAYER_INTEREST_RANGE`
 * (9,000) of a commander who leaves the station. It is moved off the doorstep,
 * not out of the system.
 *
 * It shares the value 2,500 with `PIRATE_SCATTER` (spawn-placement.ts) and
 * `THARGOID_AMBUSH_RANGE_SPAN` (witchspace.ts). Both of those say where a ship
 * APPEARS, and this says how far one wanders afterwards. A wider ambush must
 * not widen the amble.
 *
 * @rule amble.span
 */
export const AMBLE_SPAN = 2500;
