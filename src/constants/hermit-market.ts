// The rock hermit's market: what a miner is flush with, what they are
// desperate for, and what each costs at the tunnel. The opposite of a station's
// prices — ore cheap and plentiful, supplies dear because nobody delivers out
// here — and, since docs/TODO/96, who they will deal with at all. Spent by
// `hermitMarket` and `hermitRefuses` in game/market.ts.

import { CHARACTER } from './character.ts';

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

/**
 * The name a hermit will not deal with — the character ladder's Dodgy rung,
 * expressed from `CHARACTER` rather than typed so moving the rung moves the
 * door with it (the same trick as `FAME_FULL`, constants/threat.ts).
 *
 * Dodgy is where it has to sit for the deed that earns it: one hermit kill is
 * `DISREPUTE_HERMIT_KILL` (40), which clears this by a wide margin, so cracking
 * a rock costs you every rock for the fortnight or so the decay takes. It is
 * also reachable by a run of dirty sales at 5 apiece, which is the point — the
 * underworld's welcome and its ban are the same number, and a working smuggler
 * has to decide how dirty is too dirty (docs/TODO/96). It is also the top of
 * the `HERMIT_FAVOUR` ramp below: the welcome is widest one point before the
 * door.
 */
export const HERMIT_REFUSES_AT = CHARACTER.find(([, name]) => name === 'Dodgy')![0];

/**
 * Mates' rates, at the widest: what a name worth exactly as much as the hermit
 * will tolerate takes off the ore and adds to the supplies. Both directions
 * favour the pilot, because you BUY the ore and SELL them the food.
 *
 * A fifth. Enough to be worth a detour and to notice on the row, nowhere near
 * enough to make being disreputable a trading strategy on its own: a full
 * favour is ore at 0.60 of a station's price against 0.75, and supplies at
 * 1.56 against 1.30. The carrot Chris asked for is a real perk with a real
 * cliff at the end of it, not an income.
 *
 * Its own rule id: it shares the value 0.2 with `HUNTER_CHANCE_LAUNCH`
 * (constants/population.ts), a price discount beside a probability, and either
 * may move without the other.
 *
 * @rule hermit.favour
 */
export const HERMIT_FAVOUR = 0.2;
