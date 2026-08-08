// How close you have to be before you are anybody's business.
//
// One distance with four readers: whether a hostile engages you, whether the
// condition light goes red, whether a bought combat computer takes the controls,
// and whether a pirate stays on you. `test/npc.test.ts` fails if the literal
// reappears in a consumer. Not `DEFENCE_RANGE` (constants/law.ts), which is also
// 9,000 but is measured from the STATION to decide whether Vipers launch.

/**
 * A hostile closer than this is engaged with you; further away it is scenery.
 * An NPC's laser reaches 3,500, so this is the range a ship starts closing at,
 * not the range it can hurt you from — red means something is on its way.
 */
export const PLAYER_INTEREST_RANGE = 9000;
