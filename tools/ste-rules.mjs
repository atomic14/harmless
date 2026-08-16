// The three rules of the house style that a machine can count.
//
// `CLAUDE.md` owns the style and this file restates none of it. It holds the
// three rules that are countable, and the word lists each one needs:
//
// 1. a sentence over its cap — 20 words for an instruction, 25 for descriptive
//    text;
// 2. an `-ing` word that is not a technical noun;
// 3. a perfect tense, or a chain of two auxiliary verbs.
//
// The other rules of the style are not here, and their absence is deliberate.
// One word for one concept, the plainest available word, and a paragraph of one
// topic are all read rather than counted. A tool that guessed at them would
// report noise beside three numbers that mean something.
//
// `tools/ste-read.mjs` decides what is measured. `tools/ste.mjs` reports, and
// gates under `--gate`.

import { words } from './ste-read.mjs';

/** The cap on a descriptive sentence, in words. `CLAUDE.md` owns the rule. */
export const DESCRIPTIVE_CAP = 25;

/** The cap on an instruction, in words. `CLAUDE.md` owns the rule. */
export const INSTRUCTION_CAP = 20;

// ---------------------------------------------------------------------------
// Rule 1 — the caps
// ---------------------------------------------------------------------------

/**
 * The verbs this repository gives an instruction with.
 *
 * An instruction gets the tighter cap, so the tool has to tell one from a
 * description. The test is the first word, because an imperative sentence opens
 * with a base-form verb. The list is drawn from the rule docs rather than from
 * a dictionary. A word missing from it costs one thing only. That sentence gets
 * the descriptive cap of 25 instead of 20.
 */
const IMPERATIVE = new Set(`
add answer apply argue ask assert avoid build call catch check choose clear
click close commit compare confirm consider convert copy correct count cut
define delete deliver document draw drop edit enter exceed explain fill find fix
flag follow give hand hold ignore install join keep land leave list load log
look maintain make mark measure mention mind move name note open pass pick place
plan prefer prepare press prevent print prove push put query quote raise rank
read record regenerate reject remove rename repair replace report reserve resolve
return review rewrite run save say scan see select send set show skip solve split
start state stop store sweep switch take tell test throw treat trim try turn
update use verify wait walk want watch weigh work write
`.trim().split(/\s+/));

/**
 * Is this sentence an instruction?
 *
 * A negative imperative counts too. `CLAUDE.md` gives more orders as "Do not"
 * and "Never" than it does as a bare verb.
 */
export function isInstruction(sentence) {
  const first = words(sentence)[0]?.toLowerCase().replace(/[^a-z']/g, '') ?? '';
  if (first === 'do' || first === 'never' || first === 'always' || first === "don't") return true;
  return IMPERATIVE.has(first);
}

/** The cap this sentence answers to. */
export const capFor = (sentence) => (isInstruction(sentence) ? INSTRUCTION_CAP : DESCRIPTIVE_CAP);

// ---------------------------------------------------------------------------
// Rule 2 — the -ing words
// ---------------------------------------------------------------------------

/**
 * An English word that merely ends in the same three letters.
 *
 * None of these is an `-ing` form of a verb, so none of them is a breach. A
 * word of four letters is covered by the length test below rather than listed
 * here. The verb under it would have to be one letter long. That test is what
 * holds `king`, `ring`, `wing` and `sing`.
 *
 * A plural is not listed either. `things` does not end in the three letters, so
 * it never reaches this set.
 */
const NOT_A_FORM = new Set(`
thing nothing something anything everything string during spring ceiling
sibling morning evening bring cling sting swing wring sling
`.trim().split(/\s+/));

/**
 * An `-ing` word that is a technical noun here, and is therefore correct.
 *
 * `CLAUDE.md` names five of these. The rest are this repository's own
 * vocabulary, and every one was added from a use the tool found rather than
 * from a guess. THE LIST IS THE PART THAT DECIDES WHETHER THE COUNT MEANS
 * ANYTHING (docs/TODO/154). Each entry earns its place by naming a thing rather
 * than an action. A `warning` is a line on the console. "Warning somebody" is a
 * verb this style does not allow.
 *
 * `npm run ste -- --nouns` audits it. It prints the count and one example per
 * entry, so a reader can check every claim by reading. It also names any entry
 * the tree no longer uses. Nineteen entries came out that way on the first run,
 * which is the same review surface `tools/sizes.mjs` keeps for its own list.
 *
 * THE TEST IS THE WORD AND NOT ITS ROLE, WHICH IS A KNOWN MISS. `damping` is a
 * noun in "the damping term" and a verb in "nothing damping it", and a list of
 * words cannot tell them apart. So the count is a FLOOR on the verb forms in
 * the tree rather than an estimate of them. Five entries were removed where
 * reading showed the verb use to be the common one — `naming`, `listing`,
 * `seeding`, `weighting` and `easing`. The mixed ones below are kept, because a
 * word this project uses as a noun should not be reported at every use.
 */
export const TECHNICAL_NOUN = new Set(`
rendering training spawning docking binding warning setting timing tuning wiring
heading bearing landing tracking scaling sampling wording targeting steering
damping mining trading smuggling briefing drawing numbering ordering ranking
padding spacing framing hunting bounding clipping rounding rating sparring
closing standing encoding reasoning load-bearing
`.trim().split(/\s+/));

/** Every `-ing` word of a sentence, split into the flagged and the allowed. */
export function ingWords(sentence) {
  const all = words(sentence)
    .map((w) => w.toLowerCase().replace(/[^a-z-]/g, ''))
    .filter((w) => w.length >= 5 && w.endsWith('ing') && !NOT_A_FORM.has(w));
  return {
    flagged: all.filter((w) => !TECHNICAL_NOUN.has(w)),
    allowed: all.filter((w) => TECHNICAL_NOUN.has(w)),
  };
}

// ---------------------------------------------------------------------------
// Rule 3 — the tense
// ---------------------------------------------------------------------------

/** An irregular past participle. A regular one ends in `ed`. */
const PARTICIPLE = new Set(`
been gone done seen made taken given written found got gotten come become run
set put kept left held told said met sent spent built meant brought thought
caught taught understood stood known grown shown drawn thrown flown blown chosen
broken spoken driven risen fallen eaten beaten forgotten hidden ridden bitten
begun sung sunk drunk won lost paid laid read cut hit let shut cost hurt bought
sold sat lain led fed bred dealt felt slept swept wept lit split spread struck
stuck hung dug worn torn born sworn shrunk sprung swum flung swung wound bound
frozen woken stolen thrust burst quit arisen withdrawn overcome undergone
mistaken
`.trim().split(/\s+/));

const MODAL = new Set('will would shall should may might must can could'.split(' '));

const AUXILIARY_BE = new Set('be been is are was were'.split(' '));

/** An adverb, or a negative, that may sit inside an auxiliary chain. */
const INTERRUPTER = new Set('not never already also still only just'.split(' '));

const isParticiple = (w) => PARTICIPLE.has(w) || (w.length > 3 && w.endsWith('ed'));

/**
 * A perfect tense, or two auxiliary verbs in a chain.
 *
 * Three shapes, and `CLAUDE.md` forbids each of them by name. `have` with a
 * past participle is the perfect. A modal with `have` is the hedge stack that
 * "may have been caused by" is the example of. A `be` form with `being` is the
 * progressive passive.
 *
 * An adverb may sit between the two words, because "has never been" is the same
 * tense as "has been".
 *
 * ONE CHAIN IS ONE BREACH. "may have been caused by" holds two of these shapes,
 * and reporting it twice would say that the sentence has two faults to fix. It
 * has one, so a match that starts inside the previous match is not counted.
 */
export function tenseBreaches(sentence) {
  const w = words(sentence).map((x) => x.toLowerCase().replace(/[^a-z']/g, ''));
  const out = [];
  let matched = -1;
  for (let i = 0; i < w.length - 1; i++) {
    if (i <= matched) continue;
    let j = i + 1;
    if (w[j].endsWith('ly') || INTERRUPTER.has(w[j])) j += 1;
    const a = w[i];
    const b = w[j];
    if (!b) continue;
    const perfect = (a === 'have' || a === 'has' || a === 'had') && isParticiple(b);
    const stacked = MODAL.has(a) && b === 'have';
    const passive = AUXILIARY_BE.has(a) && b === 'being';
    if (!perfect && !stacked && !passive) continue;
    out.push(`${a} ${b}`);
    matched = j;
  }
  return out;
}
