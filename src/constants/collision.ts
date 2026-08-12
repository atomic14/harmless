// Ships are solid. This file holds the commander's contact radius, and what a
// collision costs in speed. The overlap tests are `game/collisions.ts`. What a
// ram costs in DAMAGE is `IMPACT.ram` in `./impact.ts`.

/**
 * Speed kept after a collision. A ram should cost you your run. There are three
 * values for three kinds of contact, because the kind is what decides it. Player
 * and NPC agree today, and nothing requires them to.
 */
export const PLAYER_SPEED_KEPT = 0.3;
export const NPC_SPEED_KEPT = 0.3;
/**
 * A hit on the station is the gentlest of the three. You are already slow, and
 * the alternative is a docking attempt that ends every run.
 *
 * It has its own rule id because 0.4 is a popular fraction elsewhere — a fuel
 * price, a missile's last stand, a danger threshold. None of them should move
 * because a ram got more or less forgiving.
 *
 * @rule collision.stationSpeedKept
 */
export const STATION_SPEED_KEPT = 0.4;

/**
 * The commander's own contact radius, in world units. Two rules read it: the
 * overlap test, and `tacticsFor`'s gate on whether a pass clears both hulls.
 */
export const COMMANDER_HULL_RADIUS = 25;
