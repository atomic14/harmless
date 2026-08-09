// The rock hermit's market: what a miner is flush with, what they are
// desperate for, and what each costs at the tunnel. The opposite of a station's
// prices — ore cheap and plentiful, supplies dear because nobody delivers out
// here. Spent by `hermitMarket` in game/market.ts.

/**
 * What a hermit is sitting on: whatever they dug up.
 *
 * Matched on the market row's NAME, not its index, so a renamed row cannot
 * silently drop out (`test/economy.test.ts` catches it). Distinct from
 * `commodities.ts`'s `ORE`, which is what a MINED ROCK yields.
 */
export const HERMIT_ORE: ReadonlySet<string> = new Set(['Minerals', 'Gold', 'Platinum', 'Gem-Stones']);

/** What a hermit has run out of: anything that has to be flown in. */
export const HERMIT_SUPPLIES: ReadonlySet<string> = new Set(['Food', 'Liquor/Wines', 'Machinery']);

/** Ore is a quarter off here, and there is plenty of it. */
export const HERMIT_ORE_PRICE = 0.75;

/** Bulk stock a rock miner is never short of, on top of the rolled quantity. */
export const HERMIT_ORE_GLUT = 20;

/** Supplies cost a third more: nobody else is delivering out here. */
export const HERMIT_SUPPLY_PRICE = 1.3;
