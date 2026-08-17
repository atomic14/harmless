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
  readonly state: NpcState;
  /** Angle in radians between this ship's nose and a point. */
  facing(point: THREE.Vector3): number;
  /** Turn toward a point, at no more than this hull's turn rate. */
  steerToward(point: THREE.Vector3, dt: number): void;
  /** Move along the nose at the current speed. */
  advance(dt: number): void;
}

/**
 * WHERE THE `Pilot` INTERFACE IS.
 *
 * It is not here yet, and docs/TODO/183 M1 says why rather than inventing one.
 * The three pilots do not share a signature today. `brainFly` takes nine
 * arguments — a brain, a target's position, attitude, speed and distance, what
 * to shoot at, a fleet and a threats view. `attack` takes seven, and a
 * different seven.
 *
 * A common `fly(ship, dt, target)` needs one target OBJECT, and the step
 * allocates nothing per frame (`game/npc.ts`). So the shape has to be a reused
 * scratch. That is a decision worth taking with all three signatures in view,
 * rather than with one.
 *
 * M2 brings the other two out and declares the interface then. Until it does,
 * `PilotShip` above is the whole contract. It is also the half that matters: a
 * pilot flies a narrow view of a ship rather than the class.
 */
