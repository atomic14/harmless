// The 1984 market model, as the career reads it: the domain of the fluctuation
// byte.
//
// The model itself — the base prices, the gradients, the masks — is
// galaxy/galaxy.ts's table, and it stays there as DATA. This file holds the one
// number that the career spends: how many values the fluctuation byte can take.

/**
 * Every value that the market's fluctuation byte can take. It is a byte, so 256.
 * The original rolls one per visit, under a mask. This is the single home for the
 * count. `marketEstimate` averages over all of them for an exact mean, and a
 * fresh-market roll draws a fluctuation below it.
 */
export const FLUCTUATIONS = 256;

/**
 * What a sale does to your name. `saleFallout` in game/market.ts spends these.
 *
 * The board's side of the same idea is `SMUGGLE_DELIVERY_NOTORIETY`
 * (constants/contracts.ts). That one prices a consignment landed for a shipper.
 * These price a deal done over a public counter.
 */

/**
 * The takings that earn a full point of talk on their own, in tenths of a credit.
 * A payday is noticed for its size, whatever it was made of. 4,000 Cr across the
 * counter is a story in a small system.
 */
export const SALE_NOTORIETY_REVENUE = 40_000;

/**
 * Extra talk per tonne of CONTRABAND sold, on top of the takings. It is
 * deliberately below `SMUGGLE_DELIVERY_NOTORIETY`'s 0.06 per tonne. A shipper's
 * consignment arrives somewhere that expects it, and a few tonnes over a counter
 * can be passed off. The counter sale also marks the NAME
 * (`DISREPUTE_CONTRABAND_SALE`), which the heat alone does not.
 *
 * The owner is confirmed as the market rather than character.ts. This is REGIONAL
 * heat. It decays in days, and it belongs to the place where the deal was done.
 * What the same deal does to your name belongs to the character domain, and the
 * two must be free to move apart.
 */
export const SALE_NOTORIETY_CONTRABAND = 0.04;

/**
 * The most heat that one sale can raise, out of the 0..1 bar that `LivingGalaxy`
 * keeps. It is half, so that no single transaction can make a region as hot as a
 * career of them. That covers a fat legal payday and a hold of contraband alike.
 * Heat is meant to accumulate over a run of sales, and to decay between them
 * (`HEAT_DECAY`). It is not meant to be bought outright at one counter.
 *
 * It has its own rule id. It shares the value 0.5 with four unrelated constants —
 * a roll fade, a hit chance, a cone half-angle and a lead time — and it must stay
 * free to move without them. docs/TODO/118 owns the wider policy question about
 * popular values. This one is genuinely a heat fraction and nothing else.
 *
 * @rule market.saleNotorietyMax
 */
export const SALE_NOTORIETY_MAX = 0.5;
