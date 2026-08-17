// What the bulletin board may OFFER: how far a job can send you, what each kind
// of work is made of, and how it reads on the board.
//
// The other half of the board is test/contracts.test.ts (what settling a job
// pays and what failing it costs) and test/contract-acceptance.test.ts (what
// taking one costs the hold). These were one file until the smuggling kind
// landed (docs/TODO/110) and it crossed the size ceiling; they share no fixture,
// only the module. The distinction that matters: everything here is a property
// of `game/contract-offers.ts`, measured out of the REAL generator over the
// whole galaxy at TWO sample sizes rather than probed at its own literals, so a
// re-inlined bound or a re-cut roll goes red here and the settlement tests stay
// green.
//
// CONTRACT_RANGE is MAX_FUEL now (resolved 2026-08-05 — the tank is the
// rule): the check pins the bound exactly, from both sides — the furthest
// offer equals the furthest system the bound admits, and the galaxy holds
// destinations just beyond it that are never offered, so widening OR
// narrowing the filter moves the measurement.

import { generateGalaxy, generateMarket } from '../src/galaxy/galaxy.ts';
import { distanceTenths } from '../src/galaxy/navigation.ts';
import { generateContractOffers, describeContract } from '../src/game/contract-offers.ts';
import { settleContracts } from '../src/game/contracts.ts';
import {
  newCommander, type CommanderData, type ConsignmentContract, type Contract,
} from '../src/game/commander.ts';
import { CONTRACT_RANGE } from '../src/constants/contracts.ts';
import { ORDINARY_GOODS } from '../src/constants/commodities.ts';
import { CONTRABAND } from '../src/constants/law.ts';
import { makeRng } from '../src/game/rng.ts';
import { check } from './harness.ts';

console.log('\nthe bulletin board\'s reach');
{
  const systems = generateGalaxy(1);

  // pure data: the furthest pair the bound admits, and how many sit just past
  let maxPossible = 0;
  let justBeyond = 0;
  for (const a of systems) {
    for (const b of systems) {
      const d = distanceTenths(a, b);
      if (a.index !== b.index && d > 0 && d <= CONTRACT_RANGE && d > maxPossible) maxPossible = d;
      if (d > CONTRACT_RANGE && d <= CONTRACT_RANGE + 5) justBeyond += 1;
    }
  }
  check(`the bound excludes real destinations (${justBeyond} pairs sit in `
    + `(${CONTRACT_RANGE}, ${CONTRACT_RANGE + 5}])`, justBeyond > 0);

  /**
   * What one freight job is worth SOLD instead of delivered, in ledger tenths.
   *
   * `sell the consignment at the far end, arrive empty, eat the bill` against
   * `deliver it and take the fee`. The bill is not transcribed here — the job is
   * driven through the REAL `settleContracts` with an empty hold and an account
   * deep enough that the cap never bites, so the charge is whatever settlement
   * charges. The sale is the real market at the destination.
   *
   * Positive means arriving short pays, which is the thing docs/TODO/113 is
   * measured against.
   */
  const theftMarginFor = (k: ConsignmentContract, fluctuation: number): number => {
    const c: CommanderData = {
      ...newCommander(), systemIndex: k.destination, day: 0,
      credits: 1e9, contracts: [k],
    } as CommanderData;
    const ev = settleContracts(c);
    const bill = ev[0]?.kind === 'billed' ? ev[0].charged : 0;
    const market = generateMarket(systems[k.destination], fluctuation);
    // whole credits with one decimal on the screen, tenths in the ledger — the
    // conversion game/screens/trade.ts makes when it pays you
    const sale = k.qty * Math.round(market[k.commodity].price * 10);
    return sale - bill - k.reward;
  };

  // the sweep, read at two sizes (CLAUDE.md: read the set, not the sample) —
  // the answer must be the same one at both
  const sweep = (passes: number) => {
    const rng = makeRng(90);
    let maxD = 0;
    let offers = 0;
    let strayCommodity = 0;
    let passengers = 0;
    let strayQty = 0;
    let smuggles = 0;
    let strayLegal = 0;
    let strayLoad = 0;
    let cargoFee = 0;
    let cargoTonnes = 0;
    let smuggleFee = 0;
    let smuggleTonnes = 0;
    let freight = 0;
    let theftWins = 0;
    let theftMargin = 0;
    for (let p = 0; p < passes; p += 1) {
      for (const sys of systems) {
        for (const k of generateContractOffers(sys, systems, 0, rng)) {
          offers += 1;
          if (k.kind === 'cargo' || k.kind === 'smuggle') {
            freight += 1;
            const margin = theftMarginFor(k, Math.floor(rng() * 256));
            theftMargin += margin;
            if (margin > 0) theftWins += 1;
          }
          const d = distanceTenths(sys, systems[k.destination]);
          if (d > maxD) maxD = d;
          if (k.kind === 'cargo' && !ORDINARY_GOODS.includes(k.commodity)) strayCommodity += 1;
          if (k.kind === 'cargo') { cargoFee += k.reward; cargoTonnes += k.qty; }
          if (k.kind === 'smuggle') { smuggleFee += k.reward; smuggleTonnes += k.qty; }
          if (k.kind === 'passenger') {
            passengers += 1;
            if (k.qty < 1 || k.qty > 3) strayQty += 1;
          }
          if (k.kind === 'smuggle') {
            smuggles += 1;
            if (!CONTRABAND.includes(k.commodity)) strayLegal += 1;
            if (k.qty < 2 || k.qty > 5) strayLoad += 1;
          }
        }
      }
    }
    return {
      maxD, offers, strayCommodity, passengers, strayQty,
      smuggles, strayLegal, strayLoad,
      cargoFee, cargoTonnes, smuggleFee, smuggleTonnes,
      freight, theftWins, theftMargin,
    };
  };
  const small = sweep(3);
  const large = sweep(15);
  check(`every offer stays inside CONTRACT_RANGE and the bound is reached `
    + `(furthest ${large.maxD} of a possible ${maxPossible}, over ${large.offers} offers)`,
  small.maxD === maxPossible && large.maxD === maxPossible);
  check(`a cargo consignment is always ordinary goods `
    + `(${small.offers} and ${large.offers} offers, `
    + `${small.strayCommodity + large.strayCommodity} strays)`,
  small.strayCommodity === 0 && large.strayCommodity === 0);

  // The single seeded roll cuts all five kinds, so the passenger share is
  // pinned the way every other bound here is: measured out of the REAL
  // generator, at BOTH sample sizes, and it must be the same answer at each.
  // The band is wide enough to be a sampling question and tight enough that
  // dropping the branch (0%) or widening its slice past a quarter fails.
  const share = (s: ReturnType<typeof sweep>) => s.passengers / s.offers;
  check(`the board offers passenger work at its seeded share `
    + `(${(100 * share(small)).toFixed(1)}% of ${small.offers} and `
    + `${(100 * share(large)).toFixed(1)}% of ${large.offers} offers)`,
  [small, large].every((s) => share(s) > 0.1 && share(s) < 0.2));
  // qty is HEADS, and each head is a berth: the hold arithmetic downstream is
  // only bounded because this is.
  //
  // **"AND NO CARGO" LEFT THIS CHECK IN docs/TODO/185 M1.** It counted a
  // passenger job that carried a `commodity`. The union has no `commodity` on a
  // passenger job at all, so the count could only ever be 0. A test that cannot
  // fail asserts the implementation against itself (CLAUDE.md). The claim is
  // stronger for being the compiler's: it is impossible now rather than
  // untested.
  check(`a passenger job books 1-3 heads `
    + `(${small.passengers + large.passengers} jobs, `
    + `${small.strayQty + large.strayQty} out of range)`,
  small.strayQty === 0 && large.strayQty === 0);

  // --- and the smuggling slice (docs/TODO/110) --------------------------------
  //
  // THE MIRROR of the ordinary-goods check above, deliberately a SEPARATE
  // assertion rather than a widening of it: the two sets are disjoint by
  // construction (constants/commodities.ts says so) and each is worth pinning
  // on its own, so a generator that drew a smuggling run from ORDINARY_GOODS
  // fails here while the cargo check stays green — and vice versa.
  const smuggleShare = (s: ReturnType<typeof sweep>) => s.smuggles / s.offers;
  check(`the board offers illicit freight, uncommonly, at its seeded share `
    + `(${(100 * smuggleShare(small)).toFixed(1)}% of ${small.offers} and `
    + `${(100 * smuggleShare(large)).toFixed(1)}% of ${large.offers} offers)`,
  [small, large].every((s) => smuggleShare(s) > 0.05 && smuggleShare(s) < 0.15));
  check(`every smuggling consignment is contraband and nothing else `
    + `(${small.smuggles + large.smuggles} jobs, `
    + `${small.strayLegal + large.strayLegal} legal strays)`,
  small.strayLegal === 0 && large.strayLegal === 0);
  // Small loads, and bounded for the same reason a passenger job's heads are:
  // the reward formula and the hold arithmetic downstream are only bounded
  // because this is.
  check(`a smuggling run carries 2-5t (`
    + `${small.strayLoad + large.strayLoad} out of range)`,
  small.strayLoad === 0 && large.strayLoad === 0);

  // --- and what the fee is worth per tonne (docs/TODO/112) --------------------
  //
  // THE BOUND THAT WAS MISSING while a failed run left its consignment in the
  // hold: the fee did not have to cover the job, because the goods were the real
  // reward. They go back now, so the fee is the whole of it — and a cargo
  // consignment is worth about 24.5 Cr/t at its destination, measured over these
  // same sweeps. Below that and freight is not worth a hold slot; far above it
  // and hauling beats trading outright. Money is TENTHS of a credit
  // (docs/INVARIANTS.md invariant 8), which is exactly the trap 112 records: the
  // old `22 + dist*1.6` reads like a fee and pays 11.4 Cr/t.
  const perTonne = (fee: number, t: number) => fee / (10 * t);
  const cargoRate = (s: ReturnType<typeof sweep>) => perTonne(s.cargoFee, s.cargoTonnes);
  const smuggleRate = (s: ReturnType<typeof sweep>) => perTonne(s.smuggleFee, s.smuggleTonnes);
  check(`a cargo run's fee covers the freight it asks you to carry `
    + `(${cargoRate(small).toFixed(1)} Cr/t over ${small.cargoTonnes}t and `
    + `${cargoRate(large).toFixed(1)} Cr/t over ${large.cargoTonnes}t)`,
  [small, large].every((s) => cargoRate(s) > 20 && cargoRate(s) < 40));
  // Illicit freight keeps the premium 110 gave it: the police scan, the pirates'
  // extra appetite and the disrepute are what the difference buys.
  check(`illicit freight still pays its premium over honest freight `
    + `(${smuggleRate(small).toFixed(1)} and ${smuggleRate(large).toFixed(1)} Cr/t)`,
  [small, large].every((s) => smuggleRate(s) > 1.5 * cargoRate(s)
    && smuggleRate(s) < 3 * cargoRate(s)));

  // --- and that theft does not pay (docs/TODO/113) ---------------------------
  //
  // THE falsifiable claim of the bill, and the reason it is measured here rather
  // than in the campaign: the campaign's bots hold every consignment back on
  // purpose, so a harness of them can show what being robbed COSTS (it does —
  // the SHORTFALL line) and can never show whether selling the freight would
  // have paid. This can, because it asks the real settlement for the charge on
  // every real offer the generator makes.
  //
  // Issue #17 measured the same question before any of this landed: the goods
  // were worth more than the fee on 61% of offers, and the best trade on the
  // board was a job you never delivered. The rule is not that theft is
  // impossible — a dear market for a short haul still beats a small fee, and
  // that is the deliberate outlaw play the plan wants left open — but that it
  // is the exception rather than the default.
  const theftShare = (s: ReturnType<typeof sweep>) => s.theftWins / s.freight;
  const theftMean = (s: ReturnType<typeof sweep>) => s.theftMargin / s.freight / 10;
  check(`selling a consignment beats delivering it only rarely `
    + `(${(100 * theftShare(small)).toFixed(1)}% of ${small.freight} and `
    + `${(100 * theftShare(large)).toFixed(1)}% of ${large.freight} freight jobs)`,
  [small, large].every((s) => theftShare(s) < 0.1));
  check(`...and costs, on average, more than it makes `
    + `(${theftMean(small).toFixed(1)} and ${theftMean(large).toFixed(1)} Cr per job)`,
  [small, large].every((s) => theftMean(s) < 0));

  // --- and how a job reads on the board --------------------------------------
  //
  // `describeContract` ends on the BOUNTY line as a fallback, not a default: a
  // kind with no line of its own is silently described as a pirate hunt.
  {
    // TWO BUILDERS SINCE docs/TODO/185 M1. There was one, and it made a
    // passenger job by overriding a cargo run's `kind`. The result carried a
    // `commodity`, which no passenger job has.
    const heads = (qty: number): Contract =>
      ({ kind: 'passenger', destination: 7, qty, reward: 500, deadlineDay: 10 });
    const job = (over: Partial<ConsignmentContract>): Contract => ({
      kind: 'cargo', destination: 7, commodity: 0, qty: 5,
      reward: 500, deadlineDay: 10, ...over,
    });
    check('a passenger job is described as passengers, not as a pirate hunt',
      describeContract(heads(2), systems) === 'Carry 2 passengers to LAVE');
    check('...and one passenger is not two',
      describeContract(heads(1), systems) === 'Carry 1 passenger to LAVE');
    // The board says what the job is. A smuggling run described as a pirate
    // hunt — the fallback's failure mode — would have the player accept a
    // police scan without being told there was one to accept.
    check('a smuggling run names the goods and admits what it is',
      describeContract(job({ kind: 'smuggle', commodity: CONTRABAND[1], qty: 4 }), systems)
        === 'Move 4t Narcotics to LAVE — no questions asked');
  }
}
