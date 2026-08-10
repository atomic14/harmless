// The docking waltz: an engine for playing a score, and the score it plays.
//
// Split from audio.ts, which is a box of bleeps — `sweep`, `tone`,
// `noiseBurst`, one-shot noises with no notion of a note. This is the other
// thing entirely: pitches, instruments, an arrangement and a clock. They shared
// a file until the engine arrived and pushed it over the size ceiling, and the
// ceiling was right — nothing here is reached by a laser or an explosion, and
// nothing there knows what a chord is.
//
// It owns no AudioContext. `audio.ts` holds the one context in the program and
// hands it in, which is what keeps the lazy-on-first-gesture rule in one place.

// --- provenance --------------------------------------------------------------
//
// The Commodore 64 Elite played "An der schönen blauen Donau" while you docked
// — Strauss's own nod having been borrowed by 2001. The waltz is from 1866 and
// is comfortably public domain, so it is synthesised here from note data rather
// than shipping audio from the original game: this repo deliberately contains
// no assets from Elite, and a SID rip would be exactly that.
//
// THAT RULE COVERS THE ARRANGEMENT, NOT ONLY THE BYTES, and it is worth being
// plain about because the shortcut is tempting. The composition is Strauss's
// and free to anyone; a 1985 transcription of it for three SID voices is a
// separate work with its own copyright, and lifting its note data would be the
// rip in a different container. Crediting it would not change that —
// attribution is not a licence. The same objection retires a found MIDI, which
// is somebody's arrangement and very often that one.
//
// SO THE SPLIT BELOW IS THE POINT. An INSTRUMENT is how a note sounds and
// belongs to nobody: layered oscillators, an ADSR, a filter, a place in the
// stereo field. A SCORE is which notes, and is ours, written from the
// public-domain waltz. Swapping in a different arrangement is a data change,
// and a different instrument palette is another — neither needs this engine
// touched, which is what makes tuning it by ear cheap.

import { waltz } from './music-score.ts';

/** One oscillator inside an instrument: its wave, its offset and its share. */
export interface Layer {
  type: OscillatorType;
  /** cents away from the written pitch — a pair a few cents apart beats, and
   *  that beating is what a single oscillator lacks most */
  detune: number;
  /** its share of the instrument's level */
  gain: number;
}

/** The shape of every note: rise, fall, hold, let go. */
export interface Adsr {
  attack: number;
  decay: number;
  /** the level held after the decay, as a fraction of the peak */
  sustain: number;
  release: number;
}

/**
 * A voice. Everything here is how it SOUNDS, and none of it is a game rule —
 * it is tuned by ear in this file, which is why it is not in `src/constants/`.
 */
export interface Instrument {
  layers: readonly Layer[];
  envelope: Adsr;
  /** a lowpass, because a raw sawtooth is all edge and no body */
  cutoff: number;
  q: number;
  /** -1 hard left, 1 hard right — the width that stops four voices being a mono smear */
  pan: number;
  gain: number;
}

/** A note: where it starts and how long it lasts, both in BEATS. */
export interface Note {
  /** scientific pitch, e.g. `D4`, `F#5`, `A2` */
  note: string;
  at: number;
  beats: number;
  velocity: number;
}

export interface Track {
  instrument: Instrument;
  notes: readonly Note[];
}

/** Everything the player needs: how long a beat is, and who plays what. */
export interface Score {
  beat: number;
  tracks: readonly Track[];
}

/**
 * Scientific pitch to hertz — `D4`, `F#5`, `Bb3`, `A2`.
 *
 * A parser rather than the table of ten note names this file used to carry: a
 * table is a ceiling on what can be written, and the first bass line to want a
 * G2 would have had to edit the synth to say it.
 */
const STEP: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function noteHz(name: string): number {
  const m = /^([A-G])([#b]?)(-?\d+)$/.exec(name);
  if (!m) return 440;
  const semitone = STEP[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  // MIDI numbering, so A4 is 69 and the maths is the standard one
  const midi = (Number(m[3]) + 1) * 12 + semitone;
  return 440 * Math.pow(2, (midi - 69) / 12);
}


// --- the score ---------------------------------------------------------------

/**
 * How loud the whole arrangement sits under the game.
 *
 * The instruments carry their own balance against each other; this is the one
 * number that decides how the music sits against a laser and an explosion, and
 * it is the first knob to reach for if the waltz is too quiet or drowns the
 * cockpit.
 */
const MUSIC_GAIN = 0.35;

/**
 * How fast the game plays it: Chris's call, and slower than the arrangement is
 * written at (150). A docking approach is a minute of drifting onto a slot, not
 * a ballroom, and the extra weight in every note is most of what makes it sound
 * like an occasion rather than a jingle.
 */
const WALTZ_BPM = 100;

/** The waltz, at the tempo the game plays it. */
export function dockingScore(): Score {
  return waltz(60 / WALTZ_BPM);
}

/**
 * Schedule a score and hand back every oscillator in it, so it can be cut off.
 *
 * The per-track chain — level, filter, panner — is built ONCE and every note of
 * that track plays through it. Four nodes rather than four thousand, and a
 * static filter is not something a note needs its own copy of.
 *
 * THE RELEASE FITS INSIDE THE NOTE, which is the one thing worth saying about
 * the envelope: the fall starts at `end - release` and the voice is finished at
 * `end`. An earlier version added the release AFTER the written length, which
 * is fine for a tune with a rest after every phrase and wrong for an
 * arrangement where one note ends as the next begins — every voice would have
 * overhung its neighbour by the release and the whole thing would smear. This
 * follows the reference player Chris built the arrangement against.
 */
export function playScore(a: AudioContext, score: Score, from: number): {
  voices: OscillatorNode[]; until: number;
} {
  const voices: OscillatorNode[] = [];
  let until = from;

  for (const track of score.tracks) {
    const inst = track.instrument;
    const bus = a.createGain();
    bus.gain.value = inst.gain * MUSIC_GAIN;

    const filter = a.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = inst.cutoff;
    filter.Q.value = inst.q;
    bus.connect(filter);
    // Stereo width where the browser has a panner, straight through where it
    // does not — a missing StereoPannerNode must cost the placement, not the
    // music.
    const panner = a.createStereoPanner?.();
    if (panner) {
      panner.pan.value = inst.pan;
      filter.connect(panner).connect(a.destination);
    } else {
      filter.connect(a.destination);
    }

    const env = inst.envelope;
    for (const note of track.notes) {
      const when = from + note.at * score.beat;
      const end = when + note.beats * score.beat;
      until = Math.max(until, end);
      const hz = noteHz(note.note);
      const v = Math.max(0.0001, note.velocity);
      const sustain = Math.max(0.0001, v * env.sustain);

      const amp = a.createGain();
      amp.gain.setValueAtTime(0.0001, when);
      amp.gain.exponentialRampToValueAtTime(v, when + Math.max(0.002, env.attack));
      // The decay only happens if the note is long enough to have one.
      const decayed = when + env.attack + env.decay;
      if (decayed < end) amp.gain.exponentialRampToValueAtTime(sustain, decayed);
      // HOLD, then let go. Without this hold a note decays across its own
      // length and a minim is inaudible by its midpoint, which is what "the
      // notes seem weirdly truncated" was.
      amp.gain.setValueAtTime(sustain, Math.max(when + env.attack, end - env.release));
      amp.gain.exponentialRampToValueAtTime(0.0001, end);
      amp.connect(bus);

      for (const layer of inst.layers) {
        const level = a.createGain();
        level.gain.value = layer.gain;
        level.connect(amp);

        const o = a.createOscillator();
        o.type = layer.type;
        o.frequency.setValueAtTime(hz, when);
        // `detune` is the oscillator's own parameter and is in CENTS, so the
        // layers of a chord sit the same musical distance apart wherever the
        // note is written.
        o.detune.value = layer.detune;
        o.connect(level);
        o.start(when);
        o.stop(end + 0.04);
        voices.push(o);
      }
    }
  }
  return { voices, until };
}
