// The sun as a hazard and as a fuel supply: four distances, what the cabin does
// about them, and what you get for the risk.
//
// THE FOUR DISTANCES ARE ONE ORDERED LADDER — the only reason they share a file.
// Coming in from deep space you meet them in this order:
//
//     110,000  the cabin starts to warm            SUN_HEAT_START
//      80,000  the scoops start to gather          SUN_SCOOP_RANGE
//      26,840  the cabin reaches CABIN_TEMP_FATAL  (SUN_HEAT_MAX's ramp)
//      21,000  the ship is gone regardless         SUN_KILL_DIST
//
// Each rung buys something from the one below: warming before scooping means a
// skim always costs heat; the fatal temperature before the kill radius makes the
// gauge a real warning; scooping outside the fatal band leaves a place to fill
// the tank. Swap any two and sun-skimming stops being the trade it is;
// `test/systems.test.ts` asserts what each rung buys.
//
// For scale, the sun orbits about 320,000 out (world/system-scene.ts). What the
// sun LOOKS like is world/sun.ts, which shares nothing with this.

/** Closer than this and the cabin starts to warm. */
export const SUN_HEAT_START = 110_000;

/**
 * Close enough to scoop fuel, if you have the scoops. Inside `SUN_HEAT_START`,
 * so you are always warm before earning: here the cabin settles at 36% and
 * stays, the safe end of sun-skimming. Everything past it is a choice.
 */
export const SUN_SCOOP_RANGE = 80_000;

/**
 * The bottom of the temperature ramp: here the cabin's TARGET is 1.0, and it
 * passes `CABIN_TEMP_FATAL` at 26,840 on the way in. Temperature is linear in
 * distance up to `SUN_HEAT_START`, so this is a slope end-point, not a place
 * anything happens.
 */
export const SUN_HEAT_MAX = 26_000;

/** Fly this close and the ship is gone, temperature or not. */
export const SUN_KILL_DIST = 21_000;

/**
 * How fast the cabin follows the temperature its distance implies, as a
 * first-order lag in reciprocal seconds. The lag is the mechanic, not a
 * smoothing filter: it gives you time to pull out. From cold, sitting at the
 * bottom of the ramp reaches fatal in 3.8 seconds.
 *
 * Applied as `Math.min(1, dt * CABIN_TEMP_LAG)` per frame, so NOT exactly
 * frame-rate independent — one second of full heat measures 0.714 at 15 Hz
 * against 0.700 at 144 Hz. Two percent, in a quantity you have seconds to react
 * to; recorded rather than fixed.
 */
export const CABIN_TEMP_LAG = 1.2;

/**
 * The cabin temperature that kills you, on the gauge's own 0..1 scale. 0.99
 * rather than 1.0 because the lag only APPROACHES its target and reaches 1.0 at
 * no finite time, so a test for 1.0 would let you sit at the ramp forever.
 */
export const CABIN_TEMP_FATAL = 0.99;

/** Tonnes of fuel — tenths of a light year — gathered per second while scooping. */
export const SCOOP_RATE = 5;
