// Station bulletin-board contracts: what taking work costs your hold, what
// delivering it pays, and what failing it costs.
//
// What is ON the board, and how a job reads, is game/contract-offers.ts — the
// two left when docs/TODO/113's bill took the pair over the size ceiling, along
// the seam the tests had already found. What a station CHARGES is
// game/market.ts; those two were unrelated subjects sharing a name, and split
// when passenger work landed (docs/TODO/109).
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
import {
  cargoCapacity, cargoTonnes, formatCredits,
  type CommanderData, type Contract,
} from './commander.ts';
import type { SoundName } from './sounds.ts';
import { describeContract } from './contract-offers.ts';
import { MAX_CONTRACTS, PASSENGER_BERTH_TONNES } from '../constants/contracts.ts';
import {
  CHARACTER_LINE_SECONDS, DISREPUTE_CONTRABAND_SALE, DISREPUTE_SHORTED_CONSIGNMENT,
} from '../constants/character.ts';
import { afterDeed, characterVerdict } from './character.ts';


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
  /**
   * ...and the shipper charged you for the part you could not hand back
   * (docs/TODO/113). A new KIND rather than a field on `incomplete`, because a
   * new thing happened: money left the account and the name was marked. It
   * carries `reclaimed` as well so the ledger a failure feeds is the same one
   * whichever of the two lands — `tonnes` is what was missing, `reclaimed` what
   * was still aboard, and the two add up to the consignment.
   */
  | { kind: 'billed'; contract: Contract; reclaimed: number; tonnes: number; charged: number }
  | { kind: 'expired'; contract: Contract; reclaimed: number }
  | { kind: 'accepted'; contract: Contract }
  | { kind: 'refused'; reason: 'tooMuchWork' | 'noHoldSpace' }
  /**
   * Settling this lot moved your name onto a new rung of the Character ladder
   * (docs/TODO/129) — `line` is what to say about it, assembled by
   * `characterVerdict` rather than written out here.
   *
   * ONE per settlement, not one per job: a shorted consignment and a smuggling
   * run landed in the same breath are one visit to the counter, and the rung
   * you end on is the only one worth naming. It comes last, so the orchestrator
   * says it behind the receipts that caused it.
   */
  | { kind: 'character'; line: string };


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
 * Bill the commander for the tonnes that never arrived, and say what was taken
 * (docs/TODO/113).
 *
 * `basePrice * 4` is a tonne's base value in ledger tenths — the same scaling
 * `generateMarket` applies before its `/10` into whole credits
 * (`galaxy/galaxy.ts`). Base price rather than the local quote for two reasons:
 * `settleContracts` takes only the commander, so a local quote would mean
 * threading a market lookup through all three of its call sites into a function
 * whose purity is what invariant 10 is protecting; and the base is *below* what
 * a dear market pays, which is the leniency that keeps the robbed-by-pirates
 * case survivable — settlement cannot see WHY a hold is short, so it charges
 * the sold and the robbed alike and the gentleness has to live in the price.
 *
 * Capped at what the commander has, the shape `fineFor` uses (`law.ts`), so a
 * broke commander is never trapped: the cost is the credits, not the
 * impossibility. Spelled out here rather than imported, because this is the
 * shipper's invoice and not the Government's fine.
 */
function billShortfall(c: CommanderData, k: Contract, tonnes: number): number {
  const owed = tonnes * COMMODITIES[k.commodity].basePrice * 4;
  const charged = Math.min(c.credits, owed);
  c.credits -= charged;
  return charged;
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
 * landing a smuggling run marks the name exactly as a dirty market sale does,
 * and so does arriving short (docs/TODO/113). Being LATE does neither — that
 * is an honest failure, and 112 already priced it by taking the freight back.
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
  const wasNamed = c.disrepute ?? 0;
  for (const k of c.contracts) {
    const here = k.destination === c.systemIndex;
    const late = c.day > k.deadlineDay;
    if (here && !late && (k.kind !== 'bounty' || k.progress >= k.qty)) {
      if (k.kind === 'cargo' || k.kind === 'smuggle') {
        // the consignment must still be aboard — and a smuggling run is exactly
        // as voidable as freight, because what you sold at a better price on
        // the way is the temptation the job is built around
        if (c.cargo[k.commodity] < k.qty) {
          // What is still aboard goes back (112); what is not, you are billed
          // for and remembered for (113). The deed marks the act, not the
          // payment: a commander with nothing in the account pays nothing —
          // the cap says so — but spending down before docking must not launder
          // a shorted consignment into a free one.
          const reclaimed = reclaim(c, k);
          const tonnes = k.qty - reclaimed;
          const charged = billShortfall(c, k, tonnes);
          c.disrepute = afterDeed(c.disrepute ?? 0, DISREPUTE_SHORTED_CONSIGNMENT);
          events.push(charged > 0
            ? { kind: 'billed', contract: k, reclaimed, tonnes, charged }
            : { kind: 'incomplete', contract: k, reclaimed });
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
  const named = characterVerdict(wasNamed, c.disrepute ?? 0);
  if (named) events.push({ kind: 'character', line: named });
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
  /** hold it back until the console is free of the line it explains */
  queued?: boolean;
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
    case 'billed':
      // Says what was taken and what it was for, and names the goods ONCE —
      // this is an invoice from the shipper, not the station taking an interest
      // in what a smuggler was carrying. No sound of its own: it is the same
      // failure `incomplete` is, with a charge attached.
      return {
        text: `CONSIGNMENT SHORT — BILLED ${formatCredits(e.charged)} FOR `
          + `${e.tonnes}T ${COMMODITIES[e.contract.commodity].name.toUpperCase()}`
          + (e.reclaimed > 0 ? ` — ${e.reclaimed}T RECLAIMED` : ''),
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
    case 'character':
      // No sound: a name changing makes no noise (docs/TODO/129), and the
      // receipts it follows have already made theirs.
      return { text: e.line, seconds: CHARACTER_LINE_SECONDS, sound: null, queued: true };
  }
}

