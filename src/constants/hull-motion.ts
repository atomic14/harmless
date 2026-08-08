// The Harmless motion overlay on the pack's hulls: how one turn rate becomes a
// pitch cap and a roll cap, and how hard a hull accelerates.
//
// The pack gives every design a top speed and nothing else, so both values below
// are browser-game constants chosen for feel — no re-import can supply one. They
// are the multipliers EVERY ROSTER ROW SHARES; the per-hull `turnRate` and
// `maxSpeed` they multiply stay in `game/ship-specs.ts`.
//
// Both are load-bearing for the AI: every shipped genome was fitted against the
// agility and throttle authority these produce, so moving either is a retrain.

/**
 * A hull's `turnRate` is one number; pitch and roll caps are multiples of it.
 *
 * The shared multiplier the whole roster is written against, which is why it is
 * not a per-row property. Pirates being harder to track than the player is fixed
 * by making the player more agile (`PLAYER_FLIGHT`), not by slowing everyone
 * down: lowering these absolute rates cripples evasion far more than aggression.
 */
export const TURN = { pitch: 1.4, roll: 2.4 } as const;

/**
 * How hard a hull accelerates, as a fraction of its top speed.
 *
 * Every ship reaches cruise in about 1/ACCEL_FRACTION seconds, so a Sidewinder
 * gets to 300 no slower than a Worm gets to 200. 0.46 reproduces the three
 * hand-tuned accels (140/300, 120/260, 100/220) to within a rounding step, so no
 * ship's handling moves more than 2% from the model the brains were fitted in.
 *
 * A row may state its own `accel` to override this; `shipAccel()` in
 * game/ship-specs.ts is the one place that asks.
 */
export const ACCEL_FRACTION = 0.46;
