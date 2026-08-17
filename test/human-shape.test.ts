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
// training `Episode`: even now that an episode can stage a pursuit pirate
// (`{ kind: 'pursuit' }`, docs/TODO/102), only `update()` is the whole
// shipped path — the engagement gates, the tier dealing, `chooseWeapon` —
// and a gate on anything less could stay green while the real fight turned
// into a turret. Every measured quantity is the game's own
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
//
// WHICH pirate each episode meets is the game's own dealing rule, not this
// file's: `pirateSpecForTier`, the function every sky spawn goes through
// (spawning.ts), seeded from the episode seed the way the sky seeds it. The
// fixture only states the tier, cycling 0-1-2 in equal thirds — a career's
// own tier frequency depends on wealth and fame, and weighting by it would
// leave the rarer gang hulls unsampled at gate size.

import * as THREE from 'three';
import { seedWorld } from '../src/game/rng.ts';
import { NpcShip, type WorldView } from '../src/game/npc.ts';
import type { PlayerRef } from '../src/game/npc-state.ts';
import { steerQuatToward } from '../src/game/flight-maths.ts';
import { pirateSpecForTier } from '../src/game/ship-specs.ts';
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
 * Held-out, and distinct from every seed base in the project — the named
 * bases are 5_000_011, 8_675_309, 10_000_019, 20_000_003, 30_000_007,
 * 40_000_009 and 918_273. test/tactics.test.ts walks episode seeds up from
 * 51_000_003 in the same decade, but both files stride by 7919 and the bases
 * differ by 999,986 ≡ 2,192 (mod 7919) with a jitter of at most 96 on top,
 * so no exact seed can ever collide, at any size. Prime, following the probe
 * bases' convention.
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
 * cruise floor (`MIN_CRUISE_FRACTION` x 152 = 65 for the slowest, the
 * Monitor), so the geometry is decided by the pirate's flying, not the
 * stand-in's.
 */
const KNIFE_SPEED = 40;

/**
 * The runner translates flat out — for a stand-in that must stay catchable:
 * below the slowest pirate hull's 152 top speed (the Monitor, a margin of
 * 12), so every hull the tier table deals presents a reachable tail.
 */
const RUNNER_SPEED = 140;

/**
 * The turret floor for the mean-speed bands, shared by both rows: above every
 * pirate hull's own `MIN_CRUISE_FRACTION` pin (0.43 x 381 = 164 for the
 * fastest hull the tier table deals, the Asp Mk II), so a pilot that sits at
 * the floor and pivots reads below it whatever hull it drew. Pinched from
 * both sides — it cannot go below 164 without losing that rationale, and the
 * measured baseline is ~250 — so 180 splits the gap; the headroom is ~1.4x
 * rather than this file's usual 1.5-4x, and that trade is deliberate.
 */
const TURRET_FLOOR_SPEED = 180;

/** In the fight, not standing off: the reference fight sat in range 95% of
 *  the time, and both rows measure near that. Shared by both rows. */
const IN_RANGE_FLOOR = 0.80;

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
 * The hull is dealt by the game's own `pirateSpecForTier` off the episode
 * seed — the same call every sky spawn makes (spawning.ts) — so the batch
 * samples the tier's real hull mix and this file holds no dealing rule of
 * its own. No damage flows either way: the stand-ins carry no gun, the
 * pirate's laser shots are recorded but not resolved, and its missile rack
 * is emptied at spawn — the launch governor (the one-in-the-air cap and the
 * rack decrement) lives in world-step.ts, which this fixture does not run,
 * so a rack it cannot govern would spam launches nothing resolves. Every
 * episode therefore runs its full length and the shape measured is the
 * undisturbed pursuit flight.
 */
export function flyShapeEpisode(
  standIn: StandIn, seed: number, tier: number,
  /**
   * Which of the tier's hulls this episode meets — spawning.ts's member
   * index, played by a per-tier counter. NOT derived from `seed`: the tier
   * cycle and `pirateSpecForTier`'s modulus alias through a shared linear
   * seed (a 3-tier cycle over a 3-hull tier dealt one hull forever).
   */
  deal: number,
): { report: CombatSimReport; ranges: number[]; speeds: number[] } {
  seedWorld(seed);
  const npc = new NpcShip('pirate', new THREE.Vector3(0, 0, SPAWN_RANGE), deal,
    pirateSpecForTier(tier, deal));
  npc.state.threatTier = tier;
  npc.state.missiles = 0;
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
      tier,
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
        npc.state.flownBy, npc.state.attackPhase, npc.state.underFire,
        npc.state.tactic, npc.breakingOff),
    }],
  });
  for (let i = 0; i < Math.round(EPISODE_SECONDS / FIXED_DT); i++) {
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
    // Stride 7919, the probes' convention by copy (a shared constant is a
    // src-side refactor of its own); the tier cycles 0-1-2 in equal thirds,
    // and floor(e / 3) walks each tier's own hull list end to end.
    const { report, ranges: r, speeds: s } =
      flyShapeEpisode(standIn, HUMAN_SHAPE_BASE + e * 7919, e % 3, Math.floor(e / 3));
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
// Baseline, 2026-08-09, tier-weighted dealing (40 eps / 160 eps):
//   knife-fighter  lined 20.4/21.3%  in-range 100/100%  speed 251/254
//                  p10/p90 229/2875 · 221/2845  passes 1.20/1.27
//   runner         lined 84.8/86.4%  in-range 94.9/97.2%  speed 251/251
//                  on-six 17.0/17.3s  passes 0.00/0.00

// THE KNIFE-FIGHTER ROW — the human-shaped fight; exercises the slashing run.
{
  const r = knife;
  // The balance the reference fight found rests on pirates RARELY lined up:
  // every extra point of alignment converts almost directly into damage, and
  // doubling it kills the commander. Baseline ~21%; a pirate that tracks the
  // turning player reads far above this.
  check(`knife-fighter: lined-up share stays under the tracker ceiling`
    + ` (${(r.linedUpShare * 100).toFixed(1)}% < 35%)`, r.linedUpShare < 0.35);
  // ...and the opposite failure is on record too: "the ships didn't do
  // anything". Half the baseline, and NOT lower: the mutation sweep found
  // that a fully passive pirate ambling near the stand-in still crosses the
  // fire gate 5.6% of the time by accident, so a 5% floor never trips.
  check(`knife-fighter: lined-up share stays over the passive floor`
    + ` (${(r.linedUpShare * 100).toFixed(1)}% > 10%)`, r.linedUpShare > 0.10);
  check(`knife-fighter: in range — in the fight, not standing off`
    + ` (${(r.inRangeShare * 100).toFixed(1)}% > ${IN_RANGE_FLOOR * 100}%)`,
  r.inRangeShare > IN_RANGE_FLOOR);
  check(`knife-fighter: mean speed above the turret floor`
    + ` (${r.meanSpeed.toFixed(0)} > ${TURRET_FLOOR_SPEED})`,
  r.meanSpeed > TURRET_FLOOR_SPEED);
  // An attack run sweeps the band; a turret holds one range and the spread
  // collapses. Baseline p10-p90 gap ~2,650.
  check(`knife-fighter: range spread not collapsed`
    + ` (${(r.rangeP90 - r.rangeP10).toFixed(0)} > 1200)`,
  r.rangeP90 - r.rangeP10 > 1200);
  // A pass is a completed close-and-break — a loiter scores none however long
  // it stays. Baseline ~1.2 per 20s episode; the fight keeps moving.
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
  // It is hunting the tail it was given. Baseline ~85%.
  check(`runner: lined-up share stays over the hunting floor`
    + ` (${(r.linedUpShare * 100).toFixed(1)}% > 60%)`, r.linedUpShare > 0.60);
  // ...but even on a presented tail the shipped pilot spends time off the gun
  // — the approach, and the break-off that stops it ramming. A pilot that
  // never comes off the gun at all is the tracker.
  check(`runner: lined-up share stays under the perfect-tracker ceiling`
    + ` (${(r.linedUpShare * 100).toFixed(1)}% < 95%)`, r.linedUpShare < 0.95);
  check(`runner: in range — it caught the tail it was offered`
    + ` (${(r.inRangeShare * 100).toFixed(1)}% > ${IN_RANGE_FLOOR * 100}%)`,
  r.inRangeShare > IN_RANGE_FLOOR);
  check(`runner: mean speed above the turret floor`
    + ` (${r.meanSpeed.toFixed(0)} > ${TURRET_FLOOR_SPEED})`,
  r.meanSpeed > TURRET_FLOOR_SPEED);
  // Astern AND pointed at the target — the manoeuvre that is actually
  // threatening, and the mode the slash switch trades away when the commander
  // turns. Baseline 17.0s of a 20s episode.
  check(`runner: holds the six on a presented tail`
    + ` (${r.onSixSeconds.toFixed(1)}s > 10s)`, r.onSixSeconds > 10);
}
