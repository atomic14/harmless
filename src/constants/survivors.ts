// What becomes of somebody you pulled out of an escape capsule (docs/TODO/127).
//
// The MONEY half only. What each answer does to your NAME is
// constants/character.ts, beside every other deed the ladder prices, and what
// the Government makes of it is constants/law.ts. Three files, three subjects:
// a re-tuned bribe must not have to touch the ladder to say so.

/**
 * What somebody pays you to be let go rather than sold, as a share of what
 * selling them would have fetched.
 *
 * HALF, and the reason it is a share rather than a price of its own is that a
 * person's worth is already decided by the local Slaves quote — a Feudal system
 * pays more for one than a Democracy does, and what they can raise to avoid
 * that fate moves with it. Below the sale because it has to be: if letting them
 * go paid as well, the dirty answer would be the one nobody had a reason to
 * pick, and the choice would stop being a choice.
 *
 * Its own rule id: it shares the value 0.5 with `BRIBE_SHARE`
 * (constants/law.ts), which is a policeman's cut of what he is not reading, and
 * with `SALE_NOTORIETY_MAX` and `DISREPUTE_HEAT`, which are fractions of the
 * heat bar. Four unrelated halves.
 *
 * @rule survivors.releaseShare
 */
export const SURVIVOR_RELEASE_SHARE = 0.5;
