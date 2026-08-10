// A WebAudio context that records what was asked for, without speakers.
//
// Shared by test/audio.test.ts (the bleeps) and test/music.test.ts (the waltz),
// which is why it is a fixture rather than a block in one of them: the synth
// caches ONE AudioContext at module scope, so a second file bringing its own
// fake would either never be installed or would install it behind the first.
//
// IT FOLLOWS THE GRAPH. Three separate bugs came out of a fake that guessed —
// gain nodes bound to whichever oscillator was made last, a bare `stop()` from
// the teardown overwriting every scheduled duration with NaN, and envelopes
// dropped on the floor entirely so an envelope bug was invisible. A voice is a
// layer level, then the note's envelope, then the track's bus, and only then a
// filter; anything asking "what shape is this note" has to walk that.

/** A gain node, as the automation scheduled on it. */
export interface Amp {
  events: [number, number][];
  /** the node this envelope feeds — a track's filter, which IS that track's identity */
  out?: unknown;
}

export interface Tone {
  type: OscillatorType;
  frequency: number;
  /** cents away from `frequency`, as the layer asked for */
  detune: number;
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

export const tones: Tone[] = [];
export const filters: { type: string; frequency: { value: number }; Q: { value: number } }[] = [];
export const panners: { pan: { value: number } }[] = [];

/**
 * Walk the gain chain from an oscillator outwards.
 *
 * A voice is no longer one gain: it is a LAYER level, then the note's envelope,
 * then the track's bus, and only then the filter. Anything that wants "the
 * envelope" or "which track is this" has to follow the graph rather than assume
 * the first node it meets is the one it wanted.
 */
export const gainsFrom = (t: Tone): Amp[] => {
  const chain: Amp[] = [];
  let node: Amp | undefined = t.amp ?? undefined;
  while (node) {
    chain.push(node);
    node = (node.out as { __amp?: Amp } | undefined)?.__amp;
  }
  return chain;
};

/**
 * The note's envelope: the first gain in the chain that was SCHEDULED.
 *
 * One event is enough — `env()` in audio.ts sets a level and ramps it down, and
 * a one-shot bleep is as much an envelope as a waltz note is.
 */
export const envelopeOf = (t: Tone): Amp | null =>
  gainsFrom(t).find((g) => g.events.length > 0) ?? null;

/** The node the chain finally feeds — a track's filter, which is its identity. */
export const trackOf = (t: Tone): unknown => {
  const chain = gainsFrom(t);
  return chain.length ? chain[chain.length - 1].out : null;
};

/** The level a voice was asked for — the top of its envelope. */
export const peak = (t: Tone): number => {
  const env = envelopeOf(t);
  return env ? Math.max(...env.events.map(([v]) => v)) : 0;
};

class FakeAudioContext {
  currentTime = 10;
  state = 'running';
  destination = {};

  createOscillator() {
    const recorded: Tone = {
      type: 'sine', frequency: 0, detune: 0, duration: 0, at: 0, amp: null,
    };
    tones.push(recorded);
    const node = {
      type: 'sine' as OscillatorType,
      frequency: {
        setValueAtTime(value: number) { recorded.frequency = value; },
        exponentialRampToValueAtTime() {},
      },
      /** cents, the oscillator's own parameter — recorded so a layer's offset is readable */
      detune: { value: 0 },
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
    // the fake's own param object, mirrored onto the record when it is written
    Object.defineProperty(node.detune, 'value', {
      set(v: number) { recorded.detune = v; },
      get() { return recorded.detune; },
    });
    return node;
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
