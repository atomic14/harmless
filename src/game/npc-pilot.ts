// How a ship is flown while it fights: the contract every pilot answers.
//
// ONE RESPONSIBILITY: the seam between `game/npc.ts` and the pilot it holds.
// Nothing here flies anything. It declares the view of a ship a pilot is given,
// and nothing more.
//
// A PILOT IS THE PROJECT'S OWN WORD. `game/brain-names.ts` opens *"Which named
// pilot flies"*, and `game/brains.ts` says *"All pilots are code"*. The domain
// named this object long before the code had one (docs/TODO/183).
//
// A BEHAVIOUR SAYS WHAT A SHIP DOES, AND A PILOT SAYS HOW IT FLIES. A pirate's
// behaviour decides that the commander is worth attacking. Its pilot then flies
// the attack. `game/npc-behaviour.ts` holds the first. The two are separate
// because one role can fly more than one pilot. An armed trader turns and
// fights with the attack run, and the same run is what a `scripted` pirate
// flies.
//
// WHY THE CONTEXT IS WIDER THAN `BehaviourShip`. A behaviour that tumbles a
// rock asks for five members. A pilot steers, throttles, advances and pulls a
// trigger, so it asks for the flight stats, the transform and the primitives.
// Measured in docs/TODO/183, the three pilots together want thirteen. That is
// one interface for 286 lines. A free FUNCTION per model wants eighteen
// handles, which is docs/TODO/169 M3's 69-call seam. That seam is why it
// refused a cut that was never the right shape.
//
// A PILOT'S OWN FILE IMPORTS `FireEvent` FROM `npc.ts`, TYPE-ONLY, AND THAT IS
// A CYCLE ON PAPER ALONE. `FireEvent` carries `{ at: NpcShip }`, so neither it
// nor the class can leave (docs/TODO/181). TypeScript erases the import, so at
// runtime `npc.ts` imports a pilot and a pilot imports nothing back.
// `game/npc-behaviour.ts` took the same decision for the same reason.
//
// WHAT THIS MEANS FOR THE GATE. "It names no ship class" is the claim
// docs/TODO/169 M2 held for a fleet RULE. It is the WRONG claim here, because a
// pilot needs the whole ship. That is Chris's point of 2026-08-17. The claim
// that holds is narrower and truer. The ship a pilot FLIES is a `PilotShip`,
// and every import from `npc.ts` is `import type`.

import type * as THREE from 'three';

import type { NpcRole } from './ship-roles.ts';
import type { TacticHull } from './tactic-choice.ts';
import type { NpcState } from './npc-state.ts';
import type { NpcShip } from './npc.ts';

/**
 * The part of a ship a pilot may touch.
 *
 * IT GROWS ONLY WHEN A PILOT NEEDS IT, and each milestone says what it added.
 * docs/TODO/183 M1 starts it at what the trained brain asks for.
 *
 * `NpcShip` satisfies this structurally, as it satisfies `BehaviourShip`,
 * `TraderShip` and `HostileShip` already. So a pilot never names the class.
 */
export interface PilotShip {
  readonly object: THREE.Object3D;
  readonly role: NpcRole;
  /** Top speed for this hull, units per second. */
  readonly maxSpeed: number;
  /** Turn rate for this hull, radians per second. */
  readonly turnRate: number;
  /** Thrust, units per second squared. */
  readonly accel: number;
  /**
   * The slowest a fighter may fly. A ship that can stop dead is a turret, and
   * `MIN_CRUISE_FRACTION` is why.
   */
  readonly speedFloor: number;
  /** How much of its energy bank is left, 0..1. */
  readonly healthFraction: number;
  /** What `constants/tactics.ts` needs to know about this hull. */
  readonly tacticHull: TacticHull;
  /**
   * The ship this one is hunting, if any.
   *
   * ADDED BY docs/TODO/183 M2, and the reason is exact. `matePositions` keeps
   * a ship out of its WINGMEN's way and leaves its target alone, and the
   * target it reads is this field. That is NOT the same as the `npcTarget`
   * argument `attack` and `pursue` take. A fleeing armed trader is handed the
   * attacker it turned on while this field is still null.
   *
   * IT NAMES THE CLASS, AND IT IS THE ONE MEMBER HERE THAT DOES. A pilot that
   * shoots at this ship reports it in a `FireEvent`, and that event carries the
   * real thing downstream to `fire-resolution.ts`. The import is type-only, so
   * the file still holds no runtime dependency on `game/npc.ts`.
   */
  npcTarget: NpcShip | null;
  readonly state: NpcState;
  /** Angle in radians between this ship's nose and a point. */
  facing(point: THREE.Vector3): number;
  /** Turn toward a point, at no more than this hull's turn rate. */
  steerToward(point: THREE.Vector3, dt: number): void;
  /** Move along the nose at the current speed. */
  advance(dt: number): void;
}

/**
 * WHY THERE IS NO `Pilot` INTERFACE, MEASURED WITH ALL THREE IN VIEW.
 *
 * docs/TODO/183 M1 deferred this rather than invent a shape from one pilot. M2
 * brought the other two out, and the answer is that the three do not share one.
 *
 * | pilot | what it takes |
 * | --- | --- |
 * | `brainFly` | ship, brain, dt, pos, quat, speed, dist, fireAt, fleet, threats |
 * | `attack` | ship, dt, pos, dist, isPlayer, npcTarget, fleet, targetVel |
 * | `PursuitPilot.fly` | ship, dt, a `PlayerRef`, dist, fleet |
 *
 * `attack` and `pursue` nearly match, and `brainFly` does not. A common
 * `fly(ship, dt, target)` needs one target OBJECT. That object holds the union
 * of a position, an attitude, a speed, a velocity, a distance, a brain and a
 * threats view. The step allocates nothing per frame, so the object is reused
 * scratch. Every pilot then reads fields that mean nothing to it.
 *
 * **THE CONTEXT IS THE SEAM, AND NOT A COMMON METHOD.** `PilotShip` above is
 * what Chris's point of 2026-08-17 asked for: a collaborator that HAS the ship
 * rather than eighteen handles. That is also the house pattern —
 * `game/hostility.ts` and `game/trader-flight.ts` are free functions over a
 * narrow context, and neither declares an interface over itself.
 *
 * ONE OF THE THREE IS AN OBJECT ANYWAY, and for a reason that has nothing to do
 * with polymorphism. `PursuitPilot` holds two transient fields that are not in
 * `NpcState`. The attack run holds none, so it stays free functions.
 */
