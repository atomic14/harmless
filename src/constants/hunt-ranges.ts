// How far an NPC looks for another NPC to fight — the fights the player is not
// in. `game/npc-targeting.ts` decides who ends up hunting whom. Whether YOU are
// worth a trip is `player-interest.ts`'s wider 9,000, which is where a ship
// starts to close rather than where it can shoot. These are per-role rather than
// one shared radius, so a pirate's appetite is not coupled to the console's
// scanner draw distance.

/**
 * How far a pirate will look for a trader to rob. It is appetite rather than
 * eyesight: how far a payday is worth a flight, when no commander is in reach.
 *
 * @rule hunt.pirate
 */
export const PIRATE_HUNT_RANGE = 6000;

/**
 * The police sweep a little wider, because they look for trouble on purpose.
 * This is the one of the three that differs, which is why these are per-role.
 */
export const POLICE_HUNT_RANGE = 6500;

/**
 * How far a bounty hunter will look for a pirate to collect on. It is separate
 * from `PIRATE_HUNT_RANGE`, so a change to how the law ranges does not also make
 * every pirate greedier.
 *
 * @rule hunt.hunter
 */
export const HUNTER_RANGE = 6000;

/**
 * How far an NPC keeps chasing the target it already has.
 *
 * IT IS THE HOLD RANGE, AND THE THREE ABOVE ARE THE ACQUIRE RANGES. A ship
 * takes a target at 6,000 to 6,500 and drops it at 7,000. That gap is
 * hysteresis, and it is the point: a target that sits on the boundary would
 * otherwise be taken and dropped on alternate frames.
 *
 * `game/npc.ts` spends it, on the branch that flies at `npcTarget`. It was a
 * bare 7,000 there until docs/TODO/180, next to a file that already named the
 * other half of the same rule.
 *
 * @rule hunt.hold
 * @domain hunt-ranges
 */
export const HUNT_HOLD_RANGE = 7000;
