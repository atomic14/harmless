// The human-shape bands: a gate on the SHAPE of the shipped fight.
//
// docs/TRAINING-LOG.md's reference fight measured the shape a good fight has —
// pirates within laser range 95% of the time, lined up on the player 5% — and
// the log's conclusion is that the balance rests exactly there: doubling how
// often pirates point at the player kills him, and the opposite failure ("the
// ships didn't do anything") is on record too. docs/PROCESS.md names these
// bands as the standing defence against the failure this project has met
// twice: a pirate that wins every measurement by turning into a turret.
// docs/TODO/98 is the plan this file implements, and the baselines behind
// every band are recorded there.
//
// It flies WHAT SHIPS: real `NpcShip`s under the shipped brain selection —
// `pursuit`, with its slash switch — through the real `update()`. NOT the
// training `Episode`, which cannot express pursuit: a gate built on it would
// measure the `scripted` A/B control and stay green while the real fight
// turned into a turret. Every measured quantity is the game's own
// `CombatSimRecorder`'s — lined-up and in-range shares, the pass count, the
// on-six clock, the range quantiles. This file computes none of them.
//
// Two hand-driven player stand-ins, two labeled rows, and the rows are NEVER
// compared to each other — docs/TODO/84's trap, avoided by construction:
//
//   knife-fighter  turns hard to face and barely translates — how the recorded
//                  human flies. The commander's nose on the pirate holds it in
//                  the slashing attack run (`slashesRatherThanHoldSix`).
//   runner         translates on a fixed heading and presents a tail. This is
//                  the one opponent hold-six is reachable against — the mode
//                  the knife-fighter makes structurally unreachable.
//
// The stand-ins are this file's own. `holding`/`weaving` in
// ai-training/scenario.ts are calibrated trainer fixtures (four probe columns
// rest on them) and are deliberately not reused. docs/TODO/89 wants to reach
// for this fixture later; `flyShapeEpisode` and `measureShape` are exported
// for it.

import * as THREE from 'three';
import { seedWorld } from '../src/game/rng.ts';
import {
  NpcShip, steerQuatToward, type PlayerRef, type WorldView,
} from '../src/game/npc.ts';
import { SHIPPED_BRAINS } from '../src/game/brain-names.ts';
import { describeFlight } from '../src/game/break-off.ts';
import {
  CombatSimRecorder, aimAngle, mean, quantile,
  type CombatSimReport, type FrameSample,
} from '../src/game/combat-sim-report.ts';
import { NO_OPENING } from '../src/game/combat-sim-opening.ts';
import { registeredHull } from '../src/ships/registry.ts';
import { COBRA_MK_3_HULL_ID } from '../src/game/ship-identity.ts';
import { FIXED_DT } from '../src/constants/world-clock.ts';
import { PLAYER_FLIGHT } from '../src/constants/player-flight.ts';
import { MAX_ENERGY, MAX_SHIELD } from '../src/constants/pools.ts';
import { check } from './harness.ts';

console.log('\nhuman-shape bands (docs/TODO/98)');

/**
 * Held-out, and distinct from every other seed base in the project — the
 * others are 5_000_011, 8_675_309, 10_000_019, 20_000_003, 30_000_007,
 * 40_000_009 and 918_273 (plus per-file test seeds); nothing else uses the
 * 50-million decade. Prime, following the probe bases' convention.
 */
export const HUMAN_SHAPE_BASE = 50_000_017;

/**
 * One episode's length. Long enough for the approach from `SPAWN_RANGE` plus
 * two full attack-run cycles (7.2s median merge-to-merge,
 * constants/tactic-choice.ts), short enough that the two default rows stay
 * inside the suite's ~1s budget for this file.
 */
const EPISODE_SECONDS = 20;

/** Episodes per row at gate size. The baseline was also run at 4x this (160)
 *  and agreed — the two-size rule; both runs are recorded in docs/TODO/98. */
const EPISODES = 40;

/**
 * Where the pirate starts: dead astern of the stand-in, inside
 * `PLAYER_INTEREST_RANGE` (9,000) so it engages on frame one, outside
 * `PASS_FAR` (600) so the pass hysteresis starts clean, and just inside the
 * gun's 3,500 — a fight, not a stare.
 */
const SPAWN_RANGE = 3000;

/**
 * The knife-fighter barely translates: well below every pirate hull's own
 * cruise floor (`MIN_CRUISE_FRACTION` x 160 = 68.8 for the slowest), so the
 * geometry is decided by the pirate's flying, not the stand-in's.
 */
const KNIFE_SPEED = 40;

/**
 * The runner translates flat out — for a stand-in that must stay catchable:
 * below the slowest roster pirate's 160 top speed, so every hull the roster
 * can deal presents the same reachable tail.
 */
const RUNNER_SPEED = 140;

/** How a stand-in flies: a name for the row, a speed, and a steer. */
export interface StandIn {
  name: string;
  speed: number;
  steer(player: PlayerRef, npcPos: THREE.Vector3, dt: number): void;
}

const scratch = new THREE.Vector3();

/** Turns hard to face the pirate at the commander's own pitch rate. */
export const KNIFE_FIGHTER: StandIn = {
  name: 'knife-fighter',
  speed: KNIFE_SPEED,
  steer: (player, npcPos, dt) => steerQuatToward(
    player.quaternion, scratch.copy(npcPos).sub(player.position),
    PLAYER_FLIGHT.maxPitch * dt),
};

/** Holds its spawn heading and never turns: a tail, presented. */
export const RUNNER: StandIn = {
  name: 'runner',
  speed: RUNNER_SPEED,
  steer: () => {},
};

/**
 * One episode: a real pirate, the shipped brain selection, one stand-in.
 *
 * The variant seed cycles the pirate roster, so a batch samples the hull mix
 * the sky actually deals. No damage flows either way — the stand-ins carry no
 * gun and the pirate's shots are recorded, not resolved — so every episode
 * runs its full length and the shape is the undisturbed pursuit flight.
 */
export function flyShapeEpisode(
  standIn: StandIn, seed: number, variantSeed: number,
): { report: CombatSimReport; ranges: number[]; speeds: number[] } {
  seedWorld(seed);
  const npc = new NpcShip('pirate', new THREE.Vector3(0, 0, SPAWN_RANGE), variantSeed);
  const player: PlayerRef = {
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    speed: standIn.speed,
  };
  const view: WorldView = {
    station: new THREE.Object3D(), dockZ: 160, fleet: [npc],
    playerLegal: 0, brains: SHIPPED_BRAINS, missileInbound: false,
  };
  const rec = new CombatSimRecorder({
    seed,
    scenario: `human shape: ${standIn.name}`,
    mode: 'scenario',
    // Every step, the flight probe's cadence: a 20s episode can afford it, and
    // the recorder's derived durations follow it.
    sampleHz: 1 / FIXED_DT,
    player: {
      shipId: COBRA_MK_3_HULL_ID, laser: 'pulse',
      missiles: 0, ecm: false, energyUnit: false, energyBomb: false,
    },
    opponents: [{
      hull: registeredHull(npc.designId).name,
      designId: npc.designId,
      profileId: npc.profileId,
      brain: 'pursuit',
      role: 'pirate',
    }],
    opening: NO_OPENING,
    coPilot: 'scripted',
  });
  const fwd = new THREE.Vector3();
  const sample = (): FrameSample => ({
    speed: standIn.speed, pitch: 0, roll: 0,
    foreShield: MAX_SHIELD, aftShield: MAX_SHIELD, energy: MAX_ENERGY,
    contacts: [{
      opponent: 0,
      dist: npc.object.position.distanceTo(player.position),
      speed: npc.state.speed,
      theirAim: aimAngle(npc.object.position, npc.object.quaternion, player.position),
      yourAim: aimAngle(player.position, player.quaternion, npc.object.position),
      doing: describeFlight(
        npc.state.attackPhase, npc.state.underFire, npc.state.fleeing,
        npc.state.flownBy, npc.state.tactic, npc.breakingOff),
    }],
  });
  for (let i = 0; i < EPISODE_SECONDS * 60; i++) {
    standIn.steer(player, npc.object.position, FIXED_DT);
    player.position.addScaledVector(
      fwd.set(0, 0, -1).applyQuaternion(player.quaternion), standIn.speed * FIXED_DT);
    const shot = npc.update(FIXED_DT, player, view);
    if (shot) rec.npcShot(0, shot.weapon);
    rec.tick(FIXED_DT, sample);
  }
  const ranges: number[] = [];
  const speeds: number[] = [];
  for (const f of rec.raw) {
    for (const c of f.contacts) { ranges.push(c.dist); speeds.push(c.speed); }
  }
  return { report: rec.report('timeout'), ranges, speeds };
}

/** One row of the table: every banded quantity, plus context. */
export interface ShapeRow {
  standIn: string;
  episodes: number;
  /** recorder's `linedUpShare.them`, averaged over episodes — every episode
   *  runs the same number of frames (nothing can die), so the equal-weight
   *  mean IS the pooled share */
  linedUpShare: number;
  inRangeShare: number;
  meanSpeed: number;
  rangeP10: number;
  rangeP90: number;
  passesPerEpisode: number;
  onSixSeconds: number;
  /** context for a failure readout, not banded */
  meanAimErrorDeg: number;
}

/** A row: `episodes` seeded fights against one stand-in, pooled. */
export function measureShape(standIn: StandIn, episodes: number): ShapeRow {
  const ranges: number[] = [];
  const speeds: number[] = [];
  let linedUp = 0;
  let inRange = 0;
  let passes = 0;
  let onSix = 0;
  let aimErr = 0;
  for (let e = 0; e < episodes; e++) {
    // The 7919 stride every probe base steps by, off this file's own base.
    const { report, ranges: r, speeds: s } =
      flyShapeEpisode(standIn, HUMAN_SHAPE_BASE + e * 7919, e);
    for (const d of r) ranges.push(d);
    for (const v of s) speeds.push(v);
    linedUp += report.linedUpShare.them;
    inRange += report.inRangeShare.them;
    // Summed per episode: the pass hysteresis starts over when the fight does.
    passes += report.opposition.passes;
    onSix += report.onSixSeconds.them;
    aimErr += report.meanAimErrorDeg.them;
  }
  return {
    standIn: standIn.name,
    episodes,
    linedUpShare: linedUp / episodes,
    inRangeShare: inRange / episodes,
    meanSpeed: mean(speeds) ?? 0,
    rangeP10: quantile(ranges, 0.1) ?? 0,
    rangeP90: quantile(ranges, 0.9) ?? 0,
    passesPerEpisode: passes / episodes,
    onSixSeconds: onSix / episodes,
    meanAimErrorDeg: aimErr / episodes,
  };
}

/** The row, printed the way the probes print theirs — context for a red run. */
function printRow(r: ShapeRow): void {
  console.log(`  ${r.standIn.padEnd(13)} lined-up ${(r.linedUpShare * 100).toFixed(1)}%`
    + ` · in-range ${(r.inRangeShare * 100).toFixed(1)}%`
    + ` · speed ${r.meanSpeed.toFixed(0)}`
    + ` · range p10/p90 ${r.rangeP10.toFixed(0)}/${r.rangeP90.toFixed(0)}`
    + ` · passes ${r.passesPerEpisode.toFixed(2)}`
    + ` · on-six ${r.onSixSeconds.toFixed(1)}s`
    + ` · aim err ${r.meanAimErrorDeg.toFixed(0)} deg`);
}

const knife = measureShape(KNIFE_FIGHTER, EPISODES);
const runner = measureShape(RUNNER, EPISODES);
printRow(knife);
printRow(runner);

// --- the bands ---------------------------------------------------------------
//
// Every value below comes from the two-size baseline in docs/TODO/98 (40 and
// 160 episodes agreed on every column) plus the human-shape rationale for
// which side of it is the dangerous one. The stand-ins are not Chris, so the
// reference fight's own numbers are NOT the band values — they justify which
// quantities are banded. All assertions are inequalities on shares and
// counts, never exact totals, and each band sits 1.5-4x off its baseline so a
// deliberate combat retune can re-baseline it confidently (docs/TODO/89: a
// test nobody can re-baseline gets deleted).
//
// Baseline, 2026-08-09 (40 eps / 160 eps):
//   knife-fighter  lined 20.1/20.9%  in-range 100/100%  speed 257/257
//                  p10/p90 224/2853 · 219/2847  passes 1.25/1.27
//   runner         lined 85.6/85.5%  in-range 96.6/96.1%  speed 257/254
//                  on-six 17.1/17.1s  passes 0.00/0.00

// THE KNIFE-FIGHTER ROW — the human-shaped fight; exercises the slashing run.
{
  const r = knife;
  // The balance the reference fight found rests on pirates RARELY lined up:
  // every extra point of alignment converts almost directly into damage, and
  // doubling it kills the commander. Baseline ~20%; a pirate that tracks the
  // turning player reads far above this.
  check(`knife-fighter: lined-up share stays under the tracker ceiling`
    + ` (${(r.linedUpShare * 100).toFixed(1)}% < 35%)`, r.linedUpShare < 0.35);
  // ...and the opposite failure is on record too: "the ships didn't do
  // anything". A pirate that never lines up is not fighting.
  check(`knife-fighter: lined-up share stays over the passive floor`
    + ` (${(r.linedUpShare * 100).toFixed(1)}% > 5%)`, r.linedUpShare > 0.05);
  // The reference fight: within laser range 95% of the time. Baseline 100%.
  check(`knife-fighter: in range — in the fight, not standing off`
    + ` (${(r.inRangeShare * 100).toFixed(1)}% > 80%)`, r.inRangeShare > 0.80);
  // The turret floor: above every pirate hull's own MIN_CRUISE_FRACTION pin
  // (0.43 x 330 = 142 for the fastest), well under the baseline 257 — a brain
  // that sits at the floor and pivots reads below this.
  check(`knife-fighter: mean speed above the turret floor`
    + ` (${r.meanSpeed.toFixed(0)} > 180)`, r.meanSpeed > 180);
  // An attack run sweeps the band; a turret holds one range and the spread
  // collapses. Baseline p10-p90 gap ~2,630.
  check(`knife-fighter: range spread not collapsed`
    + ` (${(r.rangeP90 - r.rangeP10).toFixed(0)} > 1200)`,
  r.rangeP90 - r.rangeP10 > 1200);
  // A pass is a completed close-and-break — a loiter scores none however long
  // it stays. Baseline 1.25 per 20s episode; the fight keeps moving.
  check(`knife-fighter: passes per episode above zero`
    + ` (${r.passesPerEpisode.toFixed(2)} > 0.5)`, r.passesPerEpisode > 0.5);
}

// THE RUNNER ROW — the presented tail; exercises hold-six. Its own values,
// never the knife-fighter's: hold-six is station-keeping, so lined-up runs
// HIGH here by design, no pass completes (`PURSUIT_CLEAR_RANGE` 560 sits
// inside `PASS_FAR` 600 — the break-off never opens far enough to count), and
// the range legitimately collapses onto `PURSUIT_RANGE` once attached. So
// this row bands the on-six clock instead of passes and spread — the mode it
// exists to exercise — and docs/TODO/84's zero-by-construction column is
// finally measured against a target that can move it.
{
  const r = runner;
  // It is hunting the tail it was given. Baseline ~86%.
  check(`runner: lined-up share stays over the hunting floor`
    + ` (${(r.linedUpShare * 100).toFixed(1)}% > 60%)`, r.linedUpShare > 0.60);
  // ...but even on a presented tail the shipped pilot spends time off the gun
  // — the approach, and the break-off that stops it ramming. A pilot that
  // never comes off the gun at all is the tracker.
  check(`runner: lined-up share stays under the perfect-tracker ceiling`
    + ` (${(r.linedUpShare * 100).toFixed(1)}% < 95%)`, r.linedUpShare < 0.95);
  check(`runner: in range — it caught the tail it was offered`
    + ` (${(r.inRangeShare * 100).toFixed(1)}% > 80%)`, r.inRangeShare > 0.80);
  check(`runner: mean speed above the turret floor`
    + ` (${r.meanSpeed.toFixed(0)} > 180)`, r.meanSpeed > 180);
  // Astern AND pointed at the target — the manoeuvre that is actually
  // threatening, and the mode the slash switch trades away when the commander
  // turns. Baseline 17.1s of a 20s episode.
  check(`runner: holds the six on a presented tail`
    + ` (${r.onSixSeconds.toFixed(1)}s > 10s)`, r.onSixSeconds > 10);
}
