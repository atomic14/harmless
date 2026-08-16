// The scripted combat computer: a PURSUIT DOGFIGHTER at the stick of YOUR ship.
//
// A person gets on the opponent's six and shoots it up. She hauls the throttle
// back to swing the nose round, so that she stays on a target that crosses her.
//
// That is pure pursuit. Point the nose AT the target: the laser is hitscan, so
// there is no lead, and you aim where the target is. The line then curves you
// onto its tail as it turns and runs. A throttle holds a gun-range standoff
// behind it, and comes off hard when the nose has a long way to swing.
//
// It flies `pursuit.ts` rather than the attack run. The pirates fly their own
// pursuit: hold the six, then break into a fast pass when faced (npc.ts
// `pursue`). That is a separate ship and a separate decision. The two share
// `pursuitSpeed`, so they cannot drift.
//
// It DECIDES and reports, like every module here. What comes back is a
// `FlightDemand` — ramped pitch and roll rates, a throttle, a trigger — and one
// E.C.M. request. The Game flies that demand through the same
// `PlayerShip.update` a human's keys do, which is what puts the co-pilot's turn
// on the HUD needles. The Game then pulls the trigger, with its legal
// consequences.
//
// How it POINTS the nose is `pitch-roll-steer.ts`. The player's ship has no yaw
// axis. So it banks the target onto the pitch plane and pulls up to it, at the
// commander's OWN caps and ramp (PLAYER_FLIGHT).

import * as THREE from 'three';
import { ThreatLock } from './threat-lock.ts';
import { isHostileToPlayer, type NpcShip } from './npc.ts';
import type { AutopilotShip } from './combat-computer.ts';
import { hitCone } from './gunnery.ts';
import { autopilotEcm } from './ordnance.ts';
import { bankToTurn, freshSteerMemory, type SteerMemory } from './pitch-roll-steer.ts';
import { pursuitSpeed } from './pursuit.ts';
import { rampFlightRate, type FlightDemand } from '../player.ts';
import { LASER_RANGE } from '../constants/player-gun.ts';
import { UNDER_FIRE_SECONDS } from '../constants/attack-run.ts';
import {
  THREAT_RANGE, PURSUIT_SPEED_DEADBAND, ENGAGED_CONE, TARGET_DIST_WEIGHT,
} from '../constants/combat-computer.ts';
import { PLAYER_FLIGHT } from '../constants/player-flight.ts';
import type { V3 } from '../ai-training/observation.ts';

export type CoPilotStep =
  /** hands off — the reason is for the player */
  | { kind: 'disengage'; reason: string }
  /**
   * What the pursuit wants this frame. It is the SAME FlightDemand that a pair
   * of hands produces (player.ts): ramped pitch and roll rates, a throttle,
   * and a trigger.
   *
   * `fire` and `ecm` are REQUESTS. A shot has consequences, and so does a spend
   * from the bank. A consequence is the Game's (invariant 15).
   *
   * The demand flows through the same `PlayerShip.update` a human's keys do.
   * That is what puts the co-pilot's turn on the HUD's pitch and roll needles.
   */
  | { kind: 'fly'; demand: FlightDemand; ecm: boolean };

export class ScriptedCoPilot {
  /** the same lock, the same margin, the same hold as the brain co-pilot */
  private readonly lock = new ThreatLock<NpcShip>();
  private readonly toThreat = new THREE.Vector3();
  private readonly nose = new THREE.Vector3();
  /** ramped turn rates, so the co-pilot's turn continues smoothly frame to frame */
  private pitchRate = 0;
  private rollRate = 0;
  /** which vertical the bank-to-turn is committed to — see pitch-roll-steer.ts */
  private readonly steerMem: SteerMemory = freshSteerMemory();
  /**
   * Seconds left of "the commander is under fire". `noteHit` records it, and
   * each step decays it. That call is the Game's only way to tell the co-pilot
   * that the ship took damage.
   *
   * The pursuit does NOT read it yet. A dogfighter on the six should not break
   * off merely because a bolt landed. It stays live end to end, so that a later
   * evasive behaviour needs no new wiring.
   */
  private underFire = 0;

  noteHit(): void {
    this.underFire = UNDER_FIRE_SECONDS;
  }

  /** Let go of the fight entirely — the next step starts from nothing. */
  reset(): void {
    this.lock.clear();
    this.pitchRate = 0;
    this.rollRate = 0;
    this.underFire = 0;
  }

  step(
    dt: number,
    player: AutopilotShip,
    npcs: readonly NpcShip[],
    legalStatus: number,
    manualInput: boolean,
    missilePos: V3 | null,
    playerToStation = Infinity,
  ): CoPilotStep {
    if (manualInput) return { kind: 'disengage', reason: 'MANUAL OVERRIDE' };
    this.underFire = Math.max(0, this.underFire - dt);
    // How far off the nose a candidate is — the turn it would cost to lock.
    const offNose = (npc: NpcShip): number => this.nose.set(0, 0, -1)
      .applyQuaternion(player.quaternion)
      .angleTo(this.toThreat.copy(npc.object.position).sub(player.position));
    const threat = this.lock.pick(
      dt,
      npcs.filter((npc) => isHostileToPlayer(npc, legalStatus, playerToStation)
        && npc.object.position.distanceTo(player.position) < THREAT_RANGE),
      // EASIEST to lock, not nearest. It ranks by the off-nose angle, which is
      // the turn it costs to get guns on. Distance is the secondary tiebreak.
      //
      // Chris asked for this. It also sidesteps the distance roll-spin at its
      // source. Against a wave of ships, the co-pilot shoots the one already
      // near the crosshair, then moves to the next-easiest. It does not bank
      // hard onto a far off-axis target and spin. `TARGET_DIST_WEIGHT` sets how
      // many units of range weigh as much as a radian of turn.
      (npc) => offNose(npc)
        + npc.object.position.distanceTo(player.position) / TARGET_DIST_WEIGHT,
      // ENGAGED means do not switch. The target is in front and roughly on the
      // nose, so this is the kill in progress, rather than the easiest lock. A
      // pilot does not drop a ship she is lined up on because another became
      // easier (Chris). The ranking hands over a better target only when the
      // co-pilot is NOT engaged, which means the current one ran wide or ran
      // behind.
      (npc) => offNose(npc) < ENGAGED_CONE,
    );
    if (!threat) {
      this.reset();
      return { kind: 'disengage', reason: 'AREA CLEAR — COMBAT COMPUTER OFF' };
    }
    const targetPos = threat.object.position;
    const dist = targetPos.distanceTo(player.position);
    // the angle the target fills — the gun's hit cone, WIDE up close. Both the
    // trigger and the roll-fade read it. You may fire anywhere in it. You need
    // no bank to centre a target that is already inside it.
    const cone = hitCone(threat.radius, dist);

    // PURE PURSUIT: bank-to-turn straight at where the target IS. The gun is
    // hitscan, so there is nothing to lead. An aim AT the target rather than
    // ahead of it is what walks the nose onto the six as the target turns and
    // runs. It ramps through the commander's own envelope (PLAYER_FLIGHT), so
    // the co-pilot flies your ship as your hands would.
    const cmd = bankToTurn(player.quaternion,
      this.toThreat.copy(targetPos).sub(player.position), this.steerMem, cone);
    this.pitchRate = rampFlightRate(
      this.pitchRate, cmd.pitch * PLAYER_FLIGHT.maxPitch, cmd.pitch !== 0, dt);
    this.rollRate = rampFlightRate(
      this.rollRate, cmd.roll * PLAYER_FLIGHT.maxRoll, cmd.roll !== 0, dt);

    // How far off the nose the target is. It is taken AFTER this frame's ramp
    // is decided, and before the Game integrates it. One frame's turn is
    // ~0.02 rad, which neither the throttle nor the fire cone can see.
    const facing = this.nose.set(0, 0, -1).applyQuaternion(player.quaternion)
      .angleTo(this.toThreat.copy(targetPos).sub(player.position));

    return {
      kind: 'fly',
      demand: {
        pitchRate: this.pitchRate,
        rollRate: this.rollRate,
        throttle: this.pursuitThrottle(player.speed, threat.state.speed, dist, facing),
        // the trigger only when the shot would count: the player gun's own cone
        // and range (gunnery.ts). The laser's heat and cooldown pace it from
        // there, which is what makes this a marksman rather than a sprayer
        fire: dist <= LASER_RANGE && facing < cone,
      },
      // a warhead is always answered. Whether one is on its way is the world's
      // fact, and the gate is the same one every E.C.M. press goes through
      ecm: autopilotEcm(true, missilePos !== null),
    };
  }

  /**
   * Hold a gun-range standoff on the target's six.
   *
   * The speed to fly is `pursuit.ts`'s `pursuitSpeed`. The pursuit pirate
   * shares it, so the two cannot drift. This turns that speed into the
   * throttle SIGN that `FlightDemand` wants. A deadband makes it coast at the
   * held speed rather than pump around it.
   */
  private pursuitThrottle(
    ownSpeed: number, targetSpeed: number, dist: number, facing: number,
  ): number {
    const want = pursuitSpeed(targetSpeed, dist, facing, PLAYER_FLIGHT.maxSpeed);
    const diff = want - ownSpeed;
    return Math.abs(diff) < PURSUIT_SPEED_DEADBAND ? 0 : Math.sign(diff);
  }
}
