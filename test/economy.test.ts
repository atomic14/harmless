// Prices, contracts, the law, and what a pirate thinks you are worth.
//
// The rules a career is made of. They live in contracts.ts and law.ts rather than
// game.ts (invariant 10) precisely so they can be driven directly from here, and
// so the headless campaign runs the same code the game does.

import { readFileSync, readdirSync } from 'node:fs';
import { newCommander, killValue } from '../src/game/commander.ts';
import { MAX_FUEL } from '../src/constants/commander.ts';
import { fuelNeeded, refuelCost, fuelQuote } from '../src/game/shop.ts';
import { FUEL_PRICE } from '../src/constants/shop.ts';
import {
  equipRows, renderMarket,
} from '../src/ui/screens-trade.ts';
import {
  isContraband,
  contrabandTonnes,
  carryingContraband,
  fineFor,
  recordCleared,
  offenceFor,
} from '../src/game/law.ts';
import {
  CONTRABAND,
  LEGAL_NAMES,
  CLEAN,
  OFFENDER,
  FUGITIVE,
  OFFENDER_FINE,
  FUGITIVE_FINE,
} from '../src/constants/law.ts';
import { generateGalaxy, generateMarket, COMMODITIES } from '../src/galaxy/galaxy.ts';
import {
  hermitMarket, hermitRefuses, marketEstimate, saleFallout,
} from '../src/game/market.ts';
import { HERMIT_FAVOUR, HERMIT_REFUSES_AT } from '../src/constants/hermit-market.ts';
import {
  FLUCTUATIONS, SALE_NOTORIETY_CONTRABAND, SALE_NOTORIETY_MAX, SALE_NOTORIETY_REVENUE,
} from '../src/constants/market.ts';
import { MarketScreen, type TradeContext } from '../src/game/screens/trade.ts';
import { CHARACTER, DISREPUTE_CONTRABAND_SALE } from '../src/constants/character.ts';
import { characterName } from '../src/game/character.ts';
import { LivingGalaxy } from '../src/galaxy/living.ts';
import { pirateThreat, markOf, memberTier, type Mark } from '../src/game/threat.ts';
import {
  CHALLENGE_RATE, COURTESY_RATE, DISREPUTE_DRAW, DISREPUTE_FULL, DISREPUTE_HEAT,
  PRIZE_SATURATION,
} from '../src/constants/threat.ts';
import { VALUE_PER_TONNE } from '../src/constants/jettison.ts';
import { HOLD_TONNES, LARGE_BAY_TONNES } from '../src/constants/commander.ts';
import { cargoCapacity, cargoTonnes } from '../src/game/commander.ts';
import { PASSENGER_BERTH_TONNES } from '../src/constants/contracts.ts';
import { rating, ratingLadder } from '../src/game/rating.ts';
import { RATINGS } from '../src/constants/rating.ts';
import { makeRng } from '../src/game/rng.ts';
import { check, eq } from './harness.ts';
import { g1 } from './fixtures.ts';

// --- market model -----------------------------------------------------------

console.log('\nmarket model');
const laveMarket = generateMarket(g1[7], 0);
eq('17 commodities', laveMarket.length, COMMODITIES.length);
check('agricultural food is cheap (< 6.0 Cr)', laveMarket[0].price < 6);
check('agricultural computers are dear (> 80 Cr)', laveMarket[7].price > 80);
const leesti = g1.find((s) => s.name === 'Leesti')!;
const leestiMarket = generateMarket(leesti, 0);
check('industrial computers cheaper than agricultural',
  leestiMarket[7].price < laveMarket[7].price);
check('industrial food dearer than agricultural',
  leestiMarket[0].price > laveMarket[0].price);
check('quantities stay within a byte-masked range',
  laveMarket.every((m) => m.quantity >= 0 && m.quantity <= 63));

// --- the estimate a chart shows before you go -------------------------------
//
// The MARKET ESTIMATE panel and the campaign harness both carried the 1984
// formula rewritten — out by over 5 Cr on 113 of the 4,352 system/commodity
// rows, by 38.4 on Teanrebi Narcotics, and blind to living-galaxy pressure.

console.log('\nmarket estimate');
{
  const flat = () => 1;
  // every system and every commodity: the 4,352-row sweep, against the owner
  let worst = 0, worstAt = '';
  for (const sys of g1) {
    const est = marketEstimate(sys, flat);
    for (let i = 0; i < COMMODITIES.length; i++) {
      let sum = 0;
      for (let f = 0; f < FLUCTUATIONS; f++) sum += generateMarket(sys, f)[i].price;
      const d = Math.abs(est[i].price - sum / FLUCTUATIONS);
      if (d > worst) { worst = d; worstAt = `${sys.name} ${COMMODITIES[i].name}`; }
    }
  }
  check(`every estimate is the true 256-fluctuation mean, to the tenth of a credit`
    + ` it is quoted in (worst ${worst.toFixed(3)} Cr at ${worstAt})`, worst <= 0.05);

  // ...and the range is a range: no visit lands outside it. Teanrebi Narcotics,
  // the row the old formula read 38.4 Cr high, is why there is a range at all —
  // the model wraps at 0xff there, so the mean describes no single visit.
  const teanrebi = g1.find((s) => s.name === 'Teanrebi')!;
  const inRange = [g1[7], leesti, teanrebi, g1[0], g1[201]].every((sys) =>
    marketEstimate(sys, flat).every((m, i) => {
      for (let f = 0; f < FLUCTUATIONS; f++) {
        const p = generateMarket(sys, f)[i].price;
        if (p < m.low || p > m.high) return false;
      }
      return true;
    }));
  check('every quote a system can roll falls inside the estimated range', inRange);
  const narcotics = marketEstimate(teanrebi, flat)[6];
  check('the byte wrap is in the estimate, not smoothed away by it',
    narcotics.price < 60 && narcotics.low < 5 && narcotics.high > 95);

  // pressure at the FAR end is part of the estimate, and the chart says so
  const dear = marketEstimate(g1[7], (i) => (i === 0 ? 1.25 : 1));
  const lave = marketEstimate(g1[7], flat);
  check('the living galaxy moves the estimate, and only where it applies',
    dear[0].price === +(lave[0].price * 1.25).toFixed(1) && dear[1].price === lave[1].price
    && dear[0].high === +(lave[0].high * 1.25).toFixed(1));

  // `mask` and `baseQuantity` mean nothing outside the price model, so naming
  // one anywhere but galaxy.ts is a transcription starting.
  const walk = (dir: URL): URL[] => readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(new URL(`${e.name}/`, dir))
      : /\.(ts|js)$/.test(e.name) ? [new URL(e.name, dir)] : []));
  const offenders = ['../src/', '../test/']
    .flatMap((d) => walk(new URL(d, import.meta.url)))
    .filter((f) => !f.pathname.endsWith('galaxy/galaxy.ts')
      && /\.\s*(mask|baseQuantity)\b/.test(readFileSync(f, 'utf8')))
    .map((f) => f.pathname.split('/').slice(-2).join('/'));
  check(`the price model has one home (${offenders.join(', ') || 'galaxy.ts only'})`,
    offenders.length === 0);
}

// --- the hermit's tunnel ----------------------------------------------------
//
// The rule was seven bare commodity indices inside game.ts, where the campaign
// could not reach it and no test could name what it priced. It matches on the
// row's own name now, so these checks are also what catches a rename in
// COMMODITIES silently turning the discount off.

console.log('\nrock hermit prices');
{
  const base = generateMarket(g1[7], 0);
  // (spotless commander, fluctuation 0 — the favour band is exercised below)
  const hermit = hermitMarket(g1[7], 0, 0);
  const row = (name: string) => {
    const i = base.findIndex((m) => m.name === name);
    check(`${name} is a commodity the hermit rule can find`, i >= 0);
    return i;
  };
  eq('the same 17 commodities as anywhere else', hermit.length, base.length);

  for (const name of ['Minerals', 'Gold', 'Platinum', 'Gem-Stones']) {
    const i = row(name);
    check(`${name} is a quarter off at a hermit`,
      hermit[i].price === +(base[i].price * 0.75).toFixed(1));
    check(`...and they have 20 more of it`, hermit[i].quantity === base[i].quantity + 20);
  }
  for (const name of ['Food', 'Liquor/Wines', 'Machinery']) {
    const i = row(name);
    check(`${name} costs a third more out here`,
      hermit[i].price === +(base[i].price * 1.3).toFixed(1));
    check(`...and no more of it arrived`, hermit[i].quantity === base[i].quantity);
  }
  const touched = new Set([...'Minerals Gold Platinum Gem-Stones Food Machinery'.split(' '),
    'Liquor/Wines']);
  check('nothing else is repriced',
    base.every((m, i) => touched.has(m.name)
      || (hermit[i].price === m.price && hermit[i].quantity === m.quantity)));
  check('a hermit sells ore below the station price', hermit[12].price < base[12].price);

  // --- and who he deals with (docs/TODO/96, M3) ----------------------------
  //
  // One number with a cliff at the end of it: a reputation is a credential out here
  // until it is the reason the door is bolted. Both halves are measured out of
  // the real rule — the threshold bisected, the favour solved out of a price.
  {
    let lo = 0;
    let hi = 1 << 20;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (hermitRefuses(mid)) hi = mid; else lo = mid;
    }
    eq('the door shuts at HERMIT_REFUSES_AT', hi, HERMIT_REFUSES_AT);
    check(`...which is the character ladder's Dodgy rung (${hi})`,
      characterName(hi) === 'Dodgy' && characterName(hi - 1) !== 'Dodgy');
    check('a spotless commander is always welcome', !hermitRefuses(0));

    // The favour, solved out of the market rather than restated: at the widest
    // it is HERMIT_FAVOUR off the ore and the same again onto the supplies.
    // Gold and Machinery, because the tenth-of-a-credit rounding is noise at
    // their prices and half the rule at Food's.
    const favoured = hermitMarket(g1[7], HERMIT_REFUSES_AT, 0);
    const gold = base.findIndex((m) => m.name === 'Gold');
    const machinery = base.findIndex((m) => m.name === 'Machinery');
    const oreCut = 1 - favoured[gold].price / hermit[gold].price;
    const supplyRise = favoured[machinery].price / hermit[machinery].price - 1;
    check(`a full favour takes HERMIT_FAVOUR off the ore (measured ${oreCut.toFixed(4)})`,
      Math.abs(oreCut - HERMIT_FAVOUR) < 0.005);
    check(`...and adds it to the supplies they buy (measured ${supplyRise.toFixed(4)})`,
      Math.abs(supplyRise - HERMIT_FAVOUR) < 0.005);

    // ...AND IT IS A PERK, NOT AN INCOME (docs/TODO/132). 96 shipped
    // `HERMIT_FAVOUR` unflown, and the risk a re-tune runs is not that the
    // discount stops working — the two checks above would catch that — but that
    // it grows into a reason to BE disreputable, which would invert the whole
    // ladder. The rule: even at the widest welcome, a hermit's ore must still
    // cost more than the station price the honest commander pays for it is
    // measured against, so the detour buys a margin and never a business.
    check(`the widest favour is a discount and not a wholesale channel`
      + ` (${(favoured[gold].price / base[gold].price).toFixed(2)}x the station)`,
      favoured[gold].price < hermit[gold].price
      && favoured[gold].price > base[gold].price / 2);
    check('...and a spotless commander is not PUNISHED for it either',
      hermitMarket(g1[7], 0, 0)[gold].price === hermit[gold].price);

    // It has to be a ramp, not a step, or "how dirty is too dirty" is not a
    // decision the player can steer by.
    let rising = true;
    for (let d = 1; d < HERMIT_REFUSES_AT; d += 1) {
      const here = hermitMarket(g1[7], d, 0)[gold].price;
      const before = hermitMarket(g1[7], d - 1, 0)[gold].price;
      if (here > before) rising = false;
    }
    check('the favour grows with the reputation all the way to the door', rising
      && hermitMarket(g1[7], HERMIT_REFUSES_AT - 1, 0)[gold].price < hermit[gold].price);

    // ...and an honest commander pays exactly what they always did, which is
    // what the whole block above this one is still asserting.
    check('a spotless commander is quoted the plain hermit prices',
      hermitMarket(g1[7], 0, 0).every((m, i) => m.price === hermit[i].price));
  }
}

// --- what a sale is noticed as ----------------------------------------------
//
// `saleFallout` is one home for a rule that had two: the market screen applied
// it and test/campaign.ts held a hand-written copy that had dropped the
// disrepute half (docs/TODO/96, M1). Each number below is solved back OUT of
// the real function and compared to the constant, which a probe at the constant
// itself could never fail — and the last pair drives the SCREEN, so a rule
// re-inlined at the call site fails here rather than in a playtest.

console.log('\nwhat a sale is noticed as');
{
  const LEGAL = 0; // Food
  const DIRTY = 6; // Narcotics
  check('the fixtures are what this block assumes',
    !isContraband(LEGAL) && isContraband(DIRTY));

  // The takings term: with a legal commodity there is nothing else in the
  // number, so notoriety × SALE_NOTORIETY_REVENUE IS the revenue.
  eq('a legal sale is talked about for its takings alone',
    saleFallout(LEGAL, 3, 1234).notoriety * SALE_NOTORIETY_REVENUE, 1234);
  eq('...and leaves no mark on the reputation', saleFallout(LEGAL, 3, 1234).disrepute, 0);

  // The contraband term, with the takings zeroed so only tonnage is left.
  check(`each tonne of contraband adds SALE_NOTORIETY_CONTRABAND (${SALE_NOTORIETY_CONTRABAND})`,
    [1, 3, 10].every((t) =>
      Math.abs(saleFallout(DIRTY, t, 0).notoriety / t - SALE_NOTORIETY_CONTRABAND) < 1e-12));

  // The cap, bisected: the smallest revenue at which one sale stops raising
  // heat is exactly the cap divided by the takings rate.
  let lo = 0;
  let hi = 1 << 26;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (saleFallout(LEGAL, 0, mid).notoriety >= SALE_NOTORIETY_MAX) hi = mid;
    else lo = mid;
  }
  eq('one sale is capped at SALE_NOTORIETY_MAX of the heat bar',
    hi, SALE_NOTORIETY_MAX * SALE_NOTORIETY_REVENUE);

  // A dirty sale is a dirty sale however small: the heat scales with the load,
  // the mark on the NAME does not.
  check('the mark on the reputation does not scale with the tonnage',
    [1, 5, 30].every((t) =>
      saleFallout(DIRTY, t, 100 * t).disrepute === DISREPUTE_CONTRABAND_SALE));

  // ...and the screen the player actually sells through applies that rule
  // rather than a copy of it. Revenue is read off the credits the sale paid,
  // so nothing here re-derives a price.
  {
    const commander = newCommander();
    commander.cargo[DIRTY] = 5;
    let heat = 0;
    const queued: string[] = [];
    const ctx: TradeContext = {
      commander,
      system: g1[7],
      market: generateMarket(g1[7], 0),
      atHermit: false,
      cheat: false,
      leaveHermit: () => {},
      message: () => {},
      queueMessage: (text) => { queued.push(text); },
      addNotoriety: (amount) => { heat += amount; },
      checkpoint: () => {},
    };
    const screen = new MarketScreen(() => ctx);
    screen.selected = DIRTY;
    const before = commander.credits;
    screen.sell(5);
    const expected = saleFallout(DIRTY, 5, commander.credits - before);
    check('the market screen sold the load', commander.cargo[DIRTY] === 0 && heat > 0);
    eq('...and raised exactly the heat the shared rule says', heat, expected.notoriety);
    eq('...and the same mark on the name', commander.disrepute, expected.disrepute);
    // ...and said nothing about it, because five tonnes of narcotics over one
    // counter is a nudge that crosses no rung (docs/TODO/129).
    eq(`a sale inside a rung is silent (${queued.join(' / ')})`, queued.length, 0);

    // ...where one that DOES cross says so, behind the receipt. The score is
    // set to a point below the next rung rather than to a literal, so the line
    // is the ladder's answer and not this test's.
    const nextRung = CHARACTER.find(([t]) => t > (commander.disrepute ?? 0))!;
    commander.disrepute = nextRung[0] - DISREPUTE_CONTRABAND_SALE;
    commander.cargo[DIRTY] = 1;
    screen.sell(1);
    eq(`the crossing is queued behind the sale (${queued.join(' / ')})`,
      queued.join(' / '),
      `REPUTATION: ${nextRung[1].toUpperCase()} — WORD IS GETTING ROUND`);
  }
}

// --- who's worth robbing ----------------------------------------------------

console.log('\npirate economics');
{
  const fixed = () => 0.5; // take the rng out of it
  const mk = (cargo: Record<number, number>, kills = 0, laser = 'pulse', largeBay = false) => {
    const c = new Array(17).fill(0);
    for (const [i, q] of Object.entries(cargo)) c[+i] = q;
    return { cargo: c, kills, equipment: { laser, largeBay } };
  };
  const lave = g1[7];
  const at = (c: ReturnType<typeof mk>, noto = 0) =>
    pirateThreat(lave, 0.1, markOf(c, noto), fixed);

  const broke = at(mk({}));
  const laden = at(mk({ 7: 35 }, 0, 'pulse', true)); // 35t computers, large bay
  check(`an empty hold is not worth robbing (appeal ${broke.appeal.toFixed(2)})`,
    broke.appeal < 0.1 && broke.tier === 0);
  check(`a full hold of computers draws a gang (appeal ${laden.appeal.toFixed(2)})`,
    laden.appeal > 0.8 && laden.tier === 2);
  check('cheap cargo is not a prize',
    at(mk({ 0: 20 })).tier === 0); // 20t of food

  // the deterrence lever: looking dangerous makes you less worth the trouble
  const armed = at(mk({ 7: 35 }, 150, 'military', true));
  check(`a military laser and a reputation lower the tier (${laden.tier} → ${armed.tier})`,
    armed.appeal < laden.appeal - 0.3 && armed.tier < laden.tier);

  // contraband and notoriety both raise it
  //
  // The bound was `> legal * 0.9`, which is satisfied by contraband being
  // TEN PER CENT LESS attractive than legal cargo — the opposite of the rule
  // it names, and it would have survived deleting the contraband premium
  // outright. Measured gap is 2.0x, so 1.5x is a real bar with real headroom.
  {
    const narcotics = at(mk({ 6: 10 })).appeal;   // contraband, base 235
    const luxuries = at(mk({ 5: 10 })).appeal;    // legal, base 196
    check(`contraband is worth more than its price alone `
      + `(narcotics ${narcotics.toFixed(3)} vs luxuries ${luxuries.toFixed(3)}, `
      + `${(narcotics / luxuries).toFixed(2)}x)`,
    narcotics > luxuries * 1.5);
    // ...and the same rule with price controlled for, which is the sharper
    // form: slaves are contraband at a base of 40 and still the better prize
    // than furs at 176.
    const slaves = at(mk({ 3: 10 })).appeal;
    const furs = at(mk({ 11: 10 })).appeal;
    check(`...even against legal cargo worth four times as much `
      + `(slaves ${slaves.toFixed(3)} vs furs ${furs.toFixed(3)})`,
    slaves > furs);
  }
  check('notoriety raises the reception',
    at(mk({ 7: 10 }), 0.6).appeal > at(mk({ 7: 10 })).appeal + 0.2);

  // the anti-rubber-band rule: threat must grow far slower than the player does
  check(`threat is sub-linear in wealth (${broke.count} → ${laden.count} attackers)`,
    laden.count <= broke.count + 2);
  check('a gang needs the numbers to form',
    !at(mk({ 7: 35 }, 0, 'pulse', true), 0).organised
      || at(mk({ 7: 35 }, 0, 'pulse', true), 0).count >= 3);

  // a gang is ringleaders plus hangers-on, not five Fer-de-Lances — this is
  // what lets gangs be common without being overwhelming
  check('a gang has exactly two ringleaders',
    memberTier(2, 0) === 2 && memberTier(2, 1) === 2 && memberTier(2, 2) === 1);
  check('hangers-on fly a tier below their leaders',
    memberTier(2, 4) === 1 && memberTier(1, 3) === 0);
  check('opportunist groups stay opportunists',
    [0, 1, 2, 3].every((i) => memberTier(0, i) === 0));

  // fame draws challengers: at Dangerous, a share of receptions are people
  // coming for the reputation rather than the cargo
  {
    const famous = { cargo: new Array(17).fill(0), kills: 3000, combatScore: 3000,
      equipment: { laser: 'military', largeBay: false } };
    // empty hold, so nothing here is worth robbing — only the name is
    const rolls = Array.from({ length: 200 }, (_, i) =>
      pirateThreat(lave, 0.1, markOf(famous), () => (i % 100) / 100));
    const challenges = rolls.filter((r) => r.challenged).length;
    check(`a famous commander gets challenged even flying empty (${challenges}/200)`,
      challenges > 30 && challenges < 120);
    const unknown = { ...famous, kills: 0, combatScore: 0 };
    check('an unknown commander with an empty hold is left alone',
      pirateThreat(lave, 0.1, markOf(unknown), fixed).tier === 0);
    check('challengers arrive as an organised gang, not a mugging',
      rolls.filter((r) => r.challenged).every((r) => r.tier === 2));
  }

  // The tuning moved to constants/threat.ts, so the rule and its numbers are
  // in different files — these hold them together in the measured shape:
  // each number is extracted from the REAL pirateThreat and compared to the
  // constant, which a probe at `CONSTANT ± 1` could never fail.
  {
    const bare = (over: Partial<Mark>): Mark => ({
      cargoValue: 0, contraband: 0, capacity: 20, combatScore: 0,
      laser: 'pulse', notoriety: 0, disrepute: 0, ...over,
    });

    // The prize term: with nothing else on the mark, appeal is the prize
    // alone, so the smallest cargo value at which it reaches 1 IS the
    // saturation point.
    let lo = 0;
    let hi = 1 << 24;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (pirateThreat(lave, 0, bare({ cargoValue: mid }), fixed).appeal >= 1) hi = mid;
      else lo = mid;
    }
    eq('the prize term saturates exactly at PRIZE_SATURATION', hi, PRIZE_SATURATION);

    // The challenge roll: at full fame, the roll's threshold IS the rate.
    // Bisect the rng value at which `challenged` flips.
    const famous = bare({ combatScore: 1 << 24 });
    const flips = (x: number) => pirateThreat(lave, 0, famous, () => x).challenged;
    let fLo = 0;
    let fHi = 1;
    for (let i = 0; i < 60; i += 1) {
      const mid = (fLo + fHi) / 2;
      if (flips(mid)) fLo = mid; else fHi = mid;
    }
    check(`the challenge roll at full fame is CHALLENGE_RATE (measured ${fHi})`,
      Math.abs(fHi - CHALLENGE_RATE) < 1e-12);

    // FAME_FULL is an expression over the rating ladder's Dangerous rung now
    // (constants/threat.ts over constants/rating.ts), so the two cannot drift
    // by edit — but either CONSUMER can still re-inline a literal, and this
    // is what goes red if one does: the fame saturation score, bisected out
    // of the real pirateThreat, must be exactly the score at which the real
    // rating() starts saying Dangerous.
    const challengedAt = (score: number) => pirateThreat(
      lave, 0, bare({ combatScore: score }), () => CHALLENGE_RATE * (1 - 1e-9)).challenged;
    let sLo = 0;
    let sHi = 1 << 24;
    while (sLo + 1 < sHi) {
      const mid = (sLo + sHi) >> 1;
      if (challengedAt(mid)) sHi = mid; else sLo = mid;
    }
    check(`fame saturates at the rating ladder's Dangerous rung (score ${sHi})`,
      rating(sHi) === 'Dangerous' && rating(sHi - 1) !== 'Dangerous');

    // The big-bay bonus fires above the STANDARD hold, and the threshold is
    // measured out of the real function rather than probed at the constant:
    // scan every capacity a hold could plausibly be and find the one step.
    const appealAt = (capacity: number) =>
      pirateThreat(lave, 0, bare({ capacity }), fixed).appeal;
    const steps: number[] = [];
    for (let cap = 1; cap <= 60; cap += 1) {
      if (appealAt(cap) !== appealAt(cap - 1)) steps.push(cap);
    }
    check(`the big-bay bonus steps exactly once, above the standard hold `
      + `(at ${steps.join(',')})`,
    steps.length === 1 && steps[0] === HOLD_TONNES + 1);

    // --- your NAME on the mark (docs/TODO/96, M2) --------------------------
    //
    // Same discipline as everything above: each of the four numbers is solved
    // back out of the real pirateThreat rather than probed at its constant.

    // DISREPUTE_FULL: with nothing else on the mark, appeal rises with the name
    // until infamy saturates and then stops. The smallest disrepute at which it
    // stops IS the saturation point — and it has to be a rung of the ladder,
    // not a number of its own.
    const appealAtDisrepute = (disrepute: number) => pirateThreat(
      lave, 0, bare({ cargoValue: PRIZE_SATURATION * 0.3, disrepute }), fixed).appeal;
    const ceiling = appealAtDisrepute(1 << 20);
    let dLo = 0;
    let dHi = 1 << 20;
    while (dLo + 1 < dHi) {
      const mid = (dLo + dHi) >> 1;
      if (appealAtDisrepute(mid) >= ceiling) dHi = mid; else dLo = mid;
    }
    eq('a name stops counting for more at DISREPUTE_FULL', dHi, DISREPUTE_FULL);
    check(`...which is the character ladder's Notorious rung (${dHi})`,
      characterName(dHi) === 'Notorious' && characterName(dHi - 1) !== 'Notorious');

    // DISREPUTE_HEAT, measured as what it MEANS: the regional heat that makes a
    // spotless commander exactly as attractive as a fully notorious one with no
    // heat at all. Nothing here needs to know the appeal formula's weights.
    const notorious = appealAtDisrepute(DISREPUTE_FULL);
    let hLo = 0;
    let hHi = 1;
    for (let i = 0; i < 60; i += 1) {
      const mid = (hLo + hHi) / 2;
      const asHeat = pirateThreat(
        lave, 0, bare({ cargoValue: PRIZE_SATURATION * 0.3, notoriety: mid }), fixed).appeal;
      if (asHeat >= notorious) hHi = mid; else hLo = mid;
    }
    check(`a full name is worth DISREPUTE_HEAT of regional heat (measured ${hHi})`,
      Math.abs(hHi - DISREPUTE_HEAT) < 1e-9);

    // DISREPUTE_DRAW: at full infamy and no combat fame at all, the challenge
    // roll's threshold is CHALLENGE_RATE scaled by the draw a criminal name has.
    const infamous = bare({ disrepute: DISREPUTE_FULL });
    let cLo = 0;
    let cHi = 1;
    for (let i = 0; i < 60; i += 1) {
      const mid = (cLo + cHi) / 2;
      if (pirateThreat(lave, 0, infamous, () => mid).challenged) cLo = mid; else cHi = mid;
    }
    check(`a name draws challengers at DISREPUTE_DRAW of fame's rate (measured `
      + `${(cHi / CHALLENGE_RATE).toFixed(6)})`,
    Math.abs(cHi / CHALLENGE_RATE - DISREPUTE_DRAW) < 1e-9);

    // COURTESY_RATE: the second draw, so the roll needs a scripted stream — a
    // constant rng would answer the challenge roll with the same number and
    // never let the courtesy roll happen.
    const scripted = (...values: number[]) => {
      let i = 0;
      return () => values[Math.min(i++, values.length - 1)];
    };
    let uLo = 0;
    let uHi = 1;
    for (let i = 0; i < 60; i += 1) {
      const mid = (uLo + uHi) / 2;
      // first draw 1: never challenged, so the courtesy roll is reached
      if (pirateThreat(lave, 0, infamous, scripted(1, mid, 0)).passed) uLo = mid; else uHi = mid;
    }
    check(`a full name is passed by at COURTESY_RATE (measured ${uHi})`,
      Math.abs(uHi - COURTESY_RATE) < 1e-9);

    // --- and the SHAPE those two rates make (docs/TODO/132) ------------------
    //
    // docs/TODO/96 shipped both as unflown starting values. The measurements
    // above pin each to its constant, which is the mechanism; this is the
    // DESIGN, and it is the half that would survive a re-tune wrongly. A
    // criminal name is a bargain the game offers — more people want you, and
    // occasionally one calls it off — and the bargain has to be a bad one, or
    // being Notorious is simply a perk with no cost.
    check(`the stick outweighs the carrot: a name draws challengers at`
      + ` ${CHALLENGE_RATE} and is spared at ${COURTESY_RATE}`,
      COURTESY_RATE < CHALLENGE_RATE * DISREPUTE_DRAW);
    check('...and both are shares of a reception, not counts',
      COURTESY_RATE > 0 && COURTESY_RATE < 1 && CHALLENGE_RATE > 0 && CHALLENGE_RATE < 1);
    // ...and the carrot is occasional rather than a reliable screen: a name you
    // could hide behind would make infamy a defence, which is the opposite of
    // what every other term here does.
    check(`courtesy spares a minority of receptions (${COURTESY_RATE})`,
      COURTESY_RATE < 0.5);
  }

  // --- what the name does, as behaviour ---------------------------------
  {
    const bare = (over: Partial<Mark>): Mark => ({
      cargoValue: 0, contraband: 0, capacity: 20, combatScore: 0,
      laser: 'pulse', notoriety: 0, disrepute: 0, ...over,
    });

    // A worse name is never a better reception, and somewhere in the range it
    // is a visibly worse one: the same hold that draws professionals for an
    // honest pilot draws a gang for a Dodgy one.
    const DODGY = 25;
    let stepped = 0;
    let worse = true;
    for (let value = 0; value <= PRIZE_SATURATION; value += PRIZE_SATURATION / 40) {
      const honest = pirateThreat(lave, 0, bare({ cargoValue: value }), fixed);
      const dodgy = pirateThreat(lave, 0, bare({ cargoValue: value, disrepute: DODGY }), fixed);
      if (dodgy.appeal < honest.appeal || dodgy.tier < honest.tier) worse = false;
      if (dodgy.tier > honest.tier) stepped += 1;
    }
    check(`a Dodgy pilot never draws a softer reception than an honest one`, worse);
    check(`...and a harder one across ${stepped} of the 41 holds sampled`, stepped > 0);

    // ...and the carrot: over a seeded run, a Cutthroat is occasionally left
    // alone by pirates who would have robbed anyone else. An honest commander
    // never is — the roll is not even taken.
    const rolls = (disrepute: number) => {
      const rng = makeRng(96);
      let passed = 0;
      for (let i = 0; i < 400; i += 1) {
        if (pirateThreat(lave, 0.1, bare({ cargoValue: 8000, disrepute }), rng).passed) passed += 1;
      }
      return passed;
    };
    const cutthroat = rolls(120);
    check(`a Cutthroat is waved off sometimes (${cutthroat}/400)`,
      cutthroat > 20 && cutthroat < 120);
    eq('an honest commander never is', rolls(0), 0);
  }

  // --- lawful play did not move (docs/TODO/96, M2) -------------------------
  //
  // The promise the whole milestone rests on: at disrepute 0 every expression
  // collapses to the one it replaced, and the courtesy roll is not even drawn,
  // so an honest commander takes the same numbers off the world stream as
  // before. These rows were computed with the code as it stood at the M1
  // commit; if lawful play ever moves, this is what says so. They are NOT
  // decoration on the current implementation — regenerate them only from a
  // release that deliberately re-tunes the reception.
  {
    const mk = (cargo: Record<number, number>, kills = 0, laser = 'pulse', largeBay = false) => {
      const c = new Array(17).fill(0);
      for (const [i, q] of Object.entries(cargo)) c[+i] = q;
      return { cargo: c, kills, equipment: { laser, largeBay } };
    };
    const golden: [string, ReturnType<typeof mk>, number, number, number[][]][] = [
      ['an empty hold in a quiet system', mk({}), 0, 0,
        [[1, 0, 0, 0, 0, 0], [2, 0, 0, 0, 0, 0], [2, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0, 0],
          [2, 0, 0, 0, 0, 0]]],
      ['a full hold of computers', mk({ 7: 35 }, 0, 'pulse', true), 0.1, 0,
        [[3, 2, 0, 0.9624, 0, 0], [4, 2, 1, 0.9624, 0, 0], [3, 2, 1, 0.9624, 0, 0],
          [3, 2, 1, 0.9624, 0, 0], [4, 2, 1, 0.9624, 0, 0]]],
      ['armed and famous', mk({ 7: 35 }, 150, 'military', true), 0.1, 0.3,
        [[2, 2, 0, 0.5824, 0.058594, 1], [4, 2, 1, 0.5824, 0.058594, 0],
          [3, 2, 1, 0.5824, 0.058594, 0], [4, 2, 1, 0.5824, 0.058594, 0],
          [4, 2, 1, 0.5824, 0.058594, 0]]],
      ['a smuggler with regional heat', mk({ 6: 10 }), 0.2, 0.6,
        [[3, 2, 0, 0.986, 0, 0], [4, 2, 1, 0.986, 0, 0], [4, 2, 1, 0.986, 0, 0],
          [4, 2, 1, 0.986, 0, 0], [4, 2, 1, 0.986, 0, 0]]],
    ];
    for (const [name, commander, danger, noto, expected] of golden) {
      const rng = makeRng(7);
      const got = Array.from({ length: 5 }, () => {
        const t = pirateThreat(lave, danger, markOf(commander, noto), rng);
        return [t.count, t.tier, t.organised ? 1 : 0, +t.appeal.toFixed(6),
          +t.fame.toFixed(6), t.challenged ? 1 : 0];
      });
      eq(`${name} meets the reception it always did`,
        JSON.stringify(got), JSON.stringify(expected));
    }
  }

  // --- the scanner, the toll and the shop agree about a hold ----------------
  //
  // The survey's four-home cargo capacity and its unexpressed VALUE_PER_TONNE
  // pair, unified: these solve each rule's number back OUT of the function
  // and compare it to the one home, which a re-inlined literal fails.
  {
    // What a scanner reads one tonne as, solved out of the real markOf: for
    // any single tonne, cargoValue / basePrice IS the multiplier.
    const oneTonneOf = (i: number) => {
      const cargo = new Array(17).fill(0);
      cargo[i] = 1;
      return markOf({ cargo, kills: 0, equipment: { laser: 'pulse', largeBay: false } });
    };
    check('markOf prices a tonne at VALUE_PER_TONNE times its base price',
      [0, 5, 7].every((i) =>
        oneTonneOf(i).cargoValue === COMMODITIES[i].basePrice * VALUE_PER_TONNE));

    // A pirate reads the same hold size the game fits: both bay states, the
    // scanner's figure against the real cargoCapacity.
    const cWith = newCommander();
    cWith.equipment.largeBay = true;
    const cWithout = newCommander();
    check('a pirate reads exactly the hold the game fits, both bay states',
      markOf(cWith).capacity === cargoCapacity(cWith)
      && markOf(cWithout).capacity === cargoCapacity(cWithout)
      && cargoCapacity(cWith) === LARGE_BAY_TONNES
      && cargoCapacity(cWithout) === HOLD_TONNES);

    // Berths are hold. `cargoTonnes` counts the passenger contracts the
    // commander is carrying, which is what makes the trade-off issue #9 asks
    // for real: freight and fares compete for the same bays, and buying the
    // Large Cargo Bay relieves both at once (docs/TODO/109).
    const berthed = newCommander();
    berthed.cargo[0] = 4;
    berthed.contracts = [{
      kind: 'passenger', destination: 8, commodity: 0, qty: 3,
      reward: 500, deadlineDay: 10, progress: 0,
    }];
    check('a berth is charged to the hold, on top of the stock in it',
      cargoTonnes(berthed) === 4 + 3 * PASSENGER_BERTH_TONNES);
    check('...so three passengers are a visible bite of a standard hold, and '
      + 'the large bay is what relieves it',
    3 * PASSENGER_BERTH_TONNES < HOLD_TONNES / 2
      && cargoCapacity(berthed) === HOLD_TONNES);

    // markOf reads CAPACITY, not occupancy (threat.ts) — deliberately. A
    // pirate sizes up the bays a ship HAS, not what is in them, so taking
    // passengers does not change how appealing a target you are. Pinned here
    // so nobody "fixes" it into occupancy.
    const empty = newCommander();
    check('passengers do not change what a pirate thinks you are worth',
      markOf(berthed).capacity === markOf(empty).capacity);
  }

  // --- the ladder and the function that climbs it ---------------------------
  //
  // rating() reads RATINGS from the home; if either re-inlines a copy that
  // drifts, probing the FUNCTION at the TABLE's own rungs goes red. Also the
  // manual's chart: ratingLadder() must list every rung, in order.
  {
    check('rating() turns at exactly the ladder\'s own rungs',
      RATINGS.every(([threshold, name], i) =>
        rating(threshold) === name
        && (i === 0 || rating(threshold - 1) === RATINGS[i - 1][1])));
    check('the ladder as a list is the ladder',
      ratingLadder().join('|') === RATINGS.map(([, name]) => name).join('|'));
  }

  // ratings count difficulty, not bodies
  check('a gang leader is worth five Sidewinders', killValue(2) === 5 * killValue(0));
  check('a professional is worth two', killValue(1) === 2);

  // notoriety: spreads to jump-range neighbours, and fades
  const heat = new LivingGalaxy(g1);
  heat.addNotoriety(7, 0.8);
  check('notoriety lands where you sold', heat.notoriety(7) > 0.7);
  const neighbourHeat = [...heat.states.entries()].filter(([i]) => i !== 7 && heat.notoriety(i) > 0);
  check(`word spreads to neighbours (${neighbourHeat.length} systems)`, neighbourHeat.length > 0);
  check('but more faintly than at the source',
    neighbourHeat.every(([, st]) => st.heat < heat.notoriety(7)));
  heat.advance(30, COMMODITIES.map((c) => c.gradient), makeRng(4));
  check('lying low cools you off', heat.notoriety(7) === 0);
}

// --- the fuel price has one home ---------------------------------------------
//
// It had four: a bare `* 0.4` inside equipRows in the RENDER layer, plus
// copies in test/campaign.ts, train/jameson-autopilot.js and a doc.

console.log('\nrefuelling');
{
  const tank = (fuel: number) => ({ fuel }) as never;
  check('an empty tank costs the full rate',
    refuelCost(tank(0)) === Math.round(MAX_FUEL * FUEL_PRICE));
  check('a full tank is free', refuelCost(tank(MAX_FUEL)) === 0);
  check('...and needs nothing', fuelNeeded(tank(MAX_FUEL)) === 0);
  check('half a tank is half the price',
    refuelCost(tank(MAX_FUEL / 2)) === Math.round((MAX_FUEL / 2) * FUEL_PRICE));
  // money is integer tenths (invariant 8), and a sun-skim leaves a fraction
  check('a scooped fractional tank still costs a whole number of tenths',
    Number.isInteger(refuelCost(tank(41.3))));

  // the outfitters' row must quote exactly what the rule says
  const c = newCommander();
  c.fuel = 20;
  const row = equipRows(generateGalaxy(1)[7], c).find((r) => r.id === 'fuel')!;
  check('the equipment screen quotes the shared rule', row.price === refuelCost(c));
  c.fuel = MAX_FUEL;
  check('...and reads OWNED at a full tank',
    equipRows(generateGalaxy(1)[7], c).find((r) => r.id === 'fuel')!.status === 'OWNED');

  // --- the quote the shops read ---------------------------------------------
  //
  // A shopper reads a price PER LIGHT YEAR; FUEL_PRICE is per tenth of one.
  // That conversion is the sum this file exists to stop being written twice.
  {
    const empty = newCommander();
    empty.fuel = 0;
    const q = fuelQuote(empty);
    check('the quote agrees with the rule it quotes',
      q.cost === refuelCost(empty) && q.needed === fuelNeeded(empty));
    // one LY short of full: what it costs to fill IS the per-LY price
    const shortOne = { fuel: MAX_FUEL - 10 } as never;
    check('a light year quoted costs a light year bought',
      q.perLightYear === refuelCost(shortOne));
    check('a full tank has nothing to quote',
      fuelQuote({ fuel: MAX_FUEL } as never).full && fuelQuote({ fuel: MAX_FUEL } as never).cost === 0);
    check('...and a dry one is not full', !q.full);
  }

  // --- and it reaches the market screen --------------------------------------
  //
  // The point of the feature: you could not see what fuel cost without leaving
  // the market for the outfitters. Rendered for real against a stub document,
  // because "the string is in the HTML" is the only thing that answers it.
  {
    const prev = (globalThis as unknown as { document: unknown }).document;
    let html = '';
    const cls = { add: () => {}, remove: () => {}, toggle: () => {} };
    (globalThis as unknown as { document: unknown }).document = {
      querySelectorAll: () => [],
      getElementById: () => ({ set innerHTML(v: string) { html = v; }, classList: cls }),
      body: { classList: cls },
    };
    try {
      const c = newCommander();
      c.fuel = 20; // 2.0 LY in the tank, 5.0 LY short
      const market = generateMarket(g1[7], 0);
      renderMarket(g1[7], market, c, 0, fuelQuote(c));
      check('the market screen prints the price of a light year',
        html.includes('FUEL 0.4 Cr/LY'));
      check('...and what filling up would cost', html.includes('2.0 Cr TO FILL'));
      check('...and how much is in the tank', html.includes('TANK 2.0/7.0 LY'));

      c.fuel = MAX_FUEL;
      renderMarket(g1[7], market, c, 0, fuelQuote(c));
      check('a full tank is told so rather than sold to',
        html.includes('TANK FULL') && !html.includes('TO FILL'));

      // a rock hermit trades cargo but cannot fill a tank: no quote at all
      renderMarket(g1[7], market, c, 0, null);
      check('a hermit quotes no fuel price it cannot honour', !html.includes('FUEL 0.4'));
    } finally {
      (globalThis as unknown as { document: unknown }).document = prev;
    }
  }

  // nobody may re-derive it. Deliberately fuel-specific: a bare /\* 0\.4/
  // also matches the commodity byte-to-credits scale, which is a different
  // 0.4 doing a different job.
  const reFuel = /(fuel|need)[A-Za-z]*\s*\*\s*0\.4/i;
  for (const f of ['../src/ui/screens.ts', '../src/game/screens/trade.ts',
    '../test/campaign.ts', '../train/jameson-autopilot.js']) {
    // comments stripped first — the explanatory note in jameson-autopilot.js
    // says `need * 0.4` while explaining why it must not, and tripped this.
    const src = readFileSync(new URL(f, import.meta.url), 'utf8')
      .replace(/^\s*(\/\/|\*|\/\*).*$/gm, '');
    check(`${f.split('/').pop()} does not re-derive the fuel price`, !reFuel.test(src));
  }
}

// --- the law ----------------------------------------------------------------

console.log('\nthe law');
{
  check('slaves, narcotics and firearms are the illegal three',
    CONTRABAND.length === 3 && [3, 6, 10].every(isContraband));
  check('...and nothing else is', [0, 1, 2, 4, 5, 7, 8, 9].every((i) => !isContraband(i)));

  {
    const hold = new Array(17).fill(0);
    check('a clean hold passes a scan', !carryingContraband(hold));
    hold[6] = 2;
    check('two tonnes of narcotics does not',
      carryingContraband(hold) && contrabandTonnes(hold) === 2);
    hold[3] = 1;
    check('...and it counts every kind', contrabandTonnes(hold) === 3);
  }

  // THE point of law.ts: one definition where there were four. If these ever
  // disagree, someone has re-inlined [3, 6, 10] somewhere.
  {
    const hold = new Array(17).fill(0);
    CONTRABAND.forEach((i) => { hold[i] = 1; });
    const mark = markOf(
      { cargo: hold, kills: 0, equipment: { laser: 'pulse', largeBay: false } }, 0);
    check('contracts.ts counts the same set as law.ts',
      mark.contraband === CONTRABAND.length);
  }

  {
    check('a clean commander pays nothing', fineFor(CLEAN, 100_000) === 0);
    check('an offender pays 25 Cr', fineFor(OFFENDER, 100_000) === OFFENDER_FINE);
    check('a fugitive pays 75 Cr', fineFor(FUGITIVE, 100_000) === FUGITIVE_FINE);
    check('...but never more than you have', fineFor(FUGITIVE, 100) === 100);
    check('...and a broke fugitive pays nothing rather than going negative',
      fineFor(FUGITIVE, 0) === 0);
  }

  {
    // Buying your name back — the optional station action, no longer a toll on
    // docking. The rule is the same fine, capped, but it also reports there is
    // nothing to clear when you are already Clean.
    check('a clean record cannot be paid off — there is nothing to clear',
      recordCleared(CLEAN, 100_000) === null);
    const offender = recordCleared(OFFENDER, 100_000);
    check('an offender clears for 25 Cr',
      offender?.paid === OFFENDER_FINE && offender.creditsLeft === 100_000 - OFFENDER_FINE);
    const fugitive = recordCleared(FUGITIVE, 100_000);
    check('a fugitive clears for 75 Cr',
      fugitive?.paid === FUGITIVE_FINE && fugitive.creditsLeft === 100_000 - FUGITIVE_FINE);
    const broke = recordCleared(FUGITIVE, 40);
    check('...and a broke fugitive pays all they have and is left with nothing',
      broke?.paid === 40 && broke.creditsLeft === 0);
  }

  {
    check("shooting a pirate is nobody's business", offenceFor('pirate', false) === CLEAN);
    check('...destroying one, likewise', offenceFor('pirate', true) === CLEAN);
    check('...and thargoids and rocks too',
      offenceFor('thargoid', true) === CLEAN && offenceFor('asteroid', true) === CLEAN);
    for (const role of ['police', 'trader', 'hunter']) {
      check(`shooting a ${role} is an offence`, offenceFor(role, false) === OFFENDER);
      check(`...destroying a ${role} makes you a fugitive`,
        offenceFor(role, true) === FUGITIVE);
    }
  }
  check('every legal status has a name',
    LEGAL_NAMES.length === 3 && LEGAL_NAMES.every((n) => n.length > 0));
}
