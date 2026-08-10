// Your CHARACTER: the reputation for dirty dealing that clings to a name after
// the fine is paid. Distinct from `rating.ts` (how DANGEROUS you are) and
// `law.ts` (your standing with the Government right now, which money clears).
// A score shady deeds raise and time erodes — a dirty sale, a shorted
// consignment, a bribe pressed on a policeman — read off the ladder below by
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
 * Selling somebody you pulled out of an escape capsule (docs/TODO/127).
 *
 * The deed the ladder was built for, and priced with the other career-marker:
 * one takes an Honest commander clear to Dodgy, which is what a rescue turned
 * into a transaction ought to be worth. That it equals `DISREPUTE_HERMIT_KILL`
 * is the statement — cracking a hermit for his ore and selling a rescued pilot
 * are the same order of thing.
 *
 * Its own rule id: it shares the value 40 with `DISREPUTE_HERMIT_KILL` and
 * `DISREPUTE_MURDER` above, and the three must stay free to move apart. This
 * one is the only one of them a station counter will process.
 *
 * Owner confirmed as character.ts rather than the survivors file the catalogue
 * prefers: constants/survivors.ts prices the TRANSACTION, and every mark on the
 * name lives here beside the ladder that reads it and the decay that erodes it
 * (docs/TODO/127 says so in as many words).
 *
 * @rule character.disreputeSlaveSale
 */
export const DISREPUTE_SLAVE_SALE = 40;

/**
 * Taking money to let one go instead (docs/TODO/127).
 *
 * A quarter of the sale, because it is a different deed and not a discount on
 * the same one: you are not selling a person, you are declining to file one,
 * and what is left is that you were paid for it. `DISREPUTE_CAUGHT`-scale — a
 * nudge that only adds up over a habit of them, which is the shape every deed
 * on this ladder that is not career-marking has.
 *
 * Its own rule id: it shares the value 10 with `DISREPUTE_CAUGHT` above, which
 * prices being read by a police scan, and with the ladder's own Dubious
 * threshold, which is not a deed at all.
 *
 * Owner confirmed as character.ts, for `DISREPUTE_SLAVE_SALE`'s reason above.
 *
 * @rule character.disreputeSurvivorReleased
 */
export const DISREPUTE_SURVIVOR_RELEASED = 10;

/**
 * Buying a policeman: what the offer adds to disrepute whether he takes it or
 * refuses it (`game/law.ts`, docs/TODO/123).
 *
 * More than being CAUGHT, which is the only comparison that matters. Being
 * scanned costs you the record, the fine and everybody the record brings after
 * you; a bribe leaves the Government's paperwork spotless, so the name is the
 * ONLY thing it costs and it has to bite for the deed to have a price at all.
 * Two of them take an Honest commander past Dubious, five past Dodgy — a habit
 * makes a reputation, one bad afternoon does not.
 *
 * Its own rule id: it shares the value 12 with `DEFENCE_WEIGHT`
 * (constants/threat.ts), which weighs how much shooting a hull survives, and
 * with `TACTIC_SLEEPER_SECONDS`, which is a duration. Coincidences, and nothing
 * else.
 *
 * @rule character.disreputeBribe
 */
export const DISREPUTE_BRIBE = 12;

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
 * How long the line that says your name has changed holds the console
 * (docs/TODO/129).
 *
 * ONE duration for all eight occasions that can say it — seven deeds and the
 * decay — because it is one sentence, and a per-site number would let the same
 * line linger differently depending on which crime produced it. It is the
 * length of the scan's own line for the same reason that one is 4: long enough
 * to read at the moment a fight may be starting, short enough not to sit over
 * the next thing that matters.
 *
 * Its own rule id: it shares the value 4 with `SCAN_LINE_SECONDS`
 * (constants/law.ts), which is how long a POLICE SCAN line holds the console,
 * and with `PATROL_BRIBE_FINES`, which is a multiplier. Neither should move
 * because this one did.
 *
 * Owner confirmed as character.ts rather than contracts, which the catalogue's
 * likely-owner heuristic prefers because a settled contract is one of the eight
 * occasions that say it: settlement is a CALLER. What the line is, and how long
 * it holds the console, belongs to the ladder it names.
 *
 * @rule character.lineSeconds
 */
export const CHARACTER_LINE_SECONDS = 4;

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
