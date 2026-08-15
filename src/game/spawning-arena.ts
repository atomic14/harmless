// Where AUTHORED opposition goes: the combat-training arena.
//
// `spawning.ts` puts a SYSTEM in the sky — traders on their runs, police, rocks,
// a hermit, the reception waiting for you. This puts an EXERCISE there instead,
// and an exercise wants none of that. What the two share is the idea of a
// scatter: the ring is even, and everything on top of it is a draw from the
// world's seeded stream, so the same seed gives the same sky.
//
// The two split on 2026-08-15, when `spawning.ts` crossed the size ceiling
// (docs/TODO/159). The seam was already in that file's own header: a system and
// an arena are the same job with different plans, and they answer to different
// numbers — `constants/spawn-placement.ts` for traffic, and
// `constants/opposition-ring.ts` for a ring sized by what a pilot can SEE.
//
// WHERE an exercise happens is `combat-sim-opening.ts`, and WHICH fight it is
// stays with the scenario table. Nothing here decides anything.

import * as THREE from 'three';
import type { World } from './world.ts';
import { steerQuatToward, type NpcShip } from './npc.ts';
import { pirateSpecForTier, SPECS, type NpcSpec } from './ship-specs.ts';
import type { NpcRole } from './ship-roles.ts';
import { random, randomInt, randomDirection } from './rng.ts';
import { ringBasis } from './spawning.ts';
import {
  OPPOSITION_CONE, OPPOSITION_CONE_NEAR, OPPOSITION_CONE_SPAN, OPPOSITION_RANGE,
  OPPOSITION_RANGE_MAX, OPPOSITION_RING_NEAR, OPPOSITION_RING_SPAN,
} from '../constants/opposition-ring.ts';

const _axis = new THREE.Vector3();
const _u = new THREE.Vector3();
const _v = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _face = new THREE.Vector3();

/**
 * Which policy an opponent flies, in the only terms placement can express.
 *
 * `pirateBrainFor` (brains.ts) reads the threat tier and the `organised` flag,
 * and that flag is the one per-ship lever there is — CLAUDE.md's Training split.
 * Choosing a *named* brain per ship is a global A/B flag today, set around the
 * exercise; there is no field on `NpcState` for it.
 */
export type OppositionBrain =
  /** whatever the galaxy would give this role and tier */
  | 'auto'
  /** the pack policy — what an organised gang flies */
  | 'pack'
  /** the solo attack policy, even for a hull that arrived with a gang */
  | 'solo';

/** The fit-out overrides an exercise may hand an opponent. */
export interface OppositionFit {
  /** rack size, overriding the hull's */
  missiles?: number;
  /** carries E.C.M., rather than rolling the hull's `ecmChance` for it */
  ecm?: boolean;
}

/**
 * One line of authored opposition: a role, a hull, and how many of them.
 *
 * The hull can be said three ways because three callers want three of them,
 * and they are tried in this order: an explicit `hull` (what
 * `pirateSpecForTier` and `CONSTRICTOR_SPEC` hand you), a `variant` index into
 * the role's roster in `SPECS` (what a hull picker offers), or a pirate `tier`
 * (which also tells the brain what it is flying with). With none of them the
 * roster picks by seed, exactly as an ordinary spawn does.
 */
export interface OppositionUnit {
  role: NpcRole;
  /** how many, default 1 */
  count?: number;
  hull?: NpcSpec;
  variant?: number;
  /** pirate threat tier — sets `threatTier`, and picks the hull if `hull`/`variant` are absent */
  tier?: number;
  brain?: OppositionBrain;
  fit?: OppositionFit;
  /**
   * Treat the player as an enemy from the first frame.
   *
   * Pirates and Thargoids need nothing; police and bounty hunters attack a
   * clean commander only if provoked (`isHostileToPlayer`), so an authored
   * interdiction has to say that it was. It is the SCENARIO's claim, not ours.
   */
  hostile?: boolean;
}

/** How the ring is laid out. Everything optional; the defaults are a fair start. */
export interface OppositionPlacement {
  /** ring radius from the origin, in units */
  range?: number;
  /**
   * The cone's AXIS — where the player is looking. Given, the ring is a cone
   * around it so everything starts in front of you; omitted, it is a great
   * circle and they come from everywhere.
   *
   * It is an axis and not a promise about the canopy: hand it the nose
   * reversed and the cone is behind you, which is how an ambush asks.
   */
  facing?: THREE.Vector3;
  /**
   * Half-angle of that cone, in radians — ignored without a `facing`.
   *
   * The scatter spreads WITHIN it rather than on it: a ship lands between
   * `OPPOSITION_CONE_NEAR` and `OPPOSITION_CONE_FAR` of this off the axis, so
   * the widest one is `OPPOSITION_CONE_FAR` times what was asked for. A caller
   * that needs every ship inside an arc — a trainer, whose whole point is that
   * the pilot can see them — sizes it against that product.
   * combat-sim-opening.ts owns that argument.
   */
  cone?: number;
}

/** The hull for one opponent — see OppositionUnit for why there are three ways. */
function oppositionSpec(unit: OppositionUnit, seed: number): NpcSpec | undefined {
  if (unit.hull) return unit.hull;
  if (unit.variant !== undefined && unit.role !== 'asteroid') {
    const roster = SPECS[unit.role];
    return roster[Math.abs(Math.trunc(unit.variant)) % roster.length];
  }
  if (unit.tier !== undefined && unit.role === 'pirate') {
    return pirateSpecForTier(unit.tier, seed);
  }
  return undefined;
}

/**
 * Put authored opposition in the sky around `origin`, facing it.
 *
 * Deliberately NOT `spawnPopulation`: that builds a *system* — traders going
 * about their business, police, rocks, a hermit, maybe a generation ship — and
 * an arena wants none of it. What it shares is the idea of `scatter()`: the
 * ring is even, and everything on top of it is a draw from the world's seeded
 * stream, so the same seed gives the same sky.
 *
 * Returns the ships in the order asked for, which is the order a report will
 * want to list them in.
 */
export function spawnOpposition(
  world: World,
  opposition: readonly OppositionUnit[],
  origin: THREE.Vector3,
  placement: OppositionPlacement = {},
): NpcShip[] {
  const counts = opposition.map((u) => Math.max(1, Math.round(u.count ?? 1)));
  const total = counts.reduce((a, b) => a + b, 0);
  const range = Math.max(1, Math.min(placement.range ?? OPPOSITION_RANGE, OPPOSITION_RANGE_MAX));
  // A cone in front of the commander, or the whole sky.
  const axis = placement.facing
    ? _axis.copy(placement.facing).normalize()
    : randomDirection(_axis);
  const spread = placement.facing ? (placement.cone ?? OPPOSITION_CONE) : Math.PI / 2;
  ringBasis(axis, _u, _v);
  // The ring's rotation, so two exercises with one opponent do not both put it
  // in the same corner of the canopy.
  const phase = random() * Math.PI * 2;
  // Hull variety comes off the stream too — a fixed seed here would mean every
  // gang of Sidewinders was the same gang of Sidewinders.
  const roster = randomInt(1 << 20);

  const ships: NpcShip[] = [];
  let i = 0;
  opposition.forEach((unit, u) => {
    for (let k = 0; k < counts[u]; k++, i++) {
      const seed = roster + i;
      const angle = phase + (i / total) * Math.PI * 2;
      const off = spread * (OPPOSITION_CONE_NEAR + random() * OPPOSITION_CONE_SPAN);
      const dir = _dir.copy(axis).multiplyScalar(Math.cos(off))
        .addScaledVector(_u, Math.cos(angle) * Math.sin(off))
        .addScaledVector(_v, Math.sin(angle) * Math.sin(off));
      const pos = origin.clone().addScaledVector(dir,
        range * (OPPOSITION_RING_NEAR + random() * OPPOSITION_RING_SPAN));

      const npc = world.spawn(unit.role, pos, seed, oppositionSpec(unit, seed));
      // Pointed at you, not at a random corner of space: the constructor gives
      // every ship a random orientation, right for a system and wrong for a
      // duel. `state.quat` IS the mesh's quaternion, so this is the state.
      //
      // steerQuatToward, NOT `object.lookAt(origin)`: lookAt points +Z at its
      // target and a hull's nose is -Z (invariant 7), so lookAt would spawn the
      // gang flying away from you.
      steerQuatToward(npc.object.quaternion, _face.copy(origin).sub(pos), Math.PI);
      if (unit.tier !== undefined) npc.state.threatTier = unit.tier;
      if (unit.brain === 'pack') npc.state.organised = true;
      else if (unit.brain === 'solo') npc.state.organised = false;
      if (unit.hostile) {
        npc.state.provoked = true;
        npc.state.provokedByPlayer = true;
      }
      if (unit.fit?.missiles !== undefined) npc.state.missiles = Math.max(0, unit.fit.missiles);
      // Written through the state on purpose: `hasEcm` has a private setter
      // because in the galaxy it is a die roll against the hull's ecmChance at
      // warp-in, and only an authored exercise gets to say otherwise.
      if (unit.fit?.ecm !== undefined) npc.state.hasEcm = unit.fit.ecm;
      ships.push(npc);
    }
  });
  return ships;
}

