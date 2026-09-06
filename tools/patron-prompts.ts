// Build the patron prompt for every world of a galaxy.
//
//   node --experimental-strip-types tools/patron-prompts.ts [galaxy] [--json]
//
// Writes nothing. It prints a sample, so the prompts can be read before
// anyone spends money. With --json it emits the manifest that
// tools/generate-patrons.ts consumes.
//
// A PATRON is the person who offers a mission (docs/TODO/190). Everything
// here derives from the 1984 seed, as tools/species-prompts.ts does, so Lave
// always has the same governor. The seed picks the role and the manner. The
// model writes the name and the voice, and the committed record carries all
// four (docs/TODO/191 M1).
//
// The Navy is not here. It has no world, and `src/missions/patrons.ts` fixes
// it in code, so one patron has one home.

import {
  generateGalaxy, speciesName, GOVERNMENT_NAMES, type StarSystem,
} from '../src/galaxy/galaxy.ts';
import type { PatronFile } from '../src/missions/patrons.ts';
import { pickVariant } from './species-prompts.ts';
import { BANNED, factsFor, faults, fnv1a, foreignSystemNames } from './system-prompts.ts';

/**
 * Bumped by hand when the rules below change in a way that must invalidate
 * every committed patron. It is part of each record's hash, so a bump makes
 * `--check` fail for the whole galaxy at once.
 */
export const PATRON_PROMPT_VERSION = 1;

/**
 * The rules, shared by every request.
 *
 * The species line does the work. A name for a lobster is not a name for a
 * human colonial, and the model knows that once it is told to care. The
 * voice is written for a second reader: the dossier prompt quotes it, so it
 * must say how the patron speaks in a way a writer can use.
 */
export const PATRON_SYSTEM_PROMPT = `You name the people who offer work to a starship commander in a space trading game, and you describe how each one speaks.

You will be given the established facts about one world, and the role its patron holds there. Every fact is fixed and true. The patron is one of the world's own inhabitants, so the name must suit the species: a name for a lobster or a rodent is not a human name. A human colonial's name may be an ordinary one from any culture. Every name must be plausible as a name, and easy to say aloud.

Write two things:

NAME — one to three words, letters only. A given name and a family name, or a single name. Never the name of a real public figure, a well-known fictional character, or a brand. Never a name that is also a common English word.

VOICE — one or two sentences, in the third person, on how this patron speaks. It follows from the role, the government and the manner given. A writer will read it to put words in the patron's mouth, so make it usable: what the patron says first, what the patron never says, how the patron treats a pilot.

Absolute rules:

1. No digits.
2. No second person. Never "you".
3. Do not name any star system, this world included, in the name or in the voice.
4. Do not invent facts about the world. The voice is about the person.
5. Never use these words: bustling, vibrant, nestled, boasts, testament, tapestry, myriad, denizens, teeming, sprawling, hub, gem, jewel.
6. Plain sentences. No lists, no headings, no markdown, no quotation marks.`;

/**
 * A role that fits the government, three per government, picked by seed.
 *
 * Every key of `GOVERNMENT_NAMES` is here. Multi-Government went missing from
 * a table like this once (species-prompts.ts), and eight governments quietly
 * became seven.
 */
const ROLES: Record<string, readonly string[]> = {
  Anarchy: ['the warlord who holds the station', 'the dock boss', 'the broker the crews answer to'],
  Feudal: ["the baron's steward", 'the lord of the station', "the duke's marshal"],
  'Multi-Government': ["a faction's envoy", 'a councillor of one bloc', 'the minister of the caretaker council'],
  Dictatorship: ['the governor', 'a colonel of the state guard', 'the port commissar'],
  Communist: ["the collective's secretary", 'the chair of the port committee', 'the planning director'],
  Confederacy: ['a regional delegate', 'the harbour master', 'a member of the trade assembly'],
  Democracy: ['the elected port administrator', 'a councillor', 'the mayor of the port'],
  'Corporate State': ['a company director', 'the regional operations chief', "the port's contracts manager"],
};

/** How the patron speaks, in a phrase the model expands. Three per government. */
const MANNERS: Record<string, readonly string[]> = {
  Anarchy: ['blunt, and quick to threaten', 'friendly on the surface and careful underneath', 'tired of talk, and wants a price'],
  Feudal: ['formal, with the manners of a court', 'proud, and slow to ask a favour', 'courteous, with a threat under it'],
  'Multi-Government': ['careful, because a rival hears every word', 'weary, and glad of anyone outside the factions', 'eager, and quick to promise'],
  Dictatorship: ['clipped, and used to obedience', 'polite in the way of a state that watches', 'cold, with the numbers ready'],
  Communist: ['plain, and speaks for the collective', 'earnest about duty', 'guarded, and quotes the plan'],
  Confederacy: ['easy, and talks like a trader', 'practical, and counts jumps', 'warm, and knows every crew by name'],
  Democracy: ['open, and explains the reason', 'brisk and businesslike', 'apologetic about the paperwork'],
  'Corporate State': ['smooth, and speaks in terms', 'impatient, with a meter running', 'precise, and never says more than the contract'],
};

/** Slots 10 and 11, so a role cannot correlate with the dress the portraits drew. */
export function patronRole(sys: StarSystem): string {
  return pickVariant(sys, 10, ROLES[GOVERNMENT_NAMES[sys.government]]);
}

export function patronManner(sys: StarSystem): string {
  return pickVariant(sys, 11, MANNERS[GOVERNMENT_NAMES[sys.government]]);
}

/** The gazetteer's facts block, with the role and the manner beneath it. */
export function patronFactsFor(sys: StarSystem): string {
  return `${factsFor(sys)}\nRole: ${patronRole(sys)}\nManner: ${patronManner(sys)}`;
}

export interface PatronPrompt {
  /** the key the committed record is filed under */
  index: number;
  /** carried so a mis-keyed file is a test failure rather than a wrong name */
  system: string;
  species: string;
  role: string;
  facts: string;
  /** changes if the rules or this world's facts change; drives --check */
  hash: string;
}

export function hashPatronPrompt(facts: string): string {
  return fnv1a(`v${PATRON_PROMPT_VERSION}\n${PATRON_SYSTEM_PROMPT}\n${facts}`);
}

/** Every world in a galaxy, in index order. */
export function patronPrompts(galaxy: number): PatronPrompt[] {
  return generateGalaxy(galaxy).map((sys) => {
    const facts = patronFactsFor(sys);
    return {
      index: sys.index, system: sys.name, species: speciesName(sys), role: patronRole(sys),
      facts, hash: hashPatronPrompt(facts),
    };
  });
}

/** Three words at most, letters only, with an apostrophe or a hyphen inside a word. */
const NAME_SHAPE = /^[A-Za-z][A-Za-z'-]*(?: [A-Za-z][A-Za-z'-]*){0,2}$/;

/**
 * Every fault in one record, named. Empty means it passes.
 *
 * It lives here rather than in the generator because the generator is not
 * the only caller: `test/patrons.test.ts` runs it over the COMMITTED file. A
 * rule enforced only on the way in stops being true the moment somebody
 * hand-edits a record.
 */
export function patronFaults(name: string, voice: string): string[] {
  const bad: string[] = [];
  const n = name.trim();
  if (!NAME_SHAPE.test(n)) bad.push('name is not one to three plain words');
  if (n.length > 40) bad.push(`name is ${n.length} chars, over 40`);
  for (const word of BANNED) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(n)) bad.push(`name uses "${word}"`);
  }
  bad.push(...faults(voice, 'voice', { sentences: [1, 2], formulas: false }));
  // No world at all, the patron's own included. A patron called Lave is a
  // confusion on a screen that prints the world beside the name.
  bad.push(...foreignSystemNames(`${n} ${voice}`, '').map((s) => `names a system (${s})`));
  return bad;
}

/**
 * Does the committed file still describe the galaxy it claims to?
 *
 * Three ways to fail: a record whose hash no longer matches the manifest, a
 * record whose world no longer sits at that index, and a record at an index
 * the galaxy does not have. A file with FEWER records than worlds passes. A
 * missing record is a supported state, and the empty file that ships until a
 * generation run happens must not fail the build.
 */
export function patronDrift(file: PatronFile, galaxy: number): string[] {
  const byIndex = new Map(patronPrompts(galaxy).map((p) => [String(p.index), p]));
  const bad: string[] = [];
  if (file.promptVersion !== PATRON_PROMPT_VERSION) {
    bad.push(`file was generated under prompt version ${file.promptVersion}, now ${PATRON_PROMPT_VERSION}`);
  }
  for (const [index, entry] of Object.entries(file.entries)) {
    const want = byIndex.get(index);
    if (!want) { bad.push(`${index}: galaxy ${galaxy} has no such system`); continue; }
    if (want.system !== entry.system) {
      bad.push(`${index}: file says ${entry.system}, galaxy says ${want.system}`);
    } else if (want.hash !== entry.hash) {
      bad.push(`${index} ${entry.system}: prompt changed (${entry.hash} -> ${want.hash})`);
    }
  }
  return bad;
}

// ---------------------------------------------------------------- cli

if (process.argv[1]?.endsWith('patron-prompts.ts')) {
  const args = process.argv.slice(2);
  const galaxy = Number(args.find((a) => /^\d+$/.test(a)) ?? 1);
  const prompts = patronPrompts(galaxy);

  if (args.includes('--json')) {
    process.stdout.write(JSON.stringify({
      galaxy, promptVersion: PATRON_PROMPT_VERSION, systemPrompt: PATRON_SYSTEM_PROMPT, prompts,
    }, null, 2));
  } else {
    const sample = [0, 7, 96, 147].filter((i) => i < prompts.length);
    process.stdout.write(`${PATRON_SYSTEM_PROMPT}\n\n${'='.repeat(70)}\n`);
    for (const i of sample) {
      const p = prompts[i];
      process.stdout.write(`\n--- ${p.index} ${p.system} (${p.hash}) ---\n${p.facts}\n`);
    }
    const roles = new Set(prompts.map((p) => p.role)).size;
    process.stdout.write(`\n${prompts.length} patrons in galaxy ${galaxy}, ${roles} distinct roles.\n`);
  }
}
