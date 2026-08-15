// The sun as a hazard and as a fuel supply: four distances, what the cabin does
// about them, and what you get for the risk.
//
// THE FOUR DISTANCES ARE ONE ORDERED LADDER. That is the only reason they share a
// file. On the way in from deep space you meet them in this order:
//
//     110,000  the cabin starts to warm            SUN_HEAT_START
//      80,000  the scoops start to gather          SUN_SCOOP_RANGE
//      26,840  the cabin reaches CABIN_TEMP_FATAL  (SUN_HEAT_MAX's ramp)
//      21,000  the ship is gone regardless         SUN_KILL_DIST
//
// Each rung buys something from the one below. The warmth before the scoop means
// that a skim always costs heat. The fatal temperature before the kill radius
// makes the gauge a real warning. The scoop outside the fatal band leaves a place
// to fill the tank. Swap any two, and sun-skimming stops being the trade it is.
// `test/systems.test.ts` asserts what each rung buys.
//
// For scale, the sun orbits about 320,000 out (world/system-scene.ts). What the
// sun LOOKS like is world/sun.ts, which shares nothing with this.

/** Closer than this, and the cabin starts to warm. */
export const SUN_HEAT_START = 110_000;

/**
 * Close enough to scoop fuel, if you have the scoops. It is inside
 * `SUN_HEAT_START`, so you are always warm before you earn. Here the cabin
 * settles at 36% and stays there, which is the safe end of a sun-skim. Everything
 * past it is a choice.
 */
export const SUN_SCOOP_RANGE = 80_000;

/**
 * The bottom of the temperature ramp. Here the cabin's TARGET is 1.0, and it
 * passes `CABIN_TEMP_FATAL` at 26,840 on the way in. Temperature is linear in
 * distance up to `SUN_HEAT_START`, so this is a slope end-point. It is not a
 * place where anything happens.
 */
export const SUN_HEAT_MAX = 26_000;

/** Fly this close, and the ship is gone, whatever the temperature is. */
export const SUN_KILL_DIST = 21_000;

/**
 * How fast the cabin follows the temperature that its distance implies, as a
 * first-order lag in reciprocal seconds. The lag is the mechanic, not a smoothing
 * filter: it gives you time to pull out. From cold, a seat at the bottom of the
 * ramp reaches fatal in 3.8 seconds.
 *
 * It is applied as `Math.min(1, dt * CABIN_TEMP_LAG)` per frame, so it is NOT
 * exactly frame-rate independent. One second of full heat measures 0.714 at 15 Hz
 * against 0.700 at 144 Hz. That is two percent, in a quantity you have seconds to
 * react to. It is recorded rather than fixed.
 */
export const CABIN_TEMP_LAG = 1.2;

/**
 * The cabin temperature that kills you, on the gauge's own 0..1 scale. It is 0.99
 * rather than 1.0, because the lag only APPROACHES its target and reaches 1.0 at
 * no finite time. A test for 1.0 would let you sit at the ramp forever.
 */
export const CABIN_TEMP_FATAL = 0.99;

/**
 * Tonnes of fuel gathered per second on a scoop — tenths of a light year.
 *
 * It has its own rule id. It is a RATE, in tenths of a light year a second, and
 * the other constants at 5 are counts, a ratio and durations.
 *
 * @rule sun.scoopRate
 */
export const SCOOP_RATE = 5;
