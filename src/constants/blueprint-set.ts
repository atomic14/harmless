// Which of the 23 released blueprint sets a system flies — the numbers in that
// rule, and nothing else.
//
// The rule itself is `game/blueprint-set.ts`, and docs/TODO/138 records where it
// was recovered from: bbcelite's disc-version dive for the base number, and its
// Elite-A dive for the galaxy addition and the two overrides. The vendored pack
// carries the sets and their slots; it carries no selection metadata at all, so
// this is a fourth source and is cited as one.
//
// Bit 0 of that number is NOT here. It is the tech-level test that also picks
// the Dodo station over the Coriolis, it already had a home, and `galaxy/tech.ts`
// is that home.

/**
 * The highest government the blueprint rule counts as unsettled.
 *
 * Bit 1 of the set number is 0 at or below this, and 1 for everything safer. 2
 * is Multi-Government on the 1984 ladder (`galaxy.ts` `GOVERNMENT_NAMES`), so
 * the unsettled three are anarchy, feudal and multi-government.
 *
 * THREE GOVERNMENT THRESHOLDS NOW EXIST AND ALL THREE ARE DIFFERENT. The other
 * two are in ./encounters.ts: `ANARCHY_GOVERNMENT` (1) doubles a pirate wave,
 * and `LAWLESS_GOVERNMENT` (3) is where waves stop. A fourth trap sits three
 * lines from where this rule is read — `galaxy.ts:70` denies a rich economy at
 * `government <= 1`. Four rules, four values, no shared name.
 *
 * @rule blueprintset.unsettledGovernment
 */
export const UNSETTLED_GOVERNMENT = 2;

/**
 * The set the Constrictor's system always flies, in mission 1.
 *
 * Corroborated by the pack rather than taken on trust: slot 31 is the
 * Constrictor's own slot, and the slot table fills it in set G and in no other
 * set. The rule and the data agree without being made to.
 */
export const CONSTRICTOR_BLUEPRINT_SET = 'G';

/**
 * What a system flies while the commander carries the plans, and what
 * witch-space flies. Low tech takes the first, high tech the second.
 *
 * These are the sets that hold Thargoids: slots 29 and 30 are filled in select
 * sets only, which is the same corroboration the Constrictor's override has.
 */
export const THARGOID_BLUEPRINT_SET_LOW_TECH = 'C';

/** The high-tech half of the pair above. */
export const THARGOID_BLUEPRINT_SET_HIGH_TECH = 'D';
