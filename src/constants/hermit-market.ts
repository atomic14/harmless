// The rock hermit's market: what a miner is flush with, what they are desperate
// for, and what each costs at the tunnel. It is the opposite of a station's
// prices. Ore is cheap and plentiful, and supplies are dear because nobody
// delivers out here. Since docs/TODO/96 it also holds who they will deal with at
// all. `hermitMarket` and `hermitRefuses` in game/market.ts spend it.

import { CHARACTER } from './character.ts';

/**
 * What a hermit sits on: whatever they dug up.
 *
 * The match is on the market row's NAME, not on its index, so a renamed row
 * cannot silently drop out (`test/economy.test.ts` catches it). It is distinct
 * from `commodities.ts`'s `ORE`, which is what a MINED ROCK yields.
 */
export const HERMIT_ORE: ReadonlySet<string> = new Set(['Minerals', 'Gold', 'Platinum', 'Gem-Stones']);

/** What a hermit has run out of: anything that has to be flown in. */
export const HERMIT_SUPPLIES: ReadonlySet<string> = new Set(['Food', 'Liquor/Wines', 'Machinery']);

/** Ore is a quarter off here, and there is plenty of it. */
export const HERMIT_ORE_PRICE = 0.75;

/** Bulk stock a rock miner is never short of, on top of the rolled quantity. */
export const HERMIT_ORE_GLUT = 20;

/** Supplies cost a third more: nobody else delivers out here. */
export const HERMIT_SUPPLY_PRICE = 1.3;

/**
 * The name that a hermit will not deal with: the character ladder's Dodgy rung.
 * It is an expression over `CHARACTER` rather than a typed number, so a move to
 * the rung moves the door with it. That is the same trick as `FAME_FULL`
 * (constants/threat.ts).
 *
 * Dodgy is where it has to sit for the deed that earns it. One hermit kill is
 * `DISREPUTE_HERMIT_KILL` (40), which clears this by a wide margin. To crack a
 * rock therefore costs you every rock, for the fortnight or so that the decay
 * takes. A run of dirty sales at 5 apiece also reaches it, which is the point.
 * The underworld's welcome and its ban are the same number, so a working smuggler
 * has to decide how dirty is too dirty (docs/TODO/96). It is also the top of the
 * `HERMIT_FAVOUR` ramp below: the welcome is widest one point before the door.
 */
export const HERMIT_REFUSES_AT = CHARACTER.find(([, name]) => name === 'Dodgy')![0];

/**
 * Mates' rates, at the widest. It is what a name worth exactly as much as the
 * hermit will tolerate takes off the ore, and adds to the supplies. Both
 * directions favour the pilot, because you BUY the ore and SELL them the food.
 *
 * It is a fifth. That is enough to be worth a detour, and enough to notice on the
 * row. It is nowhere near enough to make disrepute a trading strategy on its own.
 * A full favour is ore at 0.60 of a station's price against 0.75, and supplies at
 * 1.56 against 1.30. The carrot Chris asked for is a real perk with a real cliff
 * at the end of it. It is not an income.
 *
 * It has its own rule id. It shares the value 0.2 with `HUNTER_CHANCE_LAUNCH`
 * (constants/population.ts) — a price discount beside a probability — and either
 * one may move without the other.
 *
 * @rule hermit.favour
 */
export const HERMIT_FAVOUR = 0.2;
