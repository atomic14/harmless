// How far an NPC looks for another NPC to fight — the fights the player is not
// in. Who ends up hunting whom is `game/npc-targeting.ts`. Whether YOU are worth
// coming for is `player-interest.ts`'s wider 9,000 (where a ship starts closing,
// not where it can shoot). Per-role rather than one shared radius, so a pirate's
// appetite is not coupled to the console's scanner draw distance.

/**
 * How far a pirate will look for a trader to rob. Appetite rather than eyesight:
 * how far a payday is worth flying for when no commander is in reach.
 */
export const PIRATE_HUNT_RANGE = 6000;

/**
 * Police sweep a little wider — they are looking for trouble on purpose. The one
 * of the three that differs, which is why these are per-role.
 */
export const POLICE_HUNT_RANGE = 6500;

/**
 * How far a bounty hunter will look for a pirate to collect on. Separate from
 * `PIRATE_HUNT_RANGE` so changing how the law ranges does not also make every
 * pirate greedier.
 */
export const HUNTER_RANGE = 6000;
