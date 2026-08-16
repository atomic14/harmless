// Your CHARACTER: what a commander is known for, after the fine is paid.
//
// It is one of the game's three ladders, and it is distinct from both of the
// others. `rating.ts` says how DANGEROUS you are. `law.ts` says where you stand
// with the Government right now, and money clears that one. This ladder is a
// score that a shady deed raises and time erodes: a dirty sale, a shorted
// consignment, a bribe pressed on a policeman. `game/character.ts` reads it off
// the ladder below.
//
// The word `name` never means this ladder (docs/TODO/162). A commander has a
// name, and it is the word the player types.

/**
 * The character ladder: the disrepute score, lowest first, and the rung that it
 * earns. Honest is the top rung, and the default. `characterRung` reads it the
 * way `rating()` reads `RATINGS`. `test/economy.test.ts` bisects the rungs back
 * out.
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
 * What each deed adds to disrepute, tuned in play. A hermit or a murder is
 * career-marking, and one takes Honest clear to Dodgy. To be caught, or to make a
 * dirty sale, is a nudge that only adds up over a run of them.
 */
export const DISREPUTE_HERMIT_KILL = 40;
export const DISREPUTE_MURDER = 40;
export const DISREPUTE_CAUGHT = 10;

/**
 * A sale of somebody you pulled out of an escape capsule (docs/TODO/127).
 *
 * It is the deed the ladder was built for, and it is priced with the other
 * career-marker. One takes an Honest commander clear to Dodgy, which is what a
 * rescue turned into a transaction ought to be worth. That it equals
 * `DISREPUTE_HERMIT_KILL` is the statement. To crack a hermit for his ore, and
 * to sell a rescued pilot, are the same order of thing.
 *
 * It has its own rule id. It shares the value 40 with `DISREPUTE_HERMIT_KILL` and
 * `DISREPUTE_MURDER` above, and the three must stay free to move apart. This one
 * is the only one of them that a station counter will process.
 *
 * The owner is confirmed as character.ts, rather than the survivors file that the
 * catalogue prefers. constants/survivors.ts prices the TRANSACTION. Every mark on
 * the character lives here, beside the ladder that reads it and the decay that
 * erodes it. docs/TODO/127 says so in as many words.
 *
 * @rule character.disreputeSlaveSale
 */
export const DISREPUTE_SLAVE_SALE = 40;

/**
 * Money taken to let one go instead (docs/TODO/127).
 *
 * It is a quarter of the sale, because it is a different deed and not a discount
 * on the same one. You do not sell a person. You decline to file one, and what is
 * left is that you were paid for it. It is `DISREPUTE_CAUGHT`-scale: a nudge that
 * only adds up over a habit of them. That is the shape of every deed on this
 * ladder that is not career-marking.
 *
 * It has its own rule id. It shares the value 10 with two other numbers.
 * `DISREPUTE_CAUGHT` above prices a read by a police scan. The ladder's own
 * Dubious threshold is not a deed at all.
 *
 * The owner is confirmed as character.ts, for `DISREPUTE_SLAVE_SALE`'s reason
 * above.
 *
 * @rule character.disreputeSurvivorReleased
 */
export const DISREPUTE_SURVIVOR_RELEASED = 10;

/**
 * A policeman bought: what the offer adds to disrepute, whether he takes it or
 * refuses it (`game/law.ts`, docs/TODO/123).
 *
 * It is more than to be CAUGHT, which is the only comparison that matters. A scan
 * costs you the record, the fine, and everybody the record brings after you. A
 * bribe leaves the Government's paperwork spotless. So your character is the ONLY
 * thing it costs, and it has to bite for the deed to have a price at all. Two of
 * them take an Honest commander past Dubious, and five take one past Dodgy. A
 * habit makes a character; one bad afternoon does not.
 *
 * **MEASURED AGAINST THE DECAY, which is what settles it** (docs/TODO/132).
 * docs/TODO/129 M2 left this open for a flight. The flight was not the missing
 * input; the other half of the arithmetic was. Over every jump that galaxy 1
 * allows inside a full tank — 1,686 of them — a jump takes 2–5 days, median 4.
 * `DISREPUTE_DECAY` therefore forgives 3–7.5 disrepute per jump, median 6.
 * **This is twice that**, which is exactly the shape the paragraph above asks
 * for. One bribe is gone after two quiet jumps. A bribe every system compounds
 * past Dodgy by the fourth, and past Shady by the eighth. Lower, and the deed is
 * free to a commander who travels. Much higher, and one bad afternoon is a
 * career. `test/character.test.ts` pins that behaviour rather than the number.
 *
 * It has its own rule id. It shares the value 12 with `DEFENCE_WEIGHT`
 * (constants/threat.ts), which weighs how much shooting a hull survives, and with
 * `TACTIC_SLEEPER_SECONDS`, which is a duration. Those are coincidences, and
 * nothing else.
 *
 * @rule character.disreputeBribe
 */
export const DISREPUTE_BRIBE = 12;

/**
 * A sale of illicit goods over a market counter, or a consignment of them landed
 * with no questions asked (`game/contracts.ts`).
 *
 * It has its own rule id since docs/TODO/113. It shares the value 5 with
 * `DISREPUTE_SHORTED_CONSIGNMENT` below, and the two must stay free to move
 * apart. This one prices a deal made with a smuggler. That one prices a promise
 * broken to a shipper.
 *
 * @rule character.disreputeContrabandSale
 */
export const DISREPUTE_CONTRABAND_SALE = 5;

/**
 * An arrival at the far end without the consignment you were entrusted with
 * (docs/TODO/113). The credits half of that is the shipper's invoice, billed in
 * `game/contracts.ts`. This is the half that sticks to your character.
 *
 * It is the same 5 as a dirty market sale, and for the same reason. One shorted
 * job is a bad week: you were robbed, or you were greedy once. Only a habit of
 * them is a reputation. A career-marker like a hermit kill at 40 would take a
 * single unlucky run from Honest most of the way to Dubious. Settlement cannot
 * tell an unlucky run from a sold one, because nothing records *why* a hold is
 * short. The value therefore has to be one that an honest trader can absorb.
 *
 * It has its own rule id. It shares the value 5 with `DISREPUTE_CONTRABAND_SALE`
 * above, and the two must stay free to move apart. That one prices a deal made
 * with a smuggler. This one prices a promise broken to a shipper.
 *
 * The owner is confirmed as character.ts rather than the board. This is what the
 * deed does to your CHARACTER, and it decays with every other deed here. The
 * board owns what the job itself is worth. That is the mirror of the note on
 * `SMUGGLE_DELIVERY_NOTORIETY` (constants/contracts.ts).
 *
 * @rule character.disreputeShortedConsignment
 */
export const DISREPUTE_SHORTED_CONSIGNMENT = 5;

/**
 * How long the line that reports a new character rung holds the console
 * (docs/TODO/129).
 *
 * It is ONE duration for all eight occasions that can say it: seven deeds and the
 * decay. It is one sentence, and a per-site number would let the same line linger
 * differently, depending on which crime produced it. It is the length of the
 * scan's own line, for the same reason that one is 4. It is long enough to read
 * at the moment a fight may start, and short enough not to sit over the next
 * thing that matters.
 *
 * It has its own rule id. It shares the value 4 with two other numbers.
 * `SCAN_LINE_SECONDS` (constants/law.ts) is how long a POLICE SCAN line holds
 * the console. `PATROL_BRIBE_FINES` is a multiplier. Neither should move because
 * this one did.
 *
 * The owner is confirmed as character.ts rather than contracts. The catalogue's
 * likely-owner heuristic prefers contracts, because a settled contract is one of
 * the eight occasions that say it. Settlement is a CALLER. What the line is, and
 * how long it holds the console, belongs to the ladder it names.
 *
 * @rule character.lineSeconds
 */
export const CHARACTER_LINE_SECONDS = 4;

/**
 * How fast disrepute fades, per day. It is slower than the galaxy's `HEAT_DECAY`:
 * a cargo is forgotten in days, and a reputation is not.
 *
 * It has its own rule id. It shares the value 1.5 with one of the docking
 * computer's distances, measured in station half-widths.
 *
 * @rule character.disreputeDecay
 */
export const DISREPUTE_DECAY = 1.5;

/**
 * The ceiling, so a lifetime of villainy cannot run the score away past what a
 * season of clean living can undo. It is a little past Cutthroat.
 */
export const DISREPUTE_MAX = 160;
