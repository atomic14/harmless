// Build the dossier prompt for every skeleton, or for the ones named.
//
//   node --experimental-strip-types tools/dossier-prompts.ts [id ...] [--json]
//
// Writes nothing. It prints a sample, so the prompts can be read before
// anyone spends money. With --json it emits the manifest that
// tools/generate-dossiers.ts consumes.
//
// A DOSSIER is one mission's generated words (docs/TODO/190). The prompt is
// built from the skeleton's shape: its legs, its verbs, its branches and its
// pitch, and from its patron. The hash covers all of it, so a skeleton with
// a new leg invalidates its dossier (docs/TODO/191 M2). A relative leg names
// no world, and the prompt says so.

import { COMMODITIES, generateGalaxy } from '../src/galaxy/galaxy.ts';
import { shipDesign } from '../src/game/ship-identity.ts';
import { triggerLabel } from '../src/missions/machine.ts';
import type { DossierFile, Leg, Placement, Skeleton, Trigger, Verb } from '../src/missions/model.ts';
import { patronFor } from '../src/missions/patrons.ts';
import { SKELETONS, skeletonById } from '../src/missions/skeletons/index.ts';
import { fnv1a } from './system-prompts.ts';

/** Bumped by hand when the rules below change. It is part of every hash. */
export const DOSSIER_PROMPT_VERSION = 1;

/**
 * The rules, shared by every request.
 *
 * The slots are the seam between a rule and a word. The model is told which
 * slot each field may carry, and `tools/dossier-faults.ts` refuses a field
 * that carries another. `{TARGET}` is the one the machine fills from the
 * rule, so a briefing that names a world of its own cannot ship.
 */
export const DOSSIER_SYSTEM_PROMPT = `You write the words of one mission in a space trading game. A commander reads them on a green terminal aboard her ship. The rules of the mission are code, and nothing you write can change them: you write how the mission is offered, announced and remembered.

You will be given the mission's facts: who offers it, what it asks, leg by leg, and how each leg can end. Every fact is fixed and true. A leg's world is picked by the game when the leg starts, so speak of "the target" and never invent a world of your own.

SLOTS. A field may carry the slots its heading lists, written exactly as shown, with the braces and the capitals: {PATRON} is the patron's name, {HERE} is the world the offer is made at, {TARGET} is the leg's world, {PAY} is the fee, {WORLD} is a world the record names, {DAY} is a day number. Use a slot where the name or the number belongs. Never write a slot a field does not list, and never invent one.

Write these fields:

TITLE — a name for the mission, two to five words, no full stop, no slot.
BRIEFING — one to three short paragraphs in the patron's own voice, spoken to the commander. Second person is right here. Slots: {PATRON} {HERE}. For a job offered at any station, {PATRON} and {HERE} are the only way to name the patron or the world.
LEGS — for each leg, three console lines, one sentence each, in the game's terse voice. "arrive" is the standing order as the patron would put it. "success" is said when the leg goes right; "fail" when it goes wrong. Slots: {TARGET} {PAY}.
LEAD — one sentence for the commander's mission screen, on how she hears that the patron wants a word. Slots: {PATRON} {WORLD}.
RUMOUR — "far" is a bulletin-board rumour heard a few jumps out; "near" is the patron's own message when she docks one jump away. One sentence each. Slots: {PATRON} {WORLD}.
NEWS — one sentence for the data page of the patron's world, saying that work waits there. Slots: {PATRON} {WORLD}.
STORY — the commander's log, told in the third person and the past tense, one sentence per entry. "opening" is the day she took the job. "closing" has one line for each ending. "legs" has one line per leg per outcome listed, saying what that outcome meant. Slots: {WORLD} {DAY}.

Absolute rules:

1. No digits anywhere. A fee is {PAY}; a day is {DAY}; a count is written out.
2. Do not name any star system. Speak of "the target", "the neighbour", "this station". The one exception is the patron's own world, when the facts give it.
3. Do not invent names for people, ships, companies or wars. The patron has a name already, and it is {PATRON} or the one the facts give.
4. Never use these words: bustling, vibrant, nestled, boasts, testament, tapestry, myriad, denizens, teeming, sprawling, hub, gem, jewel.
5. The commander's standing is her reputation. Her combat rank is her rating, never a reputation. Her criminal standing is her legal status. Never write "character", "disrepute" or "record" for any of them.
6. Plain sentences. No lists, no headings, no markdown, no quotation marks, no line breaks inside a field.
7. Every console line is short: one sentence, under fifteen words.`;

/** The ship's name in the catalogue, for the facts. */
export function shipNameOf(id: string): string {
  const r = shipDesign(id);
  return r.source === 'elite-a' ? r.design.shipName : r.overlay.name;
}

/** What a leg asks, in plain English. */
export function verbLine(verb: Verb): string {
  switch (verb.kind) {
    case 'hunt':
      return `find and destroy the ${shipNameOf(verb.ship)} near the target${verb.canEscape ? '; it may jump away' : ''}`;
    case 'deliver': return verb.cargo
      ? `carry ${verb.cargo.tonnes} tonnes of ${COMMODITIES[verb.cargo.commodity].name} to the target and dock`
      : 'dock at the target';
    case 'recover': return 'scoop the canister adrift near the target';
    case 'rescue': return 'scoop the escape pod adrift near the target, and land its passenger alive at a station';
    case 'ambush': return 'fly to the target through the pirates on the lane, and dock';
    case 'smuggle':
      return `land ${verb.tonnes} tonnes of ${COMMODITIES[verb.commodity].name} at the target without a police scan`;
    case 'escort': return `see the ${shipNameOf(verb.ship)} into station range at the target`;
    case 'scan': return `hold the ${shipNameOf(verb.ship)} on the scanner for ${verb.seconds} seconds without firing`;
  }
}

/** What a trigger means, so the story line for it says the right thing. */
export function triggerMeaning(t: Trigger, verb: Verb): string {
  if (typeof t !== 'string') {
    const [k, v] = Object.entries(t)[0];
    if (k === 'survivor') return v === 'landed' ? 'the passenger was landed alive' : 'the passenger was sold';
    return `the ${k} ${v} was set`;
  }
  switch (t) {
    case 'success': return 'the leg succeeded';
    case 'failed': return 'the leg failed, most often on the deadline';
    case 'deadlinePassed': return 'the deadline passed';
    case 'targetEscaped': return 'the target jumped away';
    case 'targetFled': return 'the target fled';
    case 'targetDestroyed':
      return verb.kind === 'hunt' ? 'the target was destroyed'
        : verb.kind === 'rescue' ? 'the pod was destroyed before the scoop'
          : 'the ship was destroyed';
  }
}

/** Where the leg happens, so "the target" means the right thing. */
export function placeLine(place: Placement): string {
  switch (place.kind) {
    case 'here': return 'the world the job is offered at';
    case 'anywhere': return 'any station at all';
    case 'origin': return 'the world the job was taken at';
    case 'band': return 'a world some jumps away, picked when the leg starts';
    case 'world': return 'one fixed world, named on screen by the rule';
    case 'entity': return 'wherever the tagged ship was last seen';
    case 'handover': return 'a world on the way toward the next patron';
  }
}

function branchLine(leg: Leg): string {
  return leg.next.map((b) => {
    const to = b.to === 'complete' ? 'the mission completes' : b.to === 'fail' ? 'the mission fails' : `leg "${b.to}" starts`;
    return `${triggerLabel(b.on)} (${triggerMeaning(b.on, leg.verb)}) -> ${to}`;
  }).join('; ');
}

/** The patron line of the facts. A local patron is the slots, and nothing else. */
function patronLine(s: Skeleton): { line: string; own: string } {
  if (s.patron.kind === 'local') {
    return {
      line: 'Patron: {PATRON}, whoever runs the station the job is offered at. The world is {HERE}. This job is offered at any station, so name neither.',
      own: '',
    };
  }
  const facts = { galaxy: 1, systemIndex: 0, kills: 0, combatScore: 0, legalStatus: 0, day: 0, cargo: [] };
  const p = patronFor(s.patron, facts, generateGalaxy(1));
  if (s.patron.kind === 'navy') return { line: `Patron: ${p.name}, in service signals: rank, no courtesy, no name.`, own: '' };
  const world = generateGalaxy(1)[s.patron.seedSlot].name;
  return {
    line: `Patron: ${p.name}, ${p.role} of ${world}. ${p.voice || 'Voice: plain and direct.'}`,
    own: world,
  };
}

/** The shape a dossier must answer: every leg, and every trigger label per leg. */
export function shapeOf(s: Skeleton): { legs: string[]; triggers: Record<string, string[]> } {
  const triggers: Record<string, string[]> = {};
  for (const leg of s.legs) triggers[leg.id] = leg.next.map((b) => triggerLabel(b.on));
  return { legs: s.legs.map((l) => l.id), triggers };
}

export interface DossierPrompt {
  skeleton: string;
  facts: string;
  /** covers the rules, the skeleton's shape and the patron; drives --check */
  hash: string;
  /** the one system a field may name, or '' */
  own: string;
  legs: string[];
  triggers: Record<string, string[]>;
}

export function dossierPromptFor(s: Skeleton): DossierPrompt {
  const { line, own } = patronLine(s);
  const kind = s.kind === 'side' ? 'a side job, offered at any station' : s.kind === 'arc' ? 'an arc, one of a chain' : 'an event';
  const legs = s.legs.map((leg) => [
    `Leg "${leg.id}": ${verbLine(leg.verb)}.`,
    `  The target is ${placeLine(leg.place)}.`,
    leg.deadlineDays ? `  Deadline: ${leg.deadlineDays} days.` : '',
    `  Order on screen: ${leg.line}`,
    `  Outcomes: ${branchLine(leg)}`,
  ].filter(Boolean).join('\n'));
  const facts = [
    `Mission: ${s.id} (${kind})`,
    line,
    `Announced on docking as: ${s.hail}`,
    `Offered as: ${s.pitch}`,
    ...legs,
    `Endings: complete${s.complete.lead ? ` (leads to ${s.complete.lead})` : ''}; fail${s.fail.lead ? ` (leads to ${s.fail.lead})` : ''}.`,
  ].join('\n');
  return {
    skeleton: s.id, facts, own,
    hash: fnv1a(`v${DOSSIER_PROMPT_VERSION}\n${DOSSIER_SYSTEM_PROMPT}\n${facts}`),
    ...shapeOf(s),
  };
}

/** The prompts for the skeletons named, or for every skeleton. */
export function dossierPrompts(ids: readonly string[] = [], from: readonly Skeleton[] = SKELETONS): DossierPrompt[] {
  const list = ids.length ? ids.map((id) => skeletonById(id, from)).filter((s): s is Skeleton => s !== null) : from;
  return list.map(dossierPromptFor);
}

/**
 * Does a committed dossier still answer the skeleton it was written for?
 * Three ways to fail: no such skeleton, an old prompt version, and a hash
 * that the rules or the skeleton's shape moved away from.
 */
export function dossierDrift(file: DossierFile, from: readonly Skeleton[] = SKELETONS): string[] {
  const s = skeletonById(file.dossier.skeleton, from);
  if (!s) return [`${file.dossier.skeleton}: no such skeleton`];
  const bad: string[] = [];
  if (file.promptVersion !== DOSSIER_PROMPT_VERSION) {
    bad.push(`${s.id}: written under prompt version ${file.promptVersion}, now ${DOSSIER_PROMPT_VERSION}`);
  }
  const want = dossierPromptFor(s).hash;
  if (file.dossier.hash !== want) bad.push(`${s.id}: prompt changed (${file.dossier.hash} -> ${want})`);
  return bad;
}

/** The generated index that imports every committed dossier, from the file names. */
export function indexSource(names: readonly string[]): string {
  const ids = [...names].sort();
  const ident = (n: string) => `d_${n.replace(/[^A-Za-z0-9]/g, '_')}`;
  return [
    '// GENERATED by tools/generate-dossiers.ts. Do not edit by hand.',
    '//',
    '// One import per committed dossier, so `../dossiers.ts` keeps no list of its',
    '// own to fall out of step with this directory. `--check` fails when a file',
    '// here is missing from this list.',
    '',
    "import type { DossierFile } from '../model.ts';",
    ...ids.map((n) => `import ${ident(n)} from './${n}.json' with { type: 'json' };`),
    '',
    ids.length
      ? `export const DOSSIER_FILES: readonly DossierFile[] = [\n${ids.map((n) => `  ${ident(n)} as DossierFile,`).join('\n')}\n];`
      : 'export const DOSSIER_FILES: readonly DossierFile[] = [];',
    '',
  ].join('\n');
}

// ---------------------------------------------------------------- cli

if (process.argv[1]?.endsWith('dossier-prompts.ts')) {
  const args = process.argv.slice(2);
  const prompts = dossierPrompts(args.filter((a) => !a.startsWith('--')));
  if (args.includes('--json')) {
    process.stdout.write(JSON.stringify({
      promptVersion: DOSSIER_PROMPT_VERSION, systemPrompt: DOSSIER_SYSTEM_PROMPT, prompts,
    }, null, 2));
  } else {
    process.stdout.write(`${DOSSIER_SYSTEM_PROMPT}\n\n${'='.repeat(70)}\n`);
    for (const p of prompts.slice(0, 2)) {
      process.stdout.write(`\n--- ${p.skeleton} (${p.hash}) ---\n${p.facts}\n`);
    }
    process.stdout.write(`\n${prompts.length} dossier prompts.\n`);
  }
}
