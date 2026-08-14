// What happened in a training fight, and what it means.
//
// The measurement half of the combat simulator (docs/COMBAT-SIM.md): something
// else runs the exercise, this counts it. It covers two things a console
// harness used to:
//
//   * a fight a HUMAN flew: accuracy both ways, damage by cause, and the
//     geometry that decides whether an NPC can shoot at all
//   * envelope(): how the commander actually flies, the one human-shaped input
//     the trainer has. ai-training/scenario.ts's target hulls are fitted to it.
//
// A module rather than monkey-patched onto Game methods, which can only measure
// what the patches still line up with.
//
// It is PURE: no DOM, no globals at module scope, no clock of its own — it is
// fed samples and events, and it derives. So the same maths can be asserted in
// test/run.ts against arrays built by hand.
//
// One rule, one home, twice over:
//   * "lined up" is `NPC_FIRE_GATE`. The range cut-offs are `NPC_LASER_RANGE`
//     (constants/npc-gun.ts, theirs) and `LASER_RANGE` (constants/player-gun.ts,
//     yours). So a balance change moves the game and the measurement together.
//   * the JSON is VERSIONED (`schema`), as snapshot.ts's SNAPSHOT_VERSION is. A
//     trainer that reads the exported records is an external consumer.

import * as THREE from 'three';
import { LASER_RANGE } from '../constants/player-gun.ts';
import { NPC_FIRE_GATE, NPC_LASER_RANGE } from '../constants/npc-gun.ts';
import type { DamageSource } from './combat.ts';
import type { DealtSource } from './damage-dealt.ts';
import type {
  NpcCombatProfileId, PlayerHullId, ShipDesignId,
} from './ship-identity.ts';
import {
  SAMPLE_HZ, SIX_CONE, PASS_CLOSE, PASS_FAR, MAX_SAMPLES, SIM_LOG_LIMIT,
} from '../constants/combat-record.ts';


/**
 * The shape of an exported record. Bump it when a field changes meaning or
 * leaves, not when one is added — a reader that ignores unknown keys survives
 * additions.
 *
 * Records across a bump are not comparable. 1->2 changed what `damageToYou` and
 * the `them` damage buckets MEAN: they are stated point numbers
 * (`constants/impact.ts`) rather than a normalized fraction. 2->3 made
 * `you.damageDealt` and `damageFromYou` cover a missile, a ram and the bomb
 * (damage-dealt.ts), rather than the laser alone.
 */
export const COMBAT_SIM_SCHEMA = 3;

/** Float slack on the sampling cadence. See `tick()`. */
const CADENCE_EPSILON = 1e-9;

/** Which of the three modes produced this record. */
export type SimMode = 'scenario' | 'sparring' | 'waves';

/** How the exercise ended. */
export type SimOutcome =
  /** every opponent destroyed */
  | 'cleared'
  /** the commander's hull failed — in the simulator, so it costs nothing */
  | 'destroyed'
  /** the pilot ended it */
  | 'quit'
  /** the exercise ran out of time */
  | 'timeout';

/** Where the source of a hit could not be named. See `taken()`. */
const UNKNOWN = 'unknown';
/**
 * One bucket of `damageBySource`, in either direction.
 *
 * The union of the two lists, rather than one per direction. The same renderer
 * prints the buckets, and the same key exports them. The two directions already
 * differ in which bucket can appear: nothing can drop a `bomb` on you, and you
 * cannot deal a `station` scrape.
 */
type SourceKey = DamageSource | DealtSource | typeof UNKNOWN;
const SOURCES: readonly SourceKey[] =
  ['laser', 'missile', 'ram', 'station', 'cargo', 'bomb'];

/** Damage from one cause, and how many times it landed. */
export interface SourceTally {
  damage: number;
  count: number;
}

/** A statistic that exists for both sides of the fight. */
export interface BothSides {
  you: number;
  them: number;
}

/**
 * How the fight goes, WHILE it goes. It is the subset of the report that means
 * anything before the exercise ends.
 *
 * It exists because the cockpit strip (combat-sim-strip.ts) has to show the
 * pilot the same numbers the report shows afterwards. The only way to be sure
 * of that is for both to be the same numbers. `report()` builds its `seconds`,
 * its `you` block and its `them.hits` OUT OF THIS. So the strip is not a second
 * tally that agrees. It IS the tally.
 *
 * Everything on it is already accumulated: nothing here is derived for the
 * strip's benefit, and nothing here is rounded differently from the report.
 */
export interface SimProgress {
  /** seconds of exercise so far, as `CombatSimReport.seconds` states them */
  seconds: number;
  /** discharges of your gun, and how many of them landed */
  shots: number;
  hits: number;
  /** hits / shots, or null when the trigger was never pulled */
  accuracy: number | null;
  /** laser hits they landed on you — `CombatSimReport.them.hits` */
  hitsTaken: number;
  /** opponents destroyed and credited to you */
  kills: number;
  /**
   * Every hostile still up, as of the last sample — hull, range, and what it is
   * doing right now.
   *
   * The report answers what a fight WAS; this answers what it IS, the question
   * you have while deciding whether a behaviour change was an improvement. Off
   * the last frame rather than accumulated, and off the SAME sample the report
   * reads, so the strip and the record cannot disagree.
   */
  live: LiveContact[];
}

/** One hostile, right now — see `SimProgress.live`. */
export interface LiveContact {
  /** index into `ExerciseSetup.opponents`, so a caller can name the hull */
  opponent: number;
  hull: string;
  dist: number;
  /** what it is doing — `ContactSample.doing`, carried and not re-derived */
  doing: string;
}

// --- what the caller feeds in ------------------------------------------------

/**
 * One hostile, at one sample instant.
 *
 * Both bearings, because half the statistics in the report are symmetric and
 * the recorder only ever took theirs. `aimAngle()` below computes either.
 */
export interface ContactSample {
  /** index into `ExerciseSetup.opponents` */
  opponent: number;
  dist: number;
  /**
   * How fast it was going, in the same units as `FrameSample.speed`.
   *
   * The one thing a turret cannot hide: a brain that hangs in space and pivots
   * reads slow here whatever its damage says.
   */
  speed: number;
  /** radians off THEIR nose to you — the angle `NPC_FIRE_GATE` gates their gun on */
  theirAim: number;
  /** radians off YOUR nose to them */
  yourAim: number;
  /**
   * What this ship was DOING at this instant — its attack phase, or the reason
   * it was not flying one.
   *
   * The difference between a log you can count and one you can read. A ship
   * with `passes: 0` at a median range of 2,705 is a fact. `closing` against
   * `extending` beside it is the reason.
   *
   * A string rather than an enum on purpose. `AttackPhase` is break-off.ts's and
   * will grow tactics beside it; a name a record does not recognise is a name a
   * human can still read.
   */
  doing: string;
}

/** The commander, and everything hostile, at one sample instant. */
export interface FrameSample {
  speed: number;
  /** pitch rate in use; the sign is not interesting, the magnitude is */
  pitch: number;
  roll: number;
  foreShield: number;
  aftShield: number;
  energy: number;
  contacts: ContactSample[];
}

/** One opponent, as the exercise was set up. */
export interface OpponentSetup {
  /** the hull's display name, from ship-specs.ts */
  hull: string;
  /**
   * What it was, in ids — see ship-identity.ts.
   *
   * The display name is for a human; these are for a record read by something
   * else. `elite-a:variant:A:25` is the exact released build the fight was
   * against, and stays true where a name may be re-spelt or re-hulled.
   */
  designId: ShipDesignId;
  profileId: NpcCombatProfileId;
  /**
   * Which policy it flies — a brain id, or the scripted baseline. The field that
   * turns the report into an A/B rig: same scenario, two brains, numbers side by
   * side.
   */
  brain: string;
  role?: string;
  tier?: number;
}

/**
 * What the commander flew.
 *
 * Description, not simulation. It is carried through to the JSON, so a record
 * reads months later with no guess at what "you" flew.
 *
 * The hull is RECORDED but not overridden. The simulator changes the fit-out
 * only (docs/COMBAT-SIM.md), because the player's hull is four constants in
 * player.ts that every pirate brain was fitted against.
 */
export interface PlayerLoadout {
  /**
   * Which hull the commander flew, as a `PlayerHullId`.
   *
   * Recorded, not flown: a report compared across a shipyard's arrival is
   * worthless without it.
   */
  shipId: PlayerHullId;
  /** the front mount: 'pulse' | 'beam' | 'military' */
  laser: string;
  rearLaser?: boolean;
  missiles: number;
  ecm: boolean;
  energyUnit: boolean;
  energyBomb: boolean;
  /** whatever else the fit-out screen grows */
  extra?: Record<string, string | number | boolean>;
}

/**
 * Where the fight started, as it actually came out.
 *
 * The intent is combat-sim-opening.ts's: arc, range and cone. The three
 * measured figures are what the seeded scatter made of it.
 *
 * Both are kept, because the pair is what makes a fight reproducible AND
 * checkable. The plan alone cannot say whether the opening happened. The
 * measurement alone cannot say whether it was meant.
 *
 * `arc: 'astern'` with `inView: false` is a scenario ABOUT an ambush, saying
 * so. Without it, a fight that opened behind the pilot and one that did so by
 * accident read identically.
 */
export interface OpeningGeometry {
  /** which arc of the sky they were put in — see `OpeningArc` */
  arc: 'ahead' | 'astern';
  /** the ring radius asked for, in units */
  range: number;
  /** half-angle of the cone asked for, degrees */
  coneDeg: number;
  /** the nearest and furthest of them at t=0, as they landed */
  nearest: number | null;
  furthest: number | null;
  /** the widest any of them was off YOUR nose, degrees — 180 is dead astern */
  widestBearingDeg: number | null;
  /** every one of them inside the arc a pilot can see (`IN_VIEW_DEG`) */
  inView: boolean;
}

/**
 * What the wave ramp turned on by this wave — the waves mode only.
 *
 * It is declared here rather than where the rule lives
 * (`combat-sim-scenarios.ts`, which fills it in). It is part of the SHAPE OF
 * THE RECORD, which this file owns. The rules module imports the type, and
 * nothing here computes one.
 *
 * It exists because an escalation nobody can see is not an escalation. Count
 * and tier are readable from the opponent table. "They are all carrying
 * missiles now" and "one of them is not a pirate" are facts about the WAVE.
 */
export interface WaveEscalation {
  /** which wave, 1-based — the same number `wave` carries */
  wave: number;
  /** 0 while only count and tier are ramping; then one per stated step */
  stage: number;
  /** everything the ramp turned on by this wave, in the order it arrived */
  active: readonly string[];
  /** the one thing that is NEW in this wave, or null when nothing is */
  added: string | null;
  /** why — the stated reason for `added`, or for where the ramp stands */
  why: string;
  /** the wave from which every wave is identical */
  saturatesAt: number;
}

/** Everything fixed about an exercise before it starts. */
export interface ExerciseSetup {
  /** the seed the exercise ran on, so the same fight can be flown again */
  seed: number;
  scenario: string;
  mode: SimMode;
  player: PlayerLoadout;
  /**
   * Which brain flew YOUR side — the combat computer if fitted, and every armed
   * trader in the fight. `scripted` here means NONE: no policy flew for you.
   */
  coPilot: string;
  opponents: OpponentSetup[];
  /** where they were when it started — see `OpeningGeometry` */
  opening: OpeningGeometry;
  /** which wave this record covers, in the waves mode */
  wave?: number;
  /** what the ramp turned on by it — waves mode only, see `WaveEscalation` */
  escalation?: WaveEscalation;
  /** override the sampling rate; every derived duration follows it */
  sampleHz?: number;
}

// --- what comes out ---------------------------------------------------------

export interface SimEvent {
  t: number;
  what: string;
  opponent?: number;
}

export interface OpponentReport {
  index: number;
  hull: string;
  /** what it was, in ids — carried through from the setup, see OpponentSetup */
  designId: ShipDesignId;
  profileId: NpcCombatProfileId;
  brain: string;
  role?: string;
  tier?: number;
  /** seconds it lasted — until it died, or the whole exercise if it did not */
  livedSeconds: number;
  destroyed: boolean;
  killedByYou: boolean;
  /** what it landed: laser shots, hits, and every point of damage it did */
  shots: number;
  hits: number;
  missiles: number;
  damageToYou: number;
  /**
   * ...in SOURCE ENERGY POINTS, where `damageToYou` above is in the commander's
   * 255-point pool points. Both are whole source-scale numbers, but they are
   * NOT the same unit. A ship's bank is 32-253, and a commander's is 255 plus
   * two shields. So a ratio of the two means nothing, and each is comparable
   * only with itself.
   */
  damageFromYou: number;
  /** the median range it held, and the nearest it ever got */
  medianRange: number | null;
  closestRange: number | null;
  /** the median speed it flew at — see `OppositionReport.speed` */
  medianSpeed: number | null;
  /** its own completed attack runs — see `countPasses` */
  passes: number;
  /** share of ITS sampled frames spent lined up on you, inside its own range */
  linedUpShare: number | null;
  /**
   * Seconds it spent doing each thing, most first — see `ContactSample.doing`.
   *
   * The column that says WHY the others look how they do. A ship with
   * `passes: 0` at a median 2,610 that reads `closing 9.1s` is one problem.
   * `extending 7.0s, closing 2.1s` is another. It is empty where nothing
   * reported a phase.
   */
  doing: Record<string, number>;
}

/**
 * How the commander flies — arena.js's `envelope()`.
 *
 * Read it beside `traderCobra` in ai-training/scenario.ts, at 220 speed, 0.70
 * pitch and 1.20 roll. The gap between that freighter and these numbers is why
 * pirates weave instead of shoot (docs/TRAINING-LOG.md run 10).
 */
export interface EnvelopeReport {
  samples: number;
  speed: { median: number; p90: number; max: number } | null;
  pitchRate: { median: number; p90: number } | null;
  rollRate: { median: number; p90: number } | null;
  /**
   * Range to the NEAREST hostile, per sampled frame — not `range` below. This
   * answers "what range does this pilot fight at", so a frame counts once
   * however many ships are in it.
   */
  engagementRange: { median: number; p10: number; p90: number } | null;
}

/**
 * How the OPPOSITION flew — `EnvelopeReport`'s missing half.
 *
 * The one judgement the trainer exists to support. CLAUDE.md warns that a
 * well-optimised pirate becomes a turret that hangs in space and snipes. A
 * brain can win on damage and still be rejected on FEEL.
 *
 * The evidence that settles it is how fast they flew, the spread of the ranges
 * they held, and how often they came in. `train/flight-probe.ts` derives its own from this same code.
 *
 * A DESCRIPTION, deliberately not a verdict. There is no turret index and no
 * score: inventing that metric is how this went wrong twice. The report
 * presents; the pilot judges.
 *
 * The population is SHIP-FRAMES, the same one `range` uses — one ship in one
 * sampled frame, so a gang of three contributes three rows a frame.
 */
export interface OppositionReport {
  /** ship-frames behind these figures */
  samples: number;
  /**
   * Their speed, over every ship-frame.
   *
   * MEDIAN and p90 rather than a mean: one ship sprinting in while two hold
   * station is a mean nobody flew.
   */
  speed: { median: number; p90: number; max: number } | null;
  /**
   * The spread of ranges they held — p10, median, p90.
   *
   * The spread is the measurement rather than the median. An attack run sweeps
   * the whole band, so p10 and p90 sit far apart. A brain that loiters collapses
   * the spread onto one range. `range.median` alone cannot tell those apart.
   */
  range: { p10: number; median: number; p90: number } | null;
  /**
   * Completed attack runs, summed over every opponent — `countPasses`, at
   * `PASS_CLOSE` and `PASS_FAR`.
   */
  passes: number;
}

export interface CombatSimReport {
  schema: number;
  seed: number;
  scenario: string;
  mode: SimMode;
  wave?: number;
  /** what the wave ramp turned on by this wave — see `WaveEscalation` */
  escalation?: WaveEscalation;
  outcome: SimOutcome;
  seconds: number;
  /** seconds with at least one hostile in the sky */
  engagedSeconds: number;
  player: PlayerLoadout;
  /** which brain flew your combat computer and every armed trader — see ExerciseSetup */
  coPilot: string;
  /** where they were at t=0 — carried through from the setup */
  opening: OpeningGeometry;
  you: {
    shots: number;
    hits: number;
    /** hits / shots, or null when the trigger was never pulled */
    accuracy: number | null;
    damageDealt: number;
    damageBySource: Partial<Record<SourceKey, SourceTally>>;
    kills: number;
  };
  them: {
    /** laser shots only — a missile launch is not a shot that can miss */
    shots: number;
    missiles: number;
    hits: number;
    accuracy: number | null;
    damageToYou: number;
    damageBySource: Partial<Record<SourceKey, SourceTally>>;
    /** the figure docs/TRAINING-LOG.md quotes: shots per minute per ship */
    shotsPerMinutePerShip: number | null;
  };
  kills: {
    /** credited to you */
    yours: number;
    /** opponents that left the sky by any means */
    total: number;
    /** seconds to your first and last kill */
    firstAt: number | null;
    lastAt: number | null;
  };
  /**
   * Engagement range over every ship in every sampled frame — three ships
   * contribute three ranges a frame. MEDIAN, not mean: one ship breaking off to
   * 8000 while two knife-fight at 400 drags a mean out to a range nobody was at.
   */
  range: { median: number | null; closest: number | null };
  /** share of ship-frames each side spent lined up on the other, and in range */
  linedUpShare: BothSides;
  inRangeShare: BothSides;
  /** mean bearing error in DEGREES — a mean on purpose: it is an average error */
  meanAimErrorDeg: BothSides;
  /**
   * Seconds spent on the other's six. Per FRAME, not per ship-frame: two
   * pirates on your tail at once is one bad second, not two.
   */
  onSixSeconds: BothSides;
  /**
   * The three pools in SOURCE POINTS at the first sample and at the last, and
   * the worst each got in between.
   *
   * Start and end are both recorded. "You lost 180 points" is not comparable
   * across fit-outs or hulls without what you started with. The low-water mark
   * alone cannot tell a fight that ended on fumes from one that recharged. All
   * three are whole 255-point-scale numbers, the same ones `systems.ts` holds.
   */
  poolsAtStart: { foreShield: number | null; aftShield: number | null; energy: number | null };
  poolsAtEnd: { foreShield: number | null; aftShield: number | null; energy: number | null };
  /** the worst it got */
  lowWater: {
    foreShield: number | null;
    aftShield: number | null;
    energy: number | null;
  };
  opponents: OpponentReport[];
  /** how the commander flew */
  envelope: EnvelopeReport;
  /** how the opposition flew — the other half of the same question */
  opposition: OppositionReport;
  events: SimEvent[];
  /**
   * Anything the report knows it does not know. A harness that admits the limit
   * of its own understanding beats one that is confidently wrong.
   */
  warnings: string[];
}

// --- geometry ---------------------------------------------------------------

const tmpForward = new THREE.Vector3();
const tmpTo = new THREE.Vector3();

/**
 * The angle between a ship's nose and the direction to a point, in radians.
 *
 * `NpcShip.facing()` is the same rule, serving the NPC's own gate. This takes
 * loose arguments, so the cockpit can take the measurement too, and the cockpit
 * has no `facing()`. Forward is −Z (ARCHITECTURE.md). The scratch vectors are
 * module-scope, so four ships sampled at 10 Hz allocate nothing.
 */
export function aimAngle(
  from: THREE.Vector3, quat: THREE.Quaternion, to: THREE.Vector3,
): number {
  tmpForward.set(0, 0, -1).applyQuaternion(quat);
  tmpTo.copy(to).sub(from);
  if (tmpTo.lengthSq() === 0) return 0;
  return tmpForward.angleTo(tmpTo.normalize());
}

// --- statistics -------------------------------------------------------------

/**
 * The p-quantile of a set of samples, by arena.js's definition — sort, and
 * index at `floor(n * p)` clamped to the last element. Not interpolated: with
 * hundreds of samples the difference is below the rounding, and an exact element
 * is a number the pilot actually flew.
 *
 * Returns null for an empty set rather than 0, because 0 is a speed.
 */
export function quantile(xs: readonly number[], p: number): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))];
}

/**
 * Completed attack runs in a series of ranges, in sampled order.
 *
 * A hysteresis crossing on `PASS_CLOSE` / `PASS_FAR`. It is out until the ship
 * closes past CLOSE, and in until it opens back out past FAR. The pass is
 * counted on the way OUT, because a run that closed and never left is not a
 * completed pass.
 *
 * Pure and total. So `train/flight-probe.ts` counts its episodes with the same
 * function the exercise counts its opponents with. A second copy would drift
 * when a threshold moved.
 */
export function countPasses(dists: readonly number[]): number {
  let inside = false;
  let passes = 0;
  for (const d of dists) {
    if (!inside && d < PASS_CLOSE) inside = true;
    else if (inside && d > PASS_FAR) { inside = false; passes += 1; }
  }
  return passes;
}

/** Arithmetic mean, or null when there is nothing to average. */
export function mean(xs: readonly number[]): number | null {
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

const round = (x: number, dp: number): number => {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
};
const roundOrNull = (x: number | null, dp: number): number | null =>
  (x === null ? null : round(x, dp));

/** One frame's three pools, or nulls when nothing was ever sampled. */
const pools = (f: FrameSample | undefined): {
  foreShield: number | null; aftShield: number | null; energy: number | null;
} => (f
  ? { foreShield: f.foreShield, aftShield: f.aftShield, energy: f.energy }
  : { foreShield: null, aftShield: null, energy: null });

// --- the recorder -----------------------------------------------------------

interface OppTally {
  shots: number;
  hits: number;
  missiles: number;
  damageToYou: number;
  damageFromYou: number;
  /** its range, in the order it was sampled — the order is what `countPasses` reads */
  dists: number[];
  speeds: number[];
  linedUp: number;
  frames: number;
  diedAt: number | null;
  killedByYou: boolean;
  /** frames spent doing each thing, keyed by whatever name the sample reported */
  doing: Map<string, number>;
}

const newTally = (): OppTally => ({
  shots: 0, hits: 0, missiles: 0, damageToYou: 0, damageFromYou: 0,
  dists: [], speeds: [], linedUp: 0, frames: 0, diedAt: null, killedByYou: false,
  doing: new Map<string, number>(),
});

/**
 * Accumulates a fight, then derives a report.
 *
 * Counters and samples and nothing else — no Game, no World, no opinion about
 * when the exercise ends. Everything it knows, it was told: `tick()` for the
 * clock and cadence, one method per thing that can happen.
 */
export class CombatSimRecorder {
  readonly setup: ExerciseSetup;
  private readonly hz: number;
  private readonly tally: OppTally[];
  private readonly samples: FrameSample[] = [];
  private readonly log: SimEvent[] = [];
  private readonly warnings: string[] = [];
  private readonly damageOut = new Map<SourceKey, SourceTally>();
  private readonly damageIn = new Map<SourceKey, SourceTally>();

  private t = 0;
  private accum = 0;
  private playerShots = 0;
  private playerHits = 0;
  private npcShots = 0;
  private npcMissiles = 0;
  private npcHits = 0;
  private killsByYou = 0;
  private deaths = 0;
  private firstKill: number | null = null;
  private lastKill: number | null = null;
  private full = false;

  constructor(setup: ExerciseSetup) {
    this.setup = setup;
    this.hz = setup.sampleHz ?? SAMPLE_HZ;
    this.tally = setup.opponents.map(newTally);
  }

  /** Seconds of exercise so far. */
  get elapsed(): number { return this.t; }

  /**
   * How it is going so far — see `SimProgress`.
   *
   * Cheap and pure: it reads the counters it already keeps and derives nothing
   * that `report()` would derive differently, because `report()` reads it.
   */
  get progress(): SimProgress {
    return {
      seconds: round(this.t, 1),
      shots: this.playerShots,
      hits: this.playerHits,
      accuracy: ratio(this.playerHits, this.playerShots),
      hitsTaken: this.npcHits,
      kills: this.killsByYou,
      live: this.liveContacts(),
    };
  }

  /**
   * The last sample, turned into something nameable.
   *
   * A dead ship stops appearing in `contacts`, so the roster shrinks as the
   * fight goes with nothing to filter.
   */
  private liveContacts(): LiveContact[] {
    const last = this.samples[this.samples.length - 1];
    if (!last) return [];
    const out: LiveContact[] = [];
    for (const c of last.contacts) {
      const setup = this.setup.opponents[c.opponent];
      if (!setup) continue;
      out.push({
        opponent: c.opponent, hull: setup.hull, dist: Math.round(c.dist), doing: c.doing,
      });
    }
    return out.sort((a, b) => a.dist - b.dist);
  }

  /** Every sample taken, for a caller that wants the raw log and not the report. */
  get raw(): readonly FrameSample[] { return this.samples; }

  /**
   * Advance the clock by one step, and take a sample if one is due.
   *
   * `probe` is called only when one is, so the caller pays for the geometry at
   * `SAMPLE_HZ` rather than at 60.
   *
   * Expects `dt` smaller than the sample interval, which `FIXED_DT` is; a caller
   * stepping more slowly gets one sample per tick and short durations. Feed
   * `frame()` directly to own the cadence.
   */
  tick(dt: number, probe: () => FrameSample): void {
    this.t += dt;
    this.accum += dt;
    const interval = 1 / this.hz;
    // The tolerance is not decoration. Six steps of FIXED_DT sum to
    // 0.09999999999999999. So an exact comparison loses one sample in ten, and
    // `engagedSeconds` comes out 2% short.
    if (this.accum < interval - CADENCE_EPSILON) return;
    // Subtract the interval rather than zero it. A zero throws away the
    // remainder, which drifts the cadence, and every duration here is derived
    // from a count of samples.
    this.accum -= interval;
    if (this.accum > interval) this.accum = 0;
    this.frame(probe());
  }

  /** Take a sample now, whatever the cadence says. */
  frame(sample: FrameSample): void {
    if (this.full) return;
    if (this.samples.length >= MAX_SAMPLES) {
      this.full = true;
      this.warn(`sample buffer full at ${MAX_SAMPLES} samples `
        + `(${round(MAX_SAMPLES / this.hz, 0)}s) — the distributions and medians `
        + 'cover that much of the exercise and no more');
      return;
    }
    this.samples.push(sample);
    for (const c of sample.contacts) {
      const o = this.tally[c.opponent];
      if (!o) { this.unknownOpponent(c.opponent); continue; }
      o.frames += 1;
      o.dists.push(c.dist);
      o.speeds.push(c.speed);
      if (c.dist < NPC_LASER_RANGE && c.theirAim < NPC_FIRE_GATE) o.linedUp += 1;
      // FRAMES, per name it reported. Turned into seconds at the end, not here,
      // so the histogram survives a change of sample rate.
      o.doing.set(c.doing, (o.doing.get(c.doing) ?? 0) + 1);
    }
  }

  /**
   * One DISCHARGE of the commander's gun, and what it landed — null for a miss.
   *
   * Discharges, and not trigger polls. `firePlayerLaser` is called every frame
   * the trigger is held, and refuses internally while the laser is hot. A count
   * of calls would report 14 shots a second from a pulse laser that manages
   * 4.2. The exercise knows the difference, because a `fired` event came back.
   */
  playerShot(landed: { opponent: number; damage: number } | null): void {
    this.playerShots += 1;
    if (!landed) return;
    this.playerHits += 1;
    this.dealt(landed.opponent, landed.damage, 'laser');
  }

  /**
   * Damage the commander did, by cause.
   *
   * `playerShot` routes its own through here as `laser`. A missile, a ram and
   * the energy bomb arrive as the `DealtEvent`s the world step and the bomb
   * report (damage-dealt.ts). Every one is what came OFF the target's bank, so
   * overkill is not credited.
   */
  dealt(opponent: number, amount: number, source: DealtSource): void {
    add(this.damageOut, this.key(source), amount);
    const o = this.tally[opponent];
    if (!o) { this.unknownOpponent(opponent); return; }
    o.damageFromYou += amount;
  }

  /**
   * Damage the commander took, by cause — the cause ASKED, not guessed from the
   * size of the number.
   *
   * `DamageSource` is a static fact at each of the five places world-step.ts
   * bills the player; classifying by magnitude cannot error, only be quietly
   * wrong. Only the laser counts against their accuracy.
   *
   * @param opponent who did it, when the caller knows — a station or a canister
   * does not have one.
   */
  taken(amount: number, source: DamageSource, opponent?: number): void {
    const key = this.key(source);
    add(this.damageIn, key, amount);
    if (key === 'laser') this.npcHits += 1;
    if (opponent !== undefined) {
      const o = this.tally[opponent];
      if (!o) this.unknownOpponent(opponent);
      else {
        o.damageToYou += amount;
        if (key === 'laser') o.hits += 1;
      }
    }
    if (key === 'ram') this.event('a ship rammed you', opponent);
    if (key === 'missile') this.event('a missile got through', opponent);
  }

  /** An opponent pulled its trigger at you. Lasers and missiles counted apart. */
  npcShot(opponent: number, weapon: 'laser' | 'missile'): void {
    if (weapon === 'missile') this.npcMissiles += 1; else this.npcShots += 1;
    const o = this.tally[opponent];
    if (!o) { this.unknownOpponent(opponent); return; }
    if (weapon === 'missile') {
      o.missiles += 1;
      this.event('missile launched at you', opponent);
    } else o.shots += 1;
  }

  /**
   * An opponent left the sky.
   *
   * `byPlayer` is whether it was credited to the commander. In the simulator
   * that credits nothing. It is still the difference between a kill and a
   * pirate that flew into the station.
   */
  opponentDown(opponent: number, byPlayer: boolean): void {
    const o = this.tally[opponent];
    if (!o) { this.unknownOpponent(opponent); return; }
    if (o.diedAt !== null) return;
    o.diedAt = this.t;
    o.killedByYou = byPlayer;
    this.deaths += 1;
    if (byPlayer) {
      this.killsByYou += 1;
      if (this.firstKill === null) this.firstKill = this.t;
      this.lastKill = this.t;
    }
    const hull = this.setup.opponents[opponent]?.hull ?? `opponent ${opponent}`;
    this.event(byPlayer ? `you destroyed ${hull}` : `${hull} was destroyed`, opponent);
  }

  /** Note something worth reading back, e.g. a wave starting. */
  event(what: string, opponent?: number): void {
    this.log.push({ t: round(this.t, 1), what, ...(opponent === undefined ? {} : { opponent }) });
    if (this.log.length > 200) this.log.shift();
  }

  warn(text: string): void {
    if (!this.warnings.includes(text)) this.warnings.push(text);
  }

  // --- deriving ------------------------------------------------------------

  /** The report. Pure: asking twice gives the same answer. */
  report(outcome: SimOutcome): CombatSimReport {
    const s = this.samples;
    const secs = (n: number) => round(n / this.hz, 1);

    // Two populations, and confusing them is the mistake this file exists to
    // avoid. `rows` is one ship in one frame — the denominator for "how much of
    // the fight was somebody aimed at me". Frames are wall-clock — for a duration.
    const rows: ContactSample[] = [];
    let engagedFrames = 0;
    let yourSixFrames = 0;
    let theirSixFrames = 0;
    for (const f of s) {
      if (!f.contacts.length) continue;
      engagedFrames += 1;
      let onYours = false;
      let onTheirs = false;
      for (const c of f.contacts) {
        rows.push(c);
        if (theyAreOnYourSix(c)) onYours = true;
        if (youAreOnTheirSix(c)) onTheirs = true;
      }
      if (onYours) yourSixFrames += 1;
      if (onTheirs) theirSixFrames += 1;
    }

    const share = (n: number) => (rows.length ? round(n / rows.length, 3) : 0);
    const dists = rows.map((r) => r.dist);
    const nearest = s.map((f) => f.contacts.reduce(
      (m, c) => Math.min(m, c.dist), Infinity)).filter((d) => d !== Infinity);

    const shipSeconds = rows.length / this.hz;
    // The live standing and the finished record are ONE set of numbers. The
    // strip reads `progress` every frame, and the report reads it here. So they
    // cannot disagree.
    const p = this.progress;
    return {
      schema: COMBAT_SIM_SCHEMA,
      seed: this.setup.seed,
      scenario: this.setup.scenario,
      mode: this.setup.mode,
      ...(this.setup.wave === undefined ? {} : { wave: this.setup.wave }),
      ...(this.setup.escalation === undefined ? {} : { escalation: this.setup.escalation }),
      outcome,
      seconds: p.seconds,
      engagedSeconds: secs(engagedFrames),
      player: this.setup.player,
      coPilot: this.setup.coPilot,
      opening: this.setup.opening,
      you: {
        shots: p.shots,
        hits: p.hits,
        accuracy: p.accuracy,
        damageDealt: round(total(this.damageOut), 2),
        damageBySource: tallies(this.damageOut),
        kills: p.kills,
      },
      them: {
        shots: this.npcShots,
        missiles: this.npcMissiles,
        hits: p.hitsTaken,
        accuracy: ratio(this.npcHits, this.npcShots),
        damageToYou: round(total(this.damageIn), 2),
        damageBySource: tallies(this.damageIn),
        shotsPerMinutePerShip: shipSeconds
          ? round(this.npcShots / (shipSeconds / 60), 1) : null,
      },
      kills: {
        yours: p.kills,
        total: this.deaths,
        firstAt: roundOrNull(this.firstKill, 1),
        lastAt: roundOrNull(this.lastKill, 1),
      },
      range: {
        median: roundOrNull(quantile(dists, 0.5), 0),
        closest: dists.length ? round(Math.min(...dists), 0) : null,
      },
      linedUpShare: {
        you: share(rows.filter(
          (r) => r.dist < LASER_RANGE && r.yourAim < NPC_FIRE_GATE).length),
        them: share(rows.filter(
          (r) => r.dist < NPC_LASER_RANGE && r.theirAim < NPC_FIRE_GATE).length),
      },
      inRangeShare: {
        you: share(rows.filter((r) => r.dist < LASER_RANGE).length),
        them: share(rows.filter((r) => r.dist < NPC_LASER_RANGE).length),
      },
      meanAimErrorDeg: {
        you: round(deg(mean(rows.map((r) => r.yourAim)) ?? 0), 1),
        them: round(deg(mean(rows.map((r) => r.theirAim)) ?? 0), 1),
      },
      onSixSeconds: { you: secs(theirSixFrames), them: secs(yourSixFrames) },
      poolsAtStart: pools(s[0]),
      poolsAtEnd: pools(s[s.length - 1]),
      lowWater: {
        foreShield: roundOrNull(low(s.map((f) => f.foreShield)), 2),
        aftShield: roundOrNull(low(s.map((f) => f.aftShield)), 2),
        energy: roundOrNull(low(s.map((f) => f.energy)), 2),
      },
      opponents: this.setup.opponents.map((o, i) => this.opponentLine(o, i)),
      envelope: this.envelope(nearest),
      opposition: this.opposition(rows),
      events: [...this.log],
      warnings: [...this.warnings],
    };
  }

  private opponentLine(setup: OpponentSetup, i: number): OpponentReport {
    const o = this.tally[i] ?? newTally();
    return {
      index: i,
      hull: setup.hull,
      designId: setup.designId,
      profileId: setup.profileId,
      brain: setup.brain,
      ...(setup.role === undefined ? {} : { role: setup.role }),
      ...(setup.tier === undefined ? {} : { tier: setup.tier }),
      livedSeconds: round(o.diedAt ?? this.t, 1),
      destroyed: o.diedAt !== null,
      killedByYou: o.killedByYou,
      shots: o.shots,
      hits: o.hits,
      missiles: o.missiles,
      damageToYou: round(o.damageToYou, 2),
      damageFromYou: round(o.damageFromYou, 2),
      medianRange: roundOrNull(quantile(o.dists, 0.5), 0),
      closestRange: o.dists.length ? round(Math.min(...o.dists), 0) : null,
      medianSpeed: roundOrNull(quantile(o.speeds, 0.5), 0),
      passes: countPasses(o.dists),
      linedUpShare: o.frames ? round(o.linedUp / o.frames, 3) : null,
      doing: Object.fromEntries(
        [...o.doing.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([what, frames]) => [what, round(frames / this.hz, 1)]),
      ),
    };
  }

  /**
   * How they flew — see `OppositionReport`.
   *
   * Over the SHIP-FRAMES the report already collected, so nothing is sampled
   * twice and a figure here covers exactly the frames `range` and `linedUpShare`
   * cover. Passes are per opponent then summed, because pooling three ships'
   * ranges would count a crossing every time the nearest changed.
   */
  private opposition(rows: readonly ContactSample[]): OppositionReport {
    const speeds = rows.map((r) => r.speed);
    const dists = rows.map((r) => r.dist);
    return {
      samples: rows.length,
      speed: speeds.length ? {
        median: round(quantile(speeds, 0.5) ?? 0, 0),
        p90: round(quantile(speeds, 0.9) ?? 0, 0),
        max: Math.round(Math.max(...speeds)),
      } : null,
      range: dists.length ? {
        p10: round(quantile(dists, 0.1) ?? 0, 0),
        median: round(quantile(dists, 0.5) ?? 0, 0),
        p90: round(quantile(dists, 0.9) ?? 0, 0),
      } : null,
      passes: this.tally.reduce((n, o) => n + countPasses(o.dists), 0),
    };
  }

  /** arena.js's envelope(): how this pilot flies, for the trainer to fit against. */
  private envelope(nearest: number[]): EnvelopeReport {
    const s = this.samples;
    const speeds = s.map((f) => f.speed);
    const pitch = s.map((f) => Math.abs(f.pitch));
    const roll = s.map((f) => Math.abs(f.roll));
    const band = (xs: number[]) => (xs.length ? {
      median: round(quantile(xs, 0.5) ?? 0, 2),
      p90: round(quantile(xs, 0.9) ?? 0, 2),
    } : null);
    return {
      samples: s.length,
      speed: speeds.length ? {
        median: round(quantile(speeds, 0.5) ?? 0, 0),
        p90: round(quantile(speeds, 0.9) ?? 0, 0),
        max: Math.round(Math.max(...speeds)),
      } : null,
      pitchRate: band(pitch),
      rollRate: band(roll),
      engagementRange: nearest.length ? {
        median: round(quantile(nearest, 0.5) ?? 0, 0),
        p10: round(quantile(nearest, 0.1) ?? 0, 0),
        p90: round(quantile(nearest, 0.9) ?? 0, 0),
      } : null,
    };
  }

  private key(source: DamageSource | DealtSource): SourceKey {
    if (SOURCES.includes(source)) return source;
    this.warn(`a hit arrived with the source '${String(source)}', which neither `
      + 'DamageSource nor DealtSource names — the game has grown a new way to '
      + 'hurt something. Do not read damageBySource as complete.');
    return UNKNOWN;
  }

  private unknownOpponent(i: number): void {
    this.warn(`something was attributed to opponent ${i}, which this exercise `
      + 'does not have — the per-opponent lines are incomplete.');
  }
}

/**
 * They are behind you AND pointed at you: you cannot see them and they can
 * shoot. `yourAim` near π means they are astern of your nose.
 */
function theyAreOnYourSix(c: ContactSample): boolean {
  return c.dist < NPC_LASER_RANGE
    && c.yourAim > Math.PI - SIX_CONE
    && c.theirAim < NPC_FIRE_GATE;
}

/** The mirror: you are astern of them, and lined up. */
function youAreOnTheirSix(c: ContactSample): boolean {
  return c.dist < LASER_RANGE
    && c.theirAim > Math.PI - SIX_CONE
    && c.yourAim < NPC_FIRE_GATE;
}

const deg = (rad: number): number => rad * 180 / Math.PI;

/** hits / shots, or null when nobody fired — 0% and "never tried" are different. */
function ratio(n: number, d: number): number | null {
  return d ? round(n / d, 3) : null;
}

function add(m: Map<SourceKey, SourceTally>, key: SourceKey, amount: number): void {
  const t = m.get(key) ?? { damage: 0, count: 0 };
  t.damage += amount;
  t.count += 1;
  m.set(key, t);
}

const total = (m: Map<SourceKey, SourceTally>): number => {
  let sum = 0;
  for (const t of m.values()) sum += t.damage;
  return sum;
};

/** Only the causes that actually happened, rounded. */
function tallies(m: Map<SourceKey, SourceTally>): Partial<Record<SourceKey, SourceTally>> {
  const out: Partial<Record<SourceKey, SourceTally>> = {};
  for (const [k, t] of m) {
    if (t.count > 0) out[k] = { damage: round(t.damage, 2), count: t.count };
  }
  return out;
}

const low = (xs: number[]): number | null => (xs.length ? Math.min(...xs) : null);

/** The report as JSON, ready for the clipboard or a file. */
export function combatSimJson(report: CombatSimReport): string {
  return JSON.stringify(report, null, 1);
}

/**
 * How far a run of waves got — 0 for a set of records that is not one.
 *
 * REACHED, not cleared: the wave that killed you is the wave you got to.
 * Derived from the records rather than counted alongside them, so a second tally
 * cannot disagree with the report the pilot is looking at.
 */
export function furthestWave(records: readonly CombatSimReport[]): number {
  return records.reduce(
    (n, r) => (r.mode === 'waves' ? Math.max(n, r.wave ?? 0) : n), 0);
}

// --- the ring of recent exercises -------------------------------------------

export interface SimLog {
  readonly limit: number;
  /** oldest first */
  records: CombatSimReport[];
  push(report: CombatSimReport): void;
  last(): CombatSimReport | null;
  json(): string;
  clear(): void;
}

/** A ring of recent records, with no global anywhere near it. */
export function makeSimLog(limit = SIM_LOG_LIMIT): SimLog {
  const records: CombatSimReport[] = [];
  return {
    limit,
    records,
    push(report) {
      records.push(report);
      while (records.length > limit) records.shift();
    },
    last() { return records.length ? records[records.length - 1] : null; },
    json() { return JSON.stringify(records, null, 1); },
    clear() { records.length = 0; },
  };
}
