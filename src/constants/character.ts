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
/**
 * Selling illicit goods over a market counter, or landing a consignment of them
 * no-questions-asked (`game/contracts.ts`).
 *
 * Its own rule id since docs/TODO/113: it shares the value 5 with
 * `DISREPUTE_SHORTED_CONSIGNMENT` below and the two must stay free to move
 * apart — this one prices a deal made with a smuggler, that one a promise
 * broken to a shipper.
 *
 * @rule character.disreputeContrabandSale
 */
export const DISREPUTE_CONTRABAND_SALE = 5;

/**
 * Arriving at the far end without the consignment you were entrusted with
 * (docs/TODO/113). The credits half of that is the shipper's invoice, billed in
 * `game/contracts.ts`; this is the half that sticks to the name.
 *
 * The same 5 as a dirty market sale, and for the same reason: one shorted job
 * is a bad week — you were robbed, or you were greedy once — and only a habit
 * of them is a reputation. A career-marker like a hermit kill at 40 would take
 * a single unlucky run from Honest most of the way to Dubious, and settlement
 * cannot tell an unlucky run from a sold one (nothing records *why* a hold is
 * short), so the value has to be one an honest trader can absorb.
 *
 * Its own rule id: it shares the value 5 with `DISREPUTE_CONTRABAND_SALE`
 * above and the two must stay free to move apart — that one prices a deal made
 * with a smuggler, this one prices a promise broken to a shipper.
 *
 * Owner confirmed as character.ts rather than the board: this is what the deed
 * does to the NAME, and it decays with every other deed here. The board owns
 * what the job itself is worth, the mirror of the note on
 * `SMUGGLE_DELIVERY_NOTORIETY` (constants/contracts.ts).
 *
 * @rule character.disreputeShortedConsignment
 */
export const DISREPUTE_SHORTED_CONSIGNMENT = 5;

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
