// Tiny WebAudio synth — bleeps and zaps in the spirit of the BBC sound chip.
// The context is created lazily on the first user gesture.
//
// One-shot noises only. The docking waltz is `music.ts` — three SID voices, a
// 50 Hz clock and the arrangement in `music-danube.ts`, which is a different
// subject and was pushing this file past the size ceiling. This file still owns
// the CONTEXT, and hands it to the player, so "created lazily on the first
// gesture" stays one rule.

import { AUDIBLE_RANGE, STEREO_WIDTH } from './constants/audio.ts';
import { COUNTDOWN } from './constants/jump.ts';
import { playDanube } from './music.ts';

/**
 * Where a sound happened, as the cockpit hears it (docs/TODO/142).
 *
 * The Game measures it; this file decides what it is worth. That is the same
 * bargain `countdown(n)` struck: the caller reports the occasion, and the audio
 * design is made here. A caller that hands over a place is not asking for a
 * volume, and a sound is free to spend one field and ignore the other.
 */
export interface Place {
  /** world units from the cockpit to the source */
  distance: number;
  /**
   * Where it lies across the view: &minus;1 hard to port, 0 dead ahead or dead
   * astern, 1 hard to starboard.
   *
   * It is the RAW direction, and the width of the field is not applied yet. How
   * wide the cockpit's stereo image is, is an audible judgement and it belongs
   * to this file (`STEREO_WIDTH`). Where a thing lies is geometry and belongs to
   * the caller. Same division as the distance above.
   */
  side: number;
}

/**
 * How much of a sound survives the trip, from 1 at the hull to 0 at the edge of
 * earshot.
 *
 * Squared rather than linear, because linear is too flat to be information: a
 * kill at half the scanner would arrive at half volume, and every fight would
 * sit in the same narrow band of loudness. Squared puts that kill at a quarter
 * and leaves room underneath for the ones that matter.
 *
 * It is NOT the inverse-square law, and the departure is deliberate. True
 * inverse-square puts a wreck at 300 units a hundredth as loud as one on the
 * hull, so a fight would stop being audible long before it stopped being
 * dangerous. This reaches zero at a stated range instead, which is what lets a
 * voice beyond it be skipped rather than built and never heard.
 */
function distanceGain(distance: number): number {
  const reach = Math.max(0, 1 - distance / AUDIBLE_RANGE);
  return reach * reach;
}

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/**
 * The envelope, scaled by how far away the sound happened.
 *
 * @returns null when there is no note to build. A voice quieter than the level
 * the envelope decays TO would ramp upwards over its own length, which is a bang
 * played backwards. So the floor decides two things at once, and it is written
 * once: below it the sound is skipped, and above it the sound decays to it.
 * Skipping also means a wreck beyond earshot costs no oscillator and no buffer.
 */
function env(
  a: AudioContext, gain: number, duration: number, place?: Place,
): GainNode | null {
  const floor = 0.001;
  const level = gain * (place ? distanceGain(place.distance) : 1);
  if (level <= floor) return null;
  const g = a.createGain();
  g.gain.setValueAtTime(level, a.currentTime);
  g.gain.exponentialRampToValueAtTime(floor, a.currentTime + duration);
  // Stereo width where the browser has a panner, straight through where it does
  // not — the rule music.ts already states for the waltz, and it holds for the
  // sky: a missing StereoPannerNode must cost the placement, not the sound.
  const panner = place ? a.createStereoPanner?.() : undefined;
  if (panner) {
    panner.pan.value = place!.side * STEREO_WIDTH;
    g.connect(panner).connect(a.destination);
  } else {
    g.connect(a.destination);
  }
  return g;
}

function sweep(
  type: OscillatorType, from: number, to: number, duration: number, gain: number,
  place?: Place,
): void {
  const a = ac();
  if (!a) return;
  const g = env(a, gain, duration, place);
  if (!g) return;
  const o = a.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(from, a.currentTime);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, to), a.currentTime + duration);
  o.connect(g);
  o.start();
  o.stop(a.currentTime + duration);
}

/** The common square-wave voice used by the named interface sounds below. */
function tone(frequency: number, duration = 0.08, gain = 0.08): void {
  sweep('square', frequency, frequency, duration, gain);
}

function noiseBurst(duration: number, gain: number, lowpass = 4000, place?: Place): void {
  const a = ac();
  if (!a) return;
  const g = env(a, gain, duration, place);
  if (!g) return;
  const len = Math.floor(a.sampleRate * duration);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = lowpass;
  src.connect(f);
  f.connect(g);
  src.start();
}

/** The teardown for the waltz while it is playing, or null when it is not. */
let musicStop: (() => void) | null = null;

export const sfx = {
  laser(): void {
    sweep('sawtooth', 900, 220, 0.18, 0.12);
  },
  /**
   * Somebody is shooting at you. PLACED, and never attenuated.
   *
   * This is the one sound of the four that ignores its own distance, and the
   * reason is in `world-step.ts`: the bang is pushed only in the branch where
   * the shot is at the PLAYER — an NPC firing on another NPC draws a tracer and
   * says nothing — so the beam always ends on the hull, or within 220 units of
   * it on a miss. How far the shooter sits is therefore not a fact about how
   * loud the bolt was. What the place tells the pilot is which side it came
   * from, which is the warning worth having.
   */
  enemyLaser(place?: Place): void {
    sweep('square', 500, 140, 0.22, 0.08,
      place && { distance: 0, side: place.side });
  },
  /** Your own bolt striking something, out where the something is. */
  hit(place?: Place): void {
    noiseBurst(0.12, 0.15, 2500, place);
  },
  /**
   * You took a hit. No place: it happened to the hull you are sitting in, and a
   * warning that faded with the shooter's range would be the wrong warning.
   */
  damage(): void {
    noiseBurst(0.3, 0.22, 1200);
    sweep('sawtooth', 200, 60, 0.3, 0.12);
  },
  explosion(place?: Place): void {
    noiseBurst(0.8, 0.3, 900, place);
    sweep('sine', 120, 30, 0.8, 0.25, place);
  },
  refused(): void { tone(220); },
  noMissiles(): void { tone(180); },
  noEnergy(): void { tone(180); },
  missileArmed(): void { tone(700); },
  missileUnarmed(): void { tone(400); },
  missileLocked(): void { tone(1200, 0.12); },
  missileDisarmed(): void { tone(500, 0.06); },
  torusDropped(): void { tone(300); },
  lowEnergy(): void { tone(320, 0.1); },
  survivorScooped(): void { tone(600, 0.12); },
  cargoScooped(): void { tone(950); },
  trumbleAte(): void { tone(500, 0.1); },
  generationShipFound(): void { tone(140, 0.5); },
  contractPaid(): void { tone(1100, 0.15); },
  contractExpired(): void { tone(220, 0.2); },
  contractAccepted(): void { tone(900, 0.1); },
  dockingComputerEngaged(): void { tone(700, 0.12); },
  combatComputerEngaged(): void { tone(1000, 0.12); },
  stationDefenceLaunched(): void { tone(300, 0.18); },
  cargoLost(): void { tone(300, 0.12); },
  equipmentDestroyed(): void { tone(240, 0.2); },
  distressBeacon(): void { tone(500, 0.4); },
  torusEngaged(): void { tone(1000, 0.15); },
  viewChanged(): void { tone(600, 0.04); },
  cargoJettisoned(): void { tone(320); },
  tradeBought(): void { tone(900, 0.05); },
  tradeSold(): void { tone(700, 0.05); },
  equipmentBought(): void { tone(600); },
  chartTargetSelected(): void { tone(900, 0.1); },
  commanderDeleted(): void { tone(400, 0.1); },
  commanderNamed(): void { tone(700, 0.1); },
  combatSimulationLaunched(): void { tone(700); },
  /**
   * The hyperspace countdown, with `n` seconds left on it: a blip that climbs
   * a hundred hertz a second towards the jump.
   *
   * Named for the occasion because the pitch used to be written out in the
   * world step, which put audio design inside the simulation. Same tone as
   * before, decided here.
   *
   * The 700 and the 100 are this file's; the length of the countdown is not,
   * and it wrote `(5 - n)` out as a digit until `COUNTDOWN` was somewhere it
   * could be imported from. A longer countdown would have started BELOW 700
   * and climbed to it — the first blip of a jump is meant to be the base note
   * whatever the drive's warning is. `test/audio.test.ts` asserts that climb
   * rather than this expression.
   */
  countdown(n: number): void {
    const f = 700 + (COUNTDOWN - n) * 100;
    sweep('square', f, f, 0.07, 0.08);
  },
  /**
   * Start the docking waltz. Safe to call repeatedly — a second call while it
   * is already playing does nothing, so an autopilot that re-engages doesn't
   * stack voices on top of each other.
   */
  dockingMusic(): void {
    const a = ac();
    if (!a || musicStop) return;
    const { voices, until } = playDanube(a, a.currentTime + 0.05);

    const clear = window.setTimeout(() => { musicStop = null; },
      (until - a.currentTime) * 1000 + 200);
    musicStop = () => {
      window.clearTimeout(clear);
      for (const o of voices) { try { o.stop(); } catch { /* already stopped */ } }
      musicStop = null;
    };
  },

  /** Cut the music off — docked, or the approach was abandoned. */
  stopDockingMusic(): void {
    musicStop?.();
  },

  dock(): void {
    sweep('square', 523, 523, 0.1, 0.08);
    setTimeout(() => sweep('square', 784, 784, 0.18, 0.08), 120);
  },
  launch(): void {
    sweep('sawtooth', 80, 320, 0.5, 0.1);
  },
  hyperspace(): void {
    sweep('sawtooth', 100, 1400, 1.2, 0.14);
    noiseBurst(1.2, 0.08, 3000);
  },
  missile(): void {
    sweep('sawtooth', 300, 900, 0.6, 0.1);
  },
  ecm(place?: Place): void {
    // warbling interference
    for (let i = 0; i < 6; i++) {
      setTimeout(() => sweep('square', 1400 - i * 180, 500, 0.09, 0.09, place), i * 90);
    }
    noiseBurst(0.6, 0.1, 5000, place);
  },
  tunnel(): void {
    sweep('sawtooth', 60, 240, 1.3, 0.09);
    noiseBurst(1.3, 0.05, 1800);
  },
  bomb(): void {
    noiseBurst(1.6, 0.35, 500);
    sweep('sine', 200, 25, 1.6, 0.3);
    sweep('sawtooth', 90, 20, 1.2, 0.15);
  },
};
