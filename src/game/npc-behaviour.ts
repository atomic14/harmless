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

import type { NpcRole } from './ship-roles.ts';
import type { FireEvent } from './npc.ts';

/**
 * The part of a ship a behaviour may touch.
 *
 * NARROW ON PURPOSE, and it grows only when a behaviour needs it. Today it is
 * what the roles that never fight ask for. The fighting roles come in their own
 * items, and each one states what it added and why.
 *
 * `NpcShip` satisfies this structurally, exactly as it satisfies `TraderShip`
 * and `HostileShip`. So no behaviour imports the class.
 */
export interface BehaviourShip {
  readonly object: THREE.Object3D;
  readonly role: NpcRole;
  /** Top speed for this hull, units per second. */
  readonly maxSpeed: number;
  readonly state: {
    speed: number;
    /** The axis a derelict tumbles about. Saved, so a reload keeps the spin. */
    readonly tumbleAxis: THREE.Vector3;
  };
  /** Move the ship along its nose at its current speed. */
  advance(dt: number): void;
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
  fly(ship: BehaviourShip, dt: number): FireEvent | null;
}
