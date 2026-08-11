// How a trained policy becomes flight: the rate ramp every shipped brain was
// fitted at, how often one re-decides, and the speed scale observations are
// normalized by. The ramp rule is `player.ts`'s `rampToward` — one copy, shared.
//
// Nothing here is a feel setting. Moving one puts every shipped genome out of
// the distribution it was fitted in, and no test can see that.

/**
 * How a brain-flown ship's pitch/roll rates ramp up, and bleed off — what the
 * brains were FITTED at.
 *
 * DO NOT FUSE WITH `player-flight.ts`'s `PLAYER_FLIGHT.rateRamp`. That is also
 * 4.1396 but a DIFFERENT RULE (a feel setting that gets retuned); they agree by
 * coincidence, not design. Each file names the other so neither moves in
 * ignorance. `test/combat-model.test.ts` pins all four constants of the pair.
 *
 * @rule flight.brain.rateRamp
 */
export const BRAIN_RATE_RAMP = 4.1396;
export const BRAIN_RATE_DECAY = 5.2207;

/**
 * How long a brain holds a decision before taking another — 10 Hz. The
 * integration runs every frame regardless, so the ship still flies smoothly
 * between decisions. One home for this rate.
 *
 * Its own rule id: it shares the value 0.1 with `CORRIDOR_START` and
 * `DC_TURN_FADE_ANGLE`, which are a fraction of a route and an angle in radians.
 * Three unrelated tenths, and this is the only one that is a duration.
 *
 * @rule flight.brain.decisionInterval
 */
export const DECISION_INTERVAL = 0.1;

/**
 * The speed scale every observation is normalized by, in world units a second:
 * `observe()` writes `target.speed / OBS_SPEED_SCALE` to slot 10 and the
 * closing rate to slot 7, and `shipView()`'s default class max is this too.
 *
 * DO NOT FUSE WITH `PLAYER_FLIGHT.maxSpeed` — same trap as `BRAIN_RATE_RAMP`.
 * This is the scale every shipped genome was FITTED at; fusing it with the
 * commander's (retunable) top speed would silently rescale every observation.
 *
 * @rule flight.brain.observationSpeed
 */
export const OBS_SPEED_SCALE = 400;
