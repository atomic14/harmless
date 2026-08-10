// Tiny WebAudio synth — bleeps and zaps in the spirit of the BBC sound chip.
// The context is created lazily on the first user gesture.

import { COUNTDOWN } from './constants/jump.ts';

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function env(a: AudioContext, gain: number, duration: number): GainNode {
  const g = a.createGain();
  g.gain.setValueAtTime(gain, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + duration);
  g.connect(a.destination);
  return g;
}

function sweep(type: OscillatorType, from: number, to: number, duration: number, gain: number): void {
  const a = ac();
  if (!a) return;
  const o = a.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(from, a.currentTime);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, to), a.currentTime + duration);
  o.connect(env(a, gain, duration));
  o.start();
  o.stop(a.currentTime + duration);
}

/** The common square-wave voice used by the named interface sounds below. */
function tone(frequency: number, duration = 0.08, gain = 0.08): void {
  sweep('square', frequency, frequency, duration, gain);
}

function noiseBurst(duration: number, gain: number, lowpass = 4000): void {
  const a = ac();
  if (!a) return;
  const len = Math.floor(a.sampleRate * duration);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = lowpass;
  src.connect(f);
  f.connect(env(a, gain, duration));
  src.start();
}

// --- docking music -----------------------------------------------------------
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
// rip in a different container. Crediting it would not change that — attribution
// is not a licence. So the notes below are written from the public-domain waltz,
// and the SOUND is imitated rather than copied: nothing about how a chip made a
// tone is anybody's property.
//
// Two voices, and what each is made of is the answer to "it is nowhere near as
// nice as the C64":
//
//   the melody   a detuned PAIR of squares through one envelope, with vibrato.
//                One square wave is a buzzer; the SID's trick was sweeping a
//                pulse's width while it sounded, and WebAudio has no such knob,
//                so the restlessness is bought with beating and a wobble instead.
//   the waltz    oom-pah-pah, where the pah is a real triad. It was a single
//                note, which is the bass again an octave up — a metronome, not
//                an accompaniment.

/** Semitone offsets from A4 (440 Hz) for the notes the theme uses. */
const NOTE: Record<string, number> = {
  A3: -12, B3: -10, D4: -7, E4: -5, Fs4: -4, G4: -2, A4: 0, B4: 2, D5: 5, Fs5: 9,
};
const hz = (n: string): number => 440 * Math.pow(2, NOTE[n] / 12);

/** [note or rest, beats] — the opening of the waltz theme, in D major. */
const BLUE_DANUBE: [string | null, number][] = [
  ['D4', 1], ['Fs4', 1], ['A4', 1],           // the rising arpeggio everyone knows
  ['A4', 2], [null, 1],
  ['B4', 0.5], ['B4', 0.5], [null, 2],        // dum dum
  ['B4', 0.5], ['B4', 0.5], [null, 2],        // dum dum
  ['D4', 1], ['Fs4', 1], ['A4', 1],
  ['A4', 2], [null, 1],
  ['G4', 0.5], ['G4', 0.5], [null, 2],
  ['G4', 0.5], ['G4', 0.5], [null, 2],
  ['B3', 1], ['E4', 1], ['G4', 1],
  ['G4', 2], [null, 1],
  ['Fs4', 0.5], ['Fs4', 0.5], [null, 2],
  ['A3', 1], ['D4', 1], ['Fs4', 1],
  ['Fs4', 2], [null, 1],
  ['D5', 1], [null, 2],
];
/**
 * The melody's held level, and how long it takes to let go of a note.
 *
 * The release is a CEILING rather than a fixed time — a half-beat note is
 * shorter than it, so it is clamped to a fraction of the note instead
 * (`Math.min` at the call site). Without that, the quick `dum dum` pairs would
 * be all release and no note.
 */
const MELODY_GAIN = 0.05;
const MELODY_RELEASE = 0.07;

/**
 * How far apart the melody's two oscillators are tuned, in cents.
 *
 * WHY THERE ARE TWO. One square wave is a buzzer. The C64's sound came off a
 * chip that could sweep a pulse wave's width while it played, which makes the
 * tone shimmer and move; WebAudio's oscillator has no pulse width to sweep, so
 * the same restlessness is bought the other way — two squares a few cents
 * apart beat against each other at a few hertz. It is not the SID, and this
 * file is not pretending to be: it is what a plain oscillator lacks most.
 *
 * Small on purpose. Past about fifteen cents it stops reading as one voice with
 * body and starts reading as two instruments slightly out of tune.
 */
const DETUNE_CENTS = 6;

/**
 * The wobble on a held note: how fast, and how deep as a FRACTION of the note's
 * own frequency — so an octave up wobbles by the same musical interval rather
 * than the same number of hertz, which is what makes it sound like one
 * instrument across the range.
 *
 * It comes in after `VIBRATO_DELAY` rather than from the attack, which is how a
 * played instrument does it: the note arrives straight, then sings.
 */
const VIBRATO_HZ = 5.5;
const VIBRATO_DEPTH = 0.004;
const VIBRATO_DELAY = 0.12;

/**
 * The harmony, one chord a bar: its root and whether it is minor.
 *
 * It was a list of single notes, which is why the accompaniment read as a
 * metronome rather than a waltz — an oom-pah-pah whose pah is one note is just
 * the oom again, higher. A triad is what the ear is listening for underneath
 * this tune, and it is the other half of "nowhere near as nice".
 *
 * The qualities are the key's own: D major and A major, B and E minor. Nothing
 * here is transcribed from anybody's arrangement — the waltz is Strauss's, 1866
 * and public domain, and these are the chords it is written over.
 */
const CHORDS: [string, 'maj' | 'min'][] = [
  ['D4', 'maj'], ['A3', 'maj'], ['D4', 'maj'], ['A3', 'maj'],
  ['B3', 'min'], ['E4', 'min'], ['A3', 'maj'], ['D4', 'maj'],
];

/** Semitones above the root for each triad. */
const TRIAD: Record<'maj' | 'min', readonly number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
};

/** The bass's two levels: the root on the downbeat, the chord on two and three. */
const BASS_GAIN = 0.045;
const CHORD_GAIN = 0.016;

/** `hz`, moved by a musical interval rather than a number of hertz. */
const cents = (frequency: number, n: number): number => frequency * Math.pow(2, n / 1200);
const semitones = (frequency: number, n: number): number => frequency * Math.pow(2, n / 12);

let musicStop: (() => void) | null = null;

export const sfx = {
  laser(): void {
    sweep('sawtooth', 900, 220, 0.18, 0.12);
  },
  enemyLaser(): void {
    sweep('square', 500, 140, 0.22, 0.08);
  },
  hit(): void {
    noiseBurst(0.12, 0.15, 2500);
  },
  damage(): void {
    noiseBurst(0.3, 0.22, 1200);
    sweep('sawtooth', 200, 60, 0.3, 0.12);
  },
  explosion(): void {
    noiseBurst(0.8, 0.3, 900);
    sweep('sine', 120, 30, 0.8, 0.25);
  },
  refused(): void { tone(220); },
  noMissiles(): void { tone(180); },
  noEnergy(): void { tone(180); },
  missileArmed(): void { tone(700); },
  missileUnarmed(): void { tone(400); },
  missileLocked(): void { tone(1200, 0.12); },
  missileDisarmed(): void { tone(500, 0.06); },
  torusDropped(): void { tone(300); },
  lowEnergy(): void { tone(320, 0.1); },
  survivorScooped(): void { tone(600, 0.12); },
  cargoScooped(): void { tone(950); },
  trumbleAte(): void { tone(500, 0.1); },
  generationShipFound(): void { tone(140, 0.5); },
  contractPaid(): void { tone(1100, 0.15); },
  contractExpired(): void { tone(220, 0.2); },
  contractAccepted(): void { tone(900, 0.1); },
  dockingComputerEngaged(): void { tone(700, 0.12); },
  combatComputerEngaged(): void { tone(1000, 0.12); },
  stationDefenceLaunched(): void { tone(300, 0.18); },
  cargoLost(): void { tone(300, 0.12); },
  equipmentDestroyed(): void { tone(240, 0.2); },
  distressBeacon(): void { tone(500, 0.4); },
  torusEngaged(): void { tone(1000, 0.15); },
  viewChanged(): void { tone(600, 0.04); },
  cargoJettisoned(): void { tone(320); },
  tradeBought(): void { tone(900, 0.05); },
  tradeSold(): void { tone(700, 0.05); },
  equipmentBought(): void { tone(600); },
  chartTargetSelected(): void { tone(900, 0.1); },
  commanderDeleted(): void { tone(400, 0.1); },
  commanderNamed(): void { tone(700, 0.1); },
  combatSimulationLaunched(): void { tone(700); },
  /**
   * The hyperspace countdown, with `n` seconds left on it: a blip that climbs
   * a hundred hertz a second towards the jump.
   *
   * Named for the occasion because the pitch used to be written out in the
   * world step, which put audio design inside the simulation. Same tone as
   * before, decided here.
   *
   * The 700 and the 100 are this file's; the length of the countdown is not,
   * and it wrote `(5 - n)` out as a digit until `COUNTDOWN` was somewhere it
   * could be imported from. A longer countdown would have started BELOW 700
   * and climbed to it — the first blip of a jump is meant to be the base note
   * whatever the drive's warning is. `test/audio.test.ts` asserts that climb
   * rather than this expression.
   */
  countdown(n: number): void {
    const f = 700 + (COUNTDOWN - n) * 100;
    sweep('square', f, f, 0.07, 0.08);
  },
  /**
   * Start the docking waltz. Safe to call repeatedly — a second call while it
   * is already playing does nothing, so an autopilot that re-engages doesn't
   * stack voices on top of each other.
   */
  dockingMusic(): void {
    const a = ac();
    if (!a || musicStop) return;
    const beat = 0.34;
    const voices: OscillatorNode[] = [];
    let t = a.currentTime + 0.05;

    for (const [note, beats] of BLUE_DANUBE) {
      if (note) {
        const dur = beats * beat * 0.92;
        // ONE envelope, TWO oscillators. Attack, HOLD, release — not a single
        // ramp across the whole note.
        //
        // It used to decay exponentially from the attack straight to silence at
        // `t + dur`, which is a 500-fold fall spread over the note: a minim was
        // 27 dB down by its own midpoint and inaudible well before it ended. The
        // waltz therefore played as a string of blips with the long notes
        // missing, which is what "the notes seem weirdly truncated" is. A held
        // level and a short release at the end is what makes a 2-beat note last
        // 2 beats.
        const release = Math.min(MELODY_RELEASE, dur * 0.4);
        const amp = a.createGain();
        amp.gain.setValueAtTime(0.0001, t);
        amp.gain.exponentialRampToValueAtTime(MELODY_GAIN, t + 0.02);
        amp.gain.setValueAtTime(MELODY_GAIN, t + dur - release);
        amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        amp.connect(a.destination);

        const base = hz(note);
        // The wobble, shared by the pair so they stay in step with each other:
        // depth is a fraction of THIS note's frequency, so the interval is the
        // same at either end of the tune.
        const lfo = a.createOscillator();
        const depth = a.createGain();
        lfo.frequency.setValueAtTime(VIBRATO_HZ, t);
        depth.gain.setValueAtTime(0.0001, t);
        depth.gain.exponentialRampToValueAtTime(
          base * VIBRATO_DEPTH, Math.min(t + VIBRATO_DELAY, t + dur));
        lfo.connect(depth);
        lfo.start(t);
        lfo.stop(t + dur);
        voices.push(lfo);

        for (const detune of [-DETUNE_CENTS, DETUNE_CENTS]) {
          const o = a.createOscillator();
          o.type = 'square';
          o.frequency.setValueAtTime(cents(base, detune), t);
          depth.connect(o.frequency);
          o.connect(amp);
          o.start(t);
          o.stop(t + dur);
          voices.push(o);
        }
      }
      t += beats * beat;
    }

    // oom-pah-pah underneath, one CHORD a bar
    const bars = Math.ceil((t - a.currentTime) / (3 * beat));
    for (let bar = 0; bar < bars; bar++) {
      const [root, quality] = CHORDS[bar % CHORDS.length];
      for (let step = 0; step < 3; step++) {
        const bt = a.currentTime + 0.05 + (bar * 3 + step) * beat;
        const dur = beat * (step === 0 ? 0.5 : 0.28);
        // The downbeat is the root an octave down and alone — that is the
        // "oom". Two and three are the whole triad, which is the "pah-pah" and
        // is what a single note could never be: an accompaniment that is one
        // note is the bass again, higher up, and reads as a metronome.
        const pitches = step === 0
          ? [hz(root) / 2]
          : TRIAD[quality].map((n) => semitones(hz(root), n));
        const level = step === 0 ? BASS_GAIN : CHORD_GAIN;
        for (const f of pitches) {
          const o = a.createOscillator();
          const g = a.createGain();
          o.type = 'triangle';
          o.frequency.setValueAtTime(f, bt);
          g.gain.setValueAtTime(0.0001, bt);
          g.gain.exponentialRampToValueAtTime(level, bt + 0.015);
          g.gain.exponentialRampToValueAtTime(0.0001, bt + dur);
          o.connect(g).connect(a.destination);
          o.start(bt);
          o.stop(bt + dur);
          voices.push(o);
        }
      }
    }

    const clear = window.setTimeout(() => { musicStop = null; }, (t - a.currentTime) * 1000 + 200);
    musicStop = () => {
      window.clearTimeout(clear);
      for (const o of voices) { try { o.stop(); } catch { /* already stopped */ } }
      musicStop = null;
    };
  },

  /** Cut the music off — docked, or the approach was abandoned. */
  stopDockingMusic(): void {
    musicStop?.();
  },

  dock(): void {
    sweep('square', 523, 523, 0.1, 0.08);
    setTimeout(() => sweep('square', 784, 784, 0.18, 0.08), 120);
  },
  launch(): void {
    sweep('sawtooth', 80, 320, 0.5, 0.1);
  },
  hyperspace(): void {
    sweep('sawtooth', 100, 1400, 1.2, 0.14);
    noiseBurst(1.2, 0.08, 3000);
  },
  missile(): void {
    sweep('sawtooth', 300, 900, 0.6, 0.1);
  },
  ecm(): void {
    // warbling interference
    for (let i = 0; i < 6; i++) {
      setTimeout(() => sweep('square', 1400 - i * 180, 500, 0.09, 0.09), i * 90);
    }
    noiseBurst(0.6, 0.1, 5000);
  },
  tunnel(): void {
    sweep('sawtooth', 60, 240, 1.3, 0.09);
    noiseBurst(1.3, 0.05, 1800);
  },
  bomb(): void {
    noiseBurst(1.6, 0.35, 500);
    sweep('sine', 200, 25, 1.6, 0.3);
    sweep('sawtooth', 90, 20, 1.2, 0.15);
  },
};
