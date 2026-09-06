// Every way a dossier can be wrong, in one place.
//
// The generator (tools/generate-dossiers.ts) drops a dossier that fails
// here, and `test/dossiers.test.ts` runs the same check over every COMMITTED
// dossier. A rule enforced only on the way in stops being true the moment
// somebody hand-edits a line, and hand-editing a line is exactly what we
// would do to fix a bad one (docs/TODO/191 M2).
//
// Six checks. Every field passes `faults()` with the options its kind of
// text takes. Every slot in a field is one the field may carry. `legs` names
// every leg of the skeleton and no other. `story.legs` names every leg and
// every branch trigger, as `triggerLabel` spells it, and no other. No field
// names a system other than the patron's own world. No field breaks the
// ladder-word rule.

import type { Dossier, Skeleton } from '../src/missions/model.ts';
import { shapeOf } from './dossier-prompts.ts';
import { proseLadderOffences } from './ladder-rules.ts';
import { faults, foreignSystemNames, type FaultOptions } from './system-prompts.ts';

/** One field of a dossier, with the slots it may carry and the shape its text takes. */
interface Field {
  path: string;
  text: string;
  slots: readonly string[];
  opts: FaultOptions;
}

/** A console line or a hint: one or two sentences, and the patron may say "you". */
const LINE: FaultOptions = { sentences: [1, 2], reader: true, formulas: false };
/** A story line: the third person, so never "you". */
const STORY: FaultOptions = { sentences: [1, 3], reader: false, formulas: false };

const isText = (v: unknown): v is string => typeof v === 'string';

/** Every field, flattened, with an empty string standing in for a missing one. */
function fieldsOf(d: Dossier): Field[] {
  const out: Field[] = [];
  const add = (path: string, text: unknown, slots: readonly string[], opts: FaultOptions) => {
    out.push({ path, text: isText(text) ? text : '', slots, opts });
  };
  add('title', d.title, [], { sentences: [0, 1], reader: false, formulas: false });
  const pages = Array.isArray(d.briefing) ? d.briefing : [];
  pages.forEach((p, i) => add(`briefing[${i}]`, p, ['PATRON', 'HERE'],
    { sentences: [1, 6], reader: true, formulas: false }));
  for (const [leg, lines] of Object.entries(d.legs ?? {})) {
    for (const k of ['arrive', 'success', 'fail'] as const) {
      add(`legs.${leg}.${k}`, lines?.[k], ['TARGET', 'PAY'], LINE);
    }
  }
  add('lead', d.lead, ['PATRON', 'WORLD'], LINE);
  add('rumour.far', d.rumour?.far, ['PATRON', 'WORLD'], LINE);
  add('rumour.near', d.rumour?.near, ['PATRON', 'WORLD'], LINE);
  add('news', d.news, ['PATRON', 'WORLD'], LINE);
  add('story.opening', d.story?.opening, ['WORLD', 'DAY'], STORY);
  add('story.closing.complete', d.story?.closing?.complete, ['WORLD', 'DAY'], STORY);
  add('story.closing.fail', d.story?.closing?.fail, ['WORLD', 'DAY'], STORY);
  for (const [leg, byTrigger] of Object.entries(d.story?.legs ?? {})) {
    for (const [trigger, line] of Object.entries(byTrigger ?? {})) {
      add(`story.legs.${leg}.${trigger}`, line, ['WORLD', 'DAY'], STORY);
    }
  }
  return out;
}

/** The two key sets, compared both ways, so a missing and a stray key are both named. */
function keyFaults(what: string, have: readonly string[], want: readonly string[]): string[] {
  const bad: string[] = [];
  for (const k of want) if (!have.includes(k)) bad.push(`${what} lacks ${k}`);
  for (const k of have) if (!want.includes(k)) bad.push(`${what} names ${k}, which the skeleton lacks`);
  return bad;
}

/**
 * Every fault in one dossier against its skeleton, named. Empty means it
 * passes. `own` is the patron's world, the one system a field may name.
 */
export function dossierFaults(d: Dossier, skeleton: Skeleton, own = ''): string[] {
  const bad: string[] = [];
  if (d.skeleton !== skeleton.id) bad.push(`dossier is for ${d.skeleton}, not ${skeleton.id}`);
  if (isText(d.title) && d.title.length > 60) bad.push(`title is ${d.title.length} chars, over 60`);
  const pages = Array.isArray(d.briefing) ? d.briefing.length : 0;
  if (pages < 1 || pages > 3) bad.push(`briefing has ${pages} pages, wanted 1-3`);

  const shape = shapeOf(skeleton);
  bad.push(...keyFaults('legs', Object.keys(d.legs ?? {}), shape.legs));
  bad.push(...keyFaults('story.legs', Object.keys(d.story?.legs ?? {}), shape.legs));
  for (const leg of shape.legs) {
    const have = Object.keys(d.story?.legs?.[leg] ?? {});
    bad.push(...keyFaults(`story.legs.${leg}`, have, shape.triggers[leg]));
  }

  for (const f of fieldsOf(d)) {
    bad.push(...faults(f.text, f.path, f.opts));
    for (const m of f.text.matchAll(/\{([A-Z]+)\}/g)) {
      if (!f.slots.includes(m[1])) bad.push(`${f.path} carries {${m[1]}}, which it may not`);
    }
    bad.push(...foreignSystemNames(f.text, own).map((n) => `${f.path} names another system (${n})`));
    bad.push(...proseLadderOffences(f.text).map((why) => `${f.path}: ${why}`));
  }
  return bad;
}
