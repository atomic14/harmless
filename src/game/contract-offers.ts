// What work a station has on its board today, and how each job reads.
//
// The other half of a contract's life — taking one on, and what settling it
// pays or costs — is game/contracts.ts. They split when docs/TODO/113's bill
// took the pair over the size ceiling, along the seam the tests had already
// found: test/contract-offers.test.ts asks what the board may OFFER,
// test/contracts.test.ts what settlement DOES. Nothing here reads settlement,
// so the dependency runs one way only.
//
// Pure functions, deliberately free of three.js and DOM so that both the
// game (src/game/game.ts) and the headless campaign simulator
// (test/campaign.ts) run the *same* rules — a balance test that mirrored
// the logic instead of calling it would be worthless.
//
// Erasable-TypeScript only: Node runs this directly via
// --experimental-strip-types.

// .ts extension: this module is run directly by Node (--experimental-strip-types)
// for the campaign simulator, and COMMODITIES is a value import, not a type.
import { COMMODITIES, type StarSystem } from '../galaxy/galaxy.ts';
import { random } from './rng.ts';
import { distanceTenths } from '../galaxy/navigation.ts';
import type { Contract } from './commander.ts';
import { CONTRACT_RANGE } from '../constants/contracts.ts';
import { ORDINARY_GOODS } from '../constants/commodities.ts';
import { CONTRABAND } from '../constants/law.ts';

/** Chart distance in tenths of a light-year (the original's metric). */
// Was a second copy of the chart metric. It now comes from the one owner, and
// keeps the old name so the campaign harness's imports still read naturally.
export { distanceTenths as chartDistanceTenths };
/**
 * Work on offer at a station today. Deliberately more generous than the
 * original, which gated every mission behind a high combat rating: a new
 * commander should always have somewhere to be. Rewards were tuned against
 * the autonomous playtest agent's ledger (see docs/DEVLOG.md).
 */
export function generateContractOffers(
  sys: StarSystem,
  systems: StarSystem[],
  day: number,
  rng: () => number = random,
): Contract[] {
  const reachable = systems.filter((s) => {
    const d = distanceTenths(sys, s);
    return s.index !== sys.index && d > 0 && d <= CONTRACT_RANGE;
  });
  if (!reachable.length) return [];

  const offers: Contract[] = [];
  const count = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < count; i++) {
    const dest = reachable[Math.floor(rng() * reachable.length)];
    const dist = distanceTenths(sys, dest);
    const roll = rng();
    // One roll cuts all five kinds, so any re-cut moves every seeded board.
    // Cargo and courier gave up the slice passengers occupy; smuggling's 0.10
    // then came off cargo and bounty together, leaving illicit freight the
    // narrowest slice on the board — it is meant to be the job you notice, not
    // the job you plan a career around — and bounty still wide enough that the
    // combat ladder is fed by the board as well as the ledger.
    if (roll < 0.4) {
      // cargo run: they supply the goods, you supply the nerve
      const commodity = ORDINARY_GOODS[Math.floor(rng() * ORDINARY_GOODS.length)];
      const qty = 3 + Math.floor(rng() * 8);
      offers.push({
        kind: 'cargo',
        destination: dest.index,
        commodity,
        qty,
        // The per-tonne term was `22 + dist * 1.6` until docs/TODO/112, which is
        // 11.4 Cr/t of fee to haul goods worth 24.5 Cr/t at the far end — a fee
        // nobody would take a hold slot for once the consignment goes back on
        // failure instead of staying sold-able in the hold. 2.45x makes the fee
        // the whole of the reward, at ~25 Cr/t. The pair was SET by the campaign
        // rather than argued: over 1,000 trader careers the reclaim alone costs
        // the cohort 6,981 -> 4,454 Cr of median net worth, and this is what puts
        // it back (6,887 Cr). The flat term and the deadline are unchanged, and
        // so is the roll above, so the fee and 110's share change stay legible
        // apart in the ledger.
        reward: Math.round(qty * (54 + dist * 3.9) + 90),
        deadlineDay: day + 4 + Math.ceil(dist / 12),
        progress: 0,
      });
    } else if (roll < 0.6) {
      offers.push({
        kind: 'courier',
        destination: dest.index,
        commodity: 0,
        qty: 0,
        reward: Math.round(240 + dist * 6.0),
        deadlineDay: day + 3 + Math.ceil(dist / 16),
        progress: 0,
      });
    } else if (roll < 0.75) {
      // passengers: a berth apiece out of the same hold freight wants, and a
      // courier's deadline, because people notice being late in a way that a
      // crate does not.
      const qty = 1 + Math.floor(rng() * 3);
      offers.push({
        kind: 'passenger',
        destination: dest.index,
        commodity: 0,
        qty,
        reward: Math.round(qty * (90 + dist * 3) + 120),
        deadlineDay: day + 3 + Math.ceil(dist / 16),
        progress: 0,
      });
    } else if (roll < 0.85) {
      // Illicit freight (docs/TODO/110). A cargo run in every mechanical
      // respect — the consignment is loaded on accept and must still be aboard
      // at the far end — but drawn from the law's own `CONTRABAND`, so from the
      // moment you accept it the police scan (world-step.ts), the pirates'
      // appetite (threat.ts) and the hermit outlet all apply with no new code.
      // Small loads: it is a job you hide, not a hold you fill.
      const commodity = CONTRABAND[Math.floor(rng() * CONTRABAND.length)];
      const qty = 2 + Math.floor(rng() * 4);
      offers.push({
        kind: 'smuggle',
        destination: dest.index,
        commodity,
        qty,
        // A FLAT formula, deliberately not `marketEstimate`: the estimate's own
        // docstring records that the Narcotics mean lies (byte wrap), and
        // pricing a reward off it would import that lie. Roughly twice the
        // per-tonne rate of an ordinary cargo run above, which is what the
        // existing punishment ladder is worth taking on. Scaled by the same
        // 2.45x as cargo in docs/TODO/112 (`80 + dist * 2` before it), so the
        // premium illicit freight carries is the one 110 measured and not a
        // second change riding along with the reclaim.
        reward: Math.round(qty * (195 + dist * 4.9) + 200),
        deadlineDay: day + 4 + Math.ceil(dist / 12),
        progress: 0,
      });
    } else {
      const qty = 2 + Math.floor(rng() * 3);
      offers.push({
        kind: 'bounty',
        destination: dest.index,
        commodity: 0,
        qty,
        reward: Math.round(qty * 170 + dist * 4),
        deadlineDay: day + 6 + Math.ceil(dist / 10),
        progress: 0,
      });
    }
  }
  return offers;
}


/** One line describing a job, for the board and the station menu. */
export function describeContract(k: Contract, systems: StarSystem[]): string {
  const dest = systems[k.destination].name.toUpperCase();
  if (k.kind === 'cargo') return `Deliver ${k.qty}t ${COMMODITIES[k.commodity].name} to ${dest}`;
  if (k.kind === 'courier') return `Carry sealed data to ${dest}`;
  // The final line is the BOUNTY fallback, not a default: a kind with no line
  // of its own here is described as a pirate hunt, silently and wrongly.
  if (k.kind === 'passenger') {
    return `Carry ${k.qty} passenger${k.qty === 1 ? '' : 's'} to ${dest}`;
  }
  // Says what it is. The board never pretends a smuggling run is freight — the
  // player is choosing to take the law on, and cannot choose what they were not
  // told (`ui/screens.ts` marks the row amber to match).
  if (k.kind === 'smuggle') {
    return `Move ${k.qty}t ${COMMODITIES[k.commodity].name} to ${dest} — no questions asked`;
  }
  return `Destroy ${k.qty} pirates around ${dest}`;
}
