// The 1984 market model, as the career reads it: the domain of the
// fluctuation byte.
//
// The model itself — base prices, gradients, masks — is galaxy/galaxy.ts's
// table and stays there as DATA. This file holds the one number the career
// spends: how many values the fluctuation byte can take.

/**
 * Every value the market's fluctuation byte can take. A byte, so 256 — the
 * original rolls one per visit under a mask. The single home for the count:
 * `marketEstimate` averages over all of them for an exact mean, and fresh-market
 * rolls draw a fluctuation below it.
 */
export const FLUCTUATIONS = 256;

/**
 * What a sale does to your name — spent by `saleFallout` in game/market.ts.
 *
 * The board's side of the same idea is `SMUGGLE_DELIVERY_NOTORIETY`
 * (constants/contracts.ts): that prices a consignment landed for a shipper,
 * these price a deal done over a public counter.
 */

/**
 * The takings, in tenths of a credit, that earn a full point of talk on their
 * own. A payday is noticed for its size whatever it was made of: 4,000 Cr
 * across the counter is a story in a small system.
 */
export const SALE_NOTORIETY_REVENUE = 40_000;

/**
 * Extra talk per tonne of CONTRABAND sold, on top of the takings. Below
 * `SMUGGLE_DELIVERY_NOTORIETY`'s 0.06 per tonne deliberately: a shipper's
 * consignment arrives somewhere expecting it, while a few tonnes over a counter
 * can be passed off — and the counter sale marks the NAME as well
 * (`DISREPUTE_CONTRABAND_SALE`), which the heat alone does not.
 *
 * Owner confirmed as the market rather than character.ts: this is REGIONAL
 * heat, which decays in days and belongs to the place the deal was done. What
 * the same deal does to your name is the character domain's, and the two must
 * be free to move apart.
 */
export const SALE_NOTORIETY_CONTRABAND = 0.04;

/**
 * The most heat one sale can raise, out of the 0..1 bar `LivingGalaxy` keeps.
 * Half, so that no single transaction — a fat legal payday or a hold of
 * contraband — can make a region as hot as a career of them: heat is meant to
 * accumulate over a run of sales and decay between (`HEAT_DECAY`), not to be
 * bought outright at one counter.
 *
 * Its own rule id: it shares the value 0.5 with four unrelated constants (a
 * roll fade, a hit chance, a cone half-angle, a lead time) and must stay free
 * to move without them. docs/TODO/118 owns the wider policy question about
 * popular values; this one is genuinely a heat fraction and nothing else.
 *
 * @rule market.saleNotorietyMax
 */
export const SALE_NOTORIETY_MAX = 0.5;
