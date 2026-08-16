// Where a training fight happens, where it starts, and what the record says
// about it.
//
// The eighth combat-trainer file (docs/COMBAT-SIM.md), and the smallest. It
// asks one question, once per round. Three files divide the job:
//
//   - combat-sim-scenarios.ts says WHO turns up;
//   - spawning-arena.ts puts them in the sky;
//   - this file says WHERE.
//
// WHERE is two answers. It is the corner of the system that is safe to fight in
// (`arenaCentre`). It is then the arc, the range and the cone that the
// opposition is scattered through.
//
// A training fight opens where the pilot can see it. The approach is the most
// informative part of a fight, because a brain shows there whether it commits
// or loiters. That is CLAUDE.md's "threat is not fun" question.
//
// One kind of fight is the exception: a fight that is ABOUT an ambush. There
// the record says ASTERN and NOT IN VIEW, which is the difference between
// deliberate and broken. Career ambush flight is `spawning.ts`'s
// `spawnPopulation` and is not this file's business.
//
// Pure: it states an intent, measures what came of it, and decides nothing else.
// The randomness is the spawner's, off the world's seeded stream. So the same
// seed gives the same start, which is what puts one on the record at all.

import * as THREE from 'three';

import { aimAngle, type OpeningGeometry } from './combat-sim-report.ts';
import {
  OPENING_RANGE, AMBUSH_RANGE, OPENING_CONE_DEG, AMBUSH_CONE_DEG, IN_VIEW_DEG,
} from '../constants/exercise.ts';
import type { ExerciseSpec, ScenarioId } from './combat-sim-scenarios.ts';
import type { OppositionPlacement } from './spawning-arena.ts';
import type { World } from './world.ts';

// --- where the fight happens -------------------------------------------------

/**
 * Where the arena sits, as a multiple of the planet's radius.
 *
 * The same distance a jump leaves you at (`WITCHPOINT_RADII`), but A SEPARATE
 * RULE AT THE SAME NUMBER. It is deliberately a literal. A move to where
 * hyperspace drops the player must not silently move where an exercise is
 * fought.
 *
 * It is anti-SUNWARD, and that makes one rule work in all 256 systems of every
 * galaxy. The station orbits at 2.4 radii on the sunward side. So the far side
 * is the furthest from the only two things that can end an exercise by
 * themselves. It scales with the planet, so no system has thinner margins in
 * proportion.
 *
 * The numbers those margins are against are NOT written out here.
 * `test/arena.test.ts` holds the worst case against the constants themselves:
 *
 *   - `SUN_HEAT_START`;
 *   - `SUN_KILL_DIST`;
 *   - `MASS_LOCK_PLANET_ALTITUDE`;
 *   - `MASS_LOCK_STATION`;
 *   - `PLANET_CRASH_ALTITUDE`.
 *
 * So no claim here can outlive a change to one of them. A fixed offset would be
 * wrong, because the furniture moves with the seed.
 */
const ARENA_RADII = 16;

/**
 * Somewhere an exercise can be fought, and the world does not interrupt it.
 *
 * Every property that matters is a distance to something the seed placed. So
 * this function reads the world rather than assumes a coordinate. See
 * ARENA_RADII for the guarantee and for what it was measured against.
 */
export function arenaCentre(world: World): THREE.Vector3 {
  return world.sunPos.clone().sub(world.planetPos).normalize()
    .multiplyScalar(-world.planetRadius * ARENA_RADII)
    .add(world.planetPos);
}

// --- where the two sides start ----------------------------------------------

/** Which arc of the sky the opposition is put in, relative to your nose. */
export type OpeningArc =
  /** in front of you, in the canopy — the default, and what a trainer is for */
  | 'ahead'
  /** behind you: the scenario is ABOUT an ambush */
  | 'astern';

/** What a scenario asks for. What it got is `OpeningGeometry`, measured. */
export interface OpeningPlan {
  arc: OpeningArc;
  /** ring radius from the commander, in units */
  range: number;
  /**
   * Half-angle of the cone about the arc's axis, in DEGREES because that is how
   * it is argued and how the record reads it.
   *
   * The spawner scatters within it rather than on it. A ship lands between 0.55
   * and 1.45 of this angle off the axis (`spawnOpposition`). So the widest a
   * plan can put one is 1.45 times this. That product is what has to fit the
   * canopy.
   */
  coneDeg: number;
}

const AHEAD: OpeningPlan = {
  arc: 'ahead', range: OPENING_RANGE, coneDeg: OPENING_CONE_DEG,
};

/**
 * Every scenario's opening, as a table. It is exhaustive, so a new
 * `ScenarioId` does not compile until it says where its fight starts.
 *
 * Six of the seven open AHEAD, at one range, on purpose. One argument covers
 * that range for all six: outside their gun, inside their interest, and clear
 * of the pass thresholds. A per-scenario number with no reason behind it would
 * be decoration that a later reader takes for a rule.
 */
const OPENINGS: Record<ScenarioId, OpeningPlan> = {
  // A hunter that came for you. You get to watch it come.
  'lone-hunter': AHEAD,
  'single-pirate': AHEAD,
  'pirate-pair': AHEAD,
  // A gang is a formation. Half of what makes the pack policy worth a look is
  // the sight of that formation as it forms up.
  'pirate-gang': AHEAD,
  // Vipers on a vector to you: an interdiction announces itself.
  police: AHEAD,
  // THE EXCEPTION, and the reason the arc is on the record. The witch-space
  // fight is an ambush in the fiction and in the 1984 game: you are dropped
  // among them. It opens astern, inside their gun. The report says NOT IN
  // VIEW, so nobody mistakes it for a broken start.
  thargoids: { arc: 'astern', range: AMBUSH_RANGE, coneDeg: AMBUSH_CONE_DEG },
  // The galaxy's own reception, which in career flight is scattered down the
  // corridor to the station. What this scenario samples is WHO it sends, not
  // how long the commute was, so it opens like every other exercise.
  'as-they-come': AHEAD,
};

/**
 * A fight the pilot authored, in the custom picker.
 *
 * Ahead: you built this fight to watch it. Nobody assembles four Fer-de-Lances
 * by hand in order to be surprised by them.
 */
export const CUSTOM_OPENING: OpeningPlan = AHEAD;

/**
 * An opening nobody placed.
 *
 * It is for a record whose fight this file did not set up. The episodes of
 * `train/flight-probe.ts` belong to `ai-training/scenario.ts`, and their
 * geometry is the EPISODE's. The report's unit tests build their setups by
 * hand.
 *
 * A zero range with three nulls reads as "not stated". `inView: false` is the
 * safe answer for a fight that nobody claimed to open in front of the pilot.
 */
export const NO_OPENING: OpeningGeometry = {
  arc: 'ahead',
  range: 0,
  coneDeg: 0,
  nearest: null,
  furthest: null,
  widestBearingDeg: null,
  inView: false,
};

/** Where this exercise opens. */
export function openingFor(spec: ExerciseSpec): OpeningPlan {
  return spec.custom ? CUSTOM_OPENING : OPENINGS[spec.scenario];
}

/** Every plan there is, for a test that has to hold all of them to one rule. */
export function openingPlans(): OpeningPlan[] {
  return [...Object.values(OPENINGS), CUSTOM_OPENING];
}

const DEG = Math.PI / 180;

/**
 * The plan as the spawner takes it.
 *
 * `forward` is the commander's nose, and it is CONSUMED. An astern start
 * negates it in place. So pass a scratch vector, which is what the exercise
 * has.
 */
export function openingPlacement(
  plan: OpeningPlan, forward: THREE.Vector3,
): OppositionPlacement {
  return {
    facing: plan.arc === 'astern' ? forward.negate() : forward,
    range: plan.range,
    cone: plan.coneDeg * DEG,
  };
}

/**
 * What the start actually came out as — the record's half of the bargain.
 *
 * It measures the ships where they landed rather than restates the plan. The
 * plan is an intent and the scatter is a draw. A report that quoted the intent
 * could not separate a fight that opened where it meant to from one that did
 * not.
 *
 * Bearings are off YOUR nose. So 0 is dead ahead and 180 is dead astern,
 * whatever arc was asked for.
 */
export function measureOpening(
  plan: OpeningPlan,
  from: THREE.Vector3,
  quat: THREE.Quaternion,
  at: readonly THREE.Vector3[],
): OpeningGeometry {
  const ranges = at.map((p) => p.distanceTo(from));
  const bearings = at.map((p) => aimAngle(from, quat, p) / DEG);
  const widest = bearings.length ? Math.max(...bearings) : null;
  return {
    arc: plan.arc,
    range: plan.range,
    coneDeg: plan.coneDeg,
    nearest: ranges.length ? Math.round(Math.min(...ranges)) : null,
    furthest: ranges.length ? Math.round(Math.max(...ranges)) : null,
    widestBearingDeg: widest === null ? null : Math.round(widest),
    // Every one of them, not most: one ship off the corner of the canopy is the
    // exact complaint this answers.
    inView: widest !== null && widest <= IN_VIEW_DEG,
  };
}

/**
 * `AHEAD 4500 · 3900-5100 OUT · WIDEST 9° · IN VIEW` — one line, for a screen or
 * a log.
 *
 * Here rather than in the renderer, because the trainer has two renderers: the
 * report and its JSON. The report's own screen is a dumb painter.
 */
export function describeOpening(o: OpeningGeometry): string {
  const spread = o.nearest === null ? 'nothing placed' : `${o.nearest}-${o.furthest} out`;
  const widest = o.widestBearingDeg === null ? '-' : `${o.widestBearingDeg}°`;
  return `${o.arc} ${o.range} · ${spread} · widest ${widest} off your nose`
    + ` · ${o.inView ? 'in view' : 'NOT in view'}`;
}
