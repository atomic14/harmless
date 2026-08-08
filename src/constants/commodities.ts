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
 * A contract's consignment is drawn from it (game/contracts.ts), a generation
 * ship sheds it and a wreck spills it (game/spawning.ts). ORDER AND LENGTH ARE
 * LOAD-BEARING: consumers index it with a seeded draw, so reordering it
 * reorders every seeded outcome even though the set is unchanged.
 */
export const ORDINARY_GOODS: readonly number[] = [0, 1, 4, 8, 9, 12];

/**
 * What a mined asteroid yields: minerals three draws in five, else gold or
 * platinum. A WEIGHTED draw written as repeated indices — `cargo.spawn` picks
 * uniformly, so the repetition is the distribution.
 *
 * Not the hermit's ore list (`HERMIT_ORE`, constants/hermit-market.ts): what a
 * rock pays and what a miner sells are not one rule.
 */
export const ORE: readonly number[] = [12, 12, 12, 13, 14];
