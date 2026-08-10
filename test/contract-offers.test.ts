// What the bulletin board may OFFER: how far a job can send you, and what each
// kind of work is made of.
//
// The other half of the board is test/contracts.test.ts — what taking a job
// costs the hold and what delivering it pays. These were one file until the
// smuggling kind landed (docs/TODO/110) and it crossed the size ceiling; they
// share no fixture, only the module. The distinction that matters: everything
// here is a property of `generateContractOffers`, measured out of the REAL
// generator over the whole galaxy at TWO sample sizes rather than probed at its
// own literals, so a re-inlined bound or a re-cut roll goes red here and the
// settlement tests stay green.
//
// CONTRACT_RANGE is MAX_FUEL now (resolved 2026-08-05 — the tank is the
// rule): the check pins the bound exactly, from both sides — the furthest
// offer equals the furthest system the bound admits, and the galaxy holds
// destinations just beyond it that are never offered, so widening OR
// narrowing the filter moves the measurement.

import { generateGalaxy } from '../src/galaxy/galaxy.ts';
import { distanceTenths } from '../src/galaxy/navigation.ts';
import { generateContractOffers } from '../src/game/contracts.ts';
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

  // the sweep, read at two sizes (CLAUDE.md: read the set, not the sample) —
  // the answer must be the same one at both
  const sweep = (passes: number) => {
    const rng = makeRng(90);
    let maxD = 0;
    let offers = 0;
    let strayCommodity = 0;
    let passengers = 0;
    let strayQty = 0;
    let strayGoods = 0;
    let smuggles = 0;
    let strayLegal = 0;
    let strayLoad = 0;
    for (let p = 0; p < passes; p += 1) {
      for (const sys of systems) {
        for (const k of generateContractOffers(sys, systems, 0, rng)) {
          offers += 1;
          const d = distanceTenths(sys, systems[k.destination]);
          if (d > maxD) maxD = d;
          if (k.kind === 'cargo' && !ORDINARY_GOODS.includes(k.commodity)) strayCommodity += 1;
          if (k.kind === 'passenger') {
            passengers += 1;
            if (k.qty < 1 || k.qty > 3) strayQty += 1;
            if (k.commodity !== 0) strayGoods += 1;
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
      maxD, offers, strayCommodity, passengers, strayQty, strayGoods,
      smuggles, strayLegal, strayLoad,
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
  // only bounded because this is. A passenger job carries no goods, so it must
  // never enter the ordinary-goods check above.
  check(`a passenger job books 1-3 heads and no cargo `
    + `(${small.passengers + large.passengers} jobs, `
    + `${small.strayQty + large.strayQty} out of range, `
    + `${small.strayGoods + large.strayGoods} carrying goods)`,
  small.strayQty === 0 && large.strayQty === 0
  && small.strayGoods === 0 && large.strayGoods === 0);

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
}
