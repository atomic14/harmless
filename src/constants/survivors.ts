// What becomes of somebody you pulled out of an escape capsule (docs/TODO/127).
//
// The MONEY half only. What each answer does to your REPUTATION is
// constants/character.ts, beside every other deed that the ladder prices. What
// the Government makes of it is constants/law.ts. Three files, three subjects.
// A re-tuned bribe must not touch the ladder to say so.

/**
 * What a PERSON is worth on the Slaves row, counted in tonnes of it.
 *
 * docs/TODO/127 priced a sale at the market's own quote for one tonne, and
 * recorded the result as a question for the playtest. A measurement of the galaxy
 * answered it with no flight at all. Across galaxies 1, 2 and 8, a tonne of
 * Slaves is 2 Cr at the cheapest system and 16 Cr at the dearest. The median is
 * 8–10. So
 * a sale paid 2–16 Cr. It also filed an Offender record that costs
 * `OFFENDER_FINE` (25 Cr) to clear, on top of `DISREPUTE_SLAVE_SALE`, which takes
 * an Honest commander clear to Dodgy. **The deed did not cover its own cleanup at
 * any market in any galaxy.** No commander who could do arithmetic would ever
 * pick it, so 127's forced choice had one branch that was never the answer.
 *
 * FOUR is the smallest whole number that clears `OFFENDER_FINE` at a MEDIAN
 * market: 8 Cr x 4 = 32 Cr, against a 25 Cr fine. The median is the right bar
 * rather than the cheapest. A person who fetched the same everywhere would
 * waste the one thing `survivorOffers` was built on. A Feudal system pays more
 * for one than a Democracy does. At the dearest market it is 64 Cr, which is
 * a real temptation to a commander who started with 100. At the cheapest it is
 * 8 Cr, which is correctly not worth a name. **Where you are docked decides**,
 * and a carry to a better market is now a thing to be tempted by.
 *
 * It is a multiple of the quote rather than a price of its own, because the quote
 * is the part that must keep moving. Re-tune this, and the market's own spread
 * survives it. Those are docs/TODO/127's own words: the lever is a multiplier on
 * top.
 *
 * NOT FLOWN. The FLOOR is a rule, and this comment argues it. How far above the
 * floor a person should sit is a taste, and it is the playtest's. It is one
 * number in one file for exactly that reason.
 *
 * It has its own rule id. Eleven other constants are 4, and a reader could take
 * two of them for this one. `VALUE_PER_TONNE` (constants/jettison.ts) turns a
 * 1984 base price into tenths. `PATROL_BRIBE_FINES` (constants/law.ts) is how
 * many fines a policeman on the hunt wants. The rest are missile racks, energy
 * banks and line durations. This is the only one of the twelve that counts
 * PEOPLE, and it must stay free to move alone.
 *
 * @rule survivors.saleTonnes
 */
export const SURVIVOR_SALE_TONNES = 4;

/**
 * What somebody pays you for their freedom rather than a sale, as a share of
 * what that sale would fetch.
 *
 * HALF. It is a share rather than a price of its own because the local Slaves
 * quote already decides a person's worth. A Feudal system pays more for one than
 * a Democracy does, and what they can raise to avoid that fate moves with it. It
 * is below the sale because it has to be. A release that paid as well would
 * make the dirty answer the one nobody has a reason to pick. The choice would
 * then stop being a choice.
 *
 * It has its own rule id. It shares the value 0.5 with three others.
 * `BRIBE_SHARE` (constants/law.ts) is a policeman's cut of what he does not
 * read. `SALE_NOTORIETY_MAX` and `DISREPUTE_HEAT` are fractions of the heat
 * bar. Four unrelated halves.
 *
 * @rule survivors.releaseShare
 */
export const SURVIVOR_RELEASE_SHARE = 0.5;
