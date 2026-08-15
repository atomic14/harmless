// Where the sky puts a ship when it appears. Every value here is a DISTANCE.
// `population.ts` decides what a system holds on arrival. `encounters.ts` decides
// what turns up while you fly. This file only says how far out.
//
// Two shapes read differently:
//   * A `_SCATTER` is a NOMINAL radius. `scatter()` (game/spawning.ts) places a
//     ship at `range * (0.5 + random())`, so 1,800 lands between 900 and 2,700.
//   * A `_RANGE` with a `_SPAN` beside it is the floor and the width of a flat
//     draw, `RANGE + random() * SPAN`. The number IS the nearest a ship can be.
//
// Authored-exercise placement is `opposition-ring.ts`. It does the same job with
// deliberately different numbers, chosen for what the pilot can see rather than
// for where traffic would be.

/**
 * How far from the station a trader on its run loiters. It is near enough to read
 * as a ship on its way there, and far enough not to queue in the slot. This is
 * where they START.
 */
export const TRADER_SCATTER = 1800;

/**
 * How far off the arrival corridor the police scatter. It is the role that
 * `PIRATE_SCATTER` plays for a gang. The police patrol the lane rather than guard
 * the slot, so a fugitive can still reach the slot to pay a fine (game/law.ts,
 * station.ts).
 */
export const POLICE_SCATTER = 1200;

/**
 * How far a launch scatters the patrol across the system. On a launch, the
 * commander starts at the slot, with no corridor to string police along. They
 * spread this wide instead: out there to be met, and not a cordon round the port
 * you just left.
 */
export const POLICE_PATROL_RANGE = 18_000;

/**
 * How far the rocks scatter. It is the widest of the three things a peaceful
 * system holds. It shares its value with `MASS_LOCK_STATION` (torus.ts), and it
 * is NOT that rule. Rocks land 2,500-7,500 out, so the field straddles the lock.
 */
export const ASTEROID_SCATTER = 5000;

/**
 * How far out a bounty hunter starts, at work on the whole system. It shares its
 * value with `PIRATE_HUNT_RANGE` and `HUNTER_RANGE` (hunt-ranges.ts), and it is a
 * different quantity: where a ship begins, not how far it looks. It is therefore
 * left as a literal.
 */
export const HUNTER_SCATTER = 6000;

/**
 * How far out the rock hermit hides. It is 2.5x the asteroid field's nominal
 * radius, so it sits at the far edge, and a player has to go looking. Its trade
 * offer opens at 900 units (game/world-step.ts).
 */
export const HERMIT_SCATTER = 14_000;

/**
 * Where along the route from you to the station the nearest pirate can be, as a
 * fraction of that route. It is a fraction, so the ambush scales with
 * `WITCHPOINT_RADII` (planet.ts). It is a tenth in, so nobody waits on top of the
 * witchpoint.
 *
 * It has its own rule id. It shares the value 0.1 with `DECISION_INTERVAL` and
 * `DC_TURN_FADE_ANGLE`, which are a duration in seconds and an angle in radians.
 * Three unrelated tenths, and this is the only one that is a share of a journey.
 *
 * @rule spawn.corridorStart
 */
export const CORRIDOR_START = 0.1;

/**
 * How much of the route the rest are spread across. 0.1 + 0.75 leaves the last
 * 15% clear, which is the approach to the station.
 */
export const CORRIDOR_SPAN = 0.75;

/**
 * How far off the corridor's line each pirate sits. It is a spread rather than a
 * firing line, so an organised gang arrives together and feels like a gang.
 *
 * It has its own rule id. It shares the value 2,500 with `AMBLE_SPAN`
 * (constants/amble.ts) and `THARGOID_AMBUSH_RANGE_SPAN` (witchspace.ts). This
 * one says how wide a reception is. Widening a gang must not widen either of
 * the other two.
 *
 * @rule spawn.pirateScatter
 */
export const PIRATE_SCATTER = 2500;

/**
 * How far out a fresh trader warps in. It is much further than the traders
 * already here (`TRADER_SCATTER`), so an arrival reads as a ship FROM somewhere.
 * The witch-flash that marks it is drawn at the same point.
 */
export const TRADER_ARRIVAL_RANGE = 22_000;

/**
 * How far from the commander a pirate wave warps in. It shares its value with
 * `PLAYER_INTEREST_RANGE` (player-interest.ts), and it is left a literal. At this
 * range the wave is interested the frame it exists, so the console warning is not
 * late.
 */
export const PIRATE_WAVE_RANGE = 9000;

/** ...and how much further out than that they may be. */
export const PIRATE_WAVE_RANGE_SPAN = 4000;

/**
 * How far from the commander a generation ship crosses. It is far out, and drawn
 * wide, because the thing is enormous. The game announces it inside 6,000.
 */
export const GENERATION_SHIP_RANGE = 14_000;

/** ...and the width of that band. */
export const GENERATION_SHIP_RANGE_SPAN = 8000;

/**
 * How far from a generation ship its shed cargo drifts. It is close enough to
 * read as cargo off the hull. The contents are `ORDINARY_GOODS`
 * (commodities.ts).
 */
export const GENERATION_CARGO_SCATTER = 700;

/**
 * How far from the commander the Constrictor hides on the mission leg. It is
 * nearer than any other authored arrival, so the leg becomes a fight quickly.
 */
export const MISSION_TARGET_RANGE = 4000;

/** ...and the width of that band — the same again, so it can be twice as far. */
export const MISSION_TARGET_RANGE_SPAN = 4000;

/**
 * How far from its mother a Thargon drone appears. It is almost on top of it, so
 * the mothership reads as the source, and a kill on it is obviously the answer.
 */
export const THARGON_DEPLOY_RANGE = 150;

/**
 * The fewest Vipers the station launches when you have shot at something you
 * should not have. This and the three below are ONE rule: a short jittered stack
 * along the slot normal, spent by `launchStationDefence`. WHETHER they launch is
 * `DEFENCE_RANGE` (constants/law.ts).
 */
export const STATION_DEFENCE_MIN = 1;

/**
 * ...and the width of that draw: one or two of them. It is the smallest
 * escalation there is, and the launch can trigger again if you keep shooting.
 */
export const STATION_DEFENCE_SPAN = 2;

/**
 * How far out of the slot the first one launches. It is along the slot normal, so
 * they come out of the station rather than beside it.
 */
export const STATION_DEFENCE_STANDOFF = 500;

/**
 * ...and how much further out each one after it starts, so a pair does not arrive
 * inside each other. It is three times a Viper's 18.75 contact radius.
 */
export const STATION_DEFENCE_STACK = 120;

/**
 * ...and the random nudge on each, so a second launch does not look like the
 * first. It is bigger than the stack spacing can absorb. Each ship is displaced
 * 80 units independently, so 1.16% of pairs land with hulls that intersect. It is
 * left as it is, because a change moves every station-launched Viper, and both
 * ships are moving within a frame of the launch. `test/world.test.ts` asserts
 * only that the positions differ.
 */
export const STATION_DEFENCE_JITTER = 80;
