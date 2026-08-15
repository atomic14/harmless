// Deep space holds somebody now.
//
// GitHub #31 — *"Flying from the space station to the sun — I don't think I
// encountered any NPC ships. We should come across some people."* Measured, the
// report was exact. The sun sits 320,000 units from the system origin and the
// station about 12,000, so the run to the fuel-scoop band is roughly 220,000
// units. Everything a system holds is within 22,000 units of the station, and
// the ONE spawn anchored to the commander is a pirate wave that half the
// government ladder refuses. So the rest of the run was empty by construction.
//
// The fix moves an anchor and nothing else. `stepEncounters` keeps its clock
// and its cap, and says WHERE the trader it already ordered should warp in.
// `spawnPassingTrader` (game/spawning.ts) is the placement.
//
// This file owns three claims, and they fail separately:
//
//   1. the RULE picks the anchor off `playerFarFromStation`, and the clock and
//      the cap do not move;
//   2. the PLACEMENT puts the ship where a commander holding course will see
//      it, every time;
//   3. the ship LEAVES, so the four trader slots are not held by a lane that
//      is 200,000 units from the station.

import * as THREE from 'three';
import { World } from '../src/game/world.ts';
import { seedWorld } from '../src/game/rng.ts';
import { spawnArrivingTrader, spawnPassingTrader } from '../src/game/spawning.ts';
import { freshTimers, stepEncounters } from '../src/game/encounters.ts';
import type { NpcShip } from '../src/game/npc.ts';
import { SHIPPED_BRAINS } from '../src/game/brain-names.ts';
import { generateGalaxy } from '../src/galaxy/galaxy.ts';
import {
  DEEP_TRADER_CONE, DEEP_TRADER_RANGE, DEEP_TRADER_RUN, TRADER_ARRIVAL_RANGE,
} from '../src/constants/spawn-placement.ts';
import { MAX_TRADERS } from '../src/constants/population.ts';
import { SCANNER_RANGE } from '../src/constants/console.ts';
import { MASS_LOCK_SHIP, TORUS_MULTIPLIER } from '../src/constants/torus.ts';
import { PLAYER_FLIGHT } from '../src/constants/player-flight.ts';
import { SUN_SCOOP_RANGE } from '../src/constants/sun.ts';
import { STATION_TRUCE } from '../src/constants/law.ts';
import { check } from './harness.ts';

/** How far out on a sun run the commander is when the sky should still hold somebody. */
const DEEP = 200_000;
/** The torus drive's true speed, which is what makes an encounter brief. */
const CRUISE = PLAYER_FLIGHT.maxSpeed * TORUS_MULTIPLIER;

const conditions = (over: Record<string, unknown> = {}) => ({
  witchspace: false, productivity: 20_000, government: 7, traderCount: 0,
  activeThargons: 0, hasThargoidMother: false, playerFarFromStation: true, ...over,
}) as Parameters<typeof stepEncounters>[2];

/** Run the clock until it orders a trader, and give back that order. */
const firstTrader = (c: Parameters<typeof stepEncounters>[2]) => {
  const timers = freshTimers(() => 0.5);
  for (let i = 0; i < 20_000; i++) {
    for (const order of stepEncounters(timers, 0.1, c, () => 0.5)) {
      if (order.kind === 'trader') return order;
    }
  }
  return null;
};

// --- 1. the rule: the same clock, a different anchor -------------------------

console.log('\ndeep space: which lane the clock feeds');
{
  check('a commander near the station feeds the station lane',
    firstTrader(conditions({ playerFarFromStation: false }))?.at === 'station');
  check('...and a commander out in deep space is fed instead',
    firstTrader(conditions())?.at === 'commander');

  // THE CONTROL, and it is the whole of the design decision: no more traffic
  // than before, and no less. Only the anchor moves.
  const count = (playerFarFromStation: boolean) => {
    const timers = freshTimers(() => 0.5);
    const c = conditions({ playerFarFromStation });
    let n = 0;
    for (let i = 0; i < 6000; i++) {        // 600 seconds at a tenth each
      for (const order of stepEncounters(timers, 0.1, c, () => 0.5)) {
        if (order.kind === 'trader') n += 1;
      }
    }
    return n;
  };
  const near = count(false);
  const far = count(true);
  check('the clock is unchanged by the anchor it chooses',
    near === far && near > 0, `${near} orders near, ${far} far, over 600s`);

  // The cap is the sky's, not the lane's: a deep-space arrival spends one of
  // the same four slots.
  check('a full sky orders no trader at either anchor',
    firstTrader(conditions({ traderCount: MAX_TRADERS })) === null
    && firstTrader(conditions({ traderCount: MAX_TRADERS, playerFarFromStation: false })) === null);
}

// --- 2. the placement: where a commander holding course will see it ----------

console.log('\ndeep space: where the ship warps in');
{
  const sys = generateGalaxy(1)[7];
  const heading = new THREE.Vector3(0, 0, -1);
  let worstOffAxis = 0;
  let worstPass = 0;
  let massLocked = 0;
  let worstStationPass = 0;
  let worstRangeError = 0;
  const SEEDS = 200;

  const rel = new THREE.Vector3();
  for (let s = 0; s < SEEDS; s++) {
    seedWorld(159_000 + s);
    const world = new World();
    world.build(sys);
    world.clearNpcs();
    const player = world.station.position.clone().addScaledVector(heading, -DEEP);

    const trader = spawnPassingTrader(world, player, heading);
    rel.copy(trader.object.position).sub(player);
    worstOffAxis = Math.max(worstOffAxis, rel.angleTo(heading));
    // How near it passes a commander who holds course: the perpendicular from
    // the ship to that line. It is what the scanner will read.
    const pass = rel.length() * Math.sin(rel.angleTo(heading));
    worstPass = Math.max(worstPass, pass);
    if (pass < MASS_LOCK_SHIP) massLocked += 1;
    worstRangeError = Math.max(worstRangeError, Math.abs(rel.length() - DEEP_TRADER_RANGE));

    // THE MEASUREMENT THE ISSUE REPORTS. The same commander, the same course,
    // and the arrival anchored to the station as it was before this item.
    world.clearNpcs();
    spawnArrivingTrader(world, TRADER_ARRIVAL_RANGE);
    const station = world.npcs[0];
    worstStationPass = Math.max(worstStationPass,
      station.object.position.distanceTo(player));
  }

  check(`every one of ${SEEDS} arrivals warps in at the stated range`,
    worstRangeError < 1e-6, `worst error ${worstRangeError.toExponential(1)} units`);
  check('every arrival is inside the cone', worstOffAxis <= DEEP_TRADER_CONE,
    `widest ${worstOffAxis.toFixed(3)} rad of ${DEEP_TRADER_CONE}`);
  check('every arrival passes inside scanner range', worstPass < SCANNER_RANGE,
    `worst pass ${Math.round(worstPass)} of ${SCANNER_RANGE}`);
  // `DEEP_TRADER_CONE` is derived from `MASS_LOCK_SHIP`, so this is the
  // derivation asserted rather than a happy measurement: the meeting is a
  // meeting. The drive lets go, and the commander flies past a ship.
  check(`every one of ${SEEDS} passes drops the torus drive`,
    massLocked === SEEDS, `${massLocked} of ${SEEDS}`);
  // ...and the control, which is what the sky did before.
  check('a station-anchored arrival is nowhere near a commander out here',
    worstStationPass > SCANNER_RANGE,
    `nearest a station arrival ever came: ${Math.round(worstStationPass)}`);
}

// --- 3. the ship leaves ------------------------------------------------------

console.log('\ndeep space: the ship leaves');
{
  const sys = generateGalaxy(1)[7];
  const heading = new THREE.Vector3(0, 0, -1);
  seedWorld(159_777);
  const world = new World();
  world.build(sys);
  world.clearNpcs();
  const player = world.station.position.clone().addScaledVector(heading, -DEEP);
  const trader = spawnPassingTrader(world, player, heading);
  const from = trader.object.position.clone();

  check('a deep-space trader is on its way OUT', trader.state.traderPhase === 'departing');
  check('...and its waypoint is the stated run',
    Math.abs(trader.state.waypoint.distanceTo(from) - DEEP_TRADER_RUN) < 1e-6);
  check('...which is further from the station than it is',
    trader.state.waypoint.distanceTo(world.station.position)
    > from.distanceTo(world.station.position));

  const view = {
    station: world.station, dockZ: world.stationDockZ, fleet: world.npcs,
    playerLegal: 0, brains: SHIPPED_BRAINS, missileInbound: false,
    playerToStation: DEEP, sunPos: world.sunPos,
  };
  const still = { position: player, quaternion: new THREE.Quaternion(), speed: 0 } as never;
  let frames = 0;
  while (!trader.state.wantsDespawn && frames < 60 * 600) {
    trader.update(1 / 60, still, view);
    frames += 1;
  }
  check('it jumps out rather than crossing the system',
    trader.state.wantsDespawn, `after ${(frames / 60).toFixed(0)}s`);
  check('...and it never came near the station',
    trader.object.position.distanceTo(world.station.position) > TRADER_ARRIVAL_RANGE);
}

// --- 4. the run itself, at two sample sizes ----------------------------------
//
// The claim the issue makes is about a JOURNEY, so this flies one: out from the
// station toward the sun, at the torus drive's own speed, until the scoop band.
// It is a sampled number that drives a decision, so `CLAUDE.md` asks for two
// sample sizes.

console.log('\ndeep space: a sun run meets somebody');
{
  const sys = generateGalaxy(1)[7];

  /** One run: how many ships came inside scanner range on the way to the sun. */
  const run = (seed: number): number => {
    seedWorld(seed);
    const world = new World();
    world.build(sys);
    world.clearNpcs();
    const heading = world.sunPos.clone().sub(world.station.position).normalize();
    const player = world.station.position.clone();
    const timers = freshTimers();
    const seen = new Set<NpcShip>();
    const view = {
      station: world.station, dockZ: world.stationDockZ, fleet: world.npcs,
      playerLegal: 0, brains: SHIPPED_BRAINS, missileInbound: false,
      sunPos: world.sunPos,
    };
    const still = { position: player, quaternion: new THREE.Quaternion(), speed: 0 } as never;
    const dt = 1 / 60;
    while (player.distanceTo(world.sunPos) > SUN_SCOOP_RANGE) {
      player.addScaledVector(heading, CRUISE * dt);
      const toStation = player.distanceTo(world.station.position);
      for (const order of stepEncounters(timers, dt, {
        witchspace: false, productivity: sys.productivity, government: sys.government,
        traderCount: world.npcs.filter((n) => n.role === 'trader').length,
        activeThargons: 0, hasThargoidMother: false,
        playerFarFromStation: toStation > STATION_TRUCE,
      })) {
        if (order.kind === 'trader' && order.at === 'commander') {
          spawnPassingTrader(world, player, heading);
        } else if (order.kind === 'trader') {
          spawnArrivingTrader(world, TRADER_ARRIVAL_RANGE);
        }
      }
      for (const npc of [...world.npcs]) {
        npc.update(dt, still, { ...view, fleet: world.npcs, playerToStation: toStation });
        if (npc.state.wantsDespawn) { world.despawn(npc); continue; }
        if (npc.object.position.distanceTo(player) < SCANNER_RANGE) seen.add(npc);
      }
    }
    return seen.size;
  };

  const sample = (n: number) => {
    const counts = Array.from({ length: n }, (_, i) => run(159_100 + i));
    return {
      met: counts.filter((c) => c > 0).length,
      most: Math.max(...counts),
      total: counts.reduce((a, b) => a + b, 0),
    };
  };

  const small = sample(20);
  check(`every sun run meets somebody (${small.met} of 20, ${small.total} ships in all)`,
    small.met === 20);
  check(`...and it stays a quiet run (most in one flight: ${small.most})`,
    small.most <= MAX_TRADERS);

  // The second sample size. The share must not move with n.
  const large = sample(60);
  check(`...and the same at 60 runs (${large.met} of 60, ${large.total} ships in all)`,
    large.met === 60);
  check(`...still quiet at 60 (most in one flight: ${large.most})`,
    large.most <= MAX_TRADERS);
}
