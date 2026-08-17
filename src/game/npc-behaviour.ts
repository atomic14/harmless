// What a ship of this kind does with one frame.
//
// ONE RESPONSIBILITY: the contract between `game/npc.ts` and the behaviour it
// holds. Nothing here decides anything. It declares the method a behaviour
// answers, and the narrow view of a ship that every behaviour shares.
//
// WHY AN OBJECT RATHER THAN A FUNCTION, and it is docs/TODO/182's whole point.
// `game/hostility.ts` and `game/trader-flight.ts` are free functions over a
// narrow structural interface, and both work. A fleet RULE needs a role and
// four flags. A trader's working life needs four handles.
//
// The flight models are not like that. Measured, they reach the ship 129 times
// over 27 members, and a free function would need about eighteen handles.
// docs/TODO/169 M3 measured that seam at 69 calls and refused the cut, and it
// was right to. A collaborator that simply HAS the ship needs one handle
// instead, and that is what a behaviour is.
//
// A BEHAVIOUR IS PER SHIP, NOT SHARED. `NpcShip` builds one in its constructor
// and holds it for the ship's life. So a behaviour may keep transient state of
// its own — a hermit's beacon clock is the first — without a field on
// `NpcState`. It costs one allocation per SPAWN, and none per frame, which is
// the rule `game/npc.ts`'s header states.
//
// IT IS DERIVED FROM `role`, WHICH IS SAVED. So a restored ship rebuilds the
// same behaviour through the same constructor, and nothing new enters the
// snapshot.
//
// THE `FireEvent` IMPORT IS TYPE-ONLY AND IT IS A CYCLE ON PAPER. `FireEvent`
// carries `{ at: NpcShip }`, so it cannot leave `game/npc.ts` without taking
// the class with it (docs/TODO/181). TypeScript erases the import, so there is
// no cycle at runtime: `npc.ts` imports a behaviour, and a behaviour imports
// nothing back. A behaviour's contract genuinely names the ship's own event,
// which is the difference from the type docs/TODO/181 refused to move.

import type * as THREE from 'three';

import type { PlayerRef } from './npc-state.ts';
import type { PilotShip } from './npc-pilot.ts';
import type { FireEvent, NpcShip, WorldView } from './npc.ts';

/**
 * The part of a ship a behaviour may touch.
 *
 * IT EXTENDS `PilotShip`, AND docs/TODO/184 M1 IS WHY. A fighting behaviour
 * decides that the commander is worth attacking, and then hands the ship to a
 * pilot to fly. So every ship a behaviour drives is also a ship a pilot can
 * fly, and saying that once beats every fighting behaviour taking two types.
 *
 * WHAT IT ADDS is what a fight needs beyond flying. That is whether the hull
 * is armed, who is hunting it, what leaves the rail, and the pursuit entry.
 * Five members over `PilotShip`'s thirteen.
 *
 * The roles that never fight use none of the five. They pay for the type and
 * not for the work, and `game/npc-idle.ts` is four behaviours that touch five
 * members between them.
 *
 * `NpcShip` satisfies this structurally, exactly as it satisfies `TraderShip`
 * and `HostileShip`. So no behaviour imports the class.
 */
export interface BehaviourShip extends PilotShip {
  /** Whether this hull carries a gun. Only a trader's roster row sets it. */
  readonly armed: boolean;

  /** The ships hunting THIS one. Only pirates register (see `addAttacker`). */
  readonly attackers: readonly BehaviourShip[];

  /** The nearest ship hunting this one, and it prunes the dead as it looks. */
  nearestAttacker(dt: number): NpcShip | null;

  /**
   * What leaves the rail, once a pilot decides to shoot.
   *
   * ON THE SHIP RATHER THAN IN A PILOT, and docs/TODO/183 M3 measured why.
   * Either flight hands its shot to one place, so that place is the ship
   * arbitrating between its own pilots.
   */
  chooseWeapon(
    shot: FireEvent | null, dist: number, targetPos: THREE.Vector3,
    missileInbound: boolean,
  ): FireEvent | null;

  /** Fly one frame of the pursuit dogfighter. See `game/npc-pursuit.ts`. */
  pursuitFly(
    dt: number, target: PlayerRef, dist: number, fleet: readonly PilotShip[],
  ): FireEvent | null;
}

/**
 * One frame of what a ship of this kind does.
 *
 * It returns a `FireEvent` where the ship shot at something, and null where it
 * did not. That is invariant 15: a module decides and reports, and
 * `game.ts` applies the consequence.
 *
 * WHAT IT MUST NOT DO is forget `state.flownBy`. `NpcShip.update` clears it
 * before it dispatches, so a behaviour that flies a ship and does not stamp
 * reports nothing at all. That is a visible gap rather than the last word a
 * real flight left behind, which is the defect docs/TODO/88 is about. A
 * behaviour that does not fly the ship leaves it alone.
 */
export interface NpcBehaviour {
  fly(
    ship: BehaviourShip, dt: number, player: PlayerRef, view: WorldView,
  ): FireEvent | null;
}
