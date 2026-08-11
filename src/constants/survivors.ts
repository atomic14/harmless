// What becomes of somebody you pulled out of an escape capsule (docs/TODO/127).
//
// The MONEY half only. What each answer does to your NAME is
// constants/character.ts, beside every other deed the ladder prices, and what
// the Government makes of it is constants/law.ts. Three files, three subjects:
// a re-tuned bribe must not have to touch the ladder to say so.

/**
 * What a PERSON is worth on the Slaves row, counted in tonnes of it.
 *
 * docs/TODO/127 priced a sale at the market's own quote for one tonne and
 * recorded the result as a question for the playtest. Measuring the galaxy
 * answered it without a flight: a tonne of Slaves is 2 Cr at the cheapest
 * system and 16 Cr at the dearest, median 8–10, across galaxies 1, 2 and 8. So
 * a sale paid 2–16 Cr — and filed an Offender record that costs `OFFENDER_FINE`
 * (25 Cr) to clear, on top of `DISREPUTE_SLAVE_SALE`, which takes an Honest
 * commander clear to Dodgy. **The deed did not cover its own cleanup at any
 * market in any galaxy**, so no commander who could do arithmetic would ever
 * pick it, and 127's forced choice had one branch that was never the answer.
 *
 * FOUR is the smallest whole number that clears `OFFENDER_FINE` at a MEDIAN
 * market (8 Cr x 4 = 32 Cr against a 25 Cr fine), and the median is the right
 * bar rather than the cheapest: a person fetching the same anywhere would waste
 * the one thing `survivorOffers` was built on — that a Feudal system pays more
 * for one than a Democracy does. At the dearest market it is 64 Cr, which is a
 * real temptation to a commander who started with 100; at the cheapest it is
 * 8 Cr, which is correctly not worth a name. **Where you are docked decides**,
 * and carrying somebody to a better market is now a thing to be tempted by.
 *
 * A multiple of the quote rather than a price of its own, because the quote is
 * the part that must keep moving: re-tune this and the market's own spread
 * survives it (docs/TODO/127's own words — the lever is a multiplier on top).
 *
 * NOT FLOWN. The FLOOR is a rule and this comment argues it; how far above the
 * floor a person should sit is a taste, and it is the playtest's. It is one
 * number in one file for exactly that reason.
 *
 * Its own rule id: eleven other constants are 4, and the two that could be
 * mistaken for this one are `VALUE_PER_TONNE` (constants/jettison.ts), which
 * turns a 1984 base price into tenths, and `PATROL_BRIBE_FINES`
 * (constants/law.ts), which is how many fines a hunting policeman wants. The
 * rest are missile racks, energy banks and line durations. This is the only one
 * of the twelve that counts PEOPLE, and it must stay free to move alone.
 *
 * @rule survivors.saleTonnes
 */
export const SURVIVOR_SALE_TONNES = 4;

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
