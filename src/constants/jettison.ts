// Buying your way out of a fight: what a pirate asks for, and what a tonne is
// worth to everyone doing the asking. Spent by game/jettison.ts (dump the most
// valuable thing first, accumulate the toll across an encounter). Pirates came
// for cargo, not for you: give them enough and the opportunists break off.

/**
 * A pirate wants this share of your arrival cargo value — an organised gang
 * considerably more than an opportunist who happened to be passing.
 */
export const OPPORTUNIST_SHARE = 0.12;
export const GANG_SHARE = 0.3;

/** ...but never less than this, so a near-empty hold is not a free pass. */
export const OPPORTUNIST_FLOOR = 400;
export const GANG_FLOOR = 1500;

/**
 * What the market values a tonne at: this times its 1984 base price, in tenths
 * of a credit (basePrice is the source's byte encoding; x0.4 gives credits, so
 * x4 gives tenths).
 *
 * ONE HOME for a rule two functions share: the toll (`dumpCargo`) and the
 * assessment (`markOf` in game/threat.ts) must agree on what a hold is worth, or
 * a bribe sized off one answers an appetite sized off another. Both import this;
 * `test/economy.test.ts` solves the multiplier back out of `markOf` and compares.
 */
export const VALUE_PER_TONNE = 4;
