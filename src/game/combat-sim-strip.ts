// What the pilot reads WHILE an exercise is being flown.
//
// The trainer's third view of a fight: the setup panel comes before it, the
// report after, and this is a strip of numbers the cockpit paints for as long as
// an exercise is running (docs/TODO/completed/33-exercise-hud.md). Without it a pilot could
// not tell an exercise nearly up from one just begun, or an exercise from real
// space once the launch banner faded.
//
// It counts nothing: every figure comes from the round's own recorder as
// `SimProgress`, the same accumulation `CombatSimRecorder.report()` derives the
// record from, so the strip and the report cannot disagree. The one thing it
// decides is what a mode has instead of a countdown, and it asks `MODES` rather
// than the mode's name.
//
// Pure: no DOM, no Game, no World. The painter is handed the result (hud/hud.ts).

import type { ExerciseSetup, LiveContact, SimProgress } from './combat-sim-report.ts';
import {
  MODES, exerciseTimeout, type ExerciseSpec, type ModeRules, type SimMode,
} from './combat-sim-scenarios.ts';

/**
 * One frame of the exercise strip.
 *
 * Deliberately small: the cockpit is crowded and the fight is the thing being
 * watched. Everything a pilot cannot read at a glance mid-dogfight belongs in
 * the report, which is two seconds away at the end of the exercise.
 */
export type { LiveContact };

export interface ExerciseStrip {
  /** the fight, exactly as the report names it — never re-derived here */
  scenario: string;
  mode: SimMode;
  /** seconds flown, as the report will state them */
  elapsed: number;
  /**
   * Seconds left, or null when the mode is endless.
   *
   * `exerciseTimeout` is the same rule `roundOutcome` calls the exercise off
   * with, so the strip counts down to the moment the fight actually ends.
   */
  remaining: number | null;
  /** what this mode is scored on — `MODES[mode].score`, not a guess from its name */
  score: ModeRules['score'];
  /** the standing in that score: the wave you are on, or kills */
  standing: number;
  /**
   * What the wave ramp has turned on by this wave, or null outside the waves
   * mode — `WaveEscalation.active`, carried and not formatted.
   *
   * The banner names a step on the wave that adds it and then is gone; a pilot
   * needs to know for the rest of the run that everything out there is carrying
   * a missile, and the cockpit is where they are looking.
   */
  escalation: readonly string[] | null;
  shots: number;
  hits: number;
  /** hits / shots, or null when the trigger has not been pulled */
  accuracy: number | null;
  /** laser hits they have landed on you */
  hitsTaken: number;
  /**
   * Every hostile still up: hull, range, and what it is doing — nearest first.
   *
   * The one thing on the strip that is NOT deliberately small. Tuning BEHAVIOUR
   * is a different job with a different reader: "why is that one not shooting at
   * me" cannot wait for a report against a fight you can no longer see.
   *
   * It stays honest by carrying `ContactSample.doing` rather than deriving a
   * second opinion, so the strip, the record and the report quote the same word.
   */
  live: readonly LiveContact[];
}

/** Seconds, at the resolution the report quotes them. */
const secs = (x: number): number => Math.round(x * 10) / 10;

/**
 * The strip for a round in progress.
 *
 * `setup` is the round's own — it already holds the scenario name, the mode and
 * (in an endless mode) the wave number, because the report quotes all three.
 * Reading them back off it is what keeps the strip and the record saying the
 * same thing about which fight this is.
 */
export function exerciseStrip(
  spec: ExerciseSpec, setup: ExerciseSetup, progress: SimProgress,
): ExerciseStrip {
  const { score } = MODES[setup.mode];
  const limit = exerciseTimeout(spec);
  return {
    scenario: setup.scenario,
    mode: setup.mode,
    elapsed: progress.seconds,
    remaining: limit > 0 ? Math.max(0, secs(limit - progress.seconds)) : null,
    score,
    // Waves are counted by the round, kills by the recorder; `setup.wave` is
    // the number the round's own record will carry, so a strip and the wave's
    // record never quote different waves.
    standing: score === 'waves' ? (setup.wave ?? 1) : progress.kills,
    escalation: setup.escalation?.active ?? null,
    shots: progress.shots,
    hits: progress.hits,
    accuracy: progress.accuracy,
    hitsTaken: progress.hitsTaken,
    live: progress.live,
  };
}
