// What work a station has on its board today, and how each job reads.
//
// The other half of a contract's life is game/contracts.ts. That half covers
// two things: the moment a commander signs a job, and what settlement then
// pays or costs.
//
// They split when docs/TODO/113's bill took the pair over the size ceiling.
// The seam was the one the tests already drew: test/contract-offers.test.ts
// asks what the board may OFFER, and test/contracts.test.ts asks what
// settlement DOES. Nothing here reads settlement, so the dependency runs one
// way only.
//
// Pure functions, deliberately free of three.js and DOM. So the game
// (src/game/game.ts) and the headless campaign simulator (test/campaign.ts)
// run the *same* rules. A balance test that mirrored the logic rather than
// called it would be worthless.
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
    // Cargo and courier gave up the slice the passengers occupy. The 0.10 for
    // a smuggling run then came off cargo and bounty together. That leaves
    // illicit freight the narrowest slice on the board, which is the intent.
    // It is the job you notice, not the job you plan a career around. Bounty
    // stays wide enough to feed the combat ladder from the board as well as
    // from the ledger.
    if (roll < 0.4) {
      // cargo run: they supply the goods, you supply the nerve
      const commodity = ORDINARY_GOODS[Math.floor(rng() * ORDINARY_GOODS.length)];
      const qty = 3 + Math.floor(rng() * 8);
      offers.push({
        kind: 'cargo',
        destination: dest.index,
        commodity,
        qty,
        // The per-tonne term was `22 + dist * 1.6` until docs/TODO/112. That is
        // 11.4 Cr/t of fee to haul goods worth 24.5 Cr/t at the far end. On
        // failure the consignment now goes back rather than stays in the hold
        // to sell, so nobody would take a hold slot for that fee. 2.45x makes
        // the fee the whole of the reward, at ~25 Cr/t.
        //
        // The pair was SET by the campaign rather than argued. Over 1,000
        // trader careers the reclaim alone costs the cohort 6,981 -> 4,454 Cr
        // of median net worth. This is what puts it back, at 6,887 Cr.
        //
        // The flat term, the deadline and the roll above are all unchanged. So
        // the fee and 110's share change stay legible apart in the ledger.
        reward: Math.round(qty * (54 + dist * 3.9) + 90),
        deadlineDay: day + 4 + Math.ceil(dist / 12),
      });
    } else if (roll < 0.6) {
      offers.push({
        kind: 'courier',
        destination: dest.index,
        qty: 0,
        reward: Math.round(240 + dist * 6.0),
        deadlineDay: day + 3 + Math.ceil(dist / 16),
      });
    } else if (roll < 0.75) {
      // passengers: a berth apiece out of the same hold that freight wants.
      // They take a courier's deadline, because a person notices a late
      // arrival in a way that a crate does not.
      const qty = 1 + Math.floor(rng() * 3);
      offers.push({
        kind: 'passenger',
        destination: dest.index,
        qty,
        reward: Math.round(qty * (90 + dist * 3) + 120),
        deadlineDay: day + 3 + Math.ceil(dist / 16),
      });
    } else if (roll < 0.85) {
      // Illicit freight (docs/TODO/110). It is a cargo run in every mechanical
      // respect. The consignment loads on accept, and it must still be aboard
      // at the far end. The goods come from the law's own `CONTRABAND`. So
      // from the moment you accept it, three rules apply with no new code:
      //
      //   - the police scan (world-step.ts);
      //   - the pirates' appetite (threat.ts);
      //   - the hermit outlet.
      //
      // Small loads: it is a job you hide, not a hold you fill.
      const commodity = CONTRABAND[Math.floor(rng() * CONTRABAND.length)];
      const qty = 2 + Math.floor(rng() * 4);
      offers.push({
        kind: 'smuggle',
        destination: dest.index,
        commodity,
        qty,
        // A FLAT formula, deliberately not `marketEstimate`. That estimate's
        // own doc comment records that the Narcotics mean lies (byte wrap). A
        // reward priced off it would import that lie.
        //
        // It is roughly twice the per-tonne rate of an ordinary cargo run
        // above. That is what the punishment ladder in force is worth. It
        // scales by the same 2.45x as cargo in docs/TODO/112, which read
        // `80 + dist * 2` before. So the premium that illicit freight carries
        // is the one 110 measured, and the reclaim brings no second change
        // with it.
        reward: Math.round(qty * (195 + dist * 4.9) + 200),
        deadlineDay: day + 4 + Math.ceil(dist / 12),
      });
    } else {
      const qty = 2 + Math.floor(rng() * 3);
      offers.push({
        kind: 'bounty',
        destination: dest.index,
        qty,
        reward: Math.round(qty * 170 + dist * 4),
        deadlineDay: day + 6 + Math.ceil(dist / 10),
        progress: 0,
      });
    }
  }
  return offers;
}


/** One line that describes a job, for the board and the station menu. */
export function describeContract(k: Contract, systems: StarSystem[]): string {
  const dest = systems[k.destination].name.toUpperCase();
  if (k.kind === 'cargo') return `Deliver ${k.qty}t ${COMMODITIES[k.commodity].name} to ${dest}`;
  if (k.kind === 'courier') return `Carry sealed data to ${dest}`;
  // The final line is the BOUNTY fallback, not a default. A kind with no line
  // of its own here reads as a pirate hunt, silently and wrongly.
  if (k.kind === 'passenger') {
    return `Carry ${k.qty} passenger${k.qty === 1 ? '' : 's'} to ${dest}`;
  }
  // Says what it is. The board never pretends a smuggling run is freight. The
  // player chooses to take the law on, and cannot choose what nobody told
  // them. `ui/screens.ts` marks the row amber to match.
  if (k.kind === 'smuggle') {
    return `Move ${k.qty}t ${COMMODITIES[k.commodity].name} to ${dest} — no questions asked`;
  }
  return `Destroy ${k.qty} pirates around ${dest}`;
}
