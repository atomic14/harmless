// How a trained policy becomes flight. Three numbers:
//
//   1. the rate ramp that every shipped brain was fitted at;
//   2. how often one re-decides;
//   3. the speed scale that normalizes the observations.
//
// The ramp rule is `player.ts`'s `rampToward` — one copy, shared.
//
// Nothing here is a feel setting. A move to one puts every shipped genome out of
// the distribution it was fitted in, and no test can see that.

/**
 * How a brain-flown ship's pitch and roll rates ramp up, and bleed off. This is
 * what the brains were FITTED at.
 *
 * DO NOT FUSE WITH `player-flight.ts`'s `PLAYER_FLIGHT.rateRamp`. That one is
 * also 4.1396, but it is a DIFFERENT RULE: a feel setting that gets retuned. They
 * agree by coincidence, not by design. Each file names the other, so neither
 * moves in ignorance. `test/combat-model.test.ts` pins all four constants of the
 * pair.
 *
 * @rule flight.brain.rateRamp
 */
export const BRAIN_RATE_RAMP = 4.1396;
export const BRAIN_RATE_DECAY = 5.2207;

/**
 * How long a brain holds a decision before it takes another: 10 Hz. The
 * integration runs every frame whatever this is, so the ship still flies smoothly
 * between decisions. This is the one home for that rate.
 *
 * It has its own rule id. It shares the value 0.1 with `CORRIDOR_START` and
 * `DC_TURN_FADE_ANGLE`, which are a fraction of a route and an angle in radians.
 * Three unrelated tenths, and this is the only one that is a duration.
 *
 * @rule flight.brain.decisionInterval
 */
export const DECISION_INTERVAL = 0.1;

/**
 * The speed scale that normalizes every observation, in world units a second.
 * `observe()` writes `target.speed / OBS_SPEED_SCALE` to slot 10, and the closing
 * rate to slot 7. `shipView()`'s default class max is this too.
 *
 * DO NOT FUSE WITH `PLAYER_FLIGHT.maxSpeed`. It is the same trap as
 * `BRAIN_RATE_RAMP`. This is the scale that every shipped genome was FITTED at. A
 * fusion with the commander's retunable top speed would silently rescale every
 * observation.
 *
 * @rule flight.brain.observationSpeed
 */
export const OBS_SPEED_SCALE = 400;
