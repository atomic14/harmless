// Named sound occasions must preserve the tones they replaced. A tiny fake
// AudioContext records oscillator shape without speakers, timing, or a browser.

import { COUNTDOWN } from '../src/constants/jump.ts';
import { check, eq } from './harness.ts';

/** A gain node, as the automation scheduled on it. */
interface Amp {
  events: [number, number][];
  /** the node this envelope feeds — a track's filter, which IS that track's identity */
  out?: unknown;
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
const filters: { type: string; frequency: { value: number }; Q: { value: number } }[] = [];
const panners: { pan: { value: number } }[] = [];

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
      // `value` for the static track level, the two schedulers for an envelope.
      gain: { value: 0, setValueAtTime: mark, exponentialRampToValueAtTime: mark },
      connect(target?: { connect?: unknown }) {
        amp.out = target;
        return target?.connect ? target : { connect() {} };
      },
    };
  }

  /** A static lowpass per track — its settings are read back, not automated. */
  createBiquadFilter() {
    const node = {
      type: '',
      frequency: { value: 0 },
      Q: { value: 0 },
      connect(target?: { connect?: unknown }) {
        return target?.connect ? target : { connect() {} };
      },
    };
    filters.push(node);
    return node;
  }

  /** Stereo placement. Present here, so the "no panner" fallback needs its own test. */
  createStereoPanner() {
    const node = {
      pan: { value: 0 },
      connect(target?: { connect?: unknown }) {
        return target?.connect ? target : { connect() {} };
      },
    };
    panners.push(node);
    return node;
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

console.log('\nthe docking waltz');
{
  tones.length = 0;
  filters.length = 0;
  panners.length = 0;
  sfx.dockingMusic();
  const played = [...tones];

  // --- the engine ----------------------------------------------------------
  //
  // Four voices, each through its own lowpass and its own place in the stereo
  // field. audio.ts had no concept of either until the palette Chris put
  // together arrived: a bare square and a bare triangle, mono, unfiltered.
  eq('four tracks, four filters', filters.length, 4);
  check('...every one a lowpass, and none of them wide open',
    filters.every((f) => f.type === 'lowpass' && f.frequency.value > 0
      && f.frequency.value < 20_000 && f.Q.value > 0));
  eq('...and four places in the stereo field', panners.length, 4);
  check('...which are not all the same place',
    new Set(panners.map((p) => p.pan.value)).size > 1
    && panners.every((p) => Math.abs(p.pan.value) <= 1));

  // A track's filter IS its identity — the graph is followed rather than the
  // wave type guessed at, because three of the four instruments use triangles.
  const byTrack = new Map<unknown, Tone[]>();
  for (const t of played) {
    if (t.amp?.out) byTrack.set(t.amp.out, [...(byTrack.get(t.amp.out) ?? []), t]);
  }
  eq('every voice belongs to one of them', byTrack.size, 4);

  // --- the notes hold ------------------------------------------------------
  //
  // The reported bug, generalised past the envelope that caused it: a note
  // must HOLD a level rather than decay across its own length. It used to ramp
  // from the attack straight to silence, so a minim was 27 dB down by its own
  // midpoint and the theme played as blips.
  const sustainOf = (t: Tone): number => {
    const ev = t.amp?.events ?? [];
    // a plateau: two consecutive events at the same level, at different times
    for (let i = 1; i < ev.length; i++) {
      if (ev[i][0] === ev[i - 1][0] && ev[i][1] > ev[i - 1][1]) return ev[i][0];
    }
    return 0;
  };
  const unheld = played.filter((t) => sustainOf(t) <= 0);
  check(`every voice in the piece holds a level (${played.length} voices, ${unheld.length} do not)`,
    played.length > 100 && unheld.length === 0);
  const shallow = played.filter((t) => sustainOf(t) < peak(t) * 0.1);
  check(`...and it is a real sustain, not a fade (${shallow.length} below a tenth of the peak)`,
    shallow.length === 0);

  // The control, and it is the bug itself: attack, then one ramp to silence
  // across the whole note. It must fail the check above, or the check is
  // measuring nothing.
  const asItWas: Tone = {
    type: 'square', frequency: 440, duration: 0.313, at: 0.05,
    amp: { events: [[0.0001, 0.05], [0.05, 0.07], [0.0001, 0.363]] },
  };
  check('...and the envelope it replaced holds nothing', sustainOf(asItWas) === 0);

  // --- the lead is a layered voice, tuned apart ----------------------------
  //
  // One oscillator is a buzzer. Only the lead uses sawtooths, so they are how
  // it is found without naming a filter setting.
  const lead = [...byTrack.values()].find((v) => v.some((t) => t.type === 'sawtooth')) ?? [];
  const saws = lead.filter((t) => t.type === 'sawtooth');
  check(`the lead is layered (${new Set(lead.map((t) => t.type)).size} wave types)`,
    new Set(lead.map((t) => t.type)).size > 1 && saws.length > 20);

  // Its pair is detuned by an INTERVAL, not a fixed number of hertz, so the
  // same musical width holds at either end of the tune.
  const together = new Map<string, Tone[]>();
  for (const t of saws) together.set(t.at.toFixed(4), [...(together.get(t.at.toFixed(4)) ?? []), t]);
  const chords2 = [...together.values()].filter((v) => v.length === 2);
  eq('...two sawtooths to a note', chords2.length, together.size);
  const ratios = chords2.map(([a, b]) => Math.max(a.frequency, b.frequency)
    / Math.min(a.frequency, b.frequency));
  const gaps = chords2.map(([a, b]) => Math.abs(a.frequency - b.frequency));
  check(`...apart by a constant RATIO, not a constant gap (${ratios[0].toFixed(5)})`,
    ratios.every((r) => Math.abs(r - ratios[0]) < 1e-9) && ratios[0] > 1
    && new Set(gaps.map((g) => g.toFixed(3))).size > 1);

  // The pitch parser, read off the tune: the waltz opens on a D4.
  const first = saws.map((t) => t.frequency).sort((a, b) => a - b);
  check(`...and it is written in real pitches — the opening D4 is near 293.66 Hz (${first[0].toFixed(2)})`,
    Math.abs(Math.min(...saws.map((t) => t.at)) - 0.05) < 1e-9
    && saws.filter((t) => Math.abs(t.at - 0.05) < 1e-9)
      .every((t) => Math.abs(t.frequency - 293.66) < 1.5));

  // --- THE DEFECT THE PALETTE ARRIVED WITH ---------------------------------
  //
  // Its score had the bass and the chords stop at bar 9 while the tune ran to
  // bar 13 — four bars, nearly a third of the piece, of melody over silence.
  // Ours derives the accompaniment's length from the melody's, so it cannot be
  // written that way; this is what says so, because the next arrangement may
  // not be generated the same way.
  const lastOf = (v: Tone[]): number => Math.max(...v.map((t) => t.at));
  const leadEnds = lastOf(lead);
  const short = [...byTrack.values()].filter((v) => v !== lead && lastOf(v) < leadEnds - 1);
  check(`no voice stops before the tune does (lead ends ${leadEnds.toFixed(1)}s)`,
    short.length === 0,
    short.map((v) => `one ends at ${lastOf(v).toFixed(1)}s`).join(', '));
  check('...and they all start with it',
    [...byTrack.values()].every((v) => Math.min(...v.map((t) => t.at)) < 1));

  // Documented behaviour: re-engaging the autopilot must not stack voices.
  sfx.stopDockingMusic();
  tones.length = 0;
  sfx.dockingMusic();
  const again = tones.length;
  sfx.dockingMusic();
  eq('a second engage while it is playing adds no voices', tones.length, again);
  sfx.stopDockingMusic();
}
