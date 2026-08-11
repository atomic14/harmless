// The docking waltz: the SID player, and the arrangement it plays.
//
// src/music.ts is a three-voice player — registers, envelopes, a swept filter
// and a 50 Hz clock — and src/music-danube.ts is the decoded C64 arrangement.
// What is asserted is the SHAPE of the sound and the integrity of the score,
// never the settings: those are tuned by ear against the reference player in
// reference/danube/source, and a test that pinned them would make every
// adjustment a two-file edit.

import { envelopeOf, filters, panners, peak, tones, trackOf, type Tone } from './audio-fixtures.ts';
import { check, eq } from './harness.ts';

const { sfx } = await import('../src/audio.ts');
const { DANUBE_FRAMES, DANUBE_SECONDS, DANUBE_TICK_HZ } = await import('../src/music-danube.ts');

console.log('\nthe docking waltz');

// --- the score, before anything plays it -------------------------------------
//
// `tools/import-danube.ts` checks these against the vendored pack, but the pack
// is not shipped and the generated file is. So they are checked again here,
// where they are claims about the DATA IN THE BUNDLE: a hand-edit of a
// generated file, or a regeneration from a revised pack that nobody re-imported,
// would show up as a hole in the timeline rather than as a wrong note.
{
  let tick = 0;
  let gaps = 0;
  let triggers = 0;
  for (const frame of DANUBE_FRAMES) {
    if (frame.tick !== tick) gaps += 1;
    tick += frame.ticks;
    triggers += frame.voices.length;
  }
  eq('the frames tile the timeline with no gap', gaps, 0);
  eq(`...to ${DANUBE_SECONDS.toFixed(2)} seconds of waltz`, tick / DANUBE_TICK_HZ, DANUBE_SECONDS);
  eq('916 note triggers across three voices', triggers, 916);
  check('...and every one of them names a voice the SID has',
    DANUBE_FRAMES.every((f) => f.voices.every((v) => v.voice >= 1 && v.voice <= 3)));
  // Only six frames move the filter and the rest carry it forward, so the FIRST
  // must set one — otherwise the piece opens with an undefined cutoff.
  check('the first frame sets a cutoff, so none is ever carried from nothing',
    DANUBE_FRAMES[0].cutoff > 0);
}

{
  tones.length = 0;
  filters.length = 0;
  panners.length = 0;
  sfx.dockingMusic();
  const played = [...tones];

  // --- the engine ----------------------------------------------------------
  //
  // Three voices, each through its own lowpass and its own place in the stereo
  // field. The chain is built ONCE per voice — nine nodes, not three thousand —
  // so a count that grew with the notes would mean it had gone back to building
  // a filter per note.
  eq('three voices, three filters', filters.length, 3);
  eq('...and three places in the stereo field', panners.length, 3);
  check('...every filter a lowpass with a real Q',
    filters.every((f) => f.type === 'lowpass' && f.Q.value > 0));
  check('...which are not all the same place',
    new Set(panners.map((p) => p.pan.value)).size > 1
    && panners.every((p) => Math.abs(p.pan.value) <= 1));

  eq(`every trigger in the score is played (${played.length})`, played.length, 916);

  // A voice's filter IS its identity — the graph is followed rather than the
  // wave type guessed at, because two of the three voices play sawtooths.
  const byVoice = new Map<unknown, Tone[]>();
  for (const t of played) {
    const key = trackOf(t);
    if (key) byVoice.set(key, [...(byVoice.get(key) ?? []), t]);
  }
  eq('every voice belongs to one of them', byVoice.size, 3);

  // --- the filter is swept, not set ----------------------------------------
  //
  // Six writes over the piece, and they are what makes the middle section
  // change colour. A filter with one event would be a static tone control.
  check(`each voice's cutoff is swept, not fixed (${filters[0].sweep.length} writes)`,
    filters.every((f) => f.sweep.length === 6));
  check('...through more than one value, in range, in time order',
    filters.every((f) => new Set(f.sweep.map(([hz]) => hz)).size > 1
      && f.sweep.every(([hz]) => hz >= 700 && hz <= 15_000)
      && f.sweep.every(([, at], i) => i === 0 || at > f.sweep[i - 1][1])));

  // --- the notes hold ------------------------------------------------------
  //
  // Carried over from the score player this replaced, because the bug is a
  // property of WebAudio and not of an arrangement: a note must HOLD a level
  // rather than decay across its own length. It used to ramp from the attack
  // straight to silence, so a long note was 27 dB down by its own midpoint and
  // the theme played as blips.
  //
  // "Holds" is the time between the note ARRIVING at its peak and the moment it
  // starts letting go. A WebAudio param keeps its value until the next
  // scheduled event, so that span is exactly the sustain.
  const heldFor = (t: Tone): number => {
    const ev = envelopeOf(t)?.events ?? [];
    if (ev.length < 3) return 0;
    const top = Math.max(...ev.map(([v]) => v));
    const arrives = ev.find(([v]) => v === top)?.[1] ?? 0;
    // the last level it is set to before the final ramp down to silence
    const letsGo = ev[ev.length - 2][1];
    return letsGo - arrives;
  };
  /** The level it is holding at, as a fraction of the peak it reached. */
  const holdLevel = (t: Tone): number => {
    const ev = envelopeOf(t)?.events ?? [];
    return ev.length < 3 ? 0 : ev[ev.length - 2][0] / peak(t);
  };

  // No exception this time, and that is a real difference from the score
  // player: the attack and decay are CLIPPED to fractions of the note, so
  // however short a frame is there is always room left to hold.
  const unheld = played.filter((t) => heldFor(t) <= 0);
  eq(`every note holds its level (${played.length} voices)`, unheld.length, 0);
  const shallow = played.filter((t) => holdLevel(t) < 0.02);
  eq(`...at a real sustain rather than a fade (${shallow.length} below a fiftieth of the peak)`,
    shallow.length, 0);

  // The control, and it is the bug itself: attack, then one ramp to silence
  // across the whole note. It must fail the check above, or the check is
  // measuring nothing.
  const asItWas: Tone = {
    type: 'square', frequency: 440, pitches: [], detune: 0, duration: 0.313,
    at: 0.05, periodic: false,
    amp: { events: [[0.0001, 0.05], [0.05, 0.07], [0.0001, 0.363]] },
  };
  check('...and the envelope it replaced holds nothing', heldFor(asItWas) <= 0);

  // --- THE RELEASE HANGS PAST THE NOTE -------------------------------------
  //
  // The deliberate reversal of what the score player did, and the thing most
  // likely to be "fixed" back by someone who reads that file's history. A SID
  // note ends when the driver clears its gate and the release is what happens
  // AFTER; fitting it inside the frame would clip every note in the piece to
  // its own cell and lose the ring the arrangement is built out of.
  const gateOff = new Map<Tone, number>();
  {
    let i = 0;
    for (const frame of DANUBE_FRAMES) {
      for (const _ of frame.voices) {
        gateOff.set(played[i], (frame.tick + frame.ticks) / DANUBE_TICK_HZ);
        i += 1;
      }
    }
  }
  const rings = played.filter((t) => {
    const ev = envelopeOf(t)?.events ?? [];
    const silent = ev[ev.length - 1]?.[1] ?? 0;
    return silent > (gateOff.get(t) ?? 0) + 0.05 + 1e-9;
  });
  check(`most notes ring on past their gate (${rings.length} of ${played.length})`,
    rings.length > played.length * 0.8);
  // ...and the oscillator is not stopped before its own release has finished.
  const cut = played.filter((t) => {
    const ev = envelopeOf(t)?.events ?? [];
    const silent = ev[ev.length - 1]?.[1] ?? 0;
    return t.at + t.duration < silent - 1e-9;
  });
  eq('no oscillator is stopped mid-release', cut.length, 0);

  // --- the pitch is the chip's own formula ---------------------------------
  //
  // `hz = register * 985248 / 2**24`, which is why the piece sits about a third
  // of a semitone sharp and is left there. The opening voice-1 register is
  // 3823, so nothing here is a note name that could have been rounded.
  const opens = played.filter((t) => Math.abs(t.at - 0.05) < 1e-9);
  eq('three voices open together', opens.length, 3);
  const first = DANUBE_FRAMES[0].voices[0];
  const expected = first.register * 985_248 / 2 ** 24;
  check(`...and the lowest is register ${first.register} at ${expected.toFixed(2)} Hz,`
    + ` a sharp A3 (${opens.map((t) => t.frequency.toFixed(2)).join(', ')})`,
  Math.abs(Math.min(...opens.map((t) => t.frequency)) - expected) < 1e-4);

  // --- vibrato belongs to the voice ----------------------------------------
  //
  // Voice 1 never wobbles, voices 2 and 3 always do, and the wobble is a STEP
  // between two registers rather than a smooth LFO — which is what the C64
  // driver does. The voices are told apart by their filter, in creation order.
  const forVoice = (n: number): Tone[] => byVoice.get(filters[n - 1]) ?? [];
  eq('voice 1 is a third of the piece', forVoice(1).length, 314);
  check('...and never vibratos — one pitch written per note',
    forVoice(1).every((t) => t.pitches.length === 1));
  for (const n of [2, 3]) {
    const voice = forVoice(n);
    const wobbling = voice.filter((t) => t.pitches.length > 1);
    check(`voice ${n} vibratos on the notes long enough to (${wobbling.length} of ${voice.length})`,
      wobbling.length > voice.length * 0.5);
    // Two pitches only, alternating, the upper one above the written one.
    check(`...between exactly two registers, the second one sharper`,
      wobbling.every((t) => {
        const distinct = [...new Set(t.pitches.map(([hz]) => hz))];
        return distinct.length === 2 && Math.max(...distinct) > t.frequency;
      }));
    // The step is the driver's own, and it is a step in the REGISTER — so the
    // interval it makes is wider at the bottom of the voice's range than at the
    // top. A vibrato written in cents would be the same width everywhere.
    const cents = wobbling.map((t) =>
      1200 * Math.log2(Math.max(...t.pitches.map(([hz]) => hz)) / t.frequency));
    check(`...by a fixed step in the register, not a fixed interval`
      + ` (${Math.min(...cents).toFixed(0)}–${Math.max(...cents).toFixed(0)} cents wide)`,
    Math.max(...cents) > Math.min(...cents) * 1.5);
  }

  // --- the SID's pulse is not a Web Audio square ---------------------------
  //
  // 45 triggers ask for a pulse at a duty of a tenth of a per cent. Web Audio
  // has no pulse, so they get a PeriodicWave; falling back to `square` would be
  // a 50% duty and a different, rounder instrument.
  const pulses = played.filter((t) => t.periodic);
  eq('the pulse notes get a built wave, not a square', pulses.length, 45);
  check('...and every other note is one of the built-in shapes',
    played.filter((t) => !t.periodic).every((t) => t.type === 'sawtooth' || t.type === 'triangle'));

  // --- no voice drops out before the end -----------------------------------
  //
  // The defect the previous arrangement arrived with, kept because the next
  // score may not be generated the same way: its bass and chords stopped four
  // bars before the tune did, leaving melody over silence.
  const lastOf = (v: Tone[]): number => Math.max(...v.map((t) => t.at));
  const ends = [1, 2, 3].map((n) => lastOf(forVoice(n)));
  check(`no voice stops more than a few seconds before the piece does`
    + ` (${ends.map((e) => e.toFixed(1)).join('s, ')}s of ${DANUBE_SECONDS.toFixed(1)}s)`,
  ends.every((e) => e > DANUBE_SECONDS - 6));
  check('...and none comes in late enough to leave the opening bare',
    [1, 2, 3].every((n) => Math.min(...forVoice(n).map((t) => t.at)) < 1));

  // Documented behaviour: re-engaging the autopilot must not stack voices.
  sfx.stopDockingMusic();
  tones.length = 0;
  sfx.dockingMusic();
  const again = tones.length;
  sfx.dockingMusic();
  eq('a second engage while it is playing adds no voices', tones.length, again);
  sfx.stopDockingMusic();
}
