// The commander's own ship, as capacities: the starting name, the grubstake, the
// tank, the missile rails and the two hold sizes.
//
// What the commander IS stays in game/commander.ts. These are the numbers that
// every other surface also reads: the shop, the charts, the briefing, and a
// pirate who sizes up the hold.

/** The original's own commander, and the default here. `newCommander` starts
 *  every career under it, and the save screens fall back to it. */
export const DEFAULT_NAME = 'JAMESON';

/** The grubstake, in tenths of a credit — the classic 100.0 Cr. The briefing
 *  interpolates this, so its prose cannot drift from the credits you get. */
export const STARTING_CREDITS = 1000;

/**
 * What test mode's GRANT CREDITS row hands over per press, in tenths: 10,000 Cr,
 * which is a hundred grubstakes (`game/screens/test-mode.ts`).
 *
 * It is here beside the grubstake for two reasons. It is the same kind of number,
 * money the commander is GIVEN rather than money that something costs. And the
 * shop's shelf is a list of prices, which this is not. A fixed sum rather than
 * a typed one is a decision of docs/TODO/121. A number-entry screen is a second
 * typed input flow, for one development lever. The row repeats, so the way to
 * get more is to press it again.
 *
 * The size is chosen to be one press for anything a test needs, and still small
 * enough that a press is deliberate. It clears the largest fine many times over,
 * and it fills a hold with the priciest cargo. It is not so vast that a marked
 * career reads as having no economy at all.
 *
 * It is named for `GameState.cheat` rather than for the screen, because that is
 * the flag it belongs to, and the one the plan kept. The screen is the door, the
 * flag is the mode, and the mode is what spends this.
 */
export const CHEAT_CREDIT_GRANT = 100_000;

/**
 * The tank, in tenths of a light year — the classic 7.0 LY range.
 *
 * A tenth of a light year is also the unit of chart distance
 * (`chart-metric.ts`). This one number is therefore the tank's size, the reach of
 * a full tank, and the radius of the dashed circle that both charts draw.
 */
export const MAX_FUEL = 70;

/** The missile rails: four, as the original's Cobra carried. */
export const MAX_MISSILES = 4;

/**
 * Which edition of the docked briefing a commander is up to date with.
 *
 * `CommanderData.briefingSeen` records the edition that a commander was shown. A
 * commander whose marker is below this is shown the briefing one time, on their
 * next docked entry (game.ts `enterDocked`). That includes every save written
 * before the marker existed, which is repaired to 0. Bump this only when the
 * briefing changes enough that a returning pilot should read it again. A bump
 * reopens it once for EVERY existing commander.
 *
 * It is an edition counter. That it currently equals other 1-valued constants is
 * a coincidence, not a shared rule.
 *
 * @rule onboarding.briefingVersion
 */
export const BRIEFING_VERSION = 1;

/**
 * What the hold carries, in tonnes, without and with the Large Cargo Bay.
 *
 * It is the single home for both figures. game/commander.ts's `cargoCapacity()`,
 * a pirate's `markOf` and big-bay threshold (game/threat.ts), and the shop's
 * shelf label all read these. The shelf therefore cannot advertise a bay that the
 * game does not fit.
 */
export const HOLD_TONNES = 20;
export const LARGE_BAY_TONNES = 35;
