// What the combat trainer's record measures: the sampling clock, the pass
// thresholds, the six cone, and the buffer's bounds. The recorder is
// `game/combat-sim-report.ts` and `train/flight-probe.ts` reads the SAME
// definitions, so the tool and the report cannot disagree about what a pass is.

/**
 * How often geometry is sampled, in Hz. Every duration the record reports is
 * derived from a count of samples, so this is the resolution of `engagedSeconds`
 * and the on-six times. 10 is enough: a fight is decided over seconds.
 */
export const SAMPLE_HZ = 10;

/**
 * The rear cone that counts as somebody's six, as a half-angle from directly
 * astern. The measurement's own number, not a rule from the game (which has no
 * notion of a six). 60 degrees is the arc a tailing ship holds; wider would
 * start counting a ship off your beam.
 */
export const SIX_CONE = Math.PI / 3;

/**
 * What an attack run is, in ranges: a ship is INSIDE once it closes past
 * `PASS_CLOSE`, and has completed a PASS once it opens back out past `PASS_FAR`.
 * The measurement's own numbers, not a rule from the game: `NPC_LASER_RANGE` is
 * 3500, so a threshold taken from the gun would count a sniping turret as
 * engaged and count no passes at all.
 *
 * TWO numbers, not one, so jitter around a single line does not score a pass
 * every wobble: in past 400 (knife-fighting range), back out past 600 (plainly
 * broken off). `PASS_CLOSE` is `train/flight-probe.ts`'s original, shared here.
 *
 * `PASS_FAR` must sit BELOW the shortest run the flight model can produce, or
 * the measurement goes blind exactly where the flying got better;
 * `test/break-off.test.ts` asserts it. 600 counts 92% of the merges a five-ship
 * fight produces (against 12% at 900) and is the floor: 200 above `PASS_CLOSE`,
 * the hysteresis that stops loitering scoring passes. `pirate-attack-g3`, which
 * hangs at a median of 240 units, scores 0.00 passes at this threshold.
 */
export const PASS_CLOSE = 400;
export const PASS_FAR = 600;

/** How many exercise records the in-memory ring keeps. */
export const SIM_LOG_LIMIT = 20;

/**
 * Samples kept before the buffer closes. Sparring and waves are endless, so the
 * buffer is bounded — and it STOPS rather than dropping the oldest, since a
 * median over a sliding tail is a median of the end of the fight, not the fight.
 */
export const MAX_SAMPLES = 12_000;
