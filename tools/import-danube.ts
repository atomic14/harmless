// Import the vendored Blue Danube decode into a compact, generated score.
//
//   npm run generate:danube              # write
//   npm run generate:danube -- --check   # compare only, non-zero on drift
//
// This file is the boundary. `reference/danube/source/elite_blue_danube.json`
// is a megabyte of decoded SID register writes carrying a full snapshot per
// voice per frame — note names, tuning cents, ADSR nibbles, derived vibrato
// frequencies, the raw driver commands. Almost all of it is either redundant
// (derivable from the frequency register) or documentation (the note name).
// What the player actually needs is 454 frames and 916 voice triggers, and
// that is what this writes.
//
// The pinned hashes below are the point of the exercise, exactly as in
// `import-elite-a.mjs`: the pack came from outside the repository, so "the same
// data" has to mean something checkable rather than "the file with that name".
// A pack that hashes differently is a different pack, and this stops rather
// than quietly regenerating a different tune.
//
// IT ALSO VERIFIES THE RULES IT COMPRESSES BY. Three facts make the compact
// form possible — Hz is a function of the frequency register, vibrato is a
// function of the voice number, and the frames tile the timeline without a gap.
// None of them is guaranteed by the format; all three are asserted here, so a
// revised pack that broke one would fail the import rather than silently lose
// the part that no longer fits.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIR = join(ROOT, 'reference/danube/source');
const OUT = join(ROOT, 'src/music-danube.ts');
const MANIFEST = join(ROOT, 'reference/danube/manifest.json');

/** The pack, by SHA-256. Changing one of these is a deliberate act. */
const PINNED: Record<string, string> = {
  'elite_blue_danube.json':
    'a5c0e44d23d86ad3843713d475ce5201acaa4414d9656f37898545122cf846cb',
  'elite_blue_danube_player.html':
    '410da15fa7166694cb77e3b84809da0d42cb987794da2c21b171bbda73bc1751',
};

/**
 * The SID's vibrato, per voice, as the GMA production driver does it: add this
 * much to the frequency register every this many ticks, alternating back.
 *
 * Written here rather than read per note because it IS per voice and not per
 * note — the source repeats the resulting `upperFrequencyHz` on all 602 of the
 * voice-2 and voice-3 triggers, and every one of them agrees with this table.
 * `checkVibrato` below is what makes that claim rather than assuming it, and a
 * pack whose driver differed would fail there instead of being averaged away.
 */
const VIBRATO: Record<number, { increment: number; halfPeriodTicks: number }> = {
  1: { increment: 0, halfPeriodTicks: 0 },
  2: { increment: 32, halfPeriodTicks: 4 },
  3: { increment: 37, halfPeriodTicks: 5 },
};

const WAVE_NAMES: Record<string, string> = {
  sawtooth: 'SAW', triangle: 'TRI', pulse: 'PLS',
};

interface SourceVoice {
  voice: number;
  frequencyRegister: number;
  frequencyHz: number;
  control: { gate: boolean; waveforms: string[] };
  adsr: {
    attackSeconds: number; decaySeconds: number;
    sustainLevel: number; releaseSeconds: number;
  };
  pulseWidthRegister: number;
  vibrato: { sidIncrement: number; halfPeriodTicks: number; upperFrequencyHz: number } | null;
}

interface SourceFrame {
  tick: number;
  waitTicks: number;
  voices: SourceVoice[];
  global: { cutoffApproxHz: number } | null;
}

interface Source {
  format: string;
  timing: { tickRateHz: number; durationTicks: number; durationSeconds: number };
  sid: { clockHz: number };
  statistics: { frames: number; noteTriggers: number };
  frames: SourceFrame[];
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function fail(message: string): never {
  console.error(`generate:danube — ${message}`);
  process.exit(1);
}

/** Read the pack, refusing anything that is not the pack this was built against. */
function readPack(): { source: Source; files: { name: string; bytes: number; sha256: string }[] } {
  const files = [];
  let source: Source | null = null;
  for (const [name, expected] of Object.entries(PINNED)) {
    let bytes: Buffer;
    try {
      bytes = readFileSync(join(SOURCE_DIR, name));
    } catch {
      return fail(`missing reference/danube/source/${name}`);
    }
    const hash = sha256(bytes);
    if (hash !== expected) {
      fail(`reference/danube/source/${name} is not the pinned pack\n`
        + `  expected ${expected}\n  found    ${hash}`);
    }
    files.push({ name, bytes: bytes.length, sha256: hash });
    if (name.endsWith('.json')) source = JSON.parse(bytes.toString('utf8')) as Source;
  }
  if (!source) fail('the pack has no JSON score in it');
  if (source.format !== 'elite-blue-danube-web-audio-ir') {
    fail(`unexpected format "${source.format}"`);
  }
  return { source, files };
}

/** Hz from a SID frequency register, which is the whole of the pitch data. */
const hzOf = (register: number, clockHz: number): number =>
  register * clockHz / 2 ** 24;

/**
 * Every claim the compact form rests on, checked against the pack.
 *
 * These are not paranoia about a file that has already hashed correctly. They
 * are what a REVISED pack would have to keep true for the generated score to
 * still mean the same thing, and stating them here is cheaper than discovering
 * from the speakers that a second waveform per voice, or a gap in the timeline,
 * was quietly dropped on the floor.
 */
function verify(source: Source): void {
  const { clockHz } = source.sid;
  let tick = 0;
  let triggers = 0;
  for (const frame of source.frames) {
    if (frame.tick !== tick) fail(`frames do not tile the timeline: expected tick ${tick}, found ${frame.tick}`);
    tick += frame.waitTicks;
    for (const v of frame.voices) {
      triggers++;
      if (!v.control.gate) fail(`an ungated voice at tick ${frame.tick}`);
      if (v.control.waveforms.length !== 1) {
        fail(`voice ${v.voice} at tick ${frame.tick} mixes ${v.control.waveforms.length} waveforms;`
          + ' the compact score keeps one per trigger');
      }
      if (!(v.control.waveforms[0] in WAVE_NAMES)) {
        fail(`unknown waveform "${v.control.waveforms[0]}" at tick ${frame.tick}`);
      }
      if (Math.abs(hzOf(v.frequencyRegister, clockHz) - v.frequencyHz) > 1e-4) {
        fail(`voice ${v.voice} at tick ${frame.tick} does not follow the SID frequency formula`);
      }
      checkVibrato(v, frame.tick, clockHz);
    }
  }
  if (tick !== source.timing.durationTicks) {
    fail(`the frames run to ${tick} ticks, the header says ${source.timing.durationTicks}`);
  }
  if (source.frames.length !== source.statistics.frames || triggers !== source.statistics.noteTriggers) {
    fail(`counted ${source.frames.length} frames and ${triggers} triggers;`
      + ` the header says ${source.statistics.frames} and ${source.statistics.noteTriggers}`);
  }
  if (source.frames[0].global === null) {
    fail('the first frame sets no filter cutoff, so a carried-forward cutoff would start undefined');
  }
}

/** The vibrato on a trigger must be the one its VOICE always uses, or nothing. */
function checkVibrato(v: SourceVoice, tick: number, clockHz: number): void {
  const rule = VIBRATO[v.voice];
  if (!rule) fail(`voice ${v.voice} at tick ${tick} is not one of the SID's three`);
  if (rule.increment === 0) {
    if (v.vibrato) fail(`voice ${v.voice} at tick ${tick} vibratos, and its voice never does`);
    return;
  }
  if (!v.vibrato) fail(`voice ${v.voice} at tick ${tick} does not vibrato, and its voice always does`);
  if (v.vibrato.sidIncrement !== rule.increment || v.vibrato.halfPeriodTicks !== rule.halfPeriodTicks) {
    fail(`voice ${v.voice} at tick ${tick} vibratos by ${v.vibrato.sidIncrement}/${v.vibrato.halfPeriodTicks},`
      + ` not the driver's ${rule.increment}/${rule.halfPeriodTicks}`);
  }
  const upper = hzOf(v.frequencyRegister + rule.increment, clockHz);
  if (Math.abs(upper - v.vibrato.upperFrequencyHz) > 1e-4) {
    fail(`voice ${v.voice} at tick ${tick} has an upper vibrato pitch that is not register + increment`);
  }
}

/** The distinct envelopes, in order of first use, and where each trigger points. */
function envelopes(source: Source): { table: SourceVoice['adsr'][]; index: Map<string, number> } {
  const table: SourceVoice['adsr'][] = [];
  const index = new Map<string, number>();
  for (const frame of source.frames) {
    for (const v of frame.voices) {
      const key = `${v.adsr.attackSeconds},${v.adsr.decaySeconds},${v.adsr.sustainLevel},${v.adsr.releaseSeconds}`;
      if (!index.has(key)) {
        index.set(key, table.length);
        table.push(v.adsr);
      }
    }
  }
  return { table, index };
}

function render(source: Source): string {
  verify(source);
  const { table, index } = envelopes(source);
  const { clockHz } = source.sid;
  const seconds = source.timing.durationSeconds.toFixed(2);

  const adsrLines = table.map((a, i) =>
    `  { attack: ${a.attackSeconds}, decay: ${a.decaySeconds},`
    + ` sustain: ${a.sustainLevel}, release: ${a.releaseSeconds} }, // ${i}`);

  let carried = 0;
  const frameLines = source.frames.map((frame) => {
    const cutoff = frame.global ? frame.global.cutoffApproxHz : 0;
    if (cutoff) carried = cutoff;
    const voices = frame.voices.map((v) => {
      const key = `${v.adsr.attackSeconds},${v.adsr.decaySeconds},${v.adsr.sustainLevel},${v.adsr.releaseSeconds}`;
      return `v(${v.voice}, ${v.frequencyRegister}, ${WAVE_NAMES[v.control.waveforms[0]]},`
        + ` ${index.get(key)}, ${v.pulseWidthRegister})`;
    });
    return `  f(${frame.tick}, ${frame.waitTicks}, ${cutoff}${voices.length ? ', ' : ''}${voices.join(', ')}),`;
  });
  if (!carried) fail('no filter cutoff anywhere in the pack');

  return `// GENERATED FILE — DO NOT EDIT.
//
// "An der schönen blauen Donau", as the Commodore 64 Elite's docking computer
// played it: ${source.statistics.frames} timed frames and ${source.statistics.noteTriggers} note triggers across three SID voices,
// ${seconds} seconds at ${source.timing.tickRateHz} Hz PAL.
//
// Written by \`npm run generate:danube\` from the vendored pack under
// reference/danube/source. To change it, change the importer or the pack,
// regenerate, and review the diff. \`npm run generate:danube -- --check\` fails
// if this file and the pack have drifted apart.
//
// PROVENANCE, and read reference/danube/README.md before reusing any of it. The
// waltz is Strauss, 1866, and public domain. THIS ARRANGEMENT OF IT IS NOT: it
// is Julie Dunn's 1985 transcription for three SID voices, decoded from the
// production music data of a commercial game, and it is a separate copyrighted
// work from the tune it arranges. It is here because Chris decided it should
// be. Nothing in this repository claims otherwise.
//
// The compact form drops what the source could always recompute. Pitch is a
// frequency REGISTER, because Hz is \`register * ${clockHz} / 2**24\` and the
// engine does that division. Vibrato is not stored at all, because it belongs
// to the VOICE and not the note — voice 1 never vibratos, voice 2 steps +32
// every 4 ticks, voice 3 +37 every 5 — and \`tools/import-danube.ts\` checks
// every trigger in the pack against that rule rather than trusting it.
//
// source-hash: ${sha256(Buffer.from(JSON.stringify(source.frames)))}

import type { DanubeFrame, SidAdsr, SidVoice } from './music.ts';

// Spelled out here rather than imported from the engine ON PURPOSE: the engine
// imports this file, and a VALUE import back would close a cycle for three
// strings. \`import type\` above is erased, so nothing circular survives compilation.
const SAW = 'sawtooth';
const TRI = 'triangle';
const PLS = 'pulse';

/**
 * Every distinct envelope in the piece, in order of first use.
 *
 * The source repeats the full ADSR on all ${source.statistics.noteTriggers} triggers; there are ${table.length} of them.
 * The seconds are the SID's nominal nibble times, not measured chip behaviour —
 * see the approximations listed in reference/danube/README.md.
 */
export const DANUBE_ADSR: readonly SidAdsr[] = [
${adsrLines.join('\n')}
];

/** One gated voice: which of the three, its pitch register, and how it sounds. */
const v = (voice: 1 | 2 | 3, register: number, wave: SidVoice['wave'],
  envelope: number, pulseRegister: number): SidVoice =>
  ({ voice, register, wave, envelope: DANUBE_ADSR[envelope], pulseRegister });

/**
 * One frame: when it starts, how long until the next, whether it moved the
 * filter, and what it gates.
 *
 * \`cutoff\` is 0 on a frame that did not change it — ${source.frames.filter((x) => x.global).length} frames in the piece do —
 * and the engine carries the last one forward. The first frame sets one, so
 * there is no such thing as a frame with no cutoff in force.
 */
const f = (tick: number, ticks: number, cutoff: number, ...voices: SidVoice[]): DanubeFrame =>
  ({ tick, ticks, cutoff, voices });

/** The piece, in order. */
export const DANUBE_FRAMES: readonly DanubeFrame[] = [
${frameLines.join('\n')}
];

/** The C64's frame rate, and the clock the whole arrangement is timed against. */
export const DANUBE_TICK_HZ = ${source.timing.tickRateHz};

/** How long it runs, in seconds — ${seconds}s, which is the PAL playback. */
export const DANUBE_SECONDS = ${source.timing.durationTicks} / DANUBE_TICK_HZ;
`;
}

function main(): void {
  const check = process.argv.includes('--check');
  const { source, files } = readPack();
  const rendered = render(source);
  const manifest = `${JSON.stringify({
    note: 'Provenance for the verbatim pack in ./source. Regenerate with `npm run generate:danube`.',
    files,
  }, null, 2)}\n`;

  if (check) {
    let drift = false;
    for (const [path, want] of [[OUT, rendered], [MANIFEST, manifest]] as const) {
      let have = '';
      try { have = readFileSync(path, 'utf8'); } catch { /* missing counts as drift */ }
      if (have !== want) {
        console.error(`generate:danube — ${path.slice(ROOT.length + 1)} has drifted from the pack`);
        drift = true;
      }
    }
    if (drift) process.exit(1);
    console.log(`generate:danube — up to date (${source.statistics.frames} frames,`
      + ` ${source.statistics.noteTriggers} triggers)`);
    return;
  }

  writeFileSync(OUT, rendered);
  writeFileSync(MANIFEST, manifest);
  console.log(`generate:danube — wrote ${source.statistics.frames} frames and`
    + ` ${source.statistics.noteTriggers} triggers to src/music-danube.ts`);
}

main();
