// Turning a population plan into ships in the sky.
//
// population.ts decides WHAT a system holds; this puts it there. The split is
// worth the two files: the plan is pure and unit-tested against the rules that
// make a galaxy feel inhabited, and this half is nothing but placement — where
// a trader sits relative to the station, how a reception scatters along the
// corridor you are about to fly down.
//
// Nothing here decides anything. Give it the same plan twice and you get the
// same sky twice.
//
// The distances are constants/spawn-placement.ts. The combat-training arena is
// the same job with a different plan, and it is `spawning-arena.ts` — a
// separate file since 2026-08-15, because an exercise's ring is sized by what a
// pilot can SEE rather than by where traffic would be. It borrows `ringBasis`
// from here and nothing else.

import * as THREE from 'three';
import type { World } from './world.ts';
import type { PopulationPlan } from './population.ts';
import { steerQuatToward, type NpcShip } from './npc.ts';
import { pirateSpecForTier, CONSTRICTOR_SPEC } from './ship-specs.ts';
import { memberTier } from './threat.ts';
import { slotNormal } from '../world/slot.ts';
import { random, randomInt, randomDirection } from './rng.ts';
import type { StarSystem } from '../galaxy/galaxy.ts';
import { ORDINARY_GOODS } from '../constants/commodities.ts';
import {
  ASTEROID_SCATTER, CORRIDOR_SPAN, CORRIDOR_START, DEEP_TRADER_CONE,
  DEEP_TRADER_RANGE, DEEP_TRADER_RUN, GENERATION_CARGO_SCATTER,
  GENERATION_SHIP_RANGE, GENERATION_SHIP_RANGE_SPAN, HERMIT_SCATTER, HUNTER_SCATTER,
  MISSION_TARGET_RANGE, MISSION_TARGET_RANGE_SPAN, PIRATE_SCATTER, POLICE_PATROL_RANGE,
  POLICE_SCATTER,
  STATION_DEFENCE_JITTER, STATION_DEFENCE_MIN, STATION_DEFENCE_SPAN,
  STATION_DEFENCE_STACK, STATION_DEFENCE_STANDOFF, TRADER_SCATTER,
} from '../constants/spawn-placement.ts';

/** A random offset of up to `range`, biased outward. */
function scatter(range: number): THREE.Vector3 {
  return randomDirection(new THREE.Vector3()).multiplyScalar(range * (0.5 + random()));
}

const _axis = new THREE.Vector3();
const _u = new THREE.Vector3();
const _v = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _face = new THREE.Vector3();

/**
 * Two unit vectors perpendicular to `axis` and to each other.
 *
 * EXPORTED for `spawning-arena.ts`, which lays an exercise's ring with it. It
 * is the one piece of geometry a system and an arena share, and it lives here
 * because this file is the older of the two homes.
 */
export function ringBasis(axis: THREE.Vector3, u: THREE.Vector3, v: THREE.Vector3): void {
  u.set(0, 0, 1).cross(axis);
  if (u.lengthSq() < 1e-6) u.set(1, 0, 0).cross(axis);
  u.normalize();
  v.copy(axis).cross(u).normalize();
}

export interface SpawnResult {
  /** the generation ship, if one crossed — the Game announces it */
  generationShip: NpcShip | null;
  /** the Constrictor, if this is where it was hiding */
  missionTarget: NpcShip | null;
}

/**
 * Build `plan` into `world`.
 *
 * @param playerPos where the commander is — the reception is scattered along
 * the corridor between them and the station, not dumped on top of them.
 */
export function spawnPopulation(
  world: World,
  plan: PopulationPlan,
  sys: StarSystem,
  playerPos: THREE.Vector3,
  missionTargetHere: boolean,
  situation: 'launch' | 'arrival' = 'arrival',
): SpawnResult {
  const home = world.station.position;
  const arriving = situation === 'arrival';

  // The lane the commander flies in on. A point `spread` off it, `CORRIDOR_START`
  // to `CORRIDOR_START + CORRIDOR_SPAN` of the way from the witchpoint to the
  // slot — the same reception geometry the pirates use below. Meaningful only on
  // an arrival; on a launch the commander starts at the slot and there is no lane.
  const toStation = home.clone().sub(playerPos);
  const routeLen = toStation.length();
  const route = routeLen > 1 ? toStation.clone().multiplyScalar(1 / routeLen) : new THREE.Vector3();
  const corridorPos = (spread: number): THREE.Vector3 =>
    playerPos.clone()
      .addScaledVector(route, routeLen * (CORRIDOR_START + random() * CORRIDOR_SPAN))
      .add(scatter(spread));

  for (let i = 0; i < plan.traders; i++) {
    // Half the traders are already trading by the slot; on an arrival the rest
    // are inbound down the corridor, so you meet honest traffic flying in (and a
    // pirate has someone to prey on). The `arriving` phase steers them to the
    // station on its own (npc.ts `updateTrader`).
    if (arriving && i % 2 === 0) {
      const trader = world.spawn('trader', corridorPos(TRADER_SCATTER), i + sys.index);
      trader.state.traderPhase = 'arriving';
    } else {
      world.spawn('trader', home.clone().add(scatter(TRADER_SCATTER)), i + sys.index);
    }
  }
  for (let i = 0; i < plan.police; i++) {
    // On the corridor when arriving — a Viper you may pass and be scanned by —
    // and scattered across the system on a launch, never sitting on the slot.
    const pos = arriving ? corridorPos(POLICE_SCATTER)
      : home.clone().add(scatter(POLICE_PATROL_RANGE));
    world.spawn('police', pos, i);
  }
  for (let i = 0; i < plan.asteroids; i++) {
    world.spawn('asteroid', home.clone().add(scatter(ASTEROID_SCATTER)), sys.seed[0] + i * 37);
  }

  if (plan.threat && plan.pirates > 0) {
    for (let i = 0; i < plan.pirates; i++) {
      const pos = corridorPos(PIRATE_SCATTER);
      // ringleaders first, then the hangers-on they brought
      const seed = i + sys.index * 3;
      const tier = memberTier(plan.threat.tier, i);
      // The tier table is the set's, not the catalogue's: this is the pirate
      // band, and it is the band a system's blueprint set narrows (TODO 138).
      const npc = world.spawn('pirate', pos, seed, pirateSpecForTier(tier, seed, world.roster));
      npc.state.organised = plan.threat.organised;
      npc.state.threatTier = tier;
    }
  }

  if (plan.hunter) {
    world.spawn('hunter', home.clone().add(scatter(HUNTER_SCATTER)), sys.index);
  }
  if (plan.hermit) {
    world.spawn('hermit',
      home.clone().add(scatter(HERMIT_SCATTER).addScaledVector(scatter(1), 2)), sys.index);
  }

  let generationShip: NpcShip | null = null;
  if (plan.generationShip) {
    const pos = playerPos.clone()
      .add(randomDirection(new THREE.Vector3())
        .multiplyScalar(GENERATION_SHIP_RANGE + random() * GENERATION_SHIP_RANGE_SPAN));
    generationShip = world.spawn('generation', pos, 0);
    // steerQuatToward, not lookAt: Object3D.lookAt aims +Z at its target and a
    // hull's nose is -Z (invariant 7), so `lookAt(home)` would point the
    // derelict exactly away from the station.
    steerQuatToward(generationShip.object.quaternion,
      _face.copy(home).sub(generationShip.object.position), Math.PI);
    // still shedding cargo after centuries
    world.cargo.spawn(
      pos.clone().add(randomDirection(new THREE.Vector3())
        .multiplyScalar(GENERATION_CARGO_SCATTER)),
      // the count stays here — a spawn's own draw; what the canisters contain
      // is the career's ordinary-goods class (constants/commodities.ts)
      3 + randomInt(4), ORDINARY_GOODS);
  }

  let missionTarget: NpcShip | null = null;
  if (missionTargetHere) {
    const pos = playerPos.clone()
      .add(randomDirection(new THREE.Vector3())
        .multiplyScalar(MISSION_TARGET_RANGE + random() * MISSION_TARGET_RANGE_SPAN));
    missionTarget = world.spawn('pirate', pos, 0, CONSTRICTOR_SPEC);
    missionTarget.state.isMissionTarget = true;
  }

  return { generationShip, missionTarget };
}

/**
 * A trader warps in AHEAD OF THE COMMANDER, out in deep space, and runs on.
 *
 * The lane the function above builds is anchored to the station, so it holds
 * nothing for a commander 200,000 units out on a sun run. Everything a system
 * holds sits within 22,000 units of the port, and the only spawn anchored to
 * the commander is a pirate wave that half the government ladder refuses. So a
 * long flight met nobody at all (docs/TODO/159, GitHub #31).
 *
 * It is `departing` rather than `arriving`, and the reason is
 * `DEEP_TRADER_RUN`: a ship pointed at the station out here would fly for
 * sixteen minutes and hold one of the four trader slots for all of them.
 *
 * @param forward where the commander is pointed. The cone is about that, so the
 * ship arrives where somebody can see it.
 */
export function spawnPassingTrader(
  world: World, playerPos: THREE.Vector3, forward: THREE.Vector3,
): NpcShip {
  const axis = _axis.copy(forward);
  if (axis.lengthSq() < 1e-6) randomDirection(axis);
  axis.normalize();
  ringBasis(axis, _u, _v);
  // Inside the cone rather than on it, so two arrivals are not the same
  // arrival. `spawnOpposition` spreads the same way, for the same reason.
  const angle = random() * Math.PI * 2;
  const off = random() * DEEP_TRADER_CONE;
  const dir = _dir.copy(axis).multiplyScalar(Math.cos(off))
    .addScaledVector(_u, Math.cos(angle) * Math.sin(off))
    .addScaledVector(_v, Math.sin(angle) * Math.sin(off));
  const pos = playerPos.clone().addScaledVector(dir, DEEP_TRADER_RANGE);

  const trader = world.spawn('trader', pos, randomInt(100));
  trader.state.traderPhase = 'departing';
  // Onward and out of the system: the heading is away from the station, which
  // is the way a ship this far out is already going. `updateTrader` despawns it
  // near the waypoint and the Game plays the flash.
  const away = _face.copy(pos).sub(world.station.position);
  if (away.lengthSq() < 1e-6) randomDirection(away);
  trader.state.waypoint.copy(pos).addScaledVector(away.normalize(), DEEP_TRADER_RUN);
  // the witch-flash that says something just came out of hyperspace
  world.effects.explosion(pos.clone(), 0x9adfff, { count: 10, speed: 120, duration: 0.7 });
  return trader;
}

/** A fresh trader warps in at the system edge and heads for the station. */
export function spawnArrivingTrader(world: World, range: number): void {
  const pos = world.station.position.clone()
    .add(randomDirection(new THREE.Vector3()).multiplyScalar(range));
  const trader = world.spawn('trader', pos, randomInt(100));
  trader.state.traderPhase = 'arriving';
  // the witch-flash that says something just came out of hyperspace
  world.effects.explosion(pos.clone(), 0x9adfff, { count: 10, speed: 120, duration: 0.7 });
}

/**
 * Vipers off the slot, launched because you shot at something you shouldn't.
 *
 * The rule the station enforces: one or two of them, stacked along the slot
 * normal, jittered so a second call does not look like the first, and PROVOKED
 * — launched specifically for you, so unlike ordinary police they are already
 * your business.
 *
 * The stack does NOT guarantee they miss each other: the jitter is larger than
 * the spacing can absorb, and about one pair in a hundred launches with hulls
 * intersecting. See `STATION_DEFENCE_JITTER`.
 *
 * Returns the ships so the caller can say the line and make the noise.
 */
export function launchStationDefence(world: World, tmp: THREE.Vector3): NpcShip[] {
  const station = world.station;
  const slotN = slotNormal(station, tmp);
  const count = STATION_DEFENCE_MIN + randomInt(STATION_DEFENCE_SPAN);
  const out: NpcShip[] = [];
  for (let i = 0; i < count; i++) {
    const pos = station.position.clone()
      .addScaledVector(slotN, STATION_DEFENCE_STANDOFF + i * STATION_DEFENCE_STACK)
      .add(randomDirection(new THREE.Vector3()).multiplyScalar(STATION_DEFENCE_JITTER));
    const viper = world.spawn('police', pos, i);
    viper.state.provoked = true;
    viper.state.provokedByPlayer = true;
    out.push(viper);
  }
  return out;
}
