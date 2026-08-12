// How far an NPC looks for another NPC to fight — the fights the player is not
// in. `game/npc-targeting.ts` decides who ends up hunting whom. Whether YOU are
// worth a trip is `player-interest.ts`'s wider 9,000, which is where a ship
// starts to close rather than where it can shoot. These are per-role rather than
// one shared radius, so a pirate's appetite is not coupled to the console's
// scanner draw distance.

/**
 * How far a pirate will look for a trader to rob. It is appetite rather than
 * eyesight: how far a payday is worth a flight, when no commander is in reach.
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
 */
export const HUNTER_RANGE = 6000;
