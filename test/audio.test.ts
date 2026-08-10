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
