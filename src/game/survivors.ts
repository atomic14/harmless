// What becomes of the people you pulled out of the escape capsules.
//
// The rule, not the screen: `screens/survivors.ts` asks the question and this
// answers it, so the campaign harness and a test can drive the same decision a
// player makes with a keyboard (invariant 10). It mutates the commander and
// RETURNS what happened, the shape `settleContracts` uses, because the
// consequences that reach outside the commander — the region's temperature, the
// Government's opinion — are the orchestrator's to apply (invariant 15).
//
// A SURVIVOR IS NOT CARGO and must not become cargo (docs/TODO/108). Nothing
// here touches `cargo`: selling one is a TRANSACTION, not a hold operation, so
// a full hold can still make the sale and no rescue can ever read as smuggling.

import type { CommanderData } from './commander.ts';
import { afterDeed } from './character.ts';
import { formatCredits } from './commander.ts';
import { priceInTenths } from './market.ts';
import {
  DISREPUTE_SLAVE_SALE, DISREPUTE_SURVIVOR_RELEASED,
} from '../constants/character.ts';
import { SURVIVOR_RELEASE_SHARE } from '../constants/survivors.ts';

/** The three answers to "there is somebody in your crew spaces". */
export type SurvivorChoice = 'medical' | 'sold' | 'released';

/** What the answer did — the orchestrator says it and applies the rest. */
export type SurvivorEvent =
  /** handed to station medical: no payment, no mark, no questions */
  | { kind: 'handed'; people: number }
  /** sold on the Slaves row: paid, and the name pays too */
  | { kind: 'sold'; people: number; paid: number }
  /** paid to look the other way and let them walk */
  | { kind: 'released'; people: number; paid: number };

/**
 * What the two dirty answers are worth HERE, in tenths of a credit
 * (invariant 8).
 *
 * The market's own Slaves quote, per person, rather than a price of this
 * feature's own: `commodity 3` already has a figure at every station, and
 * reading it is what makes selling a person in a Feudal system pay differently
 * from a Democracy. The release is `SURVIVOR_RELEASE_SHARE` of the sale, so the
 * two move together and the dirtier answer always pays better.
 *
 * @param quote the local price of a tonne of Slaves, as the market states it
 */
export function survivorOffers(
  people: number, quote: number,
): { sale: number; release: number } {
  const sale = people * priceInTenths(quote);
  return { sale, release: Math.round(sale * SURVIVOR_RELEASE_SHARE) };
}

/**
 * Resolve the choice: clear the crew spaces, and say what that was.
 *
 * Called once for however many people are aboard — the message pluralises,
 * nothing in the fiction distinguishes them, and three prompts in a row would
 * be tedium rather than a decision (docs/TODO/127).
 *
 * **HAND THEM OVER pays nothing and costs nothing**, which is the point: being
 * decent is its own reward, and paying for it would make it a trade. It is the
 * only one of the three that leaves your Character where it was.
 *
 * The other two are priced by `survivorOffers` and marked by the ladder's own
 * constants. Neither touches the RECORD — that is the law's half, and the
 * orchestrator applies it from the event (docs/TODO/127 M3).
 *
 * @returns null when there was nobody to decide about, so no caller can
 * announce a rescue that did not happen.
 */
export function resolveSurvivors(
  c: CommanderData, choice: SurvivorChoice, offers: { sale: number; release: number },
): SurvivorEvent | null {
  const people = c.survivors;
  if (people <= 0) return null;
  c.survivors = 0;
  if (choice === 'medical') return { kind: 'handed', people };

  const sold = choice === 'sold';
  const paid = sold ? offers.sale : offers.release;
  c.credits += paid;
  c.disrepute = afterDeed(c.disrepute ?? 0,
    sold ? DISREPUTE_SLAVE_SALE : DISREPUTE_SURVIVOR_RELEASED);
  return { kind: sold ? 'sold' : 'released', people, paid };
}

/** What the console says about it. Phrasing beside the rule, as ever. */
export function survivorMessage(e: SurvivorEvent): string {
  const many = e.people > 1 ? 'S' : '';
  if (e.kind === 'handed') return `${e.people} SURVIVOR${many} HANDED TO STATION MEDICAL`;
  if (e.kind === 'sold') {
    return `${e.people} SOLD ON THE SLAVE ROW — ${formatCredits(e.paid)}`;
  }
  return `${e.people} PAID TO WALK AWAY — ${formatCredits(e.paid)}`;
}
