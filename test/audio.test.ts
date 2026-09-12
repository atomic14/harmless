// Named sound occasions must preserve the tones they replaced.
//
// The docking waltz is test/music.test.ts; the fake both drive is
// test/audio-fixtures.ts.

import { COUNTDOWN } from '../src/constants/jump.ts';
import { peak, tones } from './audio-fixtures.ts';
import { check, eq } from './harness.ts';

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
  misjumpArmed: [1300, 0.12],
  misjumpDisarmed: [450, 0.12],
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

// THE FIGHT CUE IS A WHOOP WHOOP, and it took four goes. Chris, 2026-09-12:
// *"The alarm sound for a pirate is a bit too much"*, then *"I just want a
// couple of beeps"*, then *"It back to the horrible beep"*, then *"how about a
// whoop whoop - like a klaxon just two of them though"*.
//
// It was one 1000 Hz SQUARE beep for 0.12s. Two levers were confused for one
// through three of those attempts. The VOICE is what grated, because a square
// wave carries every odd harmonic above its pitch. The SHAPE is what makes a
// klaxon, and that is a glide rather than a note.
//
// So the claim is both, and the glide is the half a flat cue would pass
// without. `test/audio-fixtures.ts` records the ramp target from this date for
// exactly that reason.
{
  tones.length = 0;
  sfx.combatComputerEngaged();
  const cue = [...tones];
  eq('the fight cue is two whoops', cue.length, 2);
  check('...each one a GLIDE, which is what makes a whoop',
    cue.every((t) => t.rampTo !== null && t.rampTo !== t.frequency),
    cue.map((t) => `${t.frequency}->${t.rampTo}`).join(','));
  check('...rising, so it reads as an alert rather than a sigh',
    cue.every((t) => (t.rampTo ?? 0) > t.frequency),
    cue.map((t) => `${t.frequency}->${t.rampTo}`).join(','));
  check('...on the soft voice, not the house square that grated',
    cue.every((t) => t.type === 'sine'), cue.map((t) => t.type).join(','));
  check('...at the standard gain, like every other named occasion',
    cue.every((t) => peak(t) === 0.08), cue.map((t) => peak(t)).join(','));
  check('...the same glide twice, so it is one cue and not two events',
    cue.length === 2 && cue[0].frequency === cue[1].frequency
      && cue[0].rampTo === cue[1].rampTo,
    cue.map((t) => `${t.frequency}->${t.rampTo}`).join(' then '));
  check('...the second after the first, not over it',
    cue.length === 2 && cue[1].at >= cue[0].at + cue[0].duration,
    cue.map((t) => `${t.at}+${t.duration}`).join(' then '));
  // A klaxon runs until somebody silences it. This one says its piece and
  // stops, because the fight it announces has already started.
  check('...and the whole cue is over inside a second',
    cue.length === 2 && cue[1].at + cue[1].duration < 1,
    `${(cue[1].at + cue[1].duration).toFixed(2)}s`);
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
