// Named sound occasions must preserve the tones they replaced. A tiny fake
// AudioContext records oscillator shape without speakers, timing, or a browser.

import { COUNTDOWN } from '../src/constants/jump.ts';
import { check, eq } from './harness.ts';

/** A gain node, as the automation scheduled on it. */
interface Amp {
  events: [number, number][];
}

interface Tone {
  type: OscillatorType;
  frequency: number;
  duration: number;
  /** when it starts, in seconds from `currentTime` */
  at: number;
  /**
   * The gain node this oscillator plays THROUGH, found by following the
   * connection rather than by guessing from creation order.
   *
   * It used to be guessed — a gain node was bound to whichever oscillator was
   * made last — and that was fine only while every voice was exactly one
   * oscillator and one gain. The melody is a detuned PAIR through one envelope
   * now, plus a vibrato LFO through a depth gain into their frequency, so the
   * guess would have credited one note's envelope to the wrong oscillator and
   * left the other with none. A fake that cannot represent the graph cannot
   * test the synth that builds one.
   */
  amp: Amp | null;
}

const tones: Tone[] = [];

/** The level a voice was asked for — the top of its envelope. */
const peak = (t: Tone): number =>
  (t.amp && t.amp.events.length ? Math.max(...t.amp.events.map(([v]) => v)) : 0);

class FakeAudioContext {
  currentTime = 10;
  state = 'running';
  destination = {};

  createOscillator() {
    const recorded: Tone = {
      type: 'sine', frequency: 0, duration: 0, at: 0, amp: null,
    };
    tones.push(recorded);
    return {
      type: 'sine' as OscillatorType,
      frequency: {
        setValueAtTime(value: number) { recorded.frequency = value; },
        exponentialRampToValueAtTime() {},
      },
      connect(target?: { __amp?: Amp; connect?: unknown }) {
        recorded.type = this.type;
        if (target?.__amp) recorded.amp = target.__amp;
        return target?.connect ? target : { connect() {} };
      },
      start(at = 10) { recorded.at = at - 10; },
      /**
       * A stop with NO time is a cancellation, not the note's own end — it is
       * how `stopDockingMusic` tears the waltz down — and recording it would
       * overwrite the scheduled length of every note that had already played.
       * It did, and turned every duration into NaN.
       */
      stop(at?: number) {
        if (typeof at === 'number') recorded.duration = at - 10 - recorded.at;
      },
    };
  }

  createGain() {
    // Times are absolute — seconds from `currentTime` — because the synth
    // schedules an envelope before it starts the oscillator, so a note's own
    // start time is still 0 while its gain is being written.
    const amp: Amp = { events: [] };
    const mark = (value: number, at: number): void => { amp.events.push([value, at - 10]); };
    return {
      __amp: amp,
      gain: { setValueAtTime: mark, exponentialRampToValueAtTime: mark },
      connect(target?: { connect?: unknown }) {
        return target?.connect ? target : { connect() {} };
      },
    };
  }

  resume() {}
}

Object.assign(globalThis, { AudioContext: FakeAudioContext });
// `dockingMusic` schedules its own teardown through `window.setTimeout`, which
// is the browser's, not node's. The two functions it wants, and nothing else.
Object.assign(globalThis, { window: { setTimeout, clearTimeout } });
const { sfx } = await import('../src/audio.ts');

console.log('\nNamed audio');

const expected = {
  refused: [220, 0.08],
  noMissiles: [180, 0.08],
  noEnergy: [180, 0.08],
  missileArmed: [700, 0.08],
  missileUnarmed: [400, 0.08],
  missileLocked: [1200, 0.12],
  missileDisarmed: [500, 0.06],
  torusDropped: [300, 0.08],
  lowEnergy: [320, 0.1],
  survivorScooped: [600, 0.12],
  cargoScooped: [950, 0.08],
  trumbleAte: [500, 0.1],
  generationShipFound: [140, 0.5],
  contractPaid: [1100, 0.15],
  contractExpired: [220, 0.2],
  contractAccepted: [900, 0.1],
  dockingComputerEngaged: [700, 0.12],
  combatComputerEngaged: [1000, 0.12],
  stationDefenceLaunched: [300, 0.18],
  cargoLost: [300, 0.12],
  equipmentDestroyed: [240, 0.2],
  distressBeacon: [500, 0.4],
  torusEngaged: [1000, 0.15],
  viewChanged: [600, 0.04],
  cargoJettisoned: [320, 0.08],
  tradeBought: [900, 0.05],
  tradeSold: [700, 0.05],
  equipmentBought: [600, 0.08],
  chartTargetSelected: [900, 0.1],
  commanderDeleted: [400, 0.1],
  commanderNamed: [700, 0.1],
  combatSimulationLaunched: [700, 0.08],
} as const;

for (const [name, [frequency, duration]] of Object.entries(expected)) {
  tones.length = 0;
  (sfx[name as keyof typeof expected] as () => void)();
  const tone = tones[0];
  eq(`${name} keeps its frequency`, tone.frequency, frequency);
  check(`${name} keeps its envelope`, Math.abs(tone.duration - duration) < 1e-9);
  eq(`${name} stays a square wave`, tone.type, 'square');
  eq(`${name} keeps the standard gain`, peak(tone), 0.08);
}

// The countdown blip is the one occasion whose pitch depends on a GAME rule —
// how many seconds of warning the drive gives — and audio.ts used to write that
// 5 out as a digit. So the assertion is the CLAIM rather than the expression:
// the first blip of any countdown is 700 Hz and each second climbs a hundred
// towards the jump, however long `COUNTDOWN` is. Restating
// `700 + (COUNTDOWN - n) * 100` here would be the implementation twice and
// would pass whatever either file said.
{
  const pitches: number[] = [];
  for (let n = COUNTDOWN; n >= 1; n--) {
    tones.length = 0;
    sfx.countdown(n);
    const tone = tones[0];
    pitches.push(tone.frequency);
    check(`countdown ${n} keeps its envelope`, Math.abs(tone.duration - 0.07) < 1e-9);
  }
  eq(`the first blip of a ${COUNTDOWN}-second countdown is the base note`,
    pitches[0], 700);
  check(`...and each of the ${pitches.length - 1} after it climbs a hundred hertz`
    + ` (${pitches.join(' ')})`,
  pitches.every((f, i) => i === 0 || f - pitches[i - 1] === 100));
}

// --- the docking waltz -------------------------------------------------------
//
// Reported from a real flight: "it plays, but the notes seem weirdly
// truncated". They were. Every melody note decayed exponentially from its
// attack straight to silence at the note's own end — a 500-fold fall spread
// across the note — so a minim was 27 dB down by its midpoint and gone well
// before the next note began. The theme played as a string of blips with the
// long notes missing.
//
// What is asserted is the CLAIM rather than the expression: a note is still at
// its full level most of the way through itself. Restating the envelope's
// arithmetic here would pass whatever audio.ts said.

console.log('\nthe docking waltz holds its notes');
{
  tones.length = 0;
  sfx.dockingMusic();
  const played = [...tones];

  // Three kinds of oscillator, told apart by wave: the melody's squares, the
  // accompaniment's triangles, and the vibrato LFOs, which are never given a
  // type because they are never heard — they bend a frequency, not the air.
  const melody = played.filter((t) => t.type === 'square');
  const bass = played.filter((t) => t.type === 'triangle');
  const lfos = played.filter((t) => t.type === 'sine');
  check(`it is two voices — ${melody.length} melody oscillators over ${bass.length} accompaniment`,
    melody.length > 20 && bass.length > 20);

  /** How far through a note the gain was last at its full level, as a fraction. */
  const holdsTo = (t: Tone): number => {
    const events = t.amp?.events ?? [];
    const top = peak(t);
    const last = events.filter(([v]) => v >= top).pop();
    return last ? (last[1] - t.at) / t.duration : 0;
  };

  // 60% is the TIGHT bound, not a comfortable one: the shortest notes — the
  // `dum dum` quavers — are the ones whose release is clamped to a fraction of
  // themselves, and that fraction is 40%. Everything longer holds to ~78% or
  // ~89%, because their release is the fixed ceiling instead. Hence the epsilon.
  const worst = melody.reduce((w, t) => Math.min(w, holdsTo(t)), 1);
  check(`every melody note is still sounding 60% of the way through it (worst ${(worst * 100).toFixed(0)}%)`,
    worst >= 0.6 - 1e-9);

  // The control, and it is the bug itself: attack, then one ramp to silence
  // across the whole note. That is what the file used to do, and it must fail
  // the check above — otherwise the check is measuring nothing.
  const asItWas: Tone = {
    type: 'square', frequency: 440, duration: 0.313, at: 0.05,
    amp: { events: [[0.0001, 0.05], [0.05, 0.07], [0.0001, 0.363]] },
  };
  check(`...and the envelope it replaced does not (${(holdsTo(asItWas) * 100).toFixed(0)}%)`,
    holdsTo(asItWas) < 0.6);

  // ...and the long notes really are long: the theme's minims last about twice
  // its crotchets, which is the other half of "truncated".
  const lengths = [...new Set(melody.map((t) => Number(t.duration.toFixed(4))))].sort((a, b) => a - b);
  check(`three note lengths, in the ratio the waltz is written in (${lengths.join(', ')})`,
    lengths.length === 3
    && Math.abs(lengths[1] / lengths[0] - 2) < 0.01
    && Math.abs(lengths[2] / lengths[0] - 4) < 0.01);

  // --- what the note is made of ---------------------------------------------
  //
  // "Nowhere near as nice as the C64" was about the VOICE, not the tune: one
  // bare square wave, and an accompaniment whose off-beats were a single note.
  // What is asserted here is the shape of the answer, not its settings — the
  // numbers are audio.ts's to tune by ear, and a test that pinned them would
  // just make tuning a two-file job.

  // A note is a PAIR, tuned apart, through ONE envelope: that is what gives a
  // plain oscillator body, standing in for the pulse-width sweep WebAudio has
  // no knob for.
  const pairs = new Map<Amp, Tone[]>();
  for (const t of melody) {
    if (t.amp) pairs.set(t.amp, [...(pairs.get(t.amp) ?? []), t]);
  }
  check(`every melody note is two oscillators through one envelope (${pairs.size} notes)`,
    pairs.size > 20 && [...pairs.values()].every((v) => v.length === 2));
  const spreads = [...pairs.values()].map(([a, b]) => Math.abs(a.frequency - b.frequency));
  check('...tuned apart, and never in unison',
    spreads.every((d) => d > 0) && spreads.length > 20);
  // Apart by an INTERVAL rather than a fixed number of hertz — the same
  // musical distance at either end of the tune, which is what keeps it one
  // instrument. A fixed-hertz detune would give a constant difference here.
  const ratios = [...pairs.values()].map(([a, b]) => Math.max(a.frequency, b.frequency)
    / Math.min(a.frequency, b.frequency));
  check(`...by a constant RATIO, not a constant gap (${ratios[0].toFixed(5)})`,
    ratios.every((r) => Math.abs(r - ratios[0]) < 1e-9)
    && new Set(spreads.map((d) => d.toFixed(3))).size > 1);

  // The wobble: one LFO a note, and its depth scales with the note, for the
  // same reason.
  eq('every melody note has a vibrato of its own', lfos.length, pairs.size);
  const depths = lfos.map((l) => peak(l));
  check(`...whose depth follows the note rather than a fixed hertz (${new Set(depths.map((d) => d.toFixed(3))).size} distinct)`,
    new Set(depths.map((d) => d.toFixed(4))).size > 1 && depths.every((d) => d > 0));

  // The accompaniment: oom on the downbeat, a REAL triad on two and three. A
  // one-note off-beat is the bass again an octave up, which is a metronome.
  const byTime = new Map<string, Tone[]>();
  for (const t of bass) byTime.set(t.at.toFixed(4), [...(byTime.get(t.at.toFixed(4)) ?? []), t]);
  const beats = [...byTime.values()];
  const oom = beats.filter((b) => b.length === 1);
  const pah = beats.filter((b) => b.length === 3);
  check(`each bar is one oom and two triads (${oom.length} oom, ${pah.length} triads)`,
    oom.length > 0 && pah.length === oom.length * 2 && oom.length + pah.length === beats.length);
  check('...and a triad really is three different pitches',
    pah.every((b) => new Set(b.map((t) => t.frequency.toFixed(3))).size === 3));
  // ...and it is a CHORD, not three notes in a row: they sound together.
  check('...sounded together, not arpeggiated',
    pah.every((b) => new Set(b.map((t) => t.at.toFixed(4))).size === 1));

  // Documented behaviour: re-engaging the autopilot must not stack voices.
  sfx.stopDockingMusic();
  tones.length = 0;
  sfx.dockingMusic();
  const again = tones.length;
  sfx.dockingMusic();
  eq('a second engage while it is playing adds no voices', tones.length, again);
  sfx.stopDockingMusic();
}
