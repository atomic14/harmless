// The Message Batches run that every offline generator shares.
//
//   loadKey()      reads ANTHROPIC_API_KEY from the environment, or .env.local
//   newClient()    the SDK client, or null with the missing key named
//   runBatches()   submits, polls, collects, and retries a dropped record
//   reportCost()   prints the tokens spent, and the money they cost
//
// ONE HOME for the batch mechanics. Three generators use it: the descriptions
// (tools/generate-descriptions.ts), the patrons (tools/generate-patrons.ts)
// and the dossiers (tools/generate-dossiers.ts). Each one owns its prompt, its
// schema and its record, and nothing about a refusal, a truncation or a
// retry. Those were one copy in the first generator, and a second generator
// with its own copy is the two-homes failure this repository is organised
// against (docs/TODO/191).
//
// The API key is a developer credential for an offline tool. It is read from
// the environment, never committed, and nothing in src/ ever sees it.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * What a run cost.
 *
 * TOKENS are the durable fact, and they are what a generator commits. The
 * money is derived and printed, never stored, because a price list goes stale
 * and a token count does not. They count EVERY result, the dropped ones too.
 * A refused or over-length record was still paid for.
 */
export interface Usage {
  requests: number;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Batch rates, USD per million tokens, already halved for the batch discount.
 * As of 2026-08-03. Sonnet 5 was on an introductory rate until 2026-08-31,
 * after which it is $1.50/$7.50 batched.
 */
export const BATCH_RATES: Record<string, { in: number; out: number }> = {
  'claude-haiku-4-5': { in: 0.50, out: 2.50 },
  'claude-sonnet-5': { in: 1.50, out: 7.50 },
  'claude-opus-5': { in: 2.50, out: 12.50 },
};

/** Print the tokens, and the money at batch rates when the model has a rate. */
export function reportCost(label: string, u: Usage, model: string, ofTotal: number): void {
  const per = (n: number) => (n / Math.max(u.requests, 1)).toFixed(0);
  console.log(`${label}: ${u.inputTokens} in + ${u.outputTokens} out over `
    + `${u.requests} requests (${per(u.inputTokens)}/${per(u.outputTokens)} each)`);

  const rate = BATCH_RATES[model];
  if (!rate) return;
  const cost = (u.inputTokens * rate.in + u.outputTokens * rate.out) / 1e6;
  const full = cost * (ofTotal / Math.max(u.requests, 1));
  console.log(`${label}: $${cost.toFixed(4)} at batch rates`
    + (ofTotal > u.requests ? ` — all ${ofTotal} would be about $${full.toFixed(2)}` : ''));
}

/**
 * Read `ANTHROPIC_API_KEY` out of `.env.local` when the environment lacks it.
 *
 * `*.local` is gitignored, so the key stays on the machine that owns it. The
 * alternative is a secret on a command line, which lands in shell history.
 */
export function loadKey(): void {
  if (process.env.ANTHROPIC_API_KEY) return;
  try {
    const text = readFileSync(join(HERE, '..', '.env.local'), 'utf8');
    const hit = /^\s*ANTHROPIC_API_KEY\s*=\s*(.+?)\s*$/m.exec(text);
    if (hit) process.env.ANTHROPIC_API_KEY = hit[1].replace(/^['"]|['"]$/g, '');
  } catch { /* no file: the caller says what is missing */ }
}

/** The SDK client, or null after a line that names the missing key. */
export async function newClient(label: string): Promise<any | null> {
  loadKey();
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(`${label}: no ANTHROPIC_API_KEY — set it, or put it in .env.local`);
    return null;
  }
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  return new Anthropic();
}

/**
 * The text of one batch result, or the reason there is none.
 *
 * Everything that can go wrong here is expected rather than exceptional: a
 * refusal, a truncation, an errored request. All of it returns a reason and
 * none of it throws. The run reports what it dropped and writes the rest.
 */
export function messageText(result: any): { text?: string; why?: string } {
  if (result.result.type !== 'succeeded') {
    return { why: `${result.result.type}: ${result.result.error?.type ?? ''}` };
  }
  const msg = result.result.message;
  if (msg.stop_reason === 'refusal') return { why: 'refused' };
  if (msg.stop_reason === 'max_tokens') return { why: 'truncated' };
  const text = msg.content.find((b: any) => b.type === 'text')?.text;
  if (!text) return { why: 'no text block' };
  return { text };
}

/** One generator's half of a run: what to ask, and what to make of an answer. */
export interface BatchJob<K, E> {
  /** the prefix on every console line */
  label: string;
  model: string;
  items: readonly K[];
  /** the `custom_id`: results come back in any order, so nothing matches by position */
  idOf(item: K): string;
  /**
   * The request parameters for one item. `note` carries the reason a previous
   * attempt was dropped. Naming the fault is the whole point: "avoid banned
   * words" is ignored, and "you used sprawling" is not.
   */
  request(item: K, note: string | undefined): object;
  /** the record from the model's text, or why it is dropped */
  parse(text: string, item: K): { entry?: E; why?: string };
  /** collect an already-submitted batch, instead of a new first pass */
  existingBatch?: string;
  /** at most this many passes; the default is three */
  passes?: number;
}

export interface BatchOutcome<E> {
  /** by `custom_id` */
  entries: Map<string, E>;
  usage: Usage;
  /** what the last pass still dropped, one line each */
  dropped: string[];
}

/**
 * Submit, poll, collect, and retry.
 *
 * Up to three passes. A dropped record is not a lost cause: the faults are
 * almost all a banned word or a length overrun, and a model told which word
 * it used does not use it again. Without the retry about one record in eight
 * would silently have no text forever, which a fallback makes invisible rather
 * than harmless.
 */
export async function runBatches<K, E>(client: any, job: BatchJob<K, E>): Promise<BatchOutcome<E>> {
  const { label, model } = job;
  const byId = new Map(job.items.map((k) => [job.idOf(k), k]));
  const entries = new Map<string, E>();
  const usage: Usage = { requests: 0, inputTokens: 0, outputTokens: 0 };
  let todo = [...job.items];
  let notes = new Map<string, string>();
  let dropped: string[] = [];

  for (let pass = 0; pass < (job.passes ?? 3) && todo.length; pass += 1) {
    let batchId = pass === 0 ? (job.existingBatch ?? '') : '';
    if (!batchId) {
      const what = pass === 0 ? `${todo.length} requests` : `${todo.length} retries`;
      console.log(`${label}: submitting ${what} to ${model}...`);
      const batch = await client.messages.batches.create({
        requests: todo.map((k) => ({
          custom_id: job.idOf(k),
          params: { model, ...job.request(k, notes.get(job.idOf(k))) },
        })),
      });
      batchId = batch.id;
      console.log(`${label}: batch ${batchId} — resume with --batch ${batchId}`);
    }

    // Most batches land inside an hour; the cap is 24. Poll gently.
    for (;;) {
      const batch = await client.messages.batches.retrieve(batchId);
      if (batch.processing_status === 'ended') break;
      const c = batch.request_counts;
      console.log(`${label}: ${batch.processing_status} — ${c.succeeded} done, ${c.processing} running`);
      await new Promise((r) => { setTimeout(r, 30_000); });
    }

    const failed: K[] = [];
    notes = new Map();
    dropped = [];

    for await (const result of await client.messages.batches.results(batchId)) {
      // Count the tokens before the prose is judged: a dropped record was
      // still generated and still billed, retries included.
      const u = (result.result as any).message?.usage;
      if (u) {
        usage.requests += 1;
        usage.inputTokens += (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0)
          + (u.cache_read_input_tokens ?? 0);
        usage.outputTokens += u.output_tokens ?? 0;
      }

      const item = byId.get(result.custom_id);
      if (!item) { dropped.push(`${result.custom_id}: not in this run`); continue; }
      const { text, why: whyNoText } = messageText(result);
      const { entry, why } = text === undefined ? { why: whyNoText } : job.parse(text, item);
      if (entry) { entries.set(result.custom_id, entry); continue; }
      failed.push(item);
      notes.set(result.custom_id, why ?? 'unknown');
      dropped.push(`${result.custom_id}: ${why}`);
    }

    if (failed.length) console.log(`${label}: ${failed.length} to retry`);
    todo = failed;
  }

  return { entries, usage, dropped };
}
