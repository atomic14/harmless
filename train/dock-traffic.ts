// Does the docking computer fly you into anybody? — the same approaches, in a
// sky that is not empty.
//
//   npm run dock-traffic
//
// WHY THIS EXISTS SEPARATELY. `train/dock-probe.ts` calls `world.clearNpcs()`
// every frame, deliberately, so that it measures the autopilot and not a
// dogfight. That is the right call for what it measures — and it means every
// "320/320 docked" this project has quoted, docs/TODO/126's and docs/TODO/134's
// alike, was flown in an empty sky. Nothing had ever measured the approach
// through traffic, so "the autopilot never crashes into anything" was not a
// finding, it was an absence (docs/TODO/135, asked by Chris: "we could easily
// crash into things").
//
// The traffic is real and it is in the way by construction: traders run the
// SAME `planDocking` corridor into the same slot (game/trader-flight.ts), so
// the lane the player is flown down is the lane they queue in, and station
// defence launches into it. Nothing here spawns anything by hand. The world
// populates itself exactly as it does in a session, which is the point.
//
// WHAT IT SCORES. Rams are the question; a ram is `IMPACT.ram` to both parties
// and a COLLISION on the console. Laser hits are counted apart from them,
// because being shot at while docking is a different game problem from being
// steered into a hull, and lumping them would let a pirate's aim look like an
// autopilot defect.
//
// THE SKY HAS TO BE LET IN FIRST, and finding that out was half of this file.
// A freshly built world is EMPTY: traders arrive on a ~50-160s timer
// (`TRADER_GAP` and its jitter) from `TRADER_ARRIVAL_RANGE`, 22,000 units out,
// and then have to fly all the way in. An approach takes fifteen seconds, so a
// probe that builds a world and engages the docking computer measures an empty
// sky no matter how carefully it avoids clearing it — the first version of this
// file did exactly that and reported 0 ships, which is a fact about the fixture
// and not about the game. So the world is PRE-ROLLED with the ship parked and
// the autopilot off, until the lane has the traffic a real session would have,
// and only then is the approach flown. The grid is smaller than dock-probe's to
// pay for it; the question here is collisions, not coverage of the geometry.
//
// Two seed sets, because a populated sky is a sampled one and a single set
// cannot tell a trend from a spawn (CLAUDE.md: check at two sample sizes).

import * as THREE from 'three';

import { freshState } from '../src/game/state.ts';
import { newCommander } from '../src/game/commander.ts';
import { WorldStep, type StepHost } from '../src/game/world-step.ts';
import { Ordnance } from '../src/game/ordnance.ts';
import { seedWorld } from '../src/game/rng.ts';
import type { DamageSource } from '../src/game/combat.ts';

const COAST = { rollRate: 0, pitchRate: 0, throttle: 0, fire: false };
const PATIENCE_SECONDS = 120;

/**
 * How long the world runs before the approach starts. Long enough for the
 * trader lane to fill and for arrivals to have flown 22,000 units in: at
 * `TRADER_GAP` (100s, less up to 50 for a busy economy, plus up to 60 of
 * jitter) and `MAX_TRADERS` of 4, five minutes puts the station's own traffic
 * where a player would find it.
 */
const PRE_ROLL_SECONDS = 300;

interface Run {
  docked: boolean;
  died: boolean;
  seconds: number;
  /** flown into somebody: the number this probe exists for */
  rams: number;
  /** the station's own hull box, which `dock-probe` also sees */
  scrapes: number;
  /** shot at while docking — a different problem, counted apart */
  shots: number;
  /** how many ships were sharing the sky at the closest moment */
  crowd: number;
  /** ...and how many were within the approach's own airspace when it began */
  nearbyAtEngage: number;
  /** nearest another ship came, in world units */
  nearest: number;
  /**
   * ...and how many of those collisions KILLED the other ship. This is the
   * number that decides whether a ram is cosmetic: `destroyNpc` runs
   * `Combat.destroy`, which pushes an `offence` for the victim's role, so a
   * docking computer that rams a trader to death files a criminal record
   * against the commander for a manoeuvre the commander did not fly.
   */
  ramKills: number;
}

function approach(seed: number, offAxis: THREE.Vector3, out: number, spin: number): Run {
  seedWorld(seed);
  const state = freshState(newCommander());
  state.world.build(state.systems[state.commander.systemIndex]);
  let docked = false;
  let died = false;
  let rams = 0;
  let scrapes = 0;
  let shots = 0;
  let ramKills = 0;
  let approaching = false;
  const host: StepHost = {
    inFlight: () => !docked && !died,
    applyPlayerDamage: (_amount: number, _from: THREE.Vector3, source: DamageSource) => {
      if (source === 'ram') rams += 1;
      else if (source === 'station') scrapes += 1;
      else shots += 1;
    },
    destroyNpc: () => { if (approaching) ramKills += 1; },
    wreckNpc: () => {}, fireLaser: () => {},
    raiseLegal: () => {}, die: () => { died = true; }, dock: () => { docked = true; },
    completeHyperspace: () => {}, completeRescue: () => {},
    openHermitTrade: () => {}, autoSave: () => {},
  };
  const step = new WorldStep(state, new Ordnance(state.world), host);

  const station = state.world.station;
  station.rotateZ(spin);
  station.updateMatrixWorld(true);
  const normal = new THREE.Vector3(0, 0, -1).applyQuaternion(station.quaternion);
  state.player.position.copy(station.position).addScaledVector(normal, out).add(offAxis);
  state.player.quaternion.identity();
  state.player.speed = 0;

  // Let the lane fill, with the autopilot off and the ship parked: the traffic
  // has to be the world's, not something this file put there.
  const dt = 1 / 60;
  let preFrames = 0;
  for (; preFrames < PRE_ROLL_SECONDS * 60; preFrames++) {
    step.step(dt, preFrames * dt, { demand: COAST, handsOn: false });
    state.player.speed = 0;
    if (died) break;
  }
  const nearbyAtEngage = state.world.npcs.filter((n) => n.state.alive
    && n.object.position.distanceTo(station.position) < 4_000).length;

  state.player.position.copy(station.position).addScaledVector(normal, out).add(offAxis);
  state.player.quaternion.identity();
  state.player.speed = 0;
  state.session.dcEngaged = true;
  approaching = true;

  let frames = 0;
  let crowd = 0;
  let nearest = Infinity;
  for (; frames < PATIENCE_SECONDS * 60 && !docked && !died; frames++) {
    // NOTHING is cleared. That one missing line is the whole difference from
    // dock-probe, and the reason this file exists.
    step.step(dt, frames * dt, { demand: COAST, handsOn: false });
    crowd = Math.max(crowd, state.world.npcs.length);
    for (const npc of state.world.npcs) {
      if (!npc.state.alive) continue;
      nearest = Math.min(nearest, npc.object.position.distanceTo(state.player.position));
    }
  }
  return {
    docked, died, seconds: frames / 60, rams, scrapes, shots, crowd, nearbyAtEngage,
    ramKills, nearest: nearest === Infinity ? -1 : nearest,
  };
}

const OFFSETS: [string, THREE.Vector3][] = [
  ['on-axis', new THREE.Vector3(0, 0, 0)],
  ['right  ', new THREE.Vector3(1, 0, 0)],
  ['left   ', new THREE.Vector3(-1, 0, 0)],
  ['above  ', new THREE.Vector3(0, 1, 0)],
  ['below  ', new THREE.Vector3(0, -1, 0)],
];

const cases = OFFSETS.flatMap(([name, dir]) =>
  [400, 1_500].flatMap((off) =>
    [900, 2_000].flatMap((out) =>
      [0, 0.9].map((spin) => ({
        label: `${name} ${String(off).padStart(4)} off · ${out} out · spin ${spin}`,
        offAxis: dir.clone().multiplyScalar(off),
        out,
        spin,
      })))));

/** One seed set, reported on its own so the two can be compared. */
function sweep(base: number, name: string): void {
  let docked = 0;
  let died = 0;
  let rams = 0;
  let scrapes = 0;
  let shots = 0;
  let ramRuns = 0;
  let kills = 0;
  let crowded = 0;
  let nearbyTotal = 0;
  const times: number[] = [];
  const nears: number[] = [];
  for (const [i, c] of cases.entries()) {
    const r = approach(base + i, c.offAxis, c.out, c.spin);
    if (r.docked) { docked += 1; times.push(r.seconds); }
    if (r.died) died += 1;
    rams += r.rams; scrapes += r.scrapes; shots += r.shots; kills += r.ramKills;
    if (r.rams > 0) ramRuns += 1;
    crowded = Math.max(crowded, r.crowd);
    nearbyTotal += r.nearbyAtEngage;
    if (r.nearest >= 0) nears.push(r.nearest);
    if (r.rams > 0 || r.died) {
      console.log(`${r.died ? 'DIED  ' : 'RAMMED'} ${r.seconds.toFixed(1).padStart(6)}s`
        + ` · ${r.rams} ram(s) · ${r.shots} shot(s) · ${c.label}`);
    }
  }
  times.sort((a, b) => a - b);
  nears.sort((a, b) => a - b);
  console.log(`\n${name}: ${docked}/${cases.length} docked · ${died} died · median ${
    times.length ? times[times.length >> 1].toFixed(1) : '—'}s`);
  console.log(`  ${rams} ram(s) over ${ramRuns} approach(es) · ${kills} of them fatal`
    + ` · ${scrapes} station scrape(s) · ${shots} laser hit(s)`);
  console.log(`  closest pass: median ${nears.length ? nears[nears.length >> 1].toFixed(0) : '—'}`
    + ` · nearest ${nears.length ? nears[0].toFixed(0) : '—'} units`
    + ` · busiest sky ${crowded} ships`);
  console.log(`  the lane at engage: ${(nearbyTotal / cases.length).toFixed(2)}`
    + ` ship(s) within 4,000 units of the station, averaged over the sweep`);
}

sweep(90_100, 'seed set A');
sweep(41_700, 'seed set B');
