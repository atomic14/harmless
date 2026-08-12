// What the combat trainer's record measures: the sampling clock, the pass
// thresholds, the six cone, and the buffer's bounds. The recorder is
// `game/combat-sim-report.ts`. `train/flight-probe.ts` reads the SAME
// definitions, so the tool and the report cannot disagree about what a pass is.

/**
 * How often the code samples the geometry, in Hz. Every duration that the record
 * reports comes from a count of samples, so this is the resolution of
 * `engagedSeconds` and of the on-six times. 10 is enough, because a fight is
 * decided over seconds.
 */
export const SAMPLE_HZ = 10;

/**
 * The rear cone that counts as somebody's six, as a half-angle from directly
 * astern. It is the measurement's own number, not a rule from the game, which has
 * no notion of a six. 60 degrees is the arc that a tailing ship holds. Wider
 * would start to count a ship off your beam.
 */
export const SIX_CONE = Math.PI / 3;

/**
 * What an attack run is, in ranges. A ship is INSIDE once it closes past
 * `PASS_CLOSE`. It completed a PASS once it opens back out past `PASS_FAR`. These
 * are the measurement's own numbers, not a rule from the game. `NPC_LASER_RANGE`
 * is 3500, so a threshold taken from the gun would count a sniping turret as
 * engaged, and would count no passes at all.
 *
 * There are TWO numbers, not one, so jitter around a single line does not score a
 * pass on every wobble. In past 400 is knife-fighting range. Back out past 600 is
 * plainly broken off. `PASS_CLOSE` is `train/flight-probe.ts`'s original, shared
 * here.
 *
 * `PASS_FAR` must sit BELOW the shortest run that the flight model can produce.
 * Otherwise the measurement goes blind exactly where the flying got better, and
 * `test/break-off.test.ts` asserts it. 600 counts 92% of the merges that a
 * five-ship fight produces, against 12% at 900. It is also the floor: 200 above
 * `PASS_CLOSE`, which is the hysteresis that stops a loiter from a score of
 * passes. `pirate-attack-g3` hangs at a median of 240 units, and it scores 0.00
 * passes at this threshold.
 */
export const PASS_CLOSE = 400;
export const PASS_FAR = 600;

/** How many exercise records the in-memory ring keeps. */
export const SIM_LOG_LIMIT = 20;

/**
 * Samples kept before the buffer closes. Sparring and waves are endless, so the
 * buffer is bounded. It STOPS rather than drops the oldest, because a median over
 * a sliding tail is a median of the end of the fight, not of the fight.
 */
export const MAX_SAMPLES = 12_000;
