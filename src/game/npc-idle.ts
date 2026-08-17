// The ships that never fight: a rock, a hermit, a derelict, and a drone whose
// mothership died.
//
// ONE RESPONSIBILITY. Each of these tumbles, and one of them drifts. None
// decides anything, none reads the commander, and none returns a `FireEvent`.
// They answer null every frame of their lives.
//
// FOUR BEHAVIOURS, ONE SHAPE, AND THE RATES ARE WHAT DIFFER. A rock rolls
// fastest because it was thrown. A hermit is a hollowed rock with an engine and
// a beacon, so it barely turns. A generation ship is under way and indifferent.
// A Thargon whose mothership died keeps the spin it had.
//
// THE RATES ARE COSMETIC, and docs/TODO/180 measured that class and left it
// alone. They decide how a hull LOOKS, and no rule reads them. A named constant
// for each would put four presentation numbers in `src/constants/`. That is the
// home for what the game decides, and not for what it looks like.
//
// A HERMIT'S BEACON CLOCK LIVES HERE, and that is the first thing a behaviour
// keeps for itself. It was a private field on `NpcShip`, off the save on
// purpose. The blink phase drives nothing, so a reload that restarts it
// mid-pulse is not an observable divergence. It never belonged to the ship.
//
// It came out of `game/npc.ts` (docs/TODO/182 M1).

import type * as THREE from 'three';

import { HERMIT_BEACON_ON, HERMIT_BEACON_PERIOD } from '../ships/geometry.ts';
import type { BehaviourShip, NpcBehaviour } from './npc-behaviour.ts';

/** How fast each derelict rolls, in radians per second. */
const ROCK_TUMBLE = 0.4;
const HERMIT_TUMBLE = 0.06;
const GENERATION_TUMBLE = 0.02;
const INERT_TUMBLE = 0.2;

/** A rock, and anything else that only rolls. */
class Tumbling implements NpcBehaviour {
  private readonly rate: number;

  constructor(rate: number) {
    this.rate = rate;
  }

  fly(ship: BehaviourShip, dt: number): null {
    ship.object.rotateOnAxis(ship.state.tumbleAxis, dt * this.rate);
    return null;
  }
}

/**
 * A rock hermit: a slow roll, and a beacon that blinks whether anybody is
 * there or not.
 *
 * The clock is this object's own, and it is why a hermit is a class rather than
 * a `Tumbling` with a longer rate. `NpcShip` held it as a private field until
 * docs/TODO/182.
 */
class Hermit implements NpcBehaviour {
  private readonly beacon: THREE.Mesh | null;
  private clock = 0;

  constructor(beacon: THREE.Mesh | null) {
    this.beacon = beacon;
  }

  fly(ship: BehaviourShip, dt: number): null {
    ship.object.rotateOnAxis(ship.state.tumbleAxis, dt * HERMIT_TUMBLE);
    if (this.beacon) {
      this.clock += dt;
      this.beacon.visible = this.clock % HERMIT_BEACON_PERIOD < HERMIT_BEACON_ON;
    }
    return null;
  }
}

/**
 * A derelict generation ship: ancient, blind, and utterly indifferent to you.
 *
 * It is the one idle behaviour that MOVES. It holds its top speed for ever, so
 * the ship crosses the system whether the commander finds it or not.
 */
class Derelict implements NpcBehaviour {
  fly(ship: BehaviourShip, dt: number): null {
    ship.object.rotateOnAxis(ship.state.tumbleAxis, dt * GENERATION_TUMBLE);
    ship.state.speed = ship.maxSpeed;
    ship.advance(dt);
    return null;
  }
}

/** A rock: thrown, and still rolling. */
export const rockIdle = (): NpcBehaviour => new Tumbling(ROCK_TUMBLE);

/** A rock hermit, with the beacon its hull was built with. */
export const hermitIdle = (beacon: THREE.Mesh | null): NpcBehaviour => new Hermit(beacon);

/** A derelict generation ship, under way and indifferent. */
export const derelictIdle = (): NpcBehaviour => new Derelict();

/**
 * A drone whose mothership died.
 *
 * NOT A ROLE, and that is why it is a separate export. `state.inert` is set on
 * a Thargon when the ship that carried it is destroyed. So a ship reaches this
 * behaviour part-way through its life rather than at its spawn. `NpcShip.update`
 * asks the flag before it asks the behaviour it holds.
 */
export const inertTumble = (): NpcBehaviour => new Tumbling(INERT_TUMBLE);
