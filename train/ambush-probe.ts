// How long does a commander last in the witch-space ambush? A FLOOR, flown
// over the real world step (docs/TODO/188, GitHub #39).
//
//   node --experimental-strip-types train/ambush-probe.ts [episodes] [seconds]
//
// WHAT IT FLIES. The ambush as `enterWitchspace` stages it: two motherships,
// a third 30% of the time, at the ambush range, and the drone timer armed.
// Every frame after that is the game's own `WorldStep`: the motherships fly
// the fighter behaviour, the drones deploy on `THARGON_REDEPLOY` up to
// `MAX_THARGONS`, and the commander's pools take the hits through
// `damagePlayer`. Nothing here is a copy of a rule.
//
// WHO FLIES THE COMMANDER. The scripted co-pilot (game/scripted-co-pilot.ts),
// which is the defence the combat computer sells. It produces the same
// `FlightDemand` a pair of hands does, and the step flies it through
// `PlayerShip.update`. Its trigger reaches the real gun through the host, at
// the gun's own heat and energy. The fit is a new commander's: a Cobra Mk III
// with a pulse laser, no E.C.M., no energy unit. So a row is a floor for the
// shipped defence in the shipped ship, and a human who flies better sits above
// it.
//
// WHAT A ROW SAYS. Over the episodes:
//
//   survived    the share that reached the time limit alive
//   death       seconds to death, median and p10, over the episodes that died
//   pools       what was left of the three pools at the end, mean
//   mothers     motherships killed per episode
//   drones      drones killed per episode
//   peak drones live drones at once, mean of each episode's peak, and the max
//   drone share the share of the damage taken that a drone dealt
//
// WHY. Chris flew it and said it is too hard. `MAX_THARGONS` and
// `THARGON_REDEPLOY` had no measurement behind them in either direction,
// because no probe killed a mothership (docs/TODO/184). This is the number a
// change to either answers to. Run it at two sizes before a decision, as
// CLAUDE.md asks.
//
// NOT A GATE. The suite does not run it. Its bands would be re-baselined by
// the very change it exists to measure.

import * as THREE from 'three';
import { freshState } from '../src/game/state.ts';
import { newCommander } from '../src/game/commander.ts';
import { Combat, type CombatScratch, type DamageSource } from '../src/game/combat.ts';
import { Ordnance } from '../src/game/ordnance.ts';
import { WorldStep, type StepHost } from '../src/game/world-step.ts';
import { damagePlayer, firePlayerLaser } from '../src/game/combat-player.ts';
import { ScriptedCoPilot } from '../src/game/scripted-co-pilot.ts';
import { specsForSet } from '../src/game/set-roster.ts';
import { blueprintSetFor } from '../src/game/blueprint-set.ts';
import { random, randomDirection, seedWorld } from '../src/game/rng.ts';
import { poolsLeft } from '../src/game/systems.ts';
import { mean, quantile } from '../src/game/combat-sim-report.ts';
import type { PlayerPoolPoints } from '../src/game/damage-units.ts';
import type { FlightDemand } from '../src/player.ts';
import {
  THARGOID_AMBUSH_EXTRA_CHANCE, THARGOID_AMBUSH_MIN, THARGOID_AMBUSH_RANGE,
  THARGOID_AMBUSH_RANGE_SPAN, WITCHSPACE_ENTRY_SPEED,
} from '../src/constants/witchspace.ts';
import { MAX_THARGONS, THARGON_REDEPLOY } from '../src/constants/encounters.ts';
import { FIXED_DT } from '../src/constants/world-clock.ts';

/**
 * Held out, and distinct from every seed base in the project. The named bases
 * are listed at `HUMAN_SHAPE_BASE` (test/human-shape.test.ts); this one is
 * above them all. Prime, by the probes' convention. Stride 7919, likewise.
 */
export const AMBUSH_PROBE_BASE = 60_000_011;

/** Hands off: what the step flies when the co-pilot has nothing to fly at. */
const COAST: FlightDemand = { rollRate: 0, pitchRate: 0, throttle: 0, fire: false };

export interface AmbushEpisode {
  seed: number;
  /** null when she reached the time limit alive */
  diedAt: number | null;
  poolsLeft: number;
  mothersAtStart: number;
  mothersKilled: number;
  dronesKilled: number;
  peakDrones: number;
  /** pool points taken, by who dealt them */
  fromDrones: number;
  fromMothers: number;
}

/**
 * One episode: the ambush, flown until she dies or `seconds` pass.
 *
 * Staged as `enterWitchspace` (world-build.ts) stages it, in the same order,
 * so the same seed gives the same sky. The commander's system is the one a
 * new commander starts in, which picks the Thargoid set as a mis-jump from
 * there would.
 */
export function flyAmbush(seed: number, seconds: number): AmbushEpisode {
  seedWorld(seed);
  const state = freshState(newCommander());
  const system = state.systems[state.commander.systemIndex];
  state.session.witchspace = true;
  state.session.blueprintSet = blueprintSetFor(system, state.commander.galaxy, 0, 'thargoid');
  state.world.build(system, specsForSet(state.session.blueprintSet));
  state.world.banishScenery();
  state.player.position.set(0, 0, 0);
  state.player.speed = WITCHSPACE_ENTRY_SPEED;
  const mothersAtStart = THARGOID_AMBUSH_MIN + (random() < THARGOID_AMBUSH_EXTRA_CHANCE ? 1 : 0);
  for (let i = 0; i < mothersAtStart; i++) {
    state.world.spawn('thargoid',
      randomDirection(new THREE.Vector3())
        .multiplyScalar(THARGOID_AMBUSH_RANGE + random() * THARGOID_AMBUSH_RANGE_SPAN), i);
  }
  state.encounterTimers.thargon = THARGON_REDEPLOY;

  const combat = new Combat(state.world);
  const ordnance = new Ordnance(state.world);
  const scratch: CombatScratch = {
    a: new THREE.Vector3(), b: new THREE.Vector3(),
    q: new THREE.Quaternion(), ray: new THREE.Raycaster(),
  };
  let diedAt: number | null = null;
  let elapsed = 0;
  let fromDrones = 0;
  let fromMothers = 0;
  /** who shot from `at`: the live ship nearest the shot's origin */
  const shooterRole = (at: THREE.Vector3): string => {
    let best = Infinity;
    let role = '';
    for (const n of state.world.npcs) {
      if (!n.state.alive) continue;
      const d = n.object.position.distanceToSquared(at);
      if (d < best) { best = d; role = n.role; }
    }
    return role;
  };
  const host: StepHost = {
    inFlight: () => diedAt === null,
    applyPlayerDamage: (amount: PlayerPoolPoints, from: THREE.Vector3, _source: DamageSource) => {
      if (shooterRole(from) === 'thargon') fromDrones += amount; else fromMothers += amount;
      for (const e of damagePlayer(state, combat, amount, from, scratch)) {
        if (e.kind === 'died' && diedAt === null) diedAt = elapsed;
      }
    },
    destroyNpc: (npc) => { combat.destroy(state.commander, npc); },
    wreckNpc: (npc) => { combat.wreck(npc); },
    // The real gun, at its own heat and energy: `Combat.fire` refuses a shot
    // the bank cannot pay for, and a laser kill is despawned inside it.
    fireLaser: () => { firePlayerLaser(state, combat, scratch); },
    raiseLegal: () => {},
    die: (reason) => { if (diedAt === null) diedAt = elapsed; void reason; },
    dock: () => {},
    completeHyperspace: () => {},
    completeRescue: () => {},
    openHermitTrade: () => {},
    autoSave: () => {},
  };
  const step = new WorldStep(state, ordnance, host);
  const coPilot = new ScriptedCoPilot();

  const live = (role: string): number =>
    state.world.npcs.filter((n) => n.state.alive && n.role === role && !n.state.inert).length;
  let mothers = live('thargoid');
  let drones = 0;
  let mothersKilled = 0;
  let dronesKilled = 0;
  let peakDrones = 0;
  const frames = Math.round(seconds / FIXED_DT);
  for (let i = 0; i < frames && diedAt === null; i++) {
    const auto = coPilot.step(FIXED_DT, state.player, state.world.npcs,
      state.commander.legalStatus, false, ordnance.hostileMissilePos, Infinity);
    const demand = auto.kind === 'fly' ? auto.demand : COAST;
    step.step(FIXED_DT, elapsed, { demand, handsOn: false });
    elapsed += FIXED_DT;
    // Kills, read off the sky rather than off an event: a laser kill is
    // despawned inside `Combat.fire`, and a drone that goes inert with its
    // mother is not a kill.
    const m = live('thargoid');
    if (m < mothers) mothersKilled += mothers - m;
    mothers = m;
    const d = state.world.npcs.filter((n) => n.state.alive && n.role === 'thargon').length;
    if (d < drones && m > 0) dronesKilled += drones - d;
    drones = d;
    peakDrones = Math.max(peakDrones, live('thargon'));
  }
  return {
    seed, diedAt, poolsLeft: poolsLeft(state.sys), mothersAtStart, mothersKilled,
    dronesKilled, peakDrones, fromDrones, fromMothers,
  };
}

export interface AmbushRow {
  episodes: number;
  seconds: number;
  survived: number;
  deathMedian: number | null;
  deathP10: number | null;
  poolsLeft: number;
  mothersKilled: number;
  dronesKilled: number;
  peakDronesMean: number;
  peakDronesMax: number;
  droneShare: number;
}

export function measureAmbush(episodes: number, seconds: number): AmbushRow {
  const runs: AmbushEpisode[] = [];
  for (let e = 0; e < episodes; e++) runs.push(flyAmbush(AMBUSH_PROBE_BASE + e * 7919, seconds));
  const deaths = runs.filter((r) => r.diedAt !== null).map((r) => r.diedAt as number);
  const taken = runs.reduce((a, r) => a + r.fromDrones + r.fromMothers, 0);
  return {
    episodes,
    seconds,
    survived: runs.filter((r) => r.diedAt === null).length / episodes,
    deathMedian: quantile(deaths, 0.5),
    deathP10: quantile(deaths, 0.1),
    poolsLeft: mean(runs.map((r) => r.poolsLeft)) ?? 0,
    mothersKilled: mean(runs.map((r) => r.mothersKilled)) ?? 0,
    dronesKilled: mean(runs.map((r) => r.dronesKilled)) ?? 0,
    peakDronesMean: mean(runs.map((r) => r.peakDrones)) ?? 0,
    peakDronesMax: Math.max(...runs.map((r) => r.peakDrones)),
    droneShare: taken > 0 ? runs.reduce((a, r) => a + r.fromDrones, 0) / taken : 0,
  };
}

const isMain = process.argv[1]?.endsWith('ambush-probe.ts') ?? false;
if (isMain) {
  const episodes = Number(process.argv[2] ?? 40);
  const seconds = Number(process.argv[3] ?? 120);
  const r = measureAmbush(episodes, seconds);
  const s = (v: number | null, d = 1): string => (v === null ? '—' : v.toFixed(d));
  console.log(`ambush-probe: ${episodes} episodes x ${seconds}s · `
    + `MAX_THARGONS ${MAX_THARGONS} · THARGON_REDEPLOY ${THARGON_REDEPLOY}s`);
  console.log('| survived | death median | death p10 | pools left | mothers | drones | peak drones (mean/max) | drone share |');
  console.log('| --- | --- | --- | --- | --- | --- | --- | --- |');
  console.log(`| ${(r.survived * 100).toFixed(0)}% | ${s(r.deathMedian)}s | ${s(r.deathP10)}s `
    + `| ${(r.poolsLeft * 100).toFixed(0)}% | ${s(r.mothersKilled, 2)} | ${s(r.dronesKilled, 2)} `
    + `| ${s(r.peakDronesMean)} / ${r.peakDronesMax} | ${(r.droneShare * 100).toFixed(0)}% |`);
}
