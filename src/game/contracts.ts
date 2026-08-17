// Station bulletin-board contracts: what taking work costs your hold, what
// delivering it pays, and what failing it costs.
//
// What is ON the board, and how a job reads, is game/contract-offers.ts. The
// two split when docs/TODO/113's bill took the pair over the size ceiling,
// along the seam the tests already found.
//
// What a station CHARGES is game/market.ts. Those two were unrelated subjects
// that shared a name, and they split when passenger work landed
// (docs/TODO/109).
//
// Pure functions, deliberately free of three.js and DOM. So both the game
// (src/game/game.ts) and the headless campaign simulator (test/campaign.ts) run
// the *same* rules. A balance test that mirrored the logic rather than called
// it would be worthless.
//
// Erasable-TypeScript only: Node runs this directly via
// --experimental-strip-types.

// .ts extension: this module is run directly by Node (--experimental-strip-types)
// for the campaign simulator, and COMMODITIES is a value import, not a type.
import { COMMODITIES, type StarSystem } from '../galaxy/galaxy.ts';
import {
  cargoCapacity, cargoTonnes, formatCredits,
  type CommanderData, type ConsignmentContract, type Contract,
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
// These were `acceptContract` and `settleContracts`, two methods of game.ts.
// That is exactly what docs/INVARIANTS.md invariant 10 forbids, and it cost
// something. test/campaign.ts carried its own transcription of the
// settlement, so the balance harness scored rules that only resembled the
// shipped ones. It calls these now.
//
// Same shape as missions.ts, which is the in-repo precedent: pure, mutates the
// commander, and RETURNS what happened. The Game announces and plays it, because
// a HUD and an AudioContext are not something a headless career simulator has.

/**
 * What settling or accepting work did.
 *
 * A failed freight run carries `reclaimed`, which is the tonnage taken back off
 * the ship (docs/TODO/112).
 *
 * It is on the EVENT rather than a new event kind, because nothing new
 * happened. The contract failed, exactly as before, and the orchestrators have
 * no consequence of their own to apply.
 *
 * But the number cannot be recovered from the contract afterwards, because the
 * hold may be short. Both the HUD line and the campaign's ledger need it.
 * Courier, passenger and bounty work always reports 0.
 */
export type ContractEvent =
  | { kind: 'paid'; contract: Contract }
  /** delivered here, on time — but the goods are no longer aboard */
  | { kind: 'incomplete'; contract: ConsignmentContract; reclaimed: number }
  /**
   * ...and the shipper charged you for the part you could not hand back
   * (docs/TODO/113). It is a new KIND rather than a field on `incomplete`,
   * because a new thing happened. Money left the account, and the reputation was
   * marked.
   *
   * It carries `reclaimed` as well, so the ledger a failure feeds is the same
   * one whichever of the two lands. `tonnes` is what was missing, `reclaimed`
   * is what was still aboard, and the two add up to the consignment.
   */
  | {
    kind: 'billed'; contract: ConsignmentContract;
    reclaimed: number; tonnes: number; charged: number;
  }
  | { kind: 'expired'; contract: Contract; reclaimed: number }
  | { kind: 'accepted'; contract: Contract }
  | { kind: 'refused'; reason: 'tooMuchWork' | 'noHoldSpace' }
  /**
   * This lot settled moved your reputation onto a new rung of the character ladder
   * (docs/TODO/129). `line` is what to say about it, assembled by
   * `characterVerdict` rather than written out here.
   *
   * ONE per settlement, and not one per job. A shorted consignment and a
   * smuggling run landed in the same breath are one visit to the counter. The
   * rung you end on is the only one worth naming. It comes last, so the
   * orchestrator says it behind the receipts that caused it.
   */
  | { kind: 'character'; line: string };


/**
 * Take a failed consignment back off the ship, and say how much that was.
 *
 * The freight was never yours. The station supplied it at acceptance
 * (`acceptContract`), against a fee for the carriage. So a run that fails hands
 * it back, whether it is late or short at the door.
 *
 * Before docs/TODO/112 it stayed in the hold, and the trade screen sold it at
 * the local quote. That made the best job on the board one you never delivered.
 * A 10t cargo run is about 470 Cr of goods, against a fee of about 79.
 *
 * `min`, and not `qty`. Goods are fungible, and the hold keeps no per-contract
 * provenance. So a commander who bought more of the same commodity has in
 * effect covered the consignment. One who sold it can only hand back what is
 * left. It is also what keeps the hold out of negative tonnage.
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
 * `basePrice * 4` is a tonne's base value in ledger tenths. It is the same
 * scaling `generateMarket` applies before its `/10` into whole credits
 * (`galaxy/galaxy.ts`).
 *
 * It is the base price rather than the local quote, for two reasons.
 * `settleContracts` takes only the commander. A local quote would thread a
 * market lookup through all three of its call sites, into a function whose
 * purity is what invariant 10 protects.
 *
 * The base is also *below* what a dear market pays, and that leniency is what
 * keeps the robbed-by-pirates case survivable. Settlement cannot see WHY a hold
 * is short. It charges the sold and the robbed alike, so the gentleness has to
 * live in the price.
 *
 * Capped at what the commander has, the shape `fineFor` uses (`law.ts`). So a
 * broke commander is never trapped. The cost is the credits, and not the
 * impossibility. It is spelled out here rather than imported, because this is
 * the shipper's invoice and not the Government's fine.
 */
function billShortfall(
  c: CommanderData, k: ConsignmentContract, tonnes: number,
): number {
  const owed = tonnes * COMMODITIES[k.commodity].basePrice * 4;
  const charged = Math.min(c.credits, owed);
  c.credits -= charged;
  return charged;
}

/**
 * Pay out anything delivered here, drop anything overdue, and take back the
 * freight that was riding on it (`reclaim`, docs/TODO/112).
 *
 * It mutates the commander's cargo, credits, DISREPUTE and contract list, and
 * the surviving work stays on it.
 *
 * A bounty job at its destination with the count unfilled is NOT settled and
 * NOT dropped. You can come back to it until the deadline. That is the one
 * branch a re-implementation is most likely to get wrong.
 *
 * Disrepute is the newest of those (docs/TODO/110), and it is worth saying out
 * loud. The campaign's numbers move once settlement applies deeds. A smuggling
 * run landed marks the reputation exactly as a dirty market sale does, and so does an
 * arrival short (docs/TODO/113).
 *
 * LATE does neither. That is an honest failure, and 112 already priced it by
 * taking the freight back. The regional heat that goes with it is
 * `LivingGalaxy` state this pure module cannot see, so the orchestrators apply
 * that from the `paid` event.
 *
 * Passengers need no branch of their own. They travel with the contract, and
 * cannot be sold off en route the way a consignment can. So an arrival in time
 * pays, and an arrival late expires. It is a courier run with luggage. The
 * contract dropped is what frees their berths, because `cargoTonnes` reads the
 * list.
 */
export function settleContracts(c: CommanderData): ContractEvent[] {
  const events: ContractEvent[] = [];
  const kept: Contract[] = [];
  const wasDisrepute = c.disrepute ?? 0;
  for (const k of c.contracts) {
    const here = k.destination === c.systemIndex;
    const late = c.day > k.deadlineDay;
    if (here && !late && (k.kind !== 'bounty' || k.progress >= k.qty)) {
      if (k.kind === 'cargo' || k.kind === 'smuggle') {
        // The consignment must still be aboard. A smuggling run is exactly as
        // voidable as freight. What you sold at a better price on the way is
        // the temptation the job is built around.
        if (c.cargo[k.commodity] < k.qty) {
          // What is still aboard goes back (112). What is not, you are billed
          // for and remembered for (113). The deed marks the act rather than
          // the payment. A commander with nothing in the account pays nothing,
          // because the cap says so. But a spend-down before the dock must not
          // launder a shorted consignment into a free one.
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
  const verdict = characterVerdict(wasDisrepute, c.disrepute ?? 0);
  if (verdict) events.push({ kind: 'character', line: verdict });
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
  // A smuggling run loads like freight, and that is the whole mechanism. From
  // the next line on, `carryingContraband` is true. So the police scan, the
  // pirates' appetite and the hermit outlet all apply, with no new code.
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
 * Read off the event's own tonnage rather than the contract's. A run that
 * arrived short hands back what is there, and not what was owed.
 *
 * A job that carries nothing — courier, passenger, bounty — reclaims 0. So does
 * a hold with nothing left in it. Both say nothing, because the line must not
 * claim a seizure that did not happen.
 */
function reclaimedClause(e: { contract: Contract; reclaimed: number }): string {
  // The type now says what the comment above said (docs/TODO/185 M1). Only a
  // consignment loads goods, so only a consignment hands any back. This guard
  // is the one that gives the line a `commodity` to name.
  const k = e.contract;
  if (k.kind !== 'cargo' && k.kind !== 'smuggle') return '';
  if (e.reclaimed <= 0) return '';
  return ` — ${e.reclaimed}T ${COMMODITIES[k.commodity].name.toUpperCase()} RECLAIMED`;
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
      // It says what was taken and what it was for, and names the goods ONCE.
      // This is an invoice from the shipper. It is not the station taking an
      // interest in what a smuggler carried. It has no sound of its own,
      // because it is the same failure `incomplete` is, with a charge on it.
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
      // No sound. A change of reputation makes no noise (docs/TODO/129), and the
      // receipts it follows already made theirs.
      return { text: e.line, seconds: CHARACTER_LINE_SECONDS, sound: null, queued: true };
  }
}

