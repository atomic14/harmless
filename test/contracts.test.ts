// Contracts: what the bulletin board offers, what taking it costs the hold, and
// what delivering it pays.
//
// Contract rules live in game/contracts.ts (invariant 10) so the headless
// campaign runs the same code the game does — these drive that module directly.
// The Navy mission and trumbles were here too and are test/missions.test.ts now.

import {
  newCommander, cargoCapacity, cargoTonnes, type Contract,
} from '../src/game/commander.ts';
import type { CommanderData } from '../src/game/commander.ts';
import { generateGalaxy } from '../src/galaxy/galaxy.ts';
import { distanceTenths } from '../src/galaxy/navigation.ts';
import {
  generateContractOffers,
  settleContracts,
  acceptContract,
  contractMessage,
  describeContract,
} from '../src/game/contracts.ts';
import {
  CONTRACT_RANGE, MAX_CONTRACTS, PASSENGER_BERTH_TONNES,
} from '../src/constants/contracts.ts';
import { ORDINARY_GOODS } from '../src/constants/commodities.ts';
import { makeRng } from '../src/game/rng.ts';
import { check } from './harness.ts';

// --- taking work, and being paid for it -------------------------------------
//
// `settleContracts` and `acceptContract` were private methods of game.ts, so
// the rules that decide whether a job pays had NO tests at all — and
// test/campaign.ts, the harness the project quotes its balance figures from,
// carried its own transcription of the settlement rather than calling them.
// That is the exact arrangement docs/INVARIANTS.md invariant 10 forbids. They are in
// contracts.ts now, and this is the coverage that was missing.

console.log('\ncontracts');
{
  const systems = generateGalaxy(1);
  const cargoRun = (over: Partial<Contract> = {}): Contract => ({
    kind: 'cargo', destination: 7, commodity: 0, qty: 5,
    reward: 500, deadlineDay: 10, progress: 0, ...over,
  });
  const passengerJob = (over: Partial<Contract> = {}): Contract => ({
    kind: 'passenger', destination: 7, commodity: 0, qty: 3,
    reward: 500, deadlineDay: 10, progress: 0, ...over,
  });
  const cmdr = (over: Record<string, unknown> = {}): CommanderData => ({
    ...newCommander(), systemIndex: 7, day: 0, credits: 1000, contracts: [], ...over,
  } as CommanderData);

  // --- settlement ----------------------------------------------------------
  {
    const c = cmdr();
    c.contracts = [cargoRun()];
    c.cargo[0] = 5;
    const ev = settleContracts(c);
    check('a consignment delivered on time pays', ev[0]?.kind === 'paid');
    check('...the reward lands in the account', c.credits === 1500);
    check('...the goods leave the hold', c.cargo[0] === 0);
    check('...and the job leaves the list', c.contracts.length === 0);
  }
  {
    const c = cmdr();
    c.contracts = [cargoRun()];
    c.cargo[0] = 4;              // sold one on the way
    const ev = settleContracts(c);
    check('a short consignment is void, not paid', ev[0]?.kind === 'incomplete');
    check('...pays nothing and takes nothing', c.credits === 1000 && c.cargo[0] === 4);
    check('...and is off the list for good', c.contracts.length === 0);
  }
  {
    const c = cmdr({ day: 11 });
    c.contracts = [cargoRun()];
    c.cargo[0] = 5;
    const ev = settleContracts(c);
    check('a late delivery expires even standing on the doorstep',
      ev[0]?.kind === 'expired' && c.credits === 1000 && c.contracts.length === 0);
  }
  {
    const c = cmdr({ systemIndex: 8 });
    c.contracts = [cargoRun()];
    c.cargo[0] = 5;
    check('a job for somewhere else is left alone',
      settleContracts(c).length === 0 && c.contracts.length === 1 && c.cargo[0] === 5);
  }
  {
    const c = cmdr({ day: 11, systemIndex: 8 });
    c.contracts = [cargoRun()];
    check('...unless the deadline has passed, wherever you are',
      settleContracts(c)[0]?.kind === 'expired' && c.contracts.length === 0);
  }
  {
    // THE branch a re-implementation gets wrong, and the reason this is one
    // function now: an unfinished bounty job at its destination is neither
    // settled nor dropped — you may come back to it until the deadline.
    const c = cmdr();
    c.contracts = [cargoRun({ kind: 'bounty', qty: 3, progress: 1 })];
    check('an unfilled bounty at its destination is kept, not failed',
      settleContracts(c).length === 0 && c.contracts.length === 1);
    c.contracts[0].progress = 3;
    check('...and pays once the count is filled',
      settleContracts(c)[0]?.kind === 'paid' && c.credits === 1500);
  }
  // --- passengers settle like a courier, and free their berths -------------
  //
  // They travel WITH the contract: there is nothing to sell short on the way,
  // so `settleContracts` needs no branch of its own and these prove it — the
  // two outcomes a passenger job has, driven through the real settler.
  {
    const c = cmdr();
    c.contracts = [passengerJob()];
    check('...and the berths are charged to the hold while they are aboard',
      cargoTonnes(c) === 3 * PASSENGER_BERTH_TONNES);
    const ev = settleContracts(c);
    check('passengers delivered on time pay', ev[0]?.kind === 'paid' && c.credits === 1500);
    check('...leave the list', c.contracts.length === 0);
    check('...and give the bays back', cargoTonnes(c) === 0);
  }
  {
    const c = cmdr({ day: 11 });
    c.contracts = [passengerJob()];
    const ev = settleContracts(c);
    check('late passengers expire, unpaid, like any other job',
      ev[0]?.kind === 'expired' && c.credits === 1000 && c.contracts.length === 0);
    check('...and the berths go with them', cargoTonnes(c) === 0);
  }
  {
    const c = cmdr({ systemIndex: 8 });
    c.contracts = [passengerJob()];
    check('passengers still in transit are left alone', settleContracts(c).length === 0
      && c.contracts.length === 1 && cargoTonnes(c) === 3 * PASSENGER_BERTH_TONNES);
  }

  {
    const c = cmdr();
    c.contracts = [cargoRun({ commodity: 0 }), cargoRun({ commodity: 1, reward: 300 })];
    c.cargo[0] = 5; c.cargo[1] = 5;
    check('several jobs settle in one dock', settleContracts(c).length === 2);
    check('...and both rewards are paid', c.credits === 1800);
  }

  // --- taking it on --------------------------------------------------------
  {
    const c = cmdr();
    const offers = [cargoRun({ destination: 8 })];
    const ev = acceptContract(c, offers, 0);
    check('accepting a cargo run loads the consignment on the spot',
      ev[0]?.kind === 'accepted' && c.cargo[0] === 5);
    check('...puts it on your list', c.contracts.length === 1);
    check('...and takes it off the board', offers.length === 0);
  }
  {
    const c = cmdr();
    c.contracts = [cargoRun(), cargoRun(), cargoRun()];   // MAX_CONTRACTS
    const offers = [cargoRun({ destination: 8 })];
    const ev = acceptContract(c, offers, 0);
    check(`no more than ${MAX_CONTRACTS} jobs at once`,
      ev[0]?.kind === 'refused' && ev[0].reason === 'tooMuchWork');
    check('...and a refusal changes nothing at all',
      c.contracts.length === 3 && offers.length === 1 && c.cargo[0] === 0);
  }
  {
    const c = cmdr();
    c.cargo[0] = cargoCapacity(c);   // hold already full
    const offers = [cargoRun({ destination: 8 })];
    const ev = acceptContract(c, offers, 0);
    check('a consignment that will not fit is refused',
      ev[0]?.kind === 'refused' && ev[0].reason === 'noHoldSpace');
    check('...and nothing is loaded', c.cargo[0] === cargoCapacity(c) && offers.length === 1);
  }
  {
    check('accepting nothing is nothing', acceptContract(cmdr(), [], 0).length === 0);
  }

  // --- berths compete with freight for the same bays -----------------------
  //
  // The mirror of the cargo `noHoldSpace` case above, and the whole point of
  // passenger work: a berth is hold space, so a hold with room for one more
  // tonne cannot take a passenger who needs two.
  {
    const c = cmdr();
    const berths = 3 * PASSENGER_BERTH_TONNES;
    c.cargo[0] = cargoCapacity(c) - berths;
    const offers = [passengerJob({ destination: 8 })];
    check('a passenger job that exactly fills the hold is taken',
      acceptContract(c, offers, 0)[0]?.kind === 'accepted');
    check('...charges the hold for the berths, loading nothing',
      cargoTonnes(c) === cargoCapacity(c) && c.cargo[0] === cargoCapacity(c) - berths);
    check('...and fills it: there is no room left for a tonne of freight',
      cargoTonnes(c) + 1 > cargoCapacity(c));
  }
  {
    const c = cmdr();
    c.cargo[0] = cargoCapacity(c) - 3 * PASSENGER_BERTH_TONNES + 1;  // one tonne short
    const offers = [passengerJob({ destination: 8 })];
    const ev = acceptContract(c, offers, 0);
    check('passengers with nowhere to sleep are refused',
      ev[0]?.kind === 'refused' && ev[0].reason === 'noHoldSpace');
    check('...and a refusal changes nothing at all',
      c.contracts.length === 0 && offers.length === 1);
  }
  {
    // berths already taken are hold already used — the two jobs compete, and
    // this fails if `cargoTonnes` reads the cargo array alone
    const c = cmdr();
    c.contracts = [passengerJob({ qty: 3, destination: 9 })];
    c.cargo[0] = cargoCapacity(c) - 4 * PASSENGER_BERTH_TONNES;
    const offers = [passengerJob({ qty: 2, destination: 8 })];
    check('a booked berth is counted against the next booking',
      acceptContract(c, offers, 0)[0]?.kind === 'refused');
  }

  // --- phrasing lives with the rule, away from the AudioContext -------------
  {
    const paid = contractMessage({ kind: 'paid', contract: cargoRun() }, systems);
    check('a payment is announced with the money',
      paid.text.includes('CONTRACT PAID') && paid.sound === 'contractPaid');
    const acc = contractMessage(
      { kind: 'accepted', contract: cargoRun({ destination: 7 }) }, systems);
    check('...and an acceptance names the destination',
      acc.text.includes('LAVE') && acc.text === acc.text.toUpperCase());
    check('a void consignment has no sound',
      contractMessage({ kind: 'incomplete', contract: cargoRun() }, systems).sound === null);
    // `describeContract` ends on the BOUNTY line as a fallback, not a default:
    // a kind with no line of its own is silently described as a pirate hunt.
    check('a passenger job is described as passengers, not as a pirate hunt',
      describeContract(passengerJob({ qty: 2, destination: 7 }), systems)
        === 'Carry 2 passengers to LAVE');
    check('...and one passenger is not two', describeContract(
      passengerJob({ qty: 1, destination: 7 }), systems) === 'Carry 1 passenger to LAVE');
  }
}

// --- what the board may offer -------------------------------------------------
//
// The two constants of the offer generator, measured out of the REAL
// generateContractOffers over the whole galaxy rather than probed at
// themselves — a re-inlined literal in the filter or the commodity draw goes
// red here and nowhere else.
//
// CONTRACT_RANGE is MAX_FUEL now (resolved 2026-08-05 — the tank is the
// rule): the check pins the bound exactly, from both sides — the furthest
// offer equals the furthest system the bound admits, and the galaxy holds
// destinations just beyond it that are never offered, so widening OR
// narrowing the filter moves the measurement.

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
        }
      }
    }
    return { maxD, offers, strayCommodity, passengers, strayQty, strayGoods };
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

  // The single seeded roll cuts all four kinds, so the passenger share is
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
}
