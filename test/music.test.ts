// The docking waltz: the engine, and the arrangement it plays.
//
// src/music.ts is a score player — instruments, tracks, notes and a clock — and
// src/music-score.ts is the arrangement Chris supplied, converted. What is
// asserted is the SHAPE of the sound and the integrity of the score, never the
// settings: those are tuned by ear, and a test that pinned them would make
// every adjustment a two-file edit.

import { envelopeOf, filters, panners, peak, tones, trackOf, type Tone } from './audio-fixtures.ts';
import { check, eq } from './harness.ts';

const { sfx } = await import('../src/audio.ts');
const { waltz } = await import('../src/music-score.ts');

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
    const key = trackOf(t);
    if (key) byTrack.set(key, [...(byTrack.get(key) ?? []), t]);
  }
  eq('every voice belongs to one of them', byTrack.size, 4);

  // --- the notes hold ------------------------------------------------------
  //
  // The reported bug, generalised past the envelope that caused it: a note
  // must HOLD a level rather than decay across its own length. It used to ramp
  // from the attack straight to silence, so a minim was 27 dB down by its own
  // midpoint and the theme played as blips.
  //
  // "Holds" is the time between the note ARRIVING at its peak and the moment it
  // starts letting go. A WebAudio param keeps its value until the next
  // scheduled event, so that span is exactly the sustain — whether or not a
  // short note was long enough to have a decay ramp in the middle of it.
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

  //
  // The exception is arithmetic rather than a let-off: a note shorter than its
  // own attack plus release has no room to hold anything, and the arrangement
  // has three of them — three 0.25-beat melody notes against a lead whose
  // attack and release come to 0.195s. So the claim is that every note WITH
  // room holds, and the count of the others is derived from the score rather
  // than tolerated as a fudge factor.
  const score = waltz(60 / 100);
  const roomless = score.tracks.reduce((n, tr) => {
    const e = tr.instrument.envelope;
    return n + tr.notes.filter((note) => note.beats * score.beat <= e.attack + e.release).length
      * tr.instrument.layers.length;
  }, 0);
  const unheld = played.filter((t) => heldFor(t) <= 0);
  eq(`every note with room for it holds its level (${played.length} voices)`,
    unheld.length, roomless);
  check(`...and the ones without room are a handful, not the piece (${roomless})`,
    roomless > 0 && roomless < played.length / 100);
  const shallow = played.filter((t) => holdLevel(t) < 0.1);
  check(`...at a real sustain rather than a fade (${shallow.length} below a tenth of the peak)`,
    shallow.length === 0);

  // The control, and it is the bug itself: attack, then one ramp to silence
  // across the whole note. It must fail the check above, or the check is
  // measuring nothing.
  const asItWas: Tone = {
    type: 'square', frequency: 440, detune: 0, duration: 0.313, at: 0.05,
    amp: { events: [[0.0001, 0.05], [0.05, 0.07], [0.0001, 0.363]] },
  };
  check('...and the envelope it replaced holds nothing', heldFor(asItWas) <= 0);

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
  const pairs = [...together.values()].filter((v) => v.length === 2);
  eq('...two sawtooths to a note', pairs.length, together.size);
  // Apart in CENTS, on the oscillator's own `detune` — which is what makes the
  // width the same musical distance wherever the note is written. A pair pushed
  // apart in hertz instead would be a different interval at every pitch.
  check('...at the same written pitch, pushed apart in cents',
    pairs.every(([a, b]) => a.frequency === b.frequency && a.detune === -b.detune
      && a.detune !== 0));

  // The pitch parser, read off the tune: the waltz opens on a D4.
  const opens = saws.filter((t) => Math.abs(t.at - 0.05) < 1e-9);
  check(`...and the pitch parser is real — the waltz opens on D4, 293.66 Hz`
    + ` (${opens.map((t) => t.frequency.toFixed(2)).join(', ')})`,
  opens.length === 2 && opens.every((t) => Math.abs(t.frequency - 293.66) < 1.5));

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
  // ...and none of them comes in late enough to leave the opening bare. The
  // melody has a two-beat pickup the others answer, so "together" is within a
  // bar rather than on the same tick.
  const barSeconds = 3 * (60 / 100);
  check(`...and none comes in more than a bar late (${barSeconds.toFixed(1)}s)`,
    [...byTrack.values()].every((v) => Math.min(...v.map((t) => t.at)) < barSeconds + 0.2));

  // Documented behaviour: re-engaging the autopilot must not stack voices.
  sfx.stopDockingMusic();
  tones.length = 0;
  sfx.dockingMusic();
  const again = tones.length;
  sfx.dockingMusic();
  eq('a second engage while it is playing adds no voices', tones.length, again);
  sfx.stopDockingMusic();
}
