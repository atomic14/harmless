// The career's classes of the 1984 commodity table: which rows count as ordinary
// goods, and what a mined rock yields.
//
// Every list holds INDICES into `COMMODITIES` in galaxy/galaxy.ts. The table
// itself is DATA, and it stays there. For reference: 0 Food, 1 Textiles,
// 4 Liquor/Wines, 8 Machinery, 9 Alloys, 11 Furs, 12 Minerals, 13 Gold,
// 14 Platinum. None of these overlap the law's `CONTRABAND` (constants/law.ts),
// because contraband is never ordinary.

/**
 * Ordinary goods: the unremarkable legal cargo that plain trade is made of —
 * food, textiles, liquor, machinery, alloys, minerals.
 *
 * A contract's consignment is drawn from it (game/contract-offers.ts). A
 * generation ship sheds it, and a wreck spills it (game/spawning.ts). ORDER AND
 * LENGTH ARE LOAD-BEARING. Consumers index it with a seeded draw, so a new order
 * reorders every seeded outcome, even when the set is unchanged.
 */
export const ORDINARY_GOODS: readonly number[] = [0, 1, 4, 8, 9, 12];

/**
 * Slaves: the row that a rescued survivor is sold on, and the only commodity
 * index named on its own (docs/TODO/127).
 *
 * A person scooped out of a capsule is NOT cargo (`CommanderData.survivors`,
 * docs/TODO/108), and never enters the hold. The code only ever READS what the
 * market pays for this row, to price a transaction that moves no tonnage. It is
 * named because `commodity 3` appeared in four comments that explained what it
 * was. A bare 3 in the middle of a sale is the sort of thing that a re-ordered
 * table turns into a quiet bug.
 *
 * It is also `CONTRABAND[0]` (constants/law.ts). It is not read from there. That
 * list is what the law will fine you for CARRYING, in an order that its own
 * consumers index, and this is a price lookup.
 */
export const SLAVES = 3;

/**
 * What a mined asteroid yields: minerals three draws in five, and otherwise gold
 * or platinum. It is a WEIGHTED draw, written as repeated indices. `cargo.spawn`
 * picks uniformly, so the repetition is the distribution.
 *
 * It is not the hermit's ore list (`HERMIT_ORE`, constants/hermit-market.ts).
 * What a rock pays and what a miner sells are not one rule.
 */
export const ORE: readonly number[] = [12, 12, 12, 13, 14];
