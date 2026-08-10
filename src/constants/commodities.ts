// The career's classes of the 1984 commodity table: which rows count as
// ordinary goods, and what a mined rock yields.
//
// Every list is INDICES into `COMMODITIES` in galaxy/galaxy.ts — the table
// itself is DATA and stays there. For reference: 0 Food, 1 Textiles,
// 4 Liquor/Wines, 8 Machinery, 9 Alloys, 11 Furs, 12 Minerals, 13 Gold,
// 14 Platinum. None of these overlap the law's `CONTRABAND` (constants/law.ts):
// contraband is never ordinary.

/**
 * Ordinary goods — the unremarkable legal cargo plain trade is made of:
 * food, textiles, liquor, machinery, alloys, minerals.
 *
 * A contract's consignment is drawn from it (game/contract-offers.ts), a generation
 * ship sheds it and a wreck spills it (game/spawning.ts). ORDER AND LENGTH ARE
 * LOAD-BEARING: consumers index it with a seeded draw, so reordering it
 * reorders every seeded outcome even though the set is unchanged.
 */
export const ORDINARY_GOODS: readonly number[] = [0, 1, 4, 8, 9, 12];

/**
 * Slaves — the row a rescued survivor is sold on, and the only commodity index
 * named on its own (docs/TODO/127).
 *
 * A person scooped out of a capsule is NOT cargo (`CommanderData.survivors`,
 * docs/TODO/108) and never enters the hold; what the market pays for this row
 * is only ever READ, to price a transaction that moves no tonnage. Named
 * because `commodity 3` appeared in four comments explaining what it was, and
 * a bare 3 in the middle of a sale is the sort of thing a re-ordered table
 * turns into a quiet bug.
 *
 * It is also `CONTRABAND[0]` (constants/law.ts). Not read from there: that list
 * is what the law will fine you for CARRYING, in an order its own consumers
 * index, and this is a price lookup.
 */
export const SLAVES = 3;

/**
 * What a mined asteroid yields: minerals three draws in five, else gold or
 * platinum. A WEIGHTED draw written as repeated indices — `cargo.spawn` picks
 * uniformly, so the repetition is the distribution.
 *
 * Not the hermit's ore list (`HERMIT_ORE`, constants/hermit-market.ts): what a
 * rock pays and what a miner sells are not one rule.
 */
export const ORE: readonly number[] = [12, 12, 12, 13, 14];
