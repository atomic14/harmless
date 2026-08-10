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
  // --- a failed consignment goes back (docs/TODO/112) ------------------------
  //
  // The freight is the station's: it is loaded at acceptance against a fee for
  // carrying it, so a run that fails hands it back rather than leaving it in the
  // hold for the trade screen to sell. `reclaimed` rides on the event because
  // the hold no longer holds the answer once settlement has run.
  {
    const c = cmdr();
    c.contracts = [cargoRun()];
    c.cargo[0] = 4;              // sold one on the way
    const ev = settleContracts(c);
    check('a short consignment is void, not paid', ev[0]?.kind === 'incomplete');
    check('...pays nothing', c.credits === 1000);
    // WHAT IS THERE, not what was owed: 4t aboard against a 5t job leaves the
    // hold empty and reports 4, which is also what stops the hold going negative
    check('...hands back what is aboard, not what was owed',
      c.cargo[0] === 0 && ev[0]?.kind === 'incomplete' && ev[0].reclaimed === 4);
    check('...and is off the list for good', c.contracts.length === 0);
  }
  {
    const c = cmdr();
    c.contracts = [cargoRun({ qty: 5 })];
    c.cargo[0] = 2;              // 2t against a 5t job — the plan's own case
    const ev = settleContracts(c);
    check('...a 2t hold against a 5t job hands back 2t and reports it',
      ev[0]?.kind === 'incomplete' && ev[0].reclaimed === 2 && c.cargo[0] === 0);
  }
  {
    // Goods are fungible and the hold keeps no per-contract provenance, so a
    // commander who bought 10t of the same Food has covered the 5t consignment:
    // the station takes its five and the ten she paid for stay hers.
    const c = cmdr();
    c.contracts = [cargoRun({ commodity: 0, qty: 5 })];
    c.cargo[0] = 15;
    const ev = settleContracts(c);
    check('pooled goods give back the consignment and no more',
      ev[0]?.kind === 'paid' && c.cargo[0] === 10);
    const late = cmdr({ day: 11 });
    late.contracts = [cargoRun({ commodity: 0, qty: 5 })];
    late.cargo[0] = 15;
    const lateEv = settleContracts(late);
    check('...and a failed one takes the consignment out of the pool, not the pool',
      lateEv[0]?.kind === 'expired' && lateEv[0].reclaimed === 5 && late.cargo[0] === 10);
  }
  {
    const c = cmdr({ day: 11 });
    c.contracts = [cargoRun()];
    c.cargo[0] = 5;
    const ev = settleContracts(c);
    check('a late delivery expires even standing on the doorstep',
      ev[0]?.kind === 'expired' && c.credits === 1000 && c.contracts.length === 0);
    // THE LEAK docs/TODO/112 closed: being late used to leave ~470 Cr of
    // Machinery in the hold against a fee of ~79, so the best job on the board
    // was one you never delivered. Revert the reclaim line and this goes red.
    check('...and the consignment goes back, unpaid and unsold',
      c.cargo[0] === 0 && ev[0]?.kind === 'expired' && ev[0].reclaimed === 5);
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
  {
    // Work that carries no consignment cannot have one taken back. The hold is
    // deliberately full of the commodity the contract names, which is the only
    // way a reclaim that ignored `kind` would show itself.
    const c = cmdr({ day: 11 });
    c.contracts = [cargoRun({ kind: 'courier', qty: 0 }), cargoRun({ kind: 'bounty', qty: 3 })];
    c.cargo[0] = 9;
    const ev = settleContracts(c);
    check('a failed courier or bounty job hands nothing back and touches no cargo',
      ev.length === 2 && ev.every((e) => e.kind === 'expired' && e.reclaimed === 0)
      && c.cargo[0] === 9);
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
    c.cargo[0] = 6;              // her own goods, nothing to do with the fares
    const ev = settleContracts(c);
    check('late passengers expire, unpaid, like any other job',
      ev[0]?.kind === 'expired' && c.credits === 1000 && c.contracts.length === 0);
    check('...and the berths go with them, leaving only her own 6t',
      cargoTonnes(c) === 6);
    // There is no consignment to hand back, and the HOLD IS NOT EMPTY: a job
    // that reclaimed by `qty` regardless of kind would take 3t of the Food she
    // bought for herself, and `commodity: 0` is Food.
    check('...and a passenger job reclaims nothing, out of a hold with goods in it',
      ev[0]?.kind === 'expired' && ev[0].reclaimed === 0 && c.cargo[0] === 6);
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
    check('...hands back the 3t still aboard and leaves the list',
      ev[0]?.kind === 'incomplete' && ev[0].reclaimed === 3
      && c.cargo[CONTRABAND[1]] === 0 && c.contracts.length === 0);
    check('...and settlement adds no deed of its own for a job it did not pay',
      (c.disrepute ?? 0) === 0);
  }
  {
    // Illicit freight is reclaimed exactly like freight — the hermit outlet
    // must not be a way to keep a smuggling run's cargo by being late for it.
    const c = cmdr({ day: 11 });
    c.contracts = [smuggleRun()];
    c.cargo[CONTRABAND[1]] = 4;
    const ev = settleContracts(c);
    check('a late smuggling run expires, and the contraband goes back too',
      ev[0]?.kind === 'expired' && ev[0].reclaimed === 4 && c.credits === 1000
      && (c.disrepute ?? 0) === 0);
    check('...leaving the hold clean', c.cargo[CONTRABAND[1]] === 0
      && !carryingContraband(c.cargo));
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
      contractMessage({ kind: 'incomplete', contract: cargoRun(), reclaimed: 0 }, systems)
        .sound === null);
    // The HUD says what was taken back, in the commodity's own name, and says
    // nothing when nothing was — a line that always claimed a seizure would be
    // wrong for a courier, and wrong for freight already sold off entirely.
    const seized = contractMessage(
      { kind: 'expired', contract: cargoRun({ commodity: 8, qty: 8 }), reclaimed: 8 }, systems);
    check('an expired freight run names what the station took back',
      seized.text === 'CONTRACT EXPIRED — 8T MACHINERY RECLAIMED');
    check('...and a courier run, carrying nothing, just expires',
      contractMessage({ kind: 'expired', contract: cargoRun({ kind: 'courier', qty: 0 }),
        reclaimed: 0 }, systems).text === 'CONTRACT EXPIRED');
    check('...as does freight with nothing left aboard to take',
      contractMessage({ kind: 'expired', contract: cargoRun(), reclaimed: 0 }, systems)
        .text === 'CONTRACT EXPIRED');
    check('a short delivery says the same of the part it handed over',
      contractMessage({ kind: 'incomplete', contract: cargoRun({ commodity: 0 }), reclaimed: 2 },
        systems).text === 'CONSIGNMENT INCOMPLETE — CONTRACT VOID — 2T FOOD RECLAIMED');
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
