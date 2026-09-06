// Generate the extended system descriptions, offline, and commit the result.
//
//   node --experimental-strip-types tools/generate-descriptions.ts [galaxy] \
//        [--model claude-haiku-4-5] [--limit N] [--out NAME] [--batch ID] [--check]
//
//   --check   the non-writing drift gate, wired into `npm run check`. No API
//             call, no key needed.
//   --batch   collect an already-submitted batch instead of sending a new one.
//   --limit   generate only the first N systems — for tasting a model cheaply.
//   --out     write to descriptions/<NAME>.json instead of galaxy-<n>.json, so
//             two models can be generated side by side and read against
//             each other before either is adopted.
//
// Uses the Message Batches API through tools/batch.ts: the whole job is
// offline, nothing waits on it, and batching halves the price. Galaxy 1 costs
// roughly forty cents on Haiku 4.5 this way.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  systemPrompts, SYSTEM_PROMPT, PROMPT_VERSION, faults, foreignSystemNames,
  type SystemPrompt,
} from './system-prompts.ts';
import { newClient, reportCost, runBatches, type Usage } from './batch.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = join(HERE, '..', 'src', 'galaxy', 'descriptions');

const DEFAULT_MODEL = 'claude-haiku-4-5';

/**
 * The schema is the contract. Structured outputs constrain the SHAPE — two
 * fields, both strings, nothing else — which is the half a schema can express.
 * The half it cannot (no digits, no second person, length) is checked by
 * `faults()` after the fact, and a record that fails is dropped rather than
 * repaired: a missing entry falls back to the 1984 line, which is a supported
 * state, so there is nothing to gain by shipping a bad one.
 */
const SCHEMA = {
  type: 'object',
  properties: {
    description: {
      type: 'string',
      description: 'Two to four sentences on the world itself. No digits, no second person.',
    },
    inhabitants: {
      type: 'string',
      description: 'One to three sentences on the people. No digits, no second person.',
    },
  },
  required: ['description', 'inhabitants'],
  additionalProperties: false,
} as const;

interface Entry {
  system: string;
  hash: string;
  description: string;
  inhabitants: string;
}

interface Overlay {
  galaxy: number;
  promptVersion: number;
  model: string;
  generated: string;
  usage: Usage;
  entries: Record<string, Entry>;
}

const overlayPath = (name: string): string => join(DIR, `${name}.json`);

function readOverlay(name: string): Overlay | null {
  try {
    return JSON.parse(readFileSync(overlayPath(name), 'utf8')) as Overlay;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------ the drift gate

/**
 * Does the committed file still describe the galaxy it claims to?
 *
 * Three ways to fail, and one deliberate way to pass:
 *
 *  - an entry whose hash no longer matches the manifest — the rules or that
 *    system's facts changed, so the prose was written against a world that no
 *    longer exists;
 *  - an entry whose name no longer matches the system at that index;
 *  - an entry at an index the galaxy does not have.
 *
 * A file with FEWER entries than the galaxy has systems passes, because a
 * missing entry is a supported state (src/galaxy/descriptions.ts). That is why
 * an empty overlay — which is what ships until a generation run happens — does
 * not fail the build.
 */
function check(galaxy: number, name: string): number {
  const prompts = systemPrompts(galaxy);
  const byIndex = new Map(prompts.map((p) => [String(p.index), p]));
  const file = readOverlay(name);

  if (!file) {
    console.error(`descriptions: no ${name}.json — nothing to check`);
    return 1;
  }

  const bad: string[] = [];
  if (file.promptVersion !== PROMPT_VERSION) {
    bad.push(`file was generated under prompt version ${file.promptVersion}, now ${PROMPT_VERSION}`);
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

  const n = Object.keys(file.entries).length;
  if (bad.length) {
    console.error(`descriptions: ${name}.json is stale\n  ${bad.slice(0, 10).join('\n  ')}`);
    if (bad.length > 10) console.error(`  ...and ${bad.length - 10} more`);
    console.error('  regenerate with: npm run generate:descriptions');
    return 1;
  }
  console.log(`descriptions: ${name}.json ok — ${n}/${prompts.length} systems described`);
  return 0;
}

// ------------------------------------------------------------- the generator

/**
 * The request for one system. `custom_id` is the index.
 *
 * `max_tokens` is 2048 rather than the 1024 it started at, because it caps
 * THINKING plus response and Sonnet 5 thinks by default. The first taste run
 * showed exactly that: Sonnet spent 506 output tokens per request against
 * Haiku's 205 and truncated two of twelve entries mid-sentence, while the
 * prose it did finish was well inside any sane length. Truncation was the
 * ceiling being sized for the answer alone.
 */
function requestFor(p: SystemPrompt, note: string | undefined) {
  return {
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    output_config: { format: { type: 'json_schema' as const, schema: SCHEMA } },
    messages: [{
      role: 'user' as const,
      content: note
        ? `${p.facts}\n\nA previous attempt at this system was rejected: ${note}. Write it again and do not repeat that fault.`
        : p.facts,
    }],
  };
}

/**
 * Turn the model's text into an entry, or say why not. A record that breaks
 * a rule is dropped rather than repaired: a missing entry falls back to the
 * 1984 line, which is a supported state.
 */
function entryFrom(text: string, want: SystemPrompt): { entry?: Entry; why?: string } {
  let parsed: { description?: string; inhabitants?: string };
  try {
    parsed = JSON.parse(text);
  } catch {
    return { why: 'not JSON' };
  }

  const description = (parsed.description ?? '').trim();
  const inhabitants = (parsed.inhabitants ?? '').trim();
  const bad = [
    ...faults(description, 'description'),
    ...faults(inhabitants, 'inhabitants'),
    // The facts block is the canon it was handed, goat-soup line included —
    // anything named in there is not the model wandering off.
    ...foreignSystemNames(`${description} ${inhabitants}`, want.system, want.facts)
      .map((n) => `names another system (${n})`),
  ];
  if (bad.length) return { why: bad.join('; ') };

  return { entry: { system: want.system, hash: want.hash, description, inhabitants } };
}

async function generate(
  galaxy: number, name: string, model: string, limit: number, existingBatch: string,
): Promise<number> {
  const client = await newClient('descriptions');
  if (!client) return 1;

  const prompts = systemPrompts(galaxy).slice(0, limit);
  const { entries: got, usage, dropped } = await runBatches<SystemPrompt, Entry>(client, {
    label: 'descriptions', model, items: prompts,
    idOf: (p) => `sys-${p.index}`,
    request: requestFor,
    parse: entryFrom,
    existingBatch,
  });

  const entries: Record<string, Entry> = {};
  for (const p of prompts) {
    const e = got.get(`sys-${p.index}`);
    if (e) entries[String(p.index)] = e;
  }

  const overlay: Overlay = {
    galaxy,
    promptVersion: PROMPT_VERSION,
    model,
    generated: new Date().toISOString().slice(0, 10),
    usage,
    // Sorted numerically so the committed file diffs cleanly between runs.
    entries: Object.fromEntries(
      Object.entries(entries).sort((a, b) => Number(a[0]) - Number(b[0])),
    ),
  };
  writeFileSync(overlayPath(name), `${JSON.stringify(overlay, null, 2)}\n`);

  const kept = Object.keys(entries).length;
  console.log(`descriptions: wrote ${kept}/${prompts.length} to ${name}.json`);
  if (dropped.length) {
    console.log(`descriptions: dropped ${dropped.length} —\n  ${dropped.join('\n  ')}`);
  }
  reportCost('descriptions', usage, model, systemPrompts(galaxy).length);
  return 0;
}

// ---------------------------------------------------------------------- cli

const argv = process.argv.slice(2);
const flag = (n: string, d = ''): string => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? (argv[i + 1] ?? d) : d;
};

const galaxy = Number(argv.find((a) => /^\d+$/.test(a)) ?? 1);
const name = flag('out') || `galaxy-${galaxy}`;

process.exit(argv.includes('--check')
  ? check(galaxy, name)
  : await generate(
    galaxy, name, flag('model') || DEFAULT_MODEL,
    Number(flag('limit')) || Infinity, flag('batch'),
  ));
