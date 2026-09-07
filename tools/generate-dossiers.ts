// Generate the dossiers, offline, and commit the result.
//
//   node --experimental-strip-types tools/generate-dossiers.ts [id ...] \
//        [--model claude-haiku-4-5] [--limit N] [--out DIR] [--batch ID] [--check]
//
//   id ...    the skeletons to write; none means every skeleton. A new
//             skeleton costs one run, not a full regeneration.
//   --check   the non-writing drift gate, wired into `npm run check`. No API
//             call, no key needed.
//   --batch   collect an already-submitted batch instead of sending a new one.
//   --limit   write only the first N, for tasting a model cheaply.
//   --out     write into DIR instead of src/missions/dossiers/, so a taste
//             never reaches the generated index.
//   --via claude   run through `claude -p` on this machine's subscription,
//             one process per skeleton, instead of the batch API. No key.
//
// One file per skeleton under src/missions/dossiers/, and a generated
// index.ts that imports each one, so the reader (src/missions/dossiers.ts)
// keeps no list of its own. The same batch runner as the other two
// generators (tools/batch.ts). The prompt is tools/dossier-prompts.ts's and
// the validator is tools/dossier-faults.ts's (docs/TODO/191 M2).

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { Dossier, DossierFile } from '../src/missions/model.ts';
import { SKELETONS, skeletonById } from '../src/missions/skeletons/index.ts';
import { newClient, reportCost, runBatches, runLocal, type BatchJob } from './batch.ts';
import { dossierFaults } from './dossier-faults.ts';
import {
  DOSSIER_PROMPT_VERSION, DOSSIER_SYSTEM_PROMPT, dossierDrift, dossierPrompts, indexSource,
  type DossierPrompt,
} from './dossier-prompts.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = join(HERE, '..', 'src', 'missions', 'dossiers');

const DEFAULT_MODEL = 'claude-haiku-4-5';

const text = (description: string) => ({ type: 'string', description }) as const;
const record = (properties: object, required: string[]) => ({
  type: 'object', properties, required, additionalProperties: false,
}) as const;

/**
 * The schema is built per skeleton, because the shape is the skeleton's:
 * one entry per leg, and one story line per trigger of each leg. The half
 * a schema cannot express (the slots, the sentence counts, the ladder
 * words, a stray world) is `dossierFaults`'s, after the fact.
 */
function schemaFor(p: DossierPrompt) {
  const legs = Object.fromEntries(p.legs.map((leg) => [leg, record({
    arrive: text('The standing order, one sentence. Slots: {TARGET} {PAY}.'),
    success: text('Said when the leg goes right, one sentence. Slots: {TARGET} {PAY}.'),
    fail: text('Said when the leg goes wrong, one sentence. Slots: {TARGET} {PAY}.'),
  }, ['arrive', 'success', 'fail'])]));
  const story = Object.fromEntries(p.legs.map((leg) => [leg, record(
    Object.fromEntries(p.triggers[leg].map((t) => [t, text(`The log line when ${t} happens on this leg. Slots: {WORLD} {DAY}.`)])),
    [...p.triggers[leg]],
  )]));
  return record({
    title: text('Two to five words, no full stop, no slot.'),
    briefing: { type: 'array', minItems: 1, maxItems: 3, items: text('One paragraph the patron speaks. Slots: {PATRON} {HERE}.') },
    legs: record(legs, [...p.legs]),
    lead: text('One sentence. Slots: {PATRON} {WORLD}.'),
    rumour: record({
      far: text('One sentence. Slots: {PATRON} {WORLD}.'),
      near: text('One sentence. Slots: {PATRON} {WORLD}.'),
    }, ['far', 'near']),
    news: text('One sentence. Slots: {PATRON} {WORLD}.'),
    story: record({
      opening: text('One sentence. Slots: {WORLD} {DAY}.'),
      closing: record({
        complete: text('One sentence. Slots: {WORLD} {DAY}.'),
        fail: text('One sentence. Slots: {WORLD} {DAY}.'),
      }, ['complete', 'fail']),
      legs: record(story, [...p.legs]),
    }, ['opening', 'closing', 'legs']),
  }, ['title', 'briefing', 'legs', 'lead', 'rumour', 'news', 'story']);
}

// ------------------------------------------------------------ the drift gate

/** Every committed dossier file, by skeleton id, from the directory's own listing. */
function committed(dir: string): { names: string[]; files: Map<string, DossierFile> } {
  const names = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();
  const files = new Map<string, DossierFile>();
  for (const n of names) files.set(n, JSON.parse(readFileSync(join(dir, `${n}.json`), 'utf8')) as DossierFile);
  return { names, files };
}

/**
 * Does every committed dossier still answer its skeleton, and does the
 * index import every file here? A directory with FEWER dossiers than
 * skeletons passes: an absent dossier is a supported state, and nothing
 * ships until a run happens.
 */
function check(): number {
  const { names, files } = committed(DIR);
  const bad: string[] = [];
  for (const [n, f] of files) {
    if (f.dossier.skeleton !== n) bad.push(`${n}.json holds the dossier for ${f.dossier.skeleton}`);
    bad.push(...dossierDrift(f));
  }
  if (readFileSync(join(DIR, 'index.ts'), 'utf8') !== indexSource(names)) {
    bad.push('index.ts does not list the files here');
  }
  if (bad.length) {
    console.error(`dossiers: stale\n  ${bad.slice(0, 10).join('\n  ')}`);
    if (bad.length > 10) console.error(`  ...and ${bad.length - 10} more`);
    console.error('  regenerate with: npm run generate:dossiers');
    return 1;
  }
  console.log(`dossiers: ok — ${names.length}/${SKELETONS.length} skeletons have a dossier`);
  return 0;
}

// ------------------------------------------------------------- the generator

function requestFor(p: DossierPrompt, note: string | undefined) {
  return {
    max_tokens: 4096,
    system: DOSSIER_SYSTEM_PROMPT,
    output_config: { format: { type: 'json_schema' as const, schema: schemaFor(p) } },
    messages: [{
      role: 'user' as const,
      content: note
        ? `${p.facts}\n\nA previous attempt at this dossier was rejected: ${note}. Write it again and do not repeat that fault.`
        : p.facts,
    }],
  };
}

function dossierFrom(raw: string, p: DossierPrompt): { entry?: Dossier; why?: string } {
  let parsed: Partial<Dossier>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { why: 'not JSON' };
  }
  const skeleton = skeletonById(p.skeleton);
  if (!skeleton) return { why: 'no such skeleton' };
  const d = { ...parsed, skeleton: p.skeleton, hash: p.hash, images: {} } as Dossier;
  const bad = dossierFaults(d, skeleton, p.own);
  if (bad.length) return { why: bad.slice(0, 8).join('; ') };
  return { entry: d };
}

async function generate(
  ids: string[], dir: string, model: string, limit: number, existingBatch: string, via: string,
): Promise<number> {
  const prompts = dossierPrompts(ids).slice(0, limit);
  const job: BatchJob<DossierPrompt, Dossier> = {
    label: 'dossiers', model, items: prompts,
    idOf: (p) => p.skeleton,
    request: requestFor,
    parse: dossierFrom,
    existingBatch,
  };
  let run;
  if (via === 'claude') {
    run = await runLocal(job);
  } else {
    const client = await newClient('dossiers');
    if (!client) return 1;
    run = await runBatches(client, job);
  }
  const { entries, usage, dropped } = run;

  const generated = new Date().toISOString().slice(0, 10);
  const wrote = via === 'claude' ? `${model} via claude -p` : model;
  for (const [id, dossier] of entries) {
    const file: DossierFile = { promptVersion: DOSSIER_PROMPT_VERSION, model: wrote, generated, usage, dossier };
    writeFileSync(join(dir, `${id}.json`), `${JSON.stringify(file, null, 2)}\n`);
  }
  if (dir === DIR) writeFileSync(join(DIR, 'index.ts'), indexSource(committed(DIR).names));

  console.log(`dossiers: wrote ${entries.size}/${prompts.length} to ${dir}`);
  if (dropped.length) console.log(`dossiers: dropped ${dropped.length} —\n  ${dropped.join('\n  ')}`);
  reportCost('dossiers', usage, model, SKELETONS.length);
  return 0;
}

// ---------------------------------------------------------------------- cli

const argv = process.argv.slice(2);
const flag = (n: string, d = ''): string => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? (argv[i + 1] ?? d) : d;
};
const ids = argv.filter((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));

process.exit(argv.includes('--check')
  ? check()
  : await generate(
    ids, flag('out') || DIR, flag('model') || DEFAULT_MODEL,
    Number(flag('limit')) || Infinity, flag('batch'), flag('via'),
  ));
