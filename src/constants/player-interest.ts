// How close you have to be before you are anybody's business.
//
// One distance with four readers. It decides four things:
//
//   1. whether a hostile engages you;
//   2. whether the condition light goes red;
//   3. whether a bought combat computer takes the controls;
//   4. whether a pirate stays on you.
//
// `test/npc.test.ts` fails if
// the literal reappears in a consumer. It is not `DEFENCE_RANGE`
// (constants/law.ts), which is also 9,000. That one is measured from the STATION,
// and it decides whether the Vipers launch.

/**
 * A hostile closer than this is engaged with you. Further away, it is scenery.
 * An NPC's laser reaches 3,500, so this is the range a ship starts to close at.
 * It is not the range it can hurt you from. Red means that something is on its
 * way.
 */
export const PLAYER_INTEREST_RANGE = 9000;

/**
 * How close the commander must be before an armed trader on the run turns and
 * fights her, rather than whoever else is shooting at it.
 *
 * NARROWER THAN `PLAYER_INTEREST_RANGE` ABOVE, ON PURPOSE. That one is where a
 * hostile starts to close on her. This is where a ship that is ALREADY fleeing
 * decides she is the one worth turning on. A trader with a pirate behind it and
 * the commander far off should answer the pirate.
 *
 * `game/npc.ts` spends it twice, on the scripted branch and on the trained
 * defence branch, because the choice of prey is the same either way. It was a
 * bare 6,000 at both until docs/TODO/180.
 *
 * @rule interest.turnAndFight
 * @domain player-interest
 */
export const TURN_AND_FIGHT_RANGE = 6000;
