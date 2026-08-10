// Station bulletin-board contracts: what work a station offers today, what
// taking it costs your hold, and what delivering it pays.
//
// What a station CHARGES is game/market.ts — the two halves of this file were
// unrelated subjects sharing a name, and it crossed the size ceiling when
// passenger work landed (docs/TODO/109).
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
import {
  cargoCapacity, cargoTonnes, formatCredits,
  type CommanderData, type Contract,
} from './commander.ts';
import type { SoundName } from './sounds.ts';
import {
  CONTRACT_RANGE, MAX_CONTRACTS, PASSENGER_BERTH_TONNES,
} from '../constants/contracts.ts';
import { ORDINARY_GOODS } from '../constants/commodities.ts';
import { CONTRABAND } from '../constants/law.ts';
import { DISREPUTE_CONTRABAND_SALE } from '../constants/character.ts';
import { afterDeed } from './character.ts';

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


// --- taking work, and being paid for it -------------------------------------
//
// These were `acceptContract` and `settleContracts`, two methods of game.ts —
// which is exactly what docs/INVARIANTS.md invariant 10 forbids, and it had already
// cost something: test/campaign.ts carried its own transcription of the
// settlement, so the balance harness was scoring rules that only resembled the
// shipped ones. It calls these now.
//
// Same shape as missions.ts, which is the in-repo precedent: pure, mutates the
// commander, and RETURNS what happened. The Game announces and plays it, because
// a HUD and an AudioContext are not something a headless career simulator has.

/**
 * What settling or accepting work did.
 *
 * A failed freight run carries `reclaimed`: the tonnage taken back off the ship
 * (docs/TODO/112). It is on the EVENT rather than being a new event kind,
 * because nothing new happened — the contract failed, exactly as before, and
 * the orchestrators have no consequence of their own to apply. But the number
 * cannot be recovered from the contract afterwards (the hold may have been
 * short), and both the HUD line and the campaign's ledger need it. Courier,
 * passenger and bounty work always reports 0.
 */
export type ContractEvent =
  | { kind: 'paid'; contract: Contract }
  /** delivered here, on time — but the goods are no longer aboard */
  | { kind: 'incomplete'; contract: Contract; reclaimed: number }
  | { kind: 'expired'; contract: Contract; reclaimed: number }
  | { kind: 'accepted'; contract: Contract }
  | { kind: 'refused'; reason: 'tooMuchWork' | 'noHoldSpace' };

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

/**
 * Take a failed consignment back off the ship, and say how much that was.
 *
 * The freight was never yours: the station supplied it at acceptance
 * (`acceptContract`) against a fee for carrying it, so a run that fails —
 * late, or short at the door — hands it back. Before docs/TODO/112 it stayed
 * in the hold and the trade screen sold it at the local quote, which made the
 * best job on the board one you never delivered: a 10t cargo run is ~470 Cr of
 * goods against a fee of ~79.
 *
 * `min`, not `qty`: goods are fungible and the hold keeps no per-contract
 * provenance, so a commander who bought more of the same commodity has in
 * effect covered the consignment, and one who sold it can only hand back what
 * is left. It is also what keeps the hold out of negative tonnage.
 *
 * Courier, passenger and bounty work carries nothing, so it reclaims nothing.
 */
function reclaim(c: CommanderData, k: Contract): number {
  if (k.kind !== 'cargo' && k.kind !== 'smuggle') return 0;
  const taken = Math.min(k.qty, c.cargo[k.commodity]);
  c.cargo[k.commodity] -= taken;
  return taken;
}

/**
 * Pay out anything delivered here, drop anything overdue, and take back the
 * freight that was riding on it (`reclaim`, docs/TODO/112).
 *
 * Mutates the commander's cargo, credits, DISREPUTE and contract list; the
 * surviving work stays on it. A bounty job standing at its destination with the
 * count unfilled is NOT settled and NOT dropped — you can come back to it until
 * the deadline, which is the one branch a re-implementation is most likely to
 * get wrong.
 *
 * Disrepute is the newest of those (docs/TODO/110) and worth saying out loud,
 * because the campaign's numbers move once settlement starts applying deeds:
 * landing a smuggling run marks the name exactly as a dirty market sale does.
 * The regional heat that goes with it is `LivingGalaxy` state this pure module
 * cannot see, so the orchestrators apply that from the `paid` event.
 *
 * Passengers need no branch of their own: they travel with the contract and
 * cannot be sold off en route the way a consignment can, so arriving in time
 * pays and arriving late expires — a courier run with luggage. Dropping the
 * contract is what frees their berths, because `cargoTonnes` reads the list.
 */
export function settleContracts(c: CommanderData): ContractEvent[] {
  const events: ContractEvent[] = [];
  const kept: Contract[] = [];
  for (const k of c.contracts) {
    const here = k.destination === c.systemIndex;
    const late = c.day > k.deadlineDay;
    if (here && !late && (k.kind !== 'bounty' || k.progress >= k.qty)) {
      if (k.kind === 'cargo' || k.kind === 'smuggle') {
        // the consignment must still be aboard — and a smuggling run is exactly
        // as voidable as freight, because what you sold at a better price on
        // the way is the temptation the job is built around
        if (c.cargo[k.commodity] < k.qty) {
          events.push({ kind: 'incomplete', contract: k, reclaimed: reclaim(c, k) });
          continue;
        }
        c.cargo[k.commodity] -= k.qty;
      }
      c.credits += k.reward;
      if (k.kind === 'smuggle') {
        c.disrepute = afterDeed(c.disrepute ?? 0, DISREPUTE_CONTRABAND_SALE);
      }
      events.push({ kind: 'paid', contract: k });
      continue;
    }
    if (late) {
      events.push({ kind: 'expired', contract: k, reclaimed: reclaim(c, k) });
      continue;
    }
    kept.push(k);
  }
  c.contracts = kept;
  return events;
}

/**
 * Take the offer at `index` off the board.
 *
 * Mutates the commander (a cargo or smuggling run loads the consignment on the
 * spot) and
 * splices the accepted job out of `offers`. A refusal changes nothing at all,
 * which is what lets the caller treat it as a refusal.
 */
export function acceptContract(
  c: CommanderData, offers: Contract[], index: number,
): ContractEvent[] {
  const k = offers[index];
  if (!k) return [];
  if (c.contracts.length >= MAX_CONTRACTS) {
    return [{ kind: 'refused', reason: 'tooMuchWork' }];
  }
  // A smuggling run loads like freight, and that is the whole mechanism: from
  // the next line on `carryingContraband` is true, so the police scan, the
  // pirates' appetite and the hermit outlet all apply without a word of new code.
  if (k.kind === 'cargo' || k.kind === 'smuggle') {
    if (cargoTonnes(c) + k.qty > cargoCapacity(c)) {
      return [{ kind: 'refused', reason: 'noHoldSpace' }];
    }
    c.cargo[k.commodity] += k.qty;
  }
  if (k.kind === 'passenger') {
    // Berths compete with freight for the same bays, which is the point of the
    // work. Nothing is loaded: the berths follow from the contract once it is
    // on the list, so `cargoTonnes` charges for them from the next line on.
    if (cargoTonnes(c) + k.qty * PASSENGER_BERTH_TONNES > cargoCapacity(c)) {
      return [{ kind: 'refused', reason: 'noHoldSpace' }];
    }
  }
  c.contracts.push(k);
  offers.splice(index, 1);
  return [{ kind: 'accepted', contract: k }];
}

/**
 * What to put on the HUD, and what to play, for one contract event.
 *
 * Phrasing lives beside the rule and away from the AudioContext, the same way
 * `trumbleMessage` and `ordnanceMessage` do. Sound construction belongs to
 * audio.ts; this message carries only the occasion.
 */
export interface ContractMessage {
  text: string;
  seconds: number;
  sound: SoundName | null;
}

/**
 * What the station took back, if anything — the tail of a failure message.
 *
 * Read off the event's own tonnage rather than the contract's, because a run
 * that arrived short hands back what is there and not what was owed. A job
 * carrying nothing (courier, passenger, bounty) and a hold with nothing left in
 * it both reclaim 0, and say nothing: the line must not claim a seizure that
 * did not happen.
 */
function reclaimedClause(e: { contract: Contract; reclaimed: number }): string {
  if (e.reclaimed <= 0) return '';
  return ` — ${e.reclaimed}T ${COMMODITIES[e.contract.commodity].name.toUpperCase()} RECLAIMED`;
}

export function contractMessage(e: ContractEvent, systems: StarSystem[]): ContractMessage {
  switch (e.kind) {
    case 'paid':
      return {
        text: `CONTRACT PAID: ${formatCredits(e.contract.reward)}`,
        seconds: 5,
        sound: 'contractPaid',
      };
    case 'incomplete':
      return {
        text: `CONSIGNMENT INCOMPLETE — CONTRACT VOID${reclaimedClause(e)}`,
        seconds: 5,
        sound: null,
      };
    case 'expired':
      return {
        text: `CONTRACT EXPIRED${reclaimedClause(e)}`,
        seconds: 4,
        sound: 'contractExpired',
      };
    case 'accepted':
      return {
        text: `ACCEPTED: ${describeContract(e.contract, systems).toUpperCase()}`,
        seconds: 4,
        sound: 'contractAccepted',
      };
    case 'refused':
      return {
        text: e.reason === 'tooMuchWork'
          ? 'YOU ARE CARRYING ENOUGH WORK ALREADY'
          : 'NOT ENOUGH HOLD SPACE FOR THAT CONSIGNMENT',
        seconds: 3,
        sound: 'refused',
      };
  }
}

