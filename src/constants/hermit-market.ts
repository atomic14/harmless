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

/** What a hermit runs out of: anything that must be flown in. */
export const HERMIT_SUPPLIES: ReadonlySet<string> = new Set(['Food', 'Liquor/Wines', 'Machinery']);

/** Ore is a quarter off here, and there is plenty of it. */
export const HERMIT_ORE_PRICE = 0.75;

/** Bulk stock a rock miner is never short of, on top of the rolled quantity. */
export const HERMIT_ORE_GLUT = 20;

/** Supplies cost a third more: nobody else delivers out here. */
export const HERMIT_SUPPLY_PRICE = 1.3;

/**
 * The character a hermit will not deal with: the ladder's Dodgy rung.
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
export const HERMIT_REFUSES_AT = CHARACTER.find(([, rung]) => rung === 'Dodgy')![0];

/**
 * Mates' rates, at the widest. It is what a character worth exactly as much as
 * the hermit will tolerate takes off the ore, and adds to the supplies. Both
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

/**
 * How near a rock hermit the commander must be to hear its hail.
 *
 * It is also the range she has to LEAVE to hear it again. One number covers
 * both, because a door you enter and a door you leave are the same door. A
 * second radius would give a band where the hail neither fires nor resets.
 *
 * `game/world-step.ts` spends it twice. It was a bare 900 at both until
 * docs/TODO/180.
 *
 * @rule hermit.hail
 * @domain hermit-market
 */
export const HERMIT_HAIL_RANGE = 900;

/**
 * How near the commander must be to actually trade with a hermit.
 *
 * Well inside `HERMIT_HAIL_RANGE` above. So the hail is a warning with room to
 * act on it, rather than a line that fires as the door opens.
 *
 * @rule hermit.dockRange
 * @domain hermit-market
 */
export const HERMIT_DOCK_RANGE = 320;

/**
 * How slow the commander must be flying to trade with a hermit.
 *
 * There is no numeric speed readout in this game, because `hud.ts` paints a
 * bar. So the hail interpolates this number rather than stating one of its own.
 * It said `SLOW TO 20` beside a rule of 40 until docs/TODO/180.
 *
 * @rule hermit.dockSpeed
 * @domain hermit-market
 */
export const HERMIT_DOCK_SPEED = 40;
