// The docking waltz: a SID player, and the arrangement it plays.
//
// Split from audio.ts, which is a box of bleeps — `sweep`, `tone`,
// `noiseBurst`, one-shot noises with no notion of a note. This is the other
// thing entirely: pitches, envelopes, three voices and a 50 Hz clock. They
// shared a file until the player arrived. The player pushed that file over the
// size ceiling. The ceiling was right: no laser and no explosion reaches
// anything here, and nothing there knows what a frame is.
//
// It owns no AudioContext. `audio.ts` holds the one context in the program and
// hands it in, which is what keeps the lazy-on-first-gesture rule in one place.

// --- provenance --------------------------------------------------------------
//
// The Commodore 64 Elite played "An der schönen blauen Donau" while you docked.
// The film 2001 borrowed the same waltz first, and the game nods to the film.
// What this file plays is THAT PERFORMANCE: Julie Dunn's 1985 arrangement for
// three SID voices. A decoder read it frame by frame out of the production
// music data of the C64 release. `reference/danube/` holds what it read.
//
// BE PLAIN ABOUT WHAT THAT MEANS. The waltz is 1866 and public domain, and
// belongs to anyone. The arrangement of it is not. A transcription for three
// voices is a separate creative work with its own copyright. To decode it out
// of a game binary changes the container and nothing else. This repository used
// to decline exactly this material. It synthesised a waltz of its own from a
// public-domain transcription instead. Chris decided to use the C64
// arrangement. That decision is deliberate. The record is here and in
// README.md, so that the project claims no cleanliness it no longer has.
// `reference/danube/README.md` says the same thing at length. Read it before
// you re-use any of that material.
//
// SO THE SPLIT BELOW IS STILL THE POINT, even though the reason changed. The
// SCORE is which notes, and is `music-danube.ts` — generated, never
// hand-edited, and traceable to a hash. The SYNTHESIS is how they sound, and is
// this file: Web Audio oscillators that stand in for a chip. No emulator of
// that chip runs here. A different score is a data change. A different
// synthesis is another. Neither needs the other touched, which is what makes a
// tuning by ear cheap.

import { DANUBE_FRAMES, DANUBE_SECONDS, DANUBE_TICK_HZ } from './music-danube.ts';

/** The shape of a note, as the SID's four nibbles decode to. */
export interface SidAdsr {
  attack: number;
  decay: number;
  /** the level held after the decay, as a fraction of the peak */
  sustain: number;
  release: number;
}

/** One gated voice inside a frame. */
export interface SidVoice {
  voice: 1 | 2 | 3;
  /** the SID frequency register — `hzOf` turns it into a pitch */
  register: number;
  wave: 'sawtooth' | 'triangle' | 'pulse';
  envelope: SidAdsr;
  /** duty numerator out of 4096; only a `pulse` reads it */
  pulseRegister: number;
}

/** One 50 Hz frame: what it gates, and how long until the next one. */
export interface DanubeFrame {
  tick: number;
  /** ticks until the next frame — which is also how long these notes are held */
  ticks: number;
  /** a new filter cutoff in Hz, or 0 to keep the one in force */
  cutoff: number;
  voices: readonly SidVoice[];
}

// --- the chip, approximately --------------------------------------------------

/**
 * The PAL 6581's clock, and the whole of the pitch maths:
 * `hz = register * CLOCK / 2**24`.
 *
 * This is the chip's own formula rather than a tuning choice. So the
 * arrangement lands about a third of a semitone sharp of concert pitch, and it
 * stays there. To correct it would re-tune somebody's performance to a standard
 * nobody played it at. The sharpness is audible as *the C64*.
 */
const SID_CLOCK_HZ = 985_248;

const hzOf = (register: number): number => register * SID_CLOCK_HZ / 2 ** 24;

/**
 * Vibrato, per voice: add this to the frequency register every this many
 * ticks, and alternate back.
 *
 * It belongs to the voice rather than the note. The driver applies it to voices
 * 2 and 3 without a condition, and never to voice 1. So it is one rule here,
 * rather than a repeated field on all 916 triggers. `tools/import-danube.ts`
 * checks every trigger in the pack against this table on import, so the two
 * cannot drift apart silently.
 */
const VIBRATO: Record<number, { increment: number; halfPeriodTicks: number }> = {
  1: { increment: 0, halfPeriodTicks: 0 },
  2: { increment: 32, halfPeriodTicks: 4 },
  3: { increment: 37, halfPeriodTicks: 5 },
};

/**
 * Where each voice sits in the stereo field.
 *
 * The SID is mono, and this is invention. It comes from the reference player
 * Chris supplied. No amount of fidelity would produce it, and it is still worth
 * the departure. Three voices stacked in the centre are a smear. The
 * arrangement gives voices 1 and 2 genuinely separate lines.
 */
const PAN = [-0.28, 0.24, 0];

/**
 * How loud the whole arrangement sits under the game.
 *
 * This one number decides how the music sits against a laser and an explosion.
 * It is the first knob to reach for if the waltz is too quiet. It is also the
 * first knob to reach for if the waltz drowns the cockpit. Three voices at
 * `VOICE_PEAK` cannot sum past 1 through it, so there is no compressor in the
 * chain and nothing to clip.
 */
const MUSIC_GAIN = 0.35;

/** The top of one voice's envelope, before `MUSIC_GAIN`. */
const VOICE_PEAK = 0.22;

/**
 * The filter, as much of it as is reproduced.
 *
 * The SID has a multimode filter with a resonance and a per-voice routing. The
 * piece switches all three over its length. What is kept is the CUTOFF SWEEP,
 * as a fixed lowpass on every voice. That is the reference player's
 * approximation, and audibly the part that matters. The cutoff falls from
 * 2919 Hz to 2253 and back. That sweep is what makes the middle section change
 * colour. The routing and the band/high-pass modes are dropped. See the
 * approximations in reference/danube/README.md.
 *
 * The multiplier and the Q are the reference player's. They are kept so that
 * what plays in the game is what Chris signed off on in the browser.
 */
const CUTOFF_SCALE = 1.5;
const CUTOFF_MIN = 700;
const CUTOFF_MAX = 15_000;
const FILTER_Q = 1.25;

/**
 * A pulse wave at a given duty, as a Fourier series.
 *
 * Web Audio has square but not pulse, and the SID's pulse width is a third of
 * how it makes a sound. 48 harmonics is the reference player's number. It is
 * enough that a narrow duty is still bright. It is few enough that the highest
 * partials of a top-octave note stay under half the sample rate.
 */
function pulseWave(a: AudioContext, duty: number): PeriodicWave {
  const harmonics = 48;
  const real = new Float32Array(harmonics + 1);
  const imag = new Float32Array(harmonics + 1);
  for (let n = 1; n <= harmonics; n++) {
    const angle = Math.PI * n * duty;
    real[n] = 2 * Math.sin(angle) * Math.cos(angle) / (Math.PI * n);
    imag[n] = 2 * Math.sin(angle) * Math.sin(angle) / (Math.PI * n);
  }
  return a.createPeriodicWave(real, imag, { disableNormalization: false });
}

/**
 * The duty a `pulse` trigger plays at.
 *
 * The arrangement asks for registers 5 and 6 out of 4096, which is a tenth of a
 * per cent. No oscillator can render that waveform. It would alias into noise
 * if it tried. The floor is the reference player's. It is a floor rather than a
 * scale, because both values are below it. Every pulse note in the piece plays
 * at 3%, which is thin and buzzy and correct.
 */
const DUTY_MIN = 0.03;
const DUTY_MAX = 0.97;
const dutyOf = (pulseRegister: number): number =>
  Math.min(DUTY_MAX, Math.max(DUTY_MIN, pulseRegister / 4096));

// --- the player ---------------------------------------------------------------

/** One voice's permanent chain: a level, the swept filter, a place to sit. */
interface Bus {
  input: GainNode;
  filter: BiquadFilterNode;
}

function busFor(a: AudioContext, voice: number, master: GainNode): Bus {
  const input = a.createGain();
  input.gain.value = 1;

  const filter = a.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = FILTER_Q;
  input.connect(filter);

  // Stereo width where the browser has a panner, straight through where it does
  // not. An absent StereoPannerNode must cost the placement, not the music.
  const panner = a.createStereoPanner?.();
  if (panner) {
    panner.pan.value = PAN[voice - 1];
    filter.connect(panner).connect(master);
  } else {
    filter.connect(master);
  }
  return { input, filter };
}

/**
 * Schedule the waltz and hand back every oscillator in it, so it can be cut off.
 *
 * THE PER-VOICE CHAIN IS BUILT ONCE, and every note of that voice plays through
 * it. That is nine nodes rather than three thousand. Six automation events
 * sweep the filter, rather than one filter re-created per note. That is both
 * cheaper and closer to the chip, where the filter is one global thing the
 * driver writes to.
 *
 * THE RELEASE HANGS PAST THE NOTE. That is the one thing worth a sentence about
 * the envelope, and it is the opposite of what the previous score player did.
 * That one fitted the release INSIDE the written length. A legato arrangement,
 * where one note begins as the last ends, would otherwise smear. This is not
 * that. A SID note ends when the driver clears its gate, and the release is
 * what happens AFTER. Up to 2.4 seconds of it rings under whatever is gated
 * next. To fit it inside the frame would clip every note in the piece to its
 * own 7-to-47-tick cell. It would also lose the sustain the arrangement is
 * built out of.
 */
export function playDanube(a: AudioContext, from: number): {
  voices: OscillatorNode[]; until: number;
} {
  const master = a.createGain();
  master.gain.value = MUSIC_GAIN;
  master.connect(a.destination);

  const buses = [1, 2, 3].map((voice) => busFor(a, voice, master));
  const oscillators: OscillatorNode[] = [];
  let until = from;

  for (const frame of DANUBE_FRAMES) {
    const at = from + frame.tick / DANUBE_TICK_HZ;
    if (frame.cutoff) {
      const hz = Math.min(CUTOFF_MAX, Math.max(CUTOFF_MIN, frame.cutoff * CUTOFF_SCALE));
      for (const bus of buses) bus.filter.frequency.setValueAtTime(hz, at);
    }
    for (const voice of frame.voices) {
      until = Math.max(until, scheduleVoice(a, voice, frame, at, buses, oscillators));
    }
  }
  return { voices: oscillators, until: Math.max(until, from + DANUBE_SECONDS) };
}

/** One gated note. Returns the time its release ends. */
function scheduleVoice(a: AudioContext, voice: SidVoice, frame: DanubeFrame,
  at: number, buses: Bus[], oscillators: OscillatorNode[]): number {
  const held = frame.ticks / DANUBE_TICK_HZ;
  const end = at + held;
  const env = voice.envelope;

  // An attack longer than the note itself would never reach its peak. A decay
  // longer than what is left of the note would never reach the sustain. Both
  // are possible here: the envelope is the chip's, the length is the driver's,
  // and neither knows about the other. The fractions are the reference
  // player's.
  const attack = Math.min(env.attack, held * 0.42);
  const decay = Math.min(env.decay, Math.max(0, held - attack) * 0.5);
  const release = Math.min(env.release, 2.5);
  const sustain = Math.max(0.0001, VOICE_PEAK * env.sustain);
  const done = end + Math.max(0.008, release);

  const amp = a.createGain();
  amp.gain.setValueAtTime(0.0001, at);
  amp.gain.exponentialRampToValueAtTime(VOICE_PEAK, at + Math.max(0.002, attack));
  amp.gain.linearRampToValueAtTime(sustain, at + Math.max(0.003, attack + decay));
  // HOLD. Then let go. A WebAudio param keeps its value until the next
  // scheduled event. That is what makes the sustain a sustain, rather than a
  // slope from the decay straight into the release.
  amp.gain.setValueAtTime(sustain, end);
  amp.gain.exponentialRampToValueAtTime(0.0001, done);
  amp.connect(buses[voice.voice - 1].input);

  const o = a.createOscillator();
  if (voice.wave === 'pulse') o.setPeriodicWave(pulseWave(a, dutyOf(voice.pulseRegister)));
  else o.type = voice.wave;

  const hz = hzOf(voice.register);
  o.frequency.setValueAtTime(hz, at);
  applyVibrato(o, voice, hz, at, end);
  o.connect(amp);
  o.start(at);
  o.stop(done + 0.02);
  oscillators.push(o);
  return done;
}

/**
 * The driver's vibrato: a square wobble between the written pitch and the
 * register a fixed step above it.
 *
 * It is stepped rather than an LFO, because that is what the C64 does. The
 * driver adds to the frequency register on a tick boundary, so the pitch jumps.
 * A smooth sine through a detune parameter would be a nicer vibrato, and a
 * different one.
 */
function applyVibrato(o: OscillatorNode, voice: SidVoice, hz: number,
  at: number, end: number): void {
  const rule = VIBRATO[voice.voice];
  if (!rule.increment) return;
  const upper = hzOf(voice.register + rule.increment);
  const half = rule.halfPeriodTicks / DANUBE_TICK_HZ;
  let high = true;
  for (let t = at + half; t < end; t += half) {
    o.frequency.setValueAtTime(high ? upper : hz, t);
    high = !high;
  }
}
