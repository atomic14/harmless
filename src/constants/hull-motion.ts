// The Harmless motion overlay on the pack's hulls. It says how one turn rate
// becomes a pitch cap and a roll cap. It also says how hard a hull
// accelerates.
//
// The pack gives every design a top speed and nothing else. Both values below are
// therefore browser-game constants, chosen for feel, and no re-import can supply
// one. They are the multipliers that EVERY ROSTER ROW SHARES. The per-hull
// `turnRate` and `maxSpeed` that they multiply stay in `game/ship-specs.ts`.
//
// Both are load-bearing for the AI. Every shipped genome was fitted against the
// agility and the throttle authority that these produce, so a move to either one
// is a retrain.

/**
 * A hull's `turnRate` is one number. The pitch cap and the roll cap are multiples
 * of it.
 *
 * This is the shared multiplier that the whole roster is written against, which
 * is why it is not a per-row property. To make pirates harder to track than the
 * player, make the player more agile (`PLAYER_FLIGHT`). Do not slow everyone
 * down: a cut to these absolute rates cripples evasion far more than aggression.
 */
export const TURN = { pitch: 1.4, roll: 2.4 } as const;

/**
 * How hard a hull accelerates, as a fraction of its top speed.
 *
 * Every ship reaches cruise in about 1/ACCEL_FRACTION seconds, so a Sidewinder
 * gets to 300 no slower than a Worm gets to 200. 0.46 reproduces the three
 * hand-tuned accels (140/300, 120/260, 100/220) to within a rounding step. No
 * ship's handling therefore moves more than 2% from the model that the brains
 * were fitted in.
 *
 * A row may state its own `accel` to override this. `shipAccel()` in
 * game/ship-specs.ts is the one place that asks.
 */
export const ACCEL_FRACTION = 0.46;
