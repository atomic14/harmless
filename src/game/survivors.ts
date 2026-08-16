// What becomes of the people you pulled out of the escape capsules.
//
// The rule, not the screen. `screens/survivors.ts` asks the question, and this
// file answers it. So the campaign harness and a test drive the same decision
// a player makes with a keyboard (invariant 10).
//
// It mutates the commander, and RETURNS what happened, in the shape
// `settleContracts` uses. Two consequences reach outside the commander: the
// region's temperature, and the Government's opinion. Both are the
// orchestrator's to apply (invariant 15).
//
// A SURVIVOR IS NOT CARGO, and must not become cargo (docs/TODO/108). Nothing
// here touches `cargo`. A sale is a TRANSACTION rather than a hold operation.
// So a full hold can still make the sale, and no rescue can ever read as a
// smuggling run.

import type { CommanderData } from './commander.ts';
import { afterDeed } from './character.ts';
import { formatCredits } from './commander.ts';
import { priceInTenths, saleFallout } from './market.ts';
import {
  DISREPUTE_SLAVE_SALE, DISREPUTE_SURVIVOR_RELEASED,
} from '../constants/character.ts';
import { SLAVES } from '../constants/commodities.ts';
import { OFFENDER } from '../constants/law.ts';
import { SURVIVOR_RELEASE_SHARE, SURVIVOR_SALE_TONNES } from '../constants/survivors.ts';

/** The three answers to "there is somebody in your crew spaces". */
export type SurvivorChoice = 'medical' | 'sold' | 'released';

/** What the answer did — the orchestrator says it and applies the rest. */
export type SurvivorEvent =
  /** handed to station medical: no payment, no mark, no questions */
  | { kind: 'handed'; people: number }
  /**
   * Sold on the Slaves row: paid, and the name pays too — plus the two the
   * orchestrator applies, because neither is the commander's own field.
   *
   * `heat` is what the region makes of it. `offence` is what the Government
   * does. Both are decided here, so that the pure rule stays the one home of
   * "a sale of a person is a crime" (invariant 15).
   */
  | { kind: 'sold'; people: number; paid: number; heat: number; offence: number }
  /** paid to look the other way and let them walk */
  | { kind: 'released'; people: number; paid: number };

/**
 * What the two dirty answers are worth HERE, in tenths of a credit
 * (invariant 8).
 *
 * The market's own Slaves quote, per person, rather than a price of this
 * feature's own. `commodity 3` already has a figure at every station. A read of
 * that figure is what makes a sale in a Feudal system pay differently from one
 * in a Democracy.
 *
 * The release is `SURVIVOR_RELEASE_SHARE` of the sale. So the two move
 * together, and the dirtier answer always pays better.
 *
 * `SURVIVOR_SALE_TONNES` is what a PERSON is worth on that row. It is what
 * makes the sale a choice rather than a mistake. At one tonne each the deed
 * paid 2–16 Cr, and filed a record that costs 25 Cr to clear. So it was never
 * the answer anywhere. The constant carries the measurement, and the floor it
 * argues.
 *
 * @param quote the local price of a tonne of Slaves, as the market states it
 */
export function survivorOffers(
  people: number, quote: number,
): { sale: number; release: number } {
  const sale = people * priceInTenths(quote) * SURVIVOR_SALE_TONNES;
  return { sale, release: Math.round(sale * SURVIVOR_RELEASE_SHARE) };
}

/**
 * Resolve the choice: clear the crew spaces, and say what that was.
 *
 * The caller calls it once, for however many people are aboard. The message
 * pluralises. Nothing in the fiction separates one person from another. Three
 * prompts in a row would be tedium rather than a decision (docs/TODO/127).
 *
 * **HAND THEM OVER pays nothing and costs nothing**, and that is the point. A
 * decent act is its own reward. A payment for it would make it a trade. It is
 * the only one of the three that leaves your Character where it was.
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
  if (!sold) return { kind: 'released', people, paid };

  // THE LAW'S HALF (docs/TODO/127 M3). A sale is a CONTRABAND SALE like any
  // other. So what it does to the region is `saleFallout`'s rule, and not a
  // second copy of one. It is the same call the market counter makes, on the
  // same row, at the price this one fetched.
  //
  // Its `disrepute` term is deliberately NOT added on top. That term is what a
  // tonne of narcotics costs a name. `DISREPUTE_SLAVE_SALE` is what a PERSON
  // costs one. Both together would price the same deed twice under two names.
  //
  // OFFENDER, not Fugitive. A lawful ship destroyed is what makes a Fugitive
  // (`offenceFor`). A sale made over a counter must not outrank a murder.
  return {
    kind: 'sold', people, paid,
    heat: saleFallout(SLAVES, people, paid).notoriety,
    offence: OFFENDER,
  };
}

/** What the console says about it. The words sit beside the rule, as ever. */
export function survivorMessage(e: SurvivorEvent): string {
  const many = e.people > 1 ? 'S' : '';
  if (e.kind === 'handed') return `${e.people} SURVIVOR${many} HANDED TO STATION MEDICAL`;
  if (e.kind === 'sold') {
    return `${e.people} SOLD ON THE SLAVE ROW — ${formatCredits(e.paid)}`;
  }
  return `${e.people} PAID TO WALK AWAY — ${formatCredits(e.paid)}`;
}
