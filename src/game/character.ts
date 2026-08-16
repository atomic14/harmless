// Your character, as a rule: the rung a disrepute score earns, and how a deed
// or a quiet week moves it.
//
// The player's word for this ladder is REPUTATION, and every screen and console
// line says that (docs/TODO/162). `character` is the code's word, and it names
// this module, its constants and its tests.
//
// The one home for the character reputation, the way `rating.ts` owns the combat
// ladder and `law.ts` owns your legal standing. The numbers are `constants/
// character.ts`; this is the arithmetic that reads and moves them. It touches no
// world state — a caller applies the result to the commander — so the trainer's
// clone and a headless campaign can ask the same questions the game does.

import {
  CHARACTER, DISREPUTE_DECAY, DISREPUTE_MAX,
} from '../constants/character.ts';

/**
 * What a disrepute score is CALLED — the highest rung of the ladder it clears.
 * Honest at 0, and the default for anything below the first threshold.
 */
export function characterRung(disrepute: number): string {
  let earned = CHARACTER[0][1];
  for (const [threshold, rung] of CHARACTER) {
    if (disrepute >= threshold) earned = rung;
  }
  return earned;
}

/**
 * The rung a move onto `after` put you on, or null when it stayed inside the
 * one you were already on.
 *
 * `characterRung` twice and nothing else, so a crossing cannot disagree with
 * the label the status screen prints — the same bargain `recordVerdict`
 * (law.ts) strikes with `lawTakesInterest`. It reads both directions: the
 * decay crosses rungs downward, and a reputation that fades is the one piece of
 * good news the character system has.
 */
export function rungCrossed(before: number, after: number): string | null {
  const rung = characterRung(after);
  return characterRung(before) === rung ? null : rung;
}

/**
 * ...in the console line, or null when nothing happened worth saying.
 *
 * The ONE phrasing of it, for the seven deeds and the decay that all owe the
 * player the same sentence. Only crossings speak: the score itself stays out
 * of the cockpit (test mode shows the number), because the ladder is the
 * interface and a running commentary on a hidden number is not.
 *
 * **It says which WAY it moved** (docs/TODO/162). A rung name alone is a word
 * the player has never met. `DUBIOUS` does not say whether it is good news, and
 * the decay crosses rungs downward. So the line carries a short clause that a
 * first-time pilot can read without a manual.
 *
 * The clause is deliberately about talk rather than about a rule. What a rung
 * COSTS differs by rung — a hermit refuses at Dodgy and not at Dubious — so a
 * clause that named a consequence would be false at some of the six.
 */
export function characterVerdict(before: number, after: number): string | null {
  const rung = rungCrossed(before, after);
  if (rung === null) return null;
  const worse = after > before;
  return `REPUTATION: ${rung.toUpperCase()} — WORD IS ${worse ? 'GETTING ROUND' : 'DYING DOWN'}`;
}

/**
 * A disrepute score after a deed of `delta` — never below Honest, never past
 * the ceiling, so neither a good week nor a bad career can run the bar away.
 */
export function afterDeed(disrepute: number, delta: number): number {
  return Math.max(0, Math.min(DISREPUTE_MAX, disrepute + delta));
}

/**
 * A disrepute score after `days` of the galaxy forgetting. Never below Honest;
 * a non-positive or non-finite span (a paused tab, a rewound clock) does
 * nothing.
 */
export function afterDecay(disrepute: number, days: number): number {
  if (!(days > 0)) return disrepute;
  return Math.max(0, disrepute - DISREPUTE_DECAY * days);
}
