# The Blue Danube — Commodore 64 Elite docking music

`source/` is the decoded C64 Elite docking music, vendored **verbatim**. It is
input to a build step and nothing else:

- **No runtime module imports it.** `src/` never reads this directory, and
  nothing here reaches the browser bundle — the megabyte of JSON stays out of
  it; what ships is the 567-line `src/music-danube.ts` generated from it.
- **Nobody edits it.** If the pack is ever revised, replace the files, update
  the pinned hashes in `tools/import-danube.ts`, regenerate and review the diff.
- **Nobody retypes it.** Every note the game plays arrives through the generated
  score, never by hand.

## Read this part before reusing any of it

The composition is Johann Strauss II's *An der schönen blauen Donau*, Op. 314,
published 1866 and long in the public domain. **The arrangement is not the
composition.** What is here is Julie Dunn's 1985 transcription of that waltz for
the SID's three voices, written for the Commodore 64 release of Elite and
decoded out of the shipped music data. A transcription for particular voices is
a creative work with a copyright of its own, held separately from the tune it
arranges, and decoding it from a binary into JSON changes the container and
nothing else. Attribution is not a licence.

This project previously declined this material for that reason and synthesised
its own waltz from a public-domain melodic transcription instead. Chris decided
the C64 arrangement should be used. That is a deliberate choice by the project
owner, and it is recorded here, in `src/music.ts`, in `src/music-danube.ts` and
in the top-level `README.md` so that nothing in the repository claims a
provenance it does not have. Anyone reusing this code should make their own
decision about the arrangement rather than inheriting this one.

HARMLESS is an unofficial, non-commercial fan homage. Elite (1984) was created
by Ian Bell and David Braben and published by Acornsoft; the Commodore 64
conversion and its music are Firebird/Torus-era works. This project is
affiliated with none of them.

## Regenerating

```sh
npm run generate:danube              # rewrite src/music-danube.ts and manifest.json
npm run generate:danube -- --check   # non-writing drift check, for CI
```

The importer verifies each file's SHA-256 against a pinned list before it reads
anything, then writes:

- `src/music-danube.ts` — the compact runtime score.
- `manifest.json` beside this file — filenames, byte sizes and hashes.

It also re-derives, and fails on, the three facts the compact form rests on:
that Hz follows the SID formula from the frequency register, that vibrato is a
property of the voice rather than the note, and that the frames tile the
timeline with no gap. A revised pack that broke one of those would stop the
import rather than quietly lose the part that no longer fits.

## What is in the pack

| File | What it holds |
| --- | --- |
| `elite_blue_danube.json` | the decode: 454 timed frames, 916 note triggers, per-voice frequency registers, gate/waveform control, ADSR nibbles, pulse widths, the driver's vibrato constants and six global filter writes |
| `elite_blue_danube_player.html` | the reference Web Audio player, carrying its own copy of the JSON. This is the implementation `src/music.ts` was matched against, and the reason its envelope fractions, pulse-width floor, filter multiplier and stereo placement are what they are |

Upstream of the decode: the production-era `C.COMUDAT.bin` in Mark Moxon's
[C64 Elite source repository](https://github.com/markmoxon/elite-source-code-commodore-64),
sha256 `ab4bed6d…`, with the driver described at
<https://elite.bbcelite.com/deep_dives/music_in_commodore_64_elite.html>.

## What is approximate

The pack is honest that it is a decode plus an approximation, and `src/music.ts`
inherits every one of these. The composition, timing and voice assignment are
the original data; the sound is not a SID emulation.

- SID waveforms are Web Audio oscillators, with pulse as a 48-harmonic
  `PeriodicWave` rather than a real variable-width pulse.
- ADSR uses the nominal nibble times. The 6581's envelope quirks are not
  reproduced.
- The multimode filter becomes a fixed lowpass at Q 1.25 on every voice, swept
  through the six cutoffs the piece writes. Per-voice filter routing, resonance
  and the band/high-pass modes are dropped.
- Vibrato reproduces the driver's register increments and tick periods as
  stepped pitch changes, not the chip's analog behaviour.
- Hard sync and ring modulation do not occur in this piece and are not
  implemented.
- Stereo placement is invention. The SID is mono; the three voices are spread
  because three lines stacked in the centre are a smear.

The arrangement also plays about a third of a semitone sharp of concert pitch,
because that is what the frequency registers say through the PAL clock. It is
left there deliberately: correcting it would re-tune a performance to a standard
it was never played at.
