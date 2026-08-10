// Named sound occasions must preserve the tones they replaced. A tiny fake
// AudioContext records oscillator shape without speakers, timing, or a browser.

import { COUNTDOWN } from '../src/constants/jump.ts';
import { check, eq } from './harness.ts';

interface Tone {
  type: OscillatorType;
  frequency: number;
  duration: number;
  gain: number;
  /**
   * The gain automation, in the order it was scheduled: `[value, seconds from
   * `currentTime`]`. Absolute, NOT relative to `at`, because the synth builds
   * the envelope before it starts the oscillator — a note's own start time is
   * still 0 while its gain is being scheduled.
   *
   * The fake used to throw ramps away, which made an ENVELOPE unobservable —
   * and that is precisely where the docking waltz was wrong: every note decayed
   * to silence across its own length, so the long notes were inaudible before
   * they ended and the theme played as blips. A test cannot catch what the fake
   * does not record.
   */
  envelope: [number, number][];
  /** when the note starts, in seconds from `currentTime` — melody notes queue */
  at: number;
}

const tones: Tone[] = [];
let current: Tone | null = null;

class FakeAudioContext {
  currentTime = 10;
  state = 'running';
  destination = {};

  createOscillator() {
    const recorded: Tone = {
      type: 'sine', frequency: 0, duration: 0, gain: 0, envelope: [], at: 0,
    };
    tones.push(recorded);
    current = recorded;
    return {
      type: 'sine' as OscillatorType,
      frequency: {
        setValueAtTime(value: number) {
          recorded.frequency = value;
        },
        exponentialRampToValueAtTime() {},
      },
      connect() {
        recorded.type = this.type;
        return { connect() {} };
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
    // Bound to whichever oscillator was created last — the synth builds the
    // pair together, so `current` is that note's.
    const note = current;
    /**
     * `set` also updates `gain`, `ramp` does not — which keeps `Tone.gain`
     * meaning what it meant before the envelope was recorded at all: the level
     * the synth ASKED for. `env()` sets the peak and then ramps to 0.001, and
     * every assertion above is about that peak.
     */
    const mark = (set: boolean) => (value: number, at: number): void => {
      if (!note) return;
      if (set) note.gain = value;
      note.envelope.push([value, at - 10]);
    };
    return {
      gain: {
        setValueAtTime: mark(true),
        exponentialRampToValueAtTime: mark(false),
      },
      connect() { return { connect() {} }; },
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
  eq(`${name} keeps the standard gain`, tone.gain, 0.08);
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

  const melody = played.filter((t) => t.type === 'square');
  const bass = played.filter((t) => t.type === 'triangle');
  check(`it is two voices — ${melody.length} melody notes over ${bass.length} bass`,
    melody.length > 20 && bass.length > 20);

  /** How far through a note the gain was last at its full level, as a fraction. */
  const holdsTo = (t: Tone): number => {
    const peak = Math.max(...t.envelope.map(([v]) => v));
    const last = t.envelope.filter(([v]) => v >= peak).pop();
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
    type: 'square', frequency: 440, duration: 0.313, gain: 0.05, at: 0.05,
    envelope: [[0.0001, 0.05], [0.05, 0.07], [0.0001, 0.363]],
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

  // Documented behaviour: re-engaging the autopilot must not stack voices.
  sfx.stopDockingMusic();
  tones.length = 0;
  sfx.dockingMusic();
  const again = tones.length;
  sfx.dockingMusic();
  eq('a second engage while it is playing adds no voices', tones.length, again);
  sfx.stopDockingMusic();
}
