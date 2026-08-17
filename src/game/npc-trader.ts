// A trader's frame: turn and fight when somebody is on you, and otherwise get
// on with the working life.
//
// ONE RESPONSIBILITY. It asks one question — is this ship fleeing? — and it
// answers with one of two things. `game/trader-flight.ts` holds the working
// life, and this file holds the defence and the choice between them.
//
// THE DEFENCE IS THE HALF docs/TODO/176 M2 LEFT BEHIND. That item took the
// trader's working life out of `game/npc.ts`. It could not take this half: 36
// of these lines call a pilot, and the pilots were still methods on the class.
// They are objects since docs/TODO/183. So this is free now, and
// docs/TODO/184 M2 closes it.
//
// IT CALLS `stepTrader` RATHER THAN ABSORBING IT. `game/trader-flight.ts` takes
// a four-handle `TraderShip` and stays that way. A behaviour that needs
// eighteen must not drag the working life up with it.
//
// AN ARMED TRADER IS THE ONLY SHIP THAT FLIES TWO MODELS, and `brain-names.ts`
// decides which. The shipped answer is the three-phase attack run, pointed back
// at whoever hunts it. A trained defence brain is the socket a future candidate
// re-enters through. Both are pilots, and neither is this file's.
//
// `state.fleeing` IS SET IN ONE PLACE, and it is guarded by `role === 'trader'`
// (`NpcShip.takeDamage`). So this behaviour is the trader's alone, and no other
// role can reach the branch.
//
// It came out of `game/npc.ts` (docs/TODO/184 M2).

import * as THREE from 'three';

import { defenceBrain } from './brains.ts';
import { defenceBrainNameFor } from './brain-names.ts';
import { TURN_AND_FIGHT_RANGE } from '../constants/player-interest.ts';
import { approach, velocityOf } from './flight-maths.ts';
import { attack } from './npc-attack-run.ts';
import { brainFly } from './npc-brain-pilot.ts';
import { stepTrader } from './trader-flight.ts';
import type { BehaviourShip, NpcBehaviour } from './npc-behaviour.ts';
import type { PlayerRef } from './npc-state.ts';
import type { FireEvent, WorldView } from './npc.ts';

/** Scratch, so a per-frame path allocates nothing. See `game/npc.ts`. */
const tmpDir = new THREE.Vector3();
const tmpVel = new THREE.Vector3();

/** A trader. One instance serves every trader: it holds no state. */
class Trader implements NpcBehaviour {
  fly(
    ship: BehaviourShip, dt: number, player: PlayerRef, view: WorldView,
  ): FireEvent | null {
    const { fleet, brains } = view;
    // How far the commander is. Every branch below asks it, so it is measured
    // once at the top.
    const distPlayer = tmpDir.copy(player.position)
      .sub(ship.object.position).length();

    if (ship.state.fleeing) {
      // Armed traders turn and fight. WHICH pilot is brain-names.ts's answer.
      // The shipped answer is the hand-written three-phase attack run, pointed
      // back at whoever hunts it. That is the run `scripted` pirates fly, and
      // live pirates default to `pursuit`. Under the `scripted` A/B the gate below
      // fails and the trader flees without fighting. The brainFly block below
      // is the socket a future trained candidate re-enters through (brains.ts),
      // and flies nothing today.
      if (ship.armed && defenceBrainNameFor(brains) === 'attack-run') {
        if (ship.state.provokedByPlayer && distPlayer < TURN_AND_FIGHT_RANGE) {
          const shot = attack(ship, dt, player.position, distPlayer, true, undefined,
            fleet, velocityOf(player.quaternion, player.speed, tmpVel));
          return ship.chooseWeapon(shot, distPlayer, player.position, view.missileInbound);
        }
        const attacker = ship.nearestAttacker(dt);
        if (attacker) {
          const d = attacker.object.position.distanceTo(ship.object.position);
          return attack(ship, dt, attacker.object.position, d, false, attacker, view.fleet,
            velocityOf(attacker.object.quaternion, attacker.state.speed, tmpVel));
        }
      }
      const defence = ship.armed ? defenceBrain(brains) : null;
      if (defence) {
        const live = ship.attackers.filter((a) => a.state.alive);
        if (ship.state.provokedByPlayer && distPlayer < TURN_AND_FIGHT_RANGE) {
          // fighting the commander; every NPC attacker is 'the rest of the sky'
          return brainFly(ship, defence, dt,
            player.position, player.quaternion, 300, distPlayer, 'player', null, {
              others: live.map((a) => ({ pos: a.object.position })),
              count: live.length + 1,
              missilePos: null,
            });
        }
        const attacker = ship.nearestAttacker(dt);
        if (attacker) {
          const d = attacker.object.position.distanceTo(ship.object.position);
          return brainFly(ship, defence, dt,
            attacker.object.position, attacker.object.quaternion, 260, d, attacker, null, {
              others: live.filter((a) => a !== attacker)
                .map((a) => ({ pos: a.object.position })),
              count: live.length,
              missilePos: null,
            });
        }
      }
      // The only flight that actually RUNS AWAY, and the only one the readout
      // may call `fleeing`. Everything above this line in the branch turned and
      // fought. A report of the branch rather than of the flight is what made
      // an armed trader mid-duel read as a ship on the run.
      ship.state.flownBy = 'fleeing';
      ship.steerToward(
        tmpDir.copy(ship.object.position).multiplyScalar(2).sub(ship.state.fleeFrom), dt);
      ship.state.speed = approach(ship.state.speed, ship.maxSpeed, 150 * dt);
      ship.advance(dt);
      return null;
    }

    // NOT FLEEING: the working life. `game/trader-flight.ts` steers and sets a
    // target speed, and this line moves the ship, so one ship moves one way.
    stepTrader(ship, dt, view);
    ship.advance(dt);
    return null;
  }
}

/** The behaviour every trader flies. */
export const traderBehaviour = (): NpcBehaviour => new Trader();
