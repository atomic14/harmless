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
    // One roll cuts all four kinds, so any re-cut moves every seeded board —
    // cargo and courier gave up the slice passengers occupy and bounty kept
    // its 0.2, because a bulletin board that stops offering fights changes the
    // combat ladder as well as the ledger.
    if (roll < 0.45) {
      // cargo run: they supply the goods, you supply the nerve
      const commodity = ORDINARY_GOODS[Math.floor(rng() * ORDINARY_GOODS.length)];
      const qty = 3 + Math.floor(rng() * 8);
      offers.push({
        kind: 'cargo',
        destination: dest.index,
        commodity,
        qty,
        reward: Math.round(qty * (22 + dist * 1.6) + 90),
        deadlineDay: day + 4 + Math.ceil(dist / 12),
        progress: 0,
      });
    } else if (roll < 0.65) {
      offers.push({
        kind: 'courier',
        destination: dest.index,
        commodity: 0,
        qty: 0,
        reward: Math.round(240 + dist * 6.0),
        deadlineDay: day + 3 + Math.ceil(dist / 16),
        progress: 0,
      });
    } else if (roll < 0.8) {
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

/** What settling or accepting work did. */
export type ContractEvent =
  | { kind: 'paid'; contract: Contract }
  /** delivered here, on time — but the goods are no longer aboard */
  | { kind: 'incomplete'; contract: Contract }
  | { kind: 'expired'; contract: Contract }
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
  return `Destroy ${k.qty} pirates around ${dest}`;
}

/**
 * Pay out anything delivered here, and drop anything overdue.
 *
 * Mutates the commander's cargo, credits and contract list; the surviving work
 * stays on it. A bounty job standing at its destination with the count unfilled
 * is NOT settled and NOT dropped — you can come back to it until the deadline,
 * which is the one branch a re-implementation is most likely to get wrong.
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
      if (k.kind === 'cargo') {
        // the consignment must still be aboard
        if (c.cargo[k.commodity] < k.qty) {
          events.push({ kind: 'incomplete', contract: k });
          continue;
        }
        c.cargo[k.commodity] -= k.qty;
      }
      c.credits += k.reward;
      events.push({ kind: 'paid', contract: k });
      continue;
    }
    if (late) {
      events.push({ kind: 'expired', contract: k });
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
 * Mutates the commander (a cargo run loads the consignment on the spot) and
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
  if (k.kind === 'cargo') {
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

export function contractMessage(e: ContractEvent, systems: StarSystem[]): ContractMessage {
  switch (e.kind) {
    case 'paid':
      return {
        text: `CONTRACT PAID: ${formatCredits(e.contract.reward)}`,
        seconds: 5,
        sound: 'contractPaid',
      };
    case 'incomplete':
      return { text: 'CONSIGNMENT INCOMPLETE — CONTRACT VOID', seconds: 5, sound: null };
    case 'expired':
      return { text: 'CONTRACT EXPIRED', seconds: 4, sound: 'contractExpired' };
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

