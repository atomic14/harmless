// Settling contracts: what delivering work pays, what failing it costs, and
// what the HUD says about either.
//
// Contract rules live in game/contracts.ts (invariant 10) so the headless
// campaign runs the same code the game does — these drive that module directly.
// The Navy mission and trumbles were here too and are test/missions.test.ts now;
// what the board may OFFER is test/contract-offers.test.ts, which left when the
// smuggling kind (docs/TODO/110) took the pair over the size ceiling, and what
// TAKING a job costs the hold is test/contract-acceptance.test.ts, which left
// when the bill for a shorted consignment (docs/TODO/113) took it over again.

import {
  newCommander, cargoTonnes, type Contract,
} from '../src/game/commander.ts';
import type { CommanderData } from '../src/game/commander.ts';
import { generateGalaxy } from '../src/galaxy/galaxy.ts';
import { settleContracts, contractMessage } from '../src/game/contracts.ts';
import { PASSENGER_BERTH_TONNES } from '../src/constants/contracts.ts';
import { CONTRABAND } from '../src/constants/law.ts';
import {
  DISREPUTE_CONTRABAND_SALE, DISREPUTE_SHORTED_CONSIGNMENT,
} from '../src/constants/character.ts';
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
  // ONE BUILDER PER KIND SINCE docs/TODO/185 M1. There were three, and
  // `cargoRun({ kind: 'bounty' })` built a bounty job that carried a
  // `commodity` nothing reads. The union forbids that now, so the test says
  // which job it means. Each builder refuses a `kind` override for the same
  // reason: `bountyJob` builds a bounty.
  type Consignment = Extract<Contract, { kind: 'cargo' | 'smuggle' }>;
  type Bounty = Extract<Contract, { kind: 'bounty' }>;
  type Passenger = Extract<Contract, { kind: 'passenger' }>;
  type Courier = Extract<Contract, { kind: 'courier' }>;
  const cargoRun = (over: Partial<Omit<Consignment, 'kind'>> = {}): Consignment => ({
    kind: 'cargo', destination: 7, commodity: 0, qty: 5,
    reward: 500, deadlineDay: 10, ...over,
  });
  const passengerJob = (over: Partial<Omit<Passenger, 'kind'>> = {}): Passenger => ({
    kind: 'passenger', destination: 7, qty: 3,
    reward: 500, deadlineDay: 10, ...over,
  });
  const smuggleRun = (over: Partial<Omit<Consignment, 'kind'>> = {}): Consignment => ({
    kind: 'smuggle', destination: 7, commodity: CONTRABAND[1], qty: 4,
    reward: 900, deadlineDay: 10, ...over,
  });
  const bountyJob = (over: Partial<Omit<Bounty, 'kind'>> = {}): Bounty => ({
    kind: 'bounty', destination: 7, qty: 5,
    reward: 500, deadlineDay: 10, progress: 0, ...over,
  });
  const courierJob = (over: Partial<Omit<Courier, 'kind'>> = {}): Courier => ({
    kind: 'courier', destination: 7, qty: 0,
    reward: 500, deadlineDay: 10, ...over,
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
    check('a short consignment is void, not paid', ev[0]?.kind === 'billed');
    // WHAT IS THERE, not what was owed: 4t aboard against a 5t job leaves the
    // hold empty and reports 4, which is also what stops the hold going negative
    check('...hands back what is aboard, not what was owed',
      c.cargo[0] === 0 && ev[0]?.kind === 'billed' && ev[0].reclaimed === 4);
    check('...and is off the list for good', c.contracts.length === 0);
  }
  {
    const c = cmdr();
    c.contracts = [cargoRun({ qty: 5 })];
    c.cargo[0] = 2;              // 2t against a 5t job — the plan's own case
    const ev = settleContracts(c);
    check('...a 2t hold against a 5t job hands back 2t and reports it',
      ev[0]?.kind === 'billed' && ev[0].reclaimed === 2 && c.cargo[0] === 0);
  }
  // --- ...and what you cannot hand back you are billed for (docs/TODO/113) ---
  //
  // 112 could close the honest failure and no more: arriving SHORT means the
  // freight was sold, jettisoned or lost, and there is nothing left to reclaim.
  // The shipper invoices the difference at the commodity's base value —
  // `basePrice * 4` ledger tenths, the same scaling generateMarket applies —
  // capped at what the commander has, and the name is marked.
  //
  // The numbers below are written out rather than recomputed from COMMODITIES,
  // so a change to the valuation rule fails here instead of agreeing with
  // itself: Machinery's base price is 0x75 = 117, so a tonne bills 468 tenths
  // (46.8 Cr) and Food's 0x13 = 19 bills 76 (7.6 Cr).
  {
    const c = cmdr();
    c.contracts = [cargoRun({ commodity: 8, qty: 5 })];   // Machinery
    c.cargo[8] = 3;              // two tonnes light at the door
    const ev = settleContracts(c);
    // EXACTLY the missing tonnes: billing the whole 5t consignment would be
    // 2,340 tenths, more than she has, and would empty the account instead.
    check('a short consignment is billed for the missing tonnes, not the whole job',
      ev[0]?.kind === 'billed' && ev[0].tonnes === 2 && ev[0].charged === 2 * 468);
    check('...and the money actually leaves the account', c.credits === 1000 - 936);
    check('...while the three tonnes still aboard go back as before',
      ev[0]?.kind === 'billed' && ev[0].reclaimed === 3 && c.cargo[8] === 0);
    check(`...and it marks the name at DISREPUTE_SHORTED_CONSIGNMENT `
      + `(${DISREPUTE_SHORTED_CONSIGNMENT})`,
    c.disrepute === DISREPUTE_SHORTED_CONSIGNMENT);
  }
  {
    // The `fineFor` shape: capped at what you can pay, so a commander who sold
    // the consignment to buy a laser is poor, not trapped. 5t of Machinery is
    // 2,340 tenths against 500 in the account.
    const c = cmdr({ credits: 500 });
    c.contracts = [cargoRun({ commodity: 8, qty: 5 })];
    const ev = settleContracts(c);
    check('a bill bigger than the account takes everything and no more',
      ev[0]?.kind === 'billed' && ev[0].charged === 500 && c.credits === 0);
    check('...and the ledger never goes negative', c.credits >= 0);
  }
  {
    // ...and at zero there is nothing to take. The line falls back to the plain
    // void — a `BILLED 0.0 CR` invoice says nothing — but the DEED still lands,
    // or spending down before the door would launder a shorted consignment into
    // a free one.
    const c = cmdr({ credits: 0 });
    c.contracts = [cargoRun({ commodity: 8, qty: 5 })];
    const ev = settleContracts(c);
    check('a commander with nothing is not billed, and the two lines never both fire',
      ev.length === 1 && ev[0]?.kind === 'incomplete' && c.credits === 0);
    check('...but being broke does not buy the deed off',
      c.disrepute === DISREPUTE_SHORTED_CONSIGNMENT);
  }
  {
    // THE honest/dishonest split, and the reason 112 and 113 are two milestones:
    // late is a failure, short is a deed. Same job, same missing tonnes, one day
    // apart — and only one of them is charged or remembered.
    const c = cmdr({ day: 11 });
    c.contracts = [cargoRun({ commodity: 8, qty: 5 })];
    c.cargo[8] = 3;
    const ev = settleContracts(c);
    check('an honest late failure charges nothing and marks nothing',
      ev[0]?.kind === 'expired' && c.credits === 1000 && (c.disrepute ?? 0) === 0);
    check('...it just takes the freight back', ev[0]?.kind === 'expired'
      && ev[0].reclaimed === 3 && c.cargo[8] === 0);
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
    const job = bountyJob({ qty: 3, progress: 1 });
    c.contracts = [job];
    check('an unfilled bounty at its destination is kept, not failed',
      settleContracts(c).length === 0 && c.contracts.length === 1);
    // The kill goes on the job the test built. `c.contracts[0]` is a `Contract`
    // and only a bounty has a `progress` (docs/TODO/185 M1).
    job.progress = 3;
    check('...and pays once the count is filled',
      settleContracts(c)[0]?.kind === 'paid' && c.credits === 1500);
  }
  {
    // Work that carries no consignment cannot have one taken back. The hold is
    // deliberately full of the commodity the contract names, which is the only
    // way a reclaim that ignored `kind` would show itself.
    const c = cmdr({ day: 11 });
    c.contracts = [courierJob({ qty: 0 }), bountyJob({ qty: 3 })];
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
    // them has nothing to hand over. Void, not paid — and billed for the tonne
    // that is missing exactly as freight is (docs/TODO/113): the shipper wants
    // paying whether or not the goods were legal to carry. Narcotics' base
    // price is 0xeb = 235, so the one missing tonne bills 940 tenths.
    const c = cmdr();
    c.contracts = [smuggleRun()];
    c.cargo[CONTRABAND[1]] = 3;
    const ev = settleContracts(c);
    check('a smuggling run sold off en route is void, not paid',
      ev[0]?.kind === 'billed' && ev[0].charged === 940 && c.credits === 60);
    check('...hands back the 3t still aboard and leaves the list',
      ev[0]?.kind === 'billed' && ev[0].reclaimed === 3
      && c.cargo[CONTRABAND[1]] === 0 && c.contracts.length === 0);
    check('...and the shorted consignment is the deed, not the smuggling',
      c.disrepute === DISREPUTE_SHORTED_CONSIGNMENT);
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
    const c = cmdr();
    c.contracts = [cargoRun({ commodity: 0 }), cargoRun({ commodity: 1, reward: 300 })];
    c.cargo[0] = 5; c.cargo[1] = 5;
    check('several jobs settle in one dock', settleContracts(c).length === 2);
    check('...and both rewards are paid', c.credits === 1800);
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
      contractMessage({ kind: 'expired', contract: courierJob({ qty: 0 }),
        reclaimed: 0 }, systems).text === 'CONTRACT EXPIRED');
    check('...as does freight with nothing left aboard to take',
      contractMessage({ kind: 'expired', contract: cargoRun(), reclaimed: 0 }, systems)
        .text === 'CONTRACT EXPIRED');
    check('a short delivery says the same of the part it handed over',
      contractMessage({ kind: 'incomplete', contract: cargoRun({ commodity: 0 }), reclaimed: 2 },
        systems).text === 'CONSIGNMENT INCOMPLETE — CONTRACT VOID — 2T FOOD RECLAIMED');
    // ...and a billed one names the charge, the tonnage it is for and the goods
    // ONCE: this is the shipper's invoice, and a line that named the commodity
    // twice would read as the station taking an interest in what was aboard.
    const billed = contractMessage({ kind: 'billed', contract: cargoRun({ commodity: 8, qty: 5 }),
      reclaimed: 3, tonnes: 2, charged: 936 }, systems);
    check('a shorted consignment is invoiced on the HUD',
      billed.text === 'CONSIGNMENT SHORT — BILLED 93.6 Cr FOR 2T MACHINERY — 3T RECLAIMED');
    check('...and says nothing of a reclaim that did not happen',
      contractMessage({ kind: 'billed', contract: cargoRun({ commodity: 8, qty: 5 }),
        reclaimed: 0, tonnes: 5, charged: 2340 }, systems).text
        === 'CONSIGNMENT SHORT — BILLED 234.0 Cr FOR 5T MACHINERY');
  }
}
