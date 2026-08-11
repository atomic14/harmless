# 133 — The docking computer plays the C64's own arrangement

**Kind:** feature (audio, and a deliberate licensing reversal) · **Severity:**
medium · **Size:** medium · **Depends on:** nothing · **GitHub:** none — Chris
supplied the files, 2026-08-11, and chose to use them after the conflict below
was put to him.

## Where we were

`src/music.ts` played a waltz this project wrote. The composition was Strauss's
and public domain; the arrangement — four instruments, 1,051 notes in
`src/music-score.ts` — was newly orchestrated over a public-domain melodic
transcription, precisely so that no part of it came from Elite. That file said
so at length, in capitals, and named what it was declining:

> a 1985 transcription of it for three SID voices is a separate work with its
> own copyright, and lifting its note data would be the rip in a different
> container. Crediting it would not change that — attribution is not a licence.

`README.md` said "this repo contains no assets from Elite" in two places.

## What arrived

Two files: `elite_blue_danube.json`, a frame-by-frame decode of the Commodore 64
Elite music binary (`C.COMUDAT.bin`, sha256 `ab4bed6d…`), and a reference Web
Audio player for it. The decode carries 454 timed frames, 916 note triggers,
per-voice frequency registers, gate and waveform control, ADSR nibbles, pulse
widths, six global filter writes and the GMA driver's vibrato constants. Its own
metadata names Julie Dunn as the arranger and states that the composition,
timing and voices are "directly decoded from the original C64 Elite production
music data."

**That is exactly the material the old file declined**, in JSON rather than in a
SID rip. The conflict was raised before anything was written. Chris chose to use
it. The work below therefore has two halves: play it well, and stop the
repository claiming a provenance it no longer has.

## What shipped

### The claim

- `reference/danube/README.md` is the long version: what the arrangement is, why
  the tune being public domain does not reach it, that the previous decision was
  reversed deliberately and by whom, and every way in which the synthesis is an
  approximation rather than an emulation.
- `README.md` no longer says the repo contains no assets from Elite. It says
  what is true: no audio, textures or binaries ship, and one piece of the
  original that is more than a description of it does — the docking music.
- `src/music.ts` and the generated `src/music-danube.ts` carry the same
  statement where someone reading the code will meet it.

Anyone reusing this code should make their own decision rather than inherit
this one, and all four places say so.

### The pack and the importer

Vendored under `reference/danube/source`, verbatim, hash-pinned, and NOT
bundled — the megabyte of JSON stays out of the browser; the 570-line generated
score is what ships. `tools/import-danube.ts` follows `import-elite-a.mjs`:
verify hashes, read, write, and `--check` in `npm run check`.

**It also re-derives the three facts the compact form rests on**, because the
compression is only safe while they hold:

1. Hz is `register * 985248 / 2**24`, so only the register is stored;
2. vibrato belongs to the VOICE, not the note — voice 1 never, voice 2 +32 every
   4 ticks, voice 3 +37 every 5 — so all 602 repetitions of it are dropped;
3. the frames tile the timeline with no gap, to 6330 ticks.

A revised pack that broke one would fail the import rather than quietly lose the
part that no longer fits. All four failure paths were proved by mutating a
re-pinned copy of the pack.

### The player

`src/music.ts` is now a SID player rather than a score player. Three permanent
voice chains — level, swept lowpass, stereo place — instead of a fresh filter
and panner per note: **nine nodes rather than about three thousand**, and the
cutoff sweep becomes six automation events, which is also closer to the chip,
where the filter is one global thing the driver writes to.

**The release rule is reversed, and it is the thing most likely to be "fixed"
back.** The old player fitted the release INSIDE the written note length,
because a legato arrangement would otherwise smear. A SID note ends when the
driver clears its gate and the release is what happens after — up to 2.4 seconds
of it here. `test/music.test.ts` pins the reversal.

Kept from the reference player so that what plays in the game is what Chris
signed off on in the browser: the envelope clipping fractions, the 48-harmonic
pulse wave and its 3% duty floor, the cutoff multiplier and Q, the peak level
and the three stereo positions. Dropped: per-voice filter routing, resonance,
and the band/high-pass modes, all listed in the reference README.

The arrangement plays about a third of a semitone sharp of concert pitch,
because that is what the registers say through the PAL clock. Left there
deliberately.

## How it was verified

- `test/music.test.ts`, rewritten: 33 assertions over the score's integrity and
  the sound's shape, never the tuned settings. Every claim was proved able to
  fail by breaking the rule it protects — the release fitted back inside the
  note, the filter set once instead of swept, the pulse fallen back to a square,
  the vibrato made a fixed interval, voice 1 given a wobble, a filter built per
  note.
- **Rendered against the reference player offline in Chrome, 40 seconds at
  44.1 kHz: correlation 1.000000, identical RMS per channel, maximum sample
  difference 0.0005** — which is the shared automated filter versus a per-note
  static one at the six switch instants. The refactor is audibly the same piece.
- Full render, 126.6 s: 916 oscillators, peak 0.182, no NaN, no clipping, sound
  continuous to 126.8 s.
- `npm run check` — 4,137 passed, 0 failed.

`src/music-score.ts` was deleted. Its arrangement is in the history; keeping an
unreachable second score would have been the two-homes failure this project is
organised against.
