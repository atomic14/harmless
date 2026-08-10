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

/** One oscillator inside an instrument: its wave, its offset and its share. */
interface Layer {
  type: OscillatorType;
  /** cents away from the written pitch — a pair a few cents apart beats, and
   *  that beating is what a single oscillator lacks most */
  detune: number;
  /** its share of the instrument's level */
  gain: number;
}

/** The shape of every note: rise, fall, hold, let go. */
interface Adsr {
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
interface Instrument {
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
interface Note {
  /** scientific pitch, e.g. `D4`, `F#5`, `A2` */
  note: string;
  at: number;
  beats: number;
  velocity: number;
}

interface Track {
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

/** A pitch moved by an interval rather than a number of hertz. */
const cents = (frequency: number, n: number): number => frequency * Math.pow(2, n / 1200);

// --- the instruments ---------------------------------------------------------
//
// Four voices, and the shape of them — layered oscillators, ADSR, a lowpass and
// a stereo position — came from a palette Chris put together for this. What
// audio.ts had was a bare square and a bare triangle with no decay, no sustain
// level, no filter and no width, which is most of the distance between "the
// notes are right" and "it sounds nice".

const LEAD: Instrument = {
  layers: [
    { type: 'sawtooth', detune: -5, gain: 0.45 },
    { type: 'sawtooth', detune: 5, gain: 0.45 },
    { type: 'sine', detune: 0, gain: 0.15 },
  ],
  envelope: { attack: 0.035, decay: 0.12, sustain: 0.72, release: 0.18 },
  cutoff: 4200, q: 0.7, pan: -0.15, gain: 0.8,
};

const HORNS: Instrument = {
  layers: [
    { type: 'triangle', detune: 0, gain: 0.75 },
    { type: 'sine', detune: -3, gain: 0.25 },
  ],
  envelope: { attack: 0.06, decay: 0.16, sustain: 0.65, release: 0.22 },
  cutoff: 2200, q: 0.8, pan: 0.15, gain: 0.62,
};

const CELLO: Instrument = {
  layers: [
    { type: 'triangle', detune: 0, gain: 0.8 },
    { type: 'sine', detune: 0, gain: 0.25 },
  ],
  envelope: { attack: 0.015, decay: 0.12, sustain: 0.58, release: 0.12 },
  cutoff: 1200, q: 0.6, pan: 0, gain: 0.72,
};

const PIZZ: Instrument = {
  layers: [
    { type: 'triangle', detune: 0, gain: 0.55 },
    { type: 'square', detune: 0, gain: 0.12 },
  ],
  envelope: { attack: 0.004, decay: 0.09, sustain: 0.12, release: 0.07 },
  cutoff: 3000, q: 0.5, pan: 0.25, gain: 0.48,
};

/** How loud the whole thing sits under the game. */
const MUSIC_GAIN = 0.06;

// --- the score ---------------------------------------------------------------
//
// The opening of the waltz theme in D major, written from the public-domain
// score. `[note, beats]` in sequence, rests included, which is how a tune is
// read rather than how a sequencer stores one — the bar positions below are
// DERIVED from it, so a note cannot be written at a beat the melody never
// reaches.

/** [note or rest, beats] — the melody, in order. */
const MELODY: [string | null, number][] = [
  ['D4', 1], ['F#4', 1], ['A4', 1],           // the rising arpeggio everyone knows
  ['A4', 2], [null, 1],
  ['B4', 0.5], ['B4', 0.5], [null, 2],        // dum dum
  ['B4', 0.5], ['B4', 0.5], [null, 2],        // dum dum
  ['D4', 1], ['F#4', 1], ['A4', 1],
  ['A4', 2], [null, 1],
  ['G4', 0.5], ['G4', 0.5], [null, 2],
  ['G4', 0.5], ['G4', 0.5], [null, 2],
  ['B3', 1], ['E4', 1], ['G4', 1],
  ['G4', 2], [null, 1],
  ['F#4', 0.5], ['F#4', 0.5], [null, 2],
  ['A3', 1], ['D4', 1], ['F#4', 1],
  ['F#4', 2], [null, 1],
  ['D5', 1], [null, 2],
];

/**
 * The harmony, one chord a bar: its root and whether it is minor.
 *
 * The qualities are the key's own — D and A major, B and E minor. The
 * accompaniment, the horn line and the bass are all DERIVED from this, so they
 * cannot drift apart from each other or stop before the melody does.
 */
const CHORDS: [string, 'maj' | 'min'][] = [
  ['D', 'maj'], ['A', 'maj'], ['D', 'maj'], ['A', 'maj'],
  ['B', 'min'], ['E', 'min'], ['A', 'maj'], ['D', 'maj'],
];

/** Semitones above the root for each triad. */
const TRIAD: Record<'maj' | 'min', readonly number[]> = { maj: [0, 4, 7], min: [0, 3, 7] };

/** A chord tone as a pitch name, `n` semitones above the root in `octave`. */
function chordTone(root: string, quality: 'maj' | 'min', degree: number, octave: number): string {
  const semitone = STEP[root] + TRIAD[quality][degree];
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return `${names[semitone % 12]}${octave + Math.floor(semitone / 12)}`;
}

/**
 * The waltz, as four tracks.
 *
 * The accompaniment is generated ACROSS THE MELODY'S OWN LENGTH rather than
 * written out to a length of its own, and that is not tidiness. The palette
 * this engine came from arrived with a score whose bass and chords stopped at
 * bar 9 while the tune ran to bar 13 — four bars, nearly a third of the piece,
 * of melody over silence. Deriving the bar count from the melody makes that
 * particular mistake unwriteable; `test/audio.test.ts` holds it anyway, because
 * the next arrangement may not be generated the same way.
 */
export function dockingScore(): Score {
  const lead: Note[] = [];
  let at = 0;
  for (const [note, beats] of MELODY) {
    if (note) lead.push({ note, at, beats: beats * 0.92, velocity: 0.86 });
    at += beats;
  }
  const bars = Math.ceil(at / 3);

  const horns: Note[] = [];
  const bass: Note[] = [];
  const pizz: Note[] = [];
  for (let bar = 0; bar < bars; bar++) {
    const [root, quality] = CHORDS[bar % CHORDS.length];
    const beat0 = bar * 3;
    // The horn line: the chord's third, held across the bar under the tune.
    horns.push({ note: chordTone(root, quality, 1, 4), at: beat0, beats: 2.8, velocity: 0.5 });
    // Oom-pah-pah: root low on one, the fifth on two and three.
    bass.push({ note: chordTone(root, quality, 0, 2), at: beat0, beats: 0.82, velocity: 0.72 });
    for (const step of [1, 2]) {
      bass.push({
        note: chordTone(root, quality, 2, 2), at: beat0 + step, beats: 0.82, velocity: 0.58,
      });
      // ...and the triad plucked over it, which is the "pah" a single note
      // could never be: one note is the bass again an octave up, a metronome.
      for (const degree of [0, 1, 2]) {
        pizz.push({
          note: chordTone(root, quality, degree, 4), at: beat0 + step,
          beats: 0.55, velocity: 0.48,
        });
      }
    }
  }

  return {
    beat: 0.34,
    tracks: [
      { instrument: LEAD, notes: lead },
      { instrument: HORNS, notes: horns },
      { instrument: CELLO, notes: bass },
      { instrument: PIZZ, notes: pizz },
    ],
  };
}

/**
 * Schedule a score and hand back every oscillator in it, so it can be cut off.
 *
 * The per-track chain — filter, panner, level — is built ONCE and every note of
 * that track plays through it. A filter a note is the whole point of a static
 * one is not, and four nodes beats four hundred.
 *
 * Each note's layers get their OWN envelope, scaled by the layer's share,
 * rather than sharing one: multiplying gains is linear, so the sound is
 * identical and every oscillator carries its own shape — which is what lets a
 * test read an envelope off any voice in the piece.
 */
export function playScore(a: AudioContext, score: Score, from: number): {
  voices: OscillatorNode[]; until: number;
} {
  const voices: OscillatorNode[] = [];
  let until = from;

  for (const track of score.tracks) {
    const inst = track.instrument;
    const out = a.createGain();
    out.gain.value = inst.gain * MUSIC_GAIN;
    out.connect(a.destination);

    const filter = a.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = inst.cutoff;
    filter.Q.value = inst.q;
    // Stereo width where the browser has a panner, straight through where it
    // does not — a missing StereoPannerNode must cost the placement, not the
    // music.
    const panner = a.createStereoPanner?.();
    if (panner) {
      panner.pan.value = inst.pan;
      filter.connect(panner).connect(out);
    } else {
      filter.connect(out);
    }

    const env = inst.envelope;
    for (const note of track.notes) {
      const t = from + note.at * score.beat;
      const held = note.beats * score.beat;
      const end = t + held + env.release;
      until = Math.max(until, end);
      const hz = noteHz(note.note);

      for (const layer of inst.layers) {
        const peak = Math.max(0.0002, note.velocity * layer.gain);
        const amp = a.createGain();
        amp.gain.setValueAtTime(0.0001, t);
        amp.gain.exponentialRampToValueAtTime(peak, t + env.attack);
        amp.gain.exponentialRampToValueAtTime(
          Math.max(0.0002, peak * env.sustain), t + env.attack + env.decay);
        // HOLD. Without this the note decays across its own length and a minim
        // is inaudible by its midpoint, which is what "the notes seem weirdly
        // truncated" was.
        amp.gain.setValueAtTime(Math.max(0.0002, peak * env.sustain), t + held);
        amp.gain.exponentialRampToValueAtTime(0.0001, end);
        amp.connect(filter);

        const o = a.createOscillator();
        o.type = layer.type;
        o.frequency.setValueAtTime(cents(hz, layer.detune), t);
        o.connect(amp);
        o.start(t);
        o.stop(end);
        voices.push(o);
      }
    }
  }
  return { voices, until };
}
