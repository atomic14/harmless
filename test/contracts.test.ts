// Contracts: what taking a job off the bulletin board costs the hold, and what
// delivering it pays.
//
// Contract rules live in game/contracts.ts (invariant 10) so the headless
// campaign runs the same code the game does — these drive that module directly.
// The Navy mission and trumbles were here too and are test/missions.test.ts now;
// what the board may OFFER is test/contract-offers.test.ts, which left when the
// smuggling kind (docs/TODO/110) took the pair over the size ceiling.

import {
  newCommander, cargoCapacity, cargoTonnes, type Contract,
} from '../src/game/commander.ts';
import type { CommanderData } from '../src/game/commander.ts';
import { generateGalaxy } from '../src/galaxy/galaxy.ts';
import {
  settleContracts,
  acceptContract,
  contractMessage,
  describeContract,
} from '../src/game/contracts.ts';
import { MAX_CONTRACTS, PASSENGER_BERTH_TONNES } from '../src/constants/contracts.ts';
import { CONTRABAND } from '../src/constants/law.ts';
import { DISREPUTE_CONTRABAND_SALE } from '../src/constants/character.ts';
import { carryingContraband } from '../src/game/law.ts';
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
  const smuggleRun = (over: Partial<Contract> = {}): Contract => ({
    kind: 'smuggle', destination: 7, commodity: CONTRABAND[1], qty: 4,
    reward: 900, deadlineDay: 10, progress: 0, ...over,
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

  // --- illicit freight settles like freight, and marks the name (TODO 110) ---
  //
  // The reward prices a risk the law and the pirates already impose, so the
  // settlement must be the cargo branch and nothing more inventive: still
  // aboard pays, sold en route is void, late expires. What IS new is the deed —
  // `settleContracts` touched credits and cargo only until this landed.
  {
    const c = cmdr();
    c.contracts = [smuggleRun()];
    c.cargo[CONTRABAND[1]] = 4;
    const ev = settleContracts(c);
    check('a smuggling run delivered on time pays', ev[0]?.kind === 'paid'
      && c.credits === 1900);
    check('...and the consignment leaves the hold', c.cargo[CONTRABAND[1]] === 0);
    check(`...and it marks the name at DISREPUTE_CONTRABAND_SALE `
      + `(${DISREPUTE_CONTRABAND_SALE})`,
    c.disrepute === DISREPUTE_CONTRABAND_SALE);
    // the control: an honest delivery is not a dirty one, and this is the
    // assertion that fails if the deed is applied to every `paid` event
    const honest = cmdr();
    honest.contracts = [cargoRun()];
    honest.cargo[0] = 5;
    settleContracts(honest);
    check('...where an honest cargo run leaves it untouched',
      (honest.disrepute ?? 0) === 0);
  }
  {
    // THE temptation the job exists for: narcotics sell, and a hold that sold
    // them has nothing to hand over. Void, not paid — and no deed either,
    // because the sale that marked the name happened at the market screen.
    const c = cmdr();
    c.contracts = [smuggleRun()];
    c.cargo[CONTRABAND[1]] = 3;
    const ev = settleContracts(c);
    check('a smuggling run sold off en route is incomplete, not paid',
      ev[0]?.kind === 'incomplete' && c.credits === 1000);
    check('...keeps what is left and leaves the list',
      c.cargo[CONTRABAND[1]] === 3 && c.contracts.length === 0);
    check('...and settlement adds no deed of its own for a job it did not pay',
      (c.disrepute ?? 0) === 0);
  }
  {
    const c = cmdr({ day: 11 });
    c.contracts = [smuggleRun()];
    c.cargo[CONTRABAND[1]] = 4;
    const ev = settleContracts(c);
    check('a late smuggling run expires with the goods still aboard',
      ev[0]?.kind === 'expired' && c.credits === 1000
      && c.cargo[CONTRABAND[1]] === 4 && (c.disrepute ?? 0) === 0);
  }
  {
    // ...and accepting one loads it, which is the ENTIRE mechanism: from here
    // `carryingContraband` is true, so the scan, the pirates' appetite and the
    // hermit outlet apply with no code of their own.
    const c = cmdr();
    const offers = [smuggleRun({ destination: 8 })];
    check('accepting a smuggling run loads the contraband on the spot',
      acceptContract(c, offers, 0)[0]?.kind === 'accepted'
      && c.cargo[CONTRABAND[1]] === 4 && offers.length === 0);
    check('...and that is what makes it contraband aboard, with no new rule',
      carryingContraband(c.cargo));
    const full = cmdr();
    full.cargo[0] = cargoCapacity(full);
    check('...and a hold with no room refuses it like any consignment',
      acceptContract(full, [smuggleRun({ destination: 8 })], 0)[0]?.kind === 'refused');
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
    // The board says what the job is. A smuggling run described as a pirate
    // hunt — the fallback's failure mode — would have the player accept a
    // police scan without being told there was one to accept.
    check('a smuggling run names the goods and admits what it is',
      describeContract(smuggleRun({ qty: 4, destination: 7 }), systems)
        === 'Move 4t Narcotics to LAVE — no questions asked');
  }
}
