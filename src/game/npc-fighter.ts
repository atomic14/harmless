// A ship that fights: the pirate, the police, the bounty hunter, the Thargoid
// and its drone.
//
// ONE RESPONSIBILITY. It asks three questions of one frame, in this order:
//
//   1. is the commander worth attacking?
//   2. is there another ship worth attacking?
//   3. otherwise, amble.
//
// THE ORDER IS LOAD-BEARING. A ship that can reach the commander does that
// before it looks at an NPC target. So a pirate mid-duel with a trader breaks
// off for her, rather than the other way about. `game/npc.ts` ran these three in
// this order before docs/TODO/184 M1 moved them.
//
// WHICH PILOT FLIES IT is `brain-names.ts`'s answer and not this file's. A live
// pirate flies the pursuit dogfighter, and the `scripted` A/B reverts every
// pirate to the attack run. Either flight hands its shot to the SHIP's
// `chooseWeapon` for what leaves the rail (docs/TODO/183 M3).
//
// THE AMBLE IS HERE BECAUSE IT IS WHAT THIS ROLE DOES WITH NOBODY TO FIGHT. It
// is the fall-through of the three questions rather than a subject of its own,
// and `constants/amble.ts` owns its numbers.
//
// IT DRAWS FROM THE SEEDED STREAM, twice, and both draws are in the amble. The
// order is load-bearing for every seeded outcome in the game (invariant 11).
//
// It came out of `game/npc.ts` (docs/TODO/184 M1).

import * as THREE from 'three';

import { isHostileToPlayer } from './hostility.ts';
import { pirateBrainNameFor } from './brain-names.ts';
import { truceHolds } from './law.ts';
import { STATION_TRUCE } from '../constants/law.ts';
import { AMBLE_ARRIVED, AMBLE_NEAR, AMBLE_SPAN } from '../constants/amble.ts';
import { PLAYER_INTEREST_RANGE } from '../constants/player-interest.ts';
import { HUNT_HOLD_RANGE } from '../constants/hunt-ranges.ts';
import { approach, velocityOf } from './flight-maths.ts';
import { random, randomDirection } from './rng.ts';
import { attack } from './npc-attack-run.ts';
import type { BehaviourShip, NpcBehaviour } from './npc-behaviour.ts';
import type { PlayerRef } from './npc-state.ts';
import type { FireEvent, WorldView } from './npc.ts';

/** Scratch, so a per-frame path allocates nothing. See `game/npc.ts`. */
const tmpDir = new THREE.Vector3();
const tmpVel = new THREE.Vector3();

/** A ship that hunts. One instance serves every ship: it holds no state. */
class Fighter implements NpcBehaviour {
  fly(
    ship: BehaviourShip, dt: number, player: PlayerRef, view: WorldView,
  ): FireEvent | null {
    const { station, fleet, playerLegal, brains } = view;
  const toPlayer = tmpDir.copy(player.position).sub(ship.object.position);
  const distPlayer = toPlayer.length();

  const aggressiveToPlayer =
    isHostileToPlayer(ship, playerLegal, view.playerToStation ?? Infinity)
    && distPlayer < PLAYER_INTEREST_RANGE;

  if (aggressiveToPlayer) {
    // A pirate a player meets flies the `pursuit` dogfighter by default — the
    // combat computer's own pilot, turned on the pirates. The `scripted` A/B
    // reverts every pirate to the hand-written three-phase attack run
    // instead. Either flight goes through the same `chooseWeapon` for what
    // leaves the rail.
    const pursuit = pirateBrainNameFor(ship.state.threatTier, false, brains) === 'pursuit';
    const shot = pursuit
      ? ship.pursuitFly(dt, player, distPlayer, fleet)
      : attack(ship, dt, player.position, distPlayer, true, undefined,
        fleet, velocityOf(player.quaternion, player.speed, tmpVel));
    return ship.chooseWeapon(shot, distPlayer, player.position,
      view.missileInbound);
  }

  if (ship.npcTarget && ship.npcTarget.state.alive) {
    const d = ship.npcTarget.object.position.distanceTo(ship.object.position);
    if (d < HUNT_HOLD_RANGE) {
      return attack(ship, 
        dt, ship.npcTarget.object.position, d, false, ship.npcTarget, view.fleet,
        velocityOf(ship.npcTarget.object.quaternion, ship.npcTarget.state.speed, tmpVel));
    }
    ship.npcTarget = null;
  }


  // Amble between waypoints near home. A role the station's truce covers
  // ambles OUTSIDE the truce, because it can do nothing inside one. A
  // waypoint in there parks a hostile over the port and calls it traffic
  // (docs/TODO/158).
  // `truceHolds` at distance 0 asks "would the truce cover this role at the
  // station itself?", so the list of covered roles keeps one home.
  ship.state.waypointTimer -= dt;
  if (ship.state.waypointTimer <= 0) {
    ship.state.waypointTimer = 12 + random() * 15;
    const near = truceHolds(ship.role, 0) ? STATION_TRUCE : AMBLE_NEAR;
    ship.state.waypoint
      .copy(station.position)
      .add(randomDirection(new THREE.Vector3()).multiplyScalar(near + random() * AMBLE_SPAN));
  }
  ship.steerToward(ship.state.waypoint, dt);
  const arrived = ship.object.position.distanceTo(ship.state.waypoint) < AMBLE_ARRIVED;
  ship.state.speed = approach(ship.state.speed, arrived ? 0 : ship.maxSpeed * 0.4, 80 * dt);
  ship.advance(dt);
  return null;
  }
}

/** The behaviour every fighting role flies. */
export const fighterBehaviour = (): NpcBehaviour => new Fighter();
