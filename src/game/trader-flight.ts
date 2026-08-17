// A trader's working life: it arrives, it works the lane, then it docks or it
// leaves.
//
// ONE RESPONSIBILITY. `stepTrader` is that four-phase machine and nothing else.
// It reads a ship's transform and the ship's trader state. It steers, and it
// sets a target speed. It reports no event at all, because a trader about its
// own business shoots at nobody.
//
// IT TAKES A NARROW INTERFACE RATHER THAN THE SHIP CLASS. `TraderShip` is a
// transform, two hull numbers and the trader's own slice of the saved state.
// `TraderWorld` is the port and the sun. `game/npc.ts`'s `NpcShip` and
// `WorldView` each satisfy one of them, and the one call site needs no cast.
// That is docs/TODO/169 M2's pattern.
//
// THE HARDEST PHASE WAS ALREADY A COLLABORATOR. The `docking` phase hands the
// work to `planDocking` in `game/docking.ts`, which the commander's docking
// computer shares. This file reads that plan back and applies it.
//
// TWO SCRATCH OBJECTS CAME WITH IT. `game/npc.ts` claims nine for the
// allocation rule, and `tmpMat` and `tmpQ` were read at three lines of that
// whole file. All three lines were in this phase. They are module scratch here,
// and that is safe because no function below yields.
//
// It came out of `game/npc.ts` (docs/TODO/176 M2).

import * as THREE from 'three';

import { planDocking, type DockPlan } from './docking.ts';
import { random, randomDirection } from './rng.ts';
import { approach, steerQuatToward } from './flight-maths.ts';

/** Where a trader is in its working life. */
export type TraderPhase = 'arriving' | 'trading' | 'departing' | 'docking';

/**
 * The trader's slice of a ship's saved state.
 *
 * `NpcState` in `game/npc.ts` holds every field below, beside the fields the
 * other roles need. This interface names the ones a trader reads or writes, so
 * this file needs no ship class. Four of the fields are shared with other
 * roles: `speed`, `waypoint`, `waypointTimer` and `wantsDespawn`.
 */
export interface TraderState {
  traderPhase: TraderPhase;
  /** Units per second, ramped toward each phase's target. */
  speed: number;
  waypoint: THREE.Vector3;
  waypointTimer: number;
  /** Seconds of business left at the station. */
  tradeTimer: number;
  /** Decided at spawn: does this one have business at the station? */
  docksHere: boolean;
  /** On final approach into the slot — the station must not shove it away. */
  docking: boolean;
  /** This trader put in at the station rather than jumping out. */
  docked: boolean;
  /** Set true once this ship flew off, or docked, and should be removed. */
  wantsDespawn: boolean;
  /** The docking computer's reusable outputs, rewritten in place each frame. */
  dockPlan: DockPlan;
}

/** A ship that can fly a trader's life. */
export interface TraderShip {
  readonly object: THREE.Object3D;
  /** Top speed for this hull, units per second. */
  readonly maxSpeed: number;
  /** Turn rate for this hull, radians per second. */
  readonly turnRate: number;
  readonly state: TraderState;
}

/** All a trader reads of the world: the port, its slot depth and the sun. */
export interface TraderWorld {
  station: THREE.Object3D;
  dockZ: number;
  /**
   * Where the system's sun is, so a trader on its way out can run for it and
   * jump. It is optional. A test that flies no departure need not supply it,
   * and a trader with no sun in view falls back to a random heading.
   */
  sunPos?: THREE.Vector3;
}

// The origin, for the `lookAt` in the docking phase. Per-module by
// docs/TODO/90's rule: a THREE.Vector3 is mutable, so one shared home is a bug.
const ZERO = new THREE.Vector3();
const dirScratch = new THREE.Vector3();
const dockMat = new THREE.Matrix4();
const dockQuat = new THREE.Quaternion();

/** Turn `ship`'s nose toward `point`, at no more than its own turn rate. */
function steerToward(ship: TraderShip, point: THREE.Vector3, dt: number): void {
  steerQuatToward(
    ship.object.quaternion,
    dirScratch.copy(point).sub(ship.object.position),
    ship.turnRate * dt);
}

/** Traders arrive from deep space, potter about the station, then leave. */
export function stepTrader(ship: TraderShip, dt: number, world: TraderWorld): void {
  const { station } = world;
  const state = ship.state;
  const home = station.position;
  switch (state.traderPhase) {
    case 'arriving': {
      steerToward(ship, home, dt);
      state.speed = approach(state.speed, ship.maxSpeed * 0.85, 90 * dt);
      if (ship.object.position.distanceTo(home) < 900) {
        state.traderPhase = 'trading';
      }
      break;
    }
    case 'trading': {
      state.tradeTimer -= dt;
      state.waypointTimer -= dt;
      if (state.waypointTimer <= 0) {
        state.waypointTimer = 10 + random() * 12;
        // Work the lane between station and planet. The planet sits at the
        // world origin, so a scale of `home` walks that line. The station
        // orbits at 2.4 planet radii (world/system-scene.ts), which puts the
        // planet surface at 1/2.4 = 0.42 of the way out. The 0.62 floor keeps
        // the waypoint clear of the planet, even where the offset points
        // straight down.
        state.waypoint
          .copy(station.position)
          .multiplyScalar(0.62 + random() * 0.38)
          .add(randomDirection(new THREE.Vector3()).multiplyScalar(600 + random() * 1200));
      }
      steerToward(ship, state.waypoint, dt);
      state.speed = approach(state.speed, ship.maxSpeed * 0.35, 60 * dt);
      if (state.tradeTimer <= 0) {
        // about half put in at the station; the rest jump out from here
        if (state.docksHere) {
          state.traderPhase = 'docking';
        } else {
          state.traderPhase = 'departing';
          // Run for the sun to jump out, where the view knows where it is.
          // Otherwise any heading out of the system will do.
          const heading = world.sunPos
            ? new THREE.Vector3().subVectors(world.sunPos, station.position).normalize()
            : randomDirection(new THREE.Vector3());
          state.waypoint.copy(station.position).addScaledVector(heading, 30000);
        }
      }
      break;
    }
    case 'docking': {
      // Shared with the player's docking computer — see game/docking.ts.
      const plan = planDocking(
        ship.object.position, station, world.dockZ, ship.maxSpeed, state.dockPlan);
      state.docking = plan.phase === 'run';
      state.speed = approach(state.speed, plan.speed, 90 * dt);
      // orientation from the plan's heading AND the station's up, so the
      // wings roll into line with the slot as it spins
      dockMat.lookAt(ZERO, plan.heading, plan.up);
      dockQuat.setFromRotationMatrix(dockMat);
      ship.object.quaternion.rotateTowards(dockQuat, ship.turnRate * 2.2 * dt);
      if (plan.arrived) {
        state.docked = true;
        state.wantsDespawn = true; // the Game plays the flash
      }
      break;
    }
    case 'departing': {
      steerToward(ship, state.waypoint, dt);
      state.speed = approach(state.speed, ship.maxSpeed, 90 * dt);
      if (ship.object.position.distanceTo(state.waypoint) < 2500) {
        state.wantsDespawn = true; // jumps out — game plays the flash
      }
      break;
    }
  }
}
