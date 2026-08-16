// What a station charges: the 1984 price model with the living galaxy's
// pressure on it, what a world you have not been to is expected to quote, and
// what a rock hermit asks in his tunnel.
//
// It was the back half of game/contracts.ts, which had grown into two
// subjects: what the bulletin board offers you and what the market charges
// you. They share nothing but the system they happen in — no caller wants
// both — and the file crossed the size ceiling when passenger work landed
// (docs/TODO/109). This is the market half, unchanged.
//
// Pure functions, deliberately free of three.js and DOM, so that both the game
// (src/game/game.ts) and the headless campaign simulator (test/campaign.ts)
// run the *same* rules: invariant 10 puts the rule that decides what a station
// charges here rather than in the screen that draws it — which is where
// `makeLocalMarket` used to live, leaving station.ts importing a SCREEN in
// order to open a market.
//
// Erasable-TypeScript only: Node runs this directly via
// --experimental-strip-types.

// .ts extension: this module is run directly by Node (--experimental-strip-types)
// for the campaign simulator, and COMMODITIES is a value import, not a type.
import {
  COMMODITIES, generateMarket, type StarSystem, type MarketEntry,
} from '../galaxy/galaxy.ts';
import { randomInt } from './rng.ts';
import { isContraband } from './law.ts';
import {
  FLUCTUATIONS, SALE_NOTORIETY_CONTRABAND, SALE_NOTORIETY_MAX,
  SALE_NOTORIETY_REVENUE,
} from '../constants/market.ts';
import { DISREPUTE_CONTRABAND_SALE } from '../constants/character.ts';
import {
  HERMIT_FAVOUR, HERMIT_ORE, HERMIT_ORE_GLUT, HERMIT_ORE_PRICE, HERMIT_REFUSES_AT,
  HERMIT_SUPPLIES, HERMIT_SUPPLY_PRICE,
} from '../constants/hermit-market.ts';

/**
 * The 1984 market, nudged by the living galaxy: supply that actually
 * arrived makes goods cheaper here, cargo lost to pirates makes them
 * dearer. Baseline prices are untouched — this is a ±25% delta.
 */
export function applyMarketPressure(
  base: MarketEntry[],
  multiplier: (commodity: number) => number,
): MarketEntry[] {
  return base.map((m, i) => {
    const mult = multiplier(i);
    return {
      ...m,
      price: +(m.price * mult).toFixed(1),
      // scarcity shows in stock as well as price
      quantity: Math.max(0, Math.round(m.quantity * (2 - mult))),
    };
  });
}

/**
 * Prices for the system you are standing in.
 *
 * The 1984 baseline, then the living galaxy's ±25% delta on top: a world that
 * has been buying computers all week pays less for the next batch, and one
 * that has been shipping them out is dearer. Baseline prices are untouched.
 *
 * It lived in screens/trade.ts, which made the rule that decides what a station
 * charges a detail of the screen that draws it — and left station.ts having to
 * import a SCREEN to open a market. Invariant 10 says market rules live here.
 */
export function makeLocalMarket(
  system: StarSystem,
  priceMultiplier: (commodity: number) => number,
): MarketEntry[] {
  return applyMarketPressure(
    // seeded: an unseeded market seed means a reload rerolls prices, which is
    // exactly the save-scum this game now has to be robust to
    generateMarket(system, randomInt(FLUCTUATIONS)),
    priceMultiplier);
}

/**
 * A quoted price as MONEY: tenths of a credit (invariant 8).
 *
 * `MarketEntry.price` is the human-facing figure — 40.6 Cr — and every ledger
 * in the game is integer tenths. The counter did this twice in
 * `screens/trade.ts` (buying and selling) and docs/TODO/127 needed it a third
 * time to price a person off the Slaves row, which is a rounding rule with
 * three homes waiting to disagree about a half-tenth.
 */
export function priceInTenths(price: number): number {
  return Math.round(price * 10);
}

/** What one sale over a counter costs your reputation. */
export interface SaleFallout {
  /** heat to add HERE — `LivingGalaxy.addNotoriety` spreads it to the neighbours */
  notoriety: number;
  /** what it adds to the commander's disrepute; 0 for legal goods */
  disrepute: number;
}

/**
 * Word gets around. A big payday — or any quantity of contraband — makes you
 * worth watching for, here and in the systems within a jump, which is why
 * smuggling raises the temperature of your *next* arrival. Dealing in
 * contraband marks your REPUTATION as well as the region: a dirty sale is a dirty
 * sale however small, and unlike the heat it does not fade in a week
 * (game/character.ts).
 *
 * One home for both halves, because it had two: the game applied this in
 * screens/trade.ts and the campaign harness in a hand-written copy that had
 * the heat and had silently dropped the disrepute. Nothing read `disrepute`
 * then, so the divergence cost nothing; docs/TODO/96 makes it drive the pirate
 * reception, at which point the instrument measuring that balance would have
 * been reading a cleaner commander than the game ships. Invariant 10.
 *
 * `revenue` is in tenths of a credit, like all money here (invariant 8).
 */
export function saleFallout(
  commodity: number, tonnes: number, revenue: number,
): SaleFallout {
  const contraband = isContraband(commodity);
  return {
    notoriety: Math.min(SALE_NOTORIETY_MAX, revenue / SALE_NOTORIETY_REVENUE
      + (contraband ? tonnes * SALE_NOTORIETY_CONTRABAND : 0)),
    disrepute: contraband ? DISREPUTE_CONTRABAND_SALE : 0,
  };
}

/**
 * A quote you have not seen yet: the mean, the cheapest and the dearest the
 * fluctuation byte can make it, with today's pressure on top.
 */
export interface MarketEstimate extends MarketEntry {
  /** `price` is the MEAN over every fluctuation; these are its extremes. */
  low: number;
  high: number;
}

/**
 * What a system is expected to quote, for a chart read before you go and for
 * anything choosing a destination by margin.
 *
 * It runs `galaxy.ts`'s own model over every fluctuation and puts the living
 * galaxy's pressure on top, which is exactly what the destination will quote.
 * The chart renderer and the campaign harness each carried the 1984 formula
 * rewritten instead, with the byte wrap around the wrong expression and no
 * knowledge of pressure at all: 113 of the 4,352 system/commodity rows were
 * out by more than 5 Cr, Teanrebi Narcotics by 38.4. A third copy had already
 * been found wrong and fixed (`train/jameson-autopilot.js`) and these two were
 * left, which is what a transcribed rule costs.
 *
 * Pressure goes on the summary rather than inside the loop because
 * `applyMarketPressure` scales the price and is monotonic in it: scaling the
 * mean is the mean of the scalings, and the cheapest quote stays the cheapest.
 *
 * A mean is not a price, which is why `low`/`high` come with it. Narcotics is
 * the case that proves it: the model wraps at 0xff, so one fluctuation quotes
 * near 100 Cr and the next near nothing, and a mean of 58 describes neither.
 */
export function marketEstimate(
  system: StarSystem,
  priceMultiplier: (commodity: number) => number,
): MarketEstimate[] {
  const sum = COMMODITIES.map(() => ({ price: 0, quantity: 0 }));
  const low = COMMODITIES.map(() => Infinity);
  const high = COMMODITIES.map(() => -Infinity);
  for (let f = 0; f < FLUCTUATIONS; f++) {
    const market = generateMarket(system, f);
    for (let i = 0; i < market.length; i++) {
      sum[i].price += market[i].price;
      sum[i].quantity += market[i].quantity;
      if (market[i].price < low[i]) low[i] = market[i].price;
      if (market[i].price > high[i]) high[i] = market[i].price;
    }
  }
  // The rows carry the mean; `low`/`high` ride through the same pressure step
  // as a price, because that is what they are.
  const mean = generateMarket(system, 0).map((m, i) => ({
    ...m,
    price: sum[i].price / FLUCTUATIONS,
    quantity: sum[i].quantity / FLUCTUATIONS,
  }));
  const pressured = applyMarketPressure(mean, priceMultiplier);
  const cheapest = applyMarketPressure(
    mean.map((m, i) => ({ ...m, price: low[i] })), priceMultiplier);
  const dearest = applyMarketPressure(
    mean.map((m, i) => ({ ...m, price: high[i] })), priceMultiplier);
  return pressured.map((m, i) => ({
    ...m, low: cheapest[i].price, high: dearest[i].price,
  }));
}

/**
 * Prices at a rock hermit's tunnel, rolled fresh.
 *
 * The hermit economy should read as the opposite of a station's: a miner is
 * flush with what they dug up and desperate for what they cannot dig, so ore
 * goes cheap and in quantity while food, drink and machinery are dear. That is
 * the whole trade — buy ore here, sell it where the mining stopped — and it is
 * also the one market that never asks what else is in your hold.
 *
 * `fluctuation` defaults to a seeded roll for the same reason
 * `makeLocalMarket`'s does: an unseeded market seed means a reload rerolls the
 * prices. It is a parameter so a headless run (the campaign) can supply its own
 * stream instead of the world's.
 */
export function hermitMarket(
  system: StarSystem,
  disrepute = 0,
  fluctuation: number = randomInt(FLUCTUATIONS),
): MarketEntry[] {
  const favour = HERMIT_FAVOUR * hermitFavour(disrepute);
  return generateMarket(system, fluctuation).map((m) => {
    if (HERMIT_ORE.has(m.name)) {
      return {
        ...m,
        quantity: m.quantity + HERMIT_ORE_GLUT,
        price: +(m.price * HERMIT_ORE_PRICE * (1 - favour)).toFixed(1),
      };
    }
    if (HERMIT_SUPPLIES.has(m.name)) {
      return { ...m, price: +(m.price * HERMIT_SUPPLY_PRICE * (1 + favour)).toFixed(1) };
    }
    return m;
  });
}

/**
 * Will this hermit deal with you at all?
 *
 * The direct, thematic price of cracking rocks: the one market that never asks
 * what is in your hold is also the one that remembers what you did to the last
 * miner. Binary, above `HERMIT_REFUSES_AT` — the beacon still blinks and the
 * hail still calls you in, and the door shuts at the tunnel mouth
 * (game/world-step.ts).
 */
export function hermitRefuses(disrepute: number): boolean {
  return disrepute >= HERMIT_REFUSES_AT;
}

/**
 * How much of a credential your reputation is out here: 0 for a spotless commander,
 * 1 for one standing at the very edge of what a hermit will tolerate.
 *
 * The same threshold as the refusal, deliberately. A miner's opinion of you is
 * one number with a cliff at the end of it: known enough to be one of us, right
 * up until you are the reason we bolt the door. Scaled by `HERMIT_FAVOUR` into
 * a price; clamped, so the unreachable range above the door has no meaning.
 */
export function hermitFavour(disrepute: number): number {
  return Math.min(1, Math.max(0, disrepute) / HERMIT_REFUSES_AT);
}

