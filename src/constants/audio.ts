// A noise, placed: how far it carries, and how wide the stereo field is.
//
// `AUDIBLE_RANGE` is the reach. `STEREO_WIDTH` is the width.
//
// Both are facts about WHERE a thing is in the world. That is why they are
// here, rather than in `src/audio.ts` beside the frequencies.
//
// The constants gate draws the same line for `music.ts`. The SID clock and a
// note's timbre are how a sound is MADE, and they stay with the synth. A range
// in world units is a game rule, and it lives in the home (docs/TODO/142).
//
// `src/audio.ts` is the only module that spends either. It decides what to do
// with them, exactly as it decides the countdown's pitch from `COUNTDOWN`.

import { SCANNER_RANGE } from './console.ts';

/**
 * How far a bang carries, in world units.
 *
 * It is the scanner's reach, written as an expression over `SCANNER_RANGE`
 * rather than as a second copy of 6,000. That is a claim: you hear what you
 * could see. A ship beyond the scanner is one the cockpit has no other way to
 * report. A bang from out there would be a sound with no source the pilot can
 * find.
 *
 * One number, one rule. A move to the scanner moves the ear with it. Same trick
 * as `HERMIT_REFUSES_AT` over `CHARACTER` (hermit-market.ts).
 *
 * It is deliberately NOT tied to `PIRATE_HUNT_RANGE` or `HUNTER_RANGE`. Those
 * are the same 6,000 for an unrelated reason. `SCANNER_RANGE`'s own doc comment
 * declines that merge, and this one inherits the refusal.
 *
 * @rule audio.audibleRange
 */
export const AUDIBLE_RANGE = SCANNER_RANGE;

/**
 * How far across the stereo field a sound may sit: 0 is mono, 1 is one ear only.
 *
 * A sound abeam gets 0.7 rather than a hard 1.0. Two reasons, and the second is
 * the one that decides it. A hard-panned voice vanishes from a mono speaker and
 * from a phone, which is what a lot of this game is played on. And a bang that
 * arrives in exactly one ear reads as a fault in the headphones rather than as a
 * ship off the port bow.
 *
 * It is wider than `PAN` in music.ts (0.28 and 0.24), and that is the difference
 * between decoration and information. The waltz places three voices so that no two
 * of them smear into each other. This places a bang so that the pilot can turn
 * towards it, so it has to be big enough to act on.
 *
 * It has its own rule id. It shares the value 0.7 with `CARGO_LOSS_CHANCE`
 * (hull-breach.ts) and `THARGOID_FIRE_RATE` (npc-gun.ts). That is a stereo
 * width beside two probabilities, and all three must stay free to move apart.
 * This one is tuned by ear on headphones. Neither of those is.
 *
 * @rule audio.stereoWidth
 */
export const STEREO_WIDTH = 0.7;
