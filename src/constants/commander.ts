// The commander's own ship, as capacities: the starting name, the grubstake,
// the tank, the missile rails and the two hold sizes.
//
// What the commander IS stays in game/commander.ts; these are the numbers
// every other surface also reads (shop, charts, briefing, a pirate sizing up
// the hold).

/** The original's own commander, and the default here; `newCommander` starts
 *  every career under it and the save screens fall back to it. */
export const DEFAULT_NAME = 'JAMESON';

/** The grubstake, in tenths of a credit — the classic 100.0 Cr. The briefing
 *  interpolates this, so its prose cannot drift from the credits you get. */
export const STARTING_CREDITS = 1000;

/**
 * What test mode's GRANT CREDITS row hands over per press, in tenths — 10,000
 * Cr, a hundred grubstakes (`game/screens/test-mode.ts`).
 *
 * Here beside the grubstake because it is the same kind of number — money the
 * commander is GIVEN rather than money something costs — and because the shop's
 * shelf is a list of prices, which this is not. A fixed sum rather than a typed
 * one is a decision of docs/TODO/121: a number-entry screen is a second typed
 * input flow for one development lever, and the row is repeatable, so the way
 * to get more is to press it again.
 *
 * The size is chosen to be one press for anything a test needs and still small
 * enough that pressing it is deliberate: it clears the largest fine many times
 * over and fills a hold with the priciest cargo, but it is not so vast that a
 * marked career reads as having no economy at all.
 *
 * Named for `GameState.cheat` rather than for the screen, because that is the
 * flag it belongs to and the one the plan kept: the screen is the door, the
 * flag is the mode, and it is the mode that spends this.
 */
export const CHEAT_CREDIT_GRANT = 100_000;

/**
 * The tank, in tenths of a light year — the classic 7.0 LY range.
 *
 * A tenth of a light year is also the unit of chart distance
 * (`chart-metric.ts`), so this one number is the tank's size, the reach of a
 * full tank, and the radius of the dashed circle both charts draw.
 */
export const MAX_FUEL = 70;

/** The missile rails: four, as the original's Cobra carried. */
export const MAX_MISSILES = 4;

/**
 * Which edition of the docked briefing a commander is up to date with.
 *
 * `CommanderData.briefingSeen` records the edition a commander has been shown;
 * a commander whose marker is below this — including every save written before
 * the marker existed, repaired to 0 — is shown the briefing once on their next
 * docked entry (game.ts `enterDocked`). Bump it only when the briefing changes
 * enough that returning pilots should read it again; a bump reopens it once
 * for EVERY existing commander.
 * An edition counter: that it currently equals other 1-valued constants is
 * coincidence, not a shared rule.
 *
 * @rule onboarding.briefingVersion
 */
export const BRIEFING_VERSION = 1;

/**
 * What the hold carries, in tonnes, without and with the Large Cargo Bay.
 *
 * The single home for both figures: game/commander.ts's `cargoCapacity()`, a
 * pirate's `markOf`/big-bay threshold (game/threat.ts) and the shop's shelf
 * label all read these, so the shelf cannot advertise a bay the game does not
 * fit.
 */
export const HOLD_TONNES = 20;
export const LARGE_BAY_TONNES = 35;
