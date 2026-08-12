// The wave ramp's tunable rates: how fast the count and the tier climb, and where
// the numbers stop. The ramp itself — `waveCount`, `waveTier`, `WAVE_STEPS` and
// `WAVE_SATURATION` — is in `game/combat-sim-scenarios.ts`.
//
// It must RAMP and then SATURATE. It must never diverge. `npm test` asserts both.
//
//   wave   1  2  3  4  5  6  7  8  9 10 11 12+
//   count  1  1  2  2  3  3  4  4  5  5  6  6
//   tier   0  0  0  1  1  1  2  2  2  2  2  2
//
// They are organised from wave 7, when the tier tops out and there are enough of
// them to form a gang. That is the same rule `pirateThreat` uses.

import { MAX_TIER } from './threat.ts';

/** The most ships a wave ever holds — the ceiling the ramp exists to have. */
export const WAVE_MAX_COUNT = 6;

/** The count grows by one every this many waves... */
export const WAVE_COUNT_EVERY = 2;

/** ...and the tier climbs a rung every this many. */
export const WAVE_TIER_EVERY = 3;

/**
 * One new thing every this many waves, once the numbers stop. The spacing lets
 * you meet a new thing, and then meet it again when you know it is coming.
 */
export const WAVE_STEP_EVERY = 2;

/**
 * From this wave on, the count and the tier stop growth: six ships, at the top
 * tier, in a gang. It is not where the ramp stops. The `WAVE_STEPS` keep
 * escalation, and `WAVE_SATURATION` (in game/combat-sim-scenarios.ts) is where
 * later waves match.
 */
export const WAVE_COUNT_SATURATION = Math.max(
  (WAVE_MAX_COUNT - 1) * WAVE_COUNT_EVERY, MAX_TIER * WAVE_TIER_EVERY) + 1;
