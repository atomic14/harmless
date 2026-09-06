// Generate the patrons of a galaxy, offline, and commit the result.
//
//   node --experimental-strip-types tools/generate-patrons.ts [galaxy] \
//        [--model claude-haiku-4-5] [--limit N] [--out NAME] [--batch ID] [--check]
//
//   --check   the non-writing drift gate, wired into `npm run check`. No API
//             call, no key needed.
//   --batch   collect an already-submitted batch instead of sending a new one.
//   --limit   generate only the first N worlds, for tasting a model cheaply.
//   --out     write to patrons/<NAME>.json instead of galaxy-<n>.json, so two
//             models can be read against each other before either is adopted.
//
// The same shape as tools/generate-descriptions.ts, on the same batch runner
// (tools/batch.ts). The prompt is tools/patron-prompts.ts's, and the reader
// is src/missions/patrons.ts (docs/TODO/191 M1).

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { PatronFile, PatronRecord } from '../src/missions/patrons.ts';
import { newClient, reportCost, runBatches } from './batch.ts';
import {
  PATRON_PROMPT_VERSION, PATRON_SYSTEM_PROMPT, patronDrift, patronFaults, patronPrompts,
  type PatronPrompt,
} from './patron-prompts.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = join(HERE, '..', 'src', 'missions', 'patrons');

const DEFAULT_MODEL = 'claude-haiku-4-5';

/**
 * The schema constrains the SHAPE: two strings, nothing else. The half it
 * cannot express (a plain name, no system named, one or two sentences) is
 * `patronFaults`'s, after the fact. A record that fails is dropped rather
 * than repaired, because a missing record falls back to a plain patron.
 */
const SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'One to three words, letters only. No digits.' },
    voice: {
      type: 'string',
      description: 'One or two sentences, third person, on how this patron speaks.',
    },
  },
  required: ['name', 'voice'],
  additionalProperties: false,
} as const;

const filePath = (name: string): string => join(DIR, `${name}.json`);

function readFile(name: string): PatronFile | null {
  try {
    return JSON.parse(readFileSync(filePath(name), 'utf8')) as PatronFile;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------ the drift gate

function check(galaxy: number, name: string): number {
  const file = readFile(name);
  if (!file) {
    console.error(`patrons: no ${name}.json — nothing to check`);
    return 1;
  }
  const bad = patronDrift(file, galaxy);
  const n = Object.keys(file.entries).length;
  if (bad.length) {
    console.error(`patrons: ${name}.json is stale\n  ${bad.slice(0, 10).join('\n  ')}`);
    if (bad.length > 10) console.error(`  ...and ${bad.length - 10} more`);
    console.error('  regenerate with: npm run generate:patrons');
    return 1;
  }
  console.log(`patrons: ${name}.json ok — ${n}/${patronPrompts(galaxy).length} worlds have a patron`);
  return 0;
}

// ------------------------------------------------------------- the generator

function requestFor(p: PatronPrompt, note: string | undefined) {
  return {
    max_tokens: 1024,
    system: PATRON_SYSTEM_PROMPT,
    output_config: { format: { type: 'json_schema' as const, schema: SCHEMA } },
    messages: [{
      role: 'user' as const,
      content: note
        ? `${p.facts}\n\nA previous attempt at this patron was rejected: ${note}. Write it again and do not repeat that fault.`
        : p.facts,
    }],
  };
}

function recordFrom(text: string, want: PatronPrompt): { entry?: PatronRecord; why?: string } {
  let parsed: { name?: string; voice?: string };
  try {
    parsed = JSON.parse(text);
  } catch {
    return { why: 'not JSON' };
  }
  const name = (parsed.name ?? '').trim();
  const voice = (parsed.voice ?? '').trim();
  const bad = patronFaults(name, voice);
  if (bad.length) return { why: bad.join('; ') };
  return { entry: { system: want.system, hash: want.hash, name, role: want.role, voice } };
}

async function generate(
  galaxy: number, name: string, model: string, limit: number, existingBatch: string,
): Promise<number> {
  const client = await newClient('patrons');
  if (!client) return 1;

  const prompts = patronPrompts(galaxy).slice(0, limit);
  const { entries: got, usage, dropped } = await runBatches<PatronPrompt, PatronRecord>(client, {
    label: 'patrons', model, items: prompts,
    idOf: (p) => `sys-${p.index}`,
    request: requestFor,
    parse: recordFrom,
    existingBatch,
  });

  const entries: Record<string, PatronRecord> = {};
  for (const p of prompts) {
    const e = got.get(`sys-${p.index}`);
    if (e) entries[String(p.index)] = e;
  }

  const file: PatronFile = {
    galaxy,
    promptVersion: PATRON_PROMPT_VERSION,
    model,
    generated: new Date().toISOString().slice(0, 10),
    usage,
    entries,
  };
  writeFileSync(filePath(name), `${JSON.stringify(file, null, 2)}\n`);

  console.log(`patrons: wrote ${Object.keys(entries).length}/${prompts.length} to ${name}.json`);
  if (dropped.length) console.log(`patrons: dropped ${dropped.length} —\n  ${dropped.join('\n  ')}`);
  reportCost('patrons', usage, model, patronPrompts(galaxy).length);
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
