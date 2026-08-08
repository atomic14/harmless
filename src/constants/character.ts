// Your CHARACTER: the reputation for dirty dealing that clings to a name after
// the fine is paid. Distinct from `rating.ts` (how DANGEROUS you are) and
// `law.ts` (your standing with the Government right now, which money clears).
// A score shady deeds raise and time erodes, read off the ladder below by
// `game/character.ts`.

/**
 * The character ladder: disrepute score, lowest first, and the name it earns.
 * Honest is the top rung and default. `characterName` reads it the way
 * `rating()` reads `RATINGS`; `test/economy.test.ts` bisects the rungs back out.
 */
export const CHARACTER: readonly (readonly [number, string])[] = [
  [0, 'Honest'],
  [10, 'Dubious'],
  [25, 'Dodgy'],
  [50, 'Shady'],
  [80, 'Notorious'],
  [120, 'Cutthroat'],
];

/**
 * What each deed adds to disrepute; tuned in play. A hermit or a murder is
 * career-marking (one takes Honest clear to Dodgy); getting caught or a dirty
 * sale is a nudge that only adds up over a run of them.
 */
export const DISREPUTE_HERMIT_KILL = 40;
export const DISREPUTE_MURDER = 40;
export const DISREPUTE_CAUGHT = 10;
export const DISREPUTE_CONTRABAND_SALE = 5;

/**
 * How fast disrepute fades, per day — slower than the galaxy's `HEAT_DECAY`: a
 * cargo is forgotten in days, a reputation is not.
 */
export const DISREPUTE_DECAY = 1.5;

/**
 * The ceiling, so a lifetime of villainy cannot run the score away past what a
 * season of clean living can undo. A little past Cutthroat.
 */
export const DISREPUTE_MAX = 160;
