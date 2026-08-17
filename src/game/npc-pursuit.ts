// The pursuit dogfighter, as a pilot: the combat computer's own pilot, turned
// on the pirates.
//
// ONE RESPONSIBILITY. It chases a target, and it veers past when a collision
// is close. It falls back to the three-phase attack run when the commander
// breaks off far enough. `pursuit.ts` owns the aim and the speed, and
// `combat-computer.ts` owns the two cones. This file spends them against one
// ship.
//
// IT IS AN OBJECT, AND THE ATTACK RUN NEXT DOOR IS NOT. Two fields decide how
// this pilot flies, and NEITHER is in `NpcState`. They are the break state it
// holds across frames, and the hysteresis bit for the slash-or-hold switch. Both are
// re-decided every frame, and `game/npc.ts` said so at both before
// docs/TODO/183 M2 moved them. A per-ship pilot can simply hold them, exactly
// as a hermit's beacon clock lives in its behaviour (docs/TODO/182 M1).
//
// SO THE SHIP HOLDS ONE OF THESE, built in its constructor. `NpcShip.breakingOff`
// reads the break state back out for the flight readout, and that is the only
// thing outside this file that asks.
//
// IT FALLS BACK RATHER THAN CALLING HOME. The attack run is imported, not
// reached through the ship. That is composition: a pilot that needs another
// pilot holds one.
//
// It came out of `game/npc.ts` (docs/TODO/183 M2).

import * as THREE from 'three';

import { pursuitSpeed, pursuitAim, freshPursuitBreak, type PursuitBreak } from './pursuit.ts';
import { PURSUIT_SLASH_CONE, PURSUIT_HOLD_CONE } from '../constants/combat-computer.ts';
import { separationFrom } from './separation.ts';
import { SEPARATION_PUSH } from '../constants/separation.ts';
import { npcTriggerPull } from './gunnery.ts';
import { THARGOID_FIRE_RATE } from '../constants/npc-gun.ts';
import { approach } from './flight-maths.ts';
import { velocityOf } from './flight-maths.ts';
import { random } from './rng.ts';
import { attack, matePositions } from './npc-attack-run.ts';
import type { PilotShip } from './npc-pilot.ts';
import type { PlayerRef } from './npc-state.ts';
import type { FireEvent, NpcShip } from './npc.ts';

/** Scratch, so a per-frame path allocates nothing. See `game/npc.ts`. */
const tmpAim = new THREE.Vector3();
const tmpAway = new THREE.Vector3();
const tmpDir2 = new THREE.Vector3();
const tmpFwd = new THREE.Vector3();
const tmpVel = new THREE.Vector3();

/**
 * The pursuit dogfighter, one per ship.
 *
 * `fly` is the entry the ship's behaviour calls. It picks between the slash and
 * the hold, and the slash IS the attack run.
 */
export class PursuitPilot {
  /** The two-phase break-off state, held across frames. Not saved. */
  private readonly brk: PursuitBreak = freshPursuitBreak();

  /** Slashing past rather than holding the six. Hysteresis, and not saved. */
  private slashing = false;

  /** Whether it is veering off a ram this frame, for the readout alone. */
  get breaking(): boolean {
    return this.brk.breaking;
  }

  fly(
    ship: PilotShip,
    dt: number,
    target: PlayerRef,
    dist: number,
    fleet: readonly PilotShip[] = [],
  ): FireEvent | null {
    return this.slashes(ship, target)
      ? attack(ship, dt, target.position, dist, true, undefined,
        fleet, velocityOf(target.quaternion, target.speed, tmpVel))
      : this.pursue(ship, dt, target.position, dist, true, undefined, target.speed, fleet);
  }

  private slashes(ship: PilotShip, player: PlayerRef): boolean {
    const fwd = tmpFwd.set(0, 0, -1).applyQuaternion(player.quaternion);
    const toUs = tmpDir2.copy(ship.object.position).sub(player.position);
    if (toUs.lengthSq() > 0) {
      const faced = fwd.angleTo(toUs.normalize());
      if (faced < PURSUIT_SLASH_CONE) this.slashing = true;
      else if (faced > PURSUIT_HOLD_CONE) this.slashing = false;
    }
    return this.slashing;
  }

  private pursue(
    ship: PilotShip,
    dt: number,
    targetPos: THREE.Vector3,
    dist: number,
    isPlayer: boolean,
    npcTarget?: NpcShip,
    targetSpeed = 0,
    fleet: readonly PilotShip[] = [],
  ): FireEvent | null {
    ship.state.flownBy = 'pursuit';
    // WHERE TO BE: chase the target, or veer past it when a collision is close
    // (pursuit.ts's two-phase break-off). Bend the line away from wingmen, as
    // `attack()` does, so a pursuing gang does not converge into itself.
    const aim = pursuitAim(this.brk, ship.object.position, targetPos, dist, tmpAim);
    const crowd = separationFrom(ship.object.position, matePositions(ship, fleet), tmpAway);
    if (crowd > 0) aim.addScaledVector(tmpAway, SEPARATION_PUSH * crowd);
    ship.steerToward(aim, dt);
    // HOW FAST: hold a gun-range standoff behind the target, and ease off in a
    // hard turn. On a break-off it stays quick, to clear the hull.
    const want = this.brk.breaking
      ? ship.maxSpeed
      : pursuitSpeed(targetSpeed, dist, ship.facing(targetPos), ship.maxSpeed);
    ship.state.speed = approach(ship.state.speed, want, ship.accel * dt);
    ship.advance(dt);
    // THE SAME gun as the attack run, through the same shared pull.
    ship.state.fireCooldown -= dt;
    const reload = npcTriggerPull(
      ship.state.fireCooldown, ship.facing(targetPos), dist, random,
      ship.role === 'thargoid' ? THARGOID_FIRE_RATE : 1);
    if (reload !== null) {
      ship.state.fireCooldown = reload;
      ship.state.dryFor = 0;
      return isPlayer ? { at: 'player', weapon: 'laser' } : { at: npcTarget!, weapon: 'laser' };
    }
    return null;
  }
}
