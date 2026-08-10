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
// here touches `cargo`, so nothing about a rescue can ever read as smuggling.

import type { CommanderData } from './commander.ts';

/** What the answer did — the orchestrator says it and applies the rest. */
export type SurvivorEvent =
  /** handed to station medical: no payment, no mark, no questions */
  | { kind: 'handed'; people: number };

/**
 * Hand them over: the crew spaces are clear, and that is the whole of it.
 *
 * It pays nothing and costs nothing, which is the point — being decent is its
 * own reward, and paying for it would make it a trade (docs/TODO/127). It is
 * the only answer that leaves your Character where it was.
 *
 * Resolved once for however many people are aboard: the message pluralises,
 * nothing in the fiction distinguishes them, and three prompts in a row would
 * be tedium rather than a decision.
 *
 * @returns null when there was nobody to decide about, so no caller can
 * announce a rescue that did not happen.
 */
export function handOverSurvivors(c: CommanderData): SurvivorEvent | null {
  const people = c.survivors;
  if (people <= 0) return null;
  c.survivors = 0;
  return { kind: 'handed', people };
}

/** What the console says about it. Phrasing beside the rule, as ever. */
export function survivorMessage(e: SurvivorEvent): string {
  return `${e.people} SURVIVOR${e.people > 1 ? 'S' : ''} HANDED TO STATION MEDICAL`;
}
