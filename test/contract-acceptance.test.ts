// Taking work off the bulletin board: what a job costs the hold before it has
// paid anything.
//
// `acceptContract`'s half of game/contracts.ts. Settling that work — what
// delivering pays and what failing it costs — is test/contracts.test.ts, and
// what the board may OFFER is test/contract-offers.test.ts. The three split as
// each crossed the size ceiling; this one left when docs/TODO/113's bill
// landed, and it shares nothing with settlement but a three-line fixture: every
// check here is about the hold, and none of them settles anything.

import {
  newCommander, cargoCapacity, cargoTonnes, type Contract,
} from '../src/game/commander.ts';
import type { CommanderData } from '../src/game/commander.ts';
import { acceptContract } from '../src/game/contracts.ts';
import { MAX_CONTRACTS, PASSENGER_BERTH_TONNES } from '../src/constants/contracts.ts';
import { CONTRABAND } from '../src/constants/law.ts';
import { carryingContraband } from '../src/game/law.ts';
import { check } from './harness.ts';

console.log('\ntaking contracts on');
{
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

  // --- and illicit freight loads exactly like freight ----------------------
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
}
