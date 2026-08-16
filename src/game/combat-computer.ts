// The TRAINED-brain seat of the combat computer: a defence policy that flies
// your ship.
//
// DORMANT today. No trained policy ships (`brains.ts`'s `defenceBrain` returns
// null), and `step` disengages without a brain. So the co-pilot the game
// actually flies is scripted-co-pilot.ts's pure-pursuit dogfighter, and
// game.ts's `pilotDemand` chooses between the two. The seat stays because a
// future candidate re-enters through it unchanged.
//
// The module works out what the autopilot WANTS. It reports that as a
// `FlightDemand`. A human's hands produce the SAME thing
// (engine/flight-controls.ts), and the same `PlayerShip.update` flies it.
//
// The Game applies it and pulls the trigger, because a shot has consequences:
// legal status, bounties, the station's Vipers. An autopilot has no business
// with a decision of that weight.

import type * as THREE from 'three';
import { rampToward, type FlightDemand } from '../player.ts';
import {
  act, makeObs, makeScratch, type Brain,
} from '../ai-training/policy.ts';
import {
  observeFor, shipView, writeView, type ThreatsView, type V3,
} from '../ai-training/observation.ts';
import { isHostileToPlayer, type NpcShip } from './npc.ts';
import { autopilotEcm } from './ordnance.ts';
import {
  aftShieldLeft, energyLeft, foreShieldLeft, poolsLeft, type ShipSystems,
} from './systems.ts';
import {
  BRAIN_RATE_DECAY, BRAIN_RATE_RAMP, DECISION_INTERVAL,
} from '../constants/brain-flight.ts';
import {
  CC_ACCEL, CC_MAX_PITCH, CC_MAX_ROLL, CC_MAX_SPEED, THREAT_RANGE,
} from '../constants/combat-computer.ts';
import { ThreatLock } from './threat-lock.ts';

export type AutopilotStep =
  /** hands off — the reason is for the player */
  | { kind: 'disengage'; reason: string }
  /**
   * What it wants — and, separately, whether it reaches for the E.C.M.
   *
   * NOT a field of `FlightDemand`, which is deliberately the four things a pair
   * of hands produces and is flown by `PlayerShip.update`. The E.C.M. is a
   * COMMAND key, not a flight axis. It spends a quarter of the bank and wipes
   * the sky. That is a consequence, and consequences are the Game's (invariant
   * 15). So it is reported beside the demand, and `game.ts` presses it through
   * `fireEcm` — the same call the player's own key makes.
   */
  | { kind: 'fly'; demand: FlightDemand; ecm: boolean };

/** Minimal view of a ship, so this needs no PlayerShip and no scene. */
export interface AutopilotShip {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  speed: number;
}

/**
 * What the autopilot is mid-thought.
 *
 * A state object rather than four private fields, for the reason npc.ts learned
 * the hard way. `brainControl` was left out of the NPC snapshot as "not really
 * state". A restored world then flew a different fight from the one it was
 * saved from. This is the same cache and the same ramped rates, on the PLAYER's
 * ship — it was still unsaved until an audit found it.
 */
export interface AutopilotState {
  /** ramped turn rates, so a restored turn continues rather than jumps to level */
  pitch: number;
  roll: number;
  /** counts down to the next 10Hz decision */
  timer: number;
  /**
   * The decision that is acted on right now.
   *
   * `ecm` rides along with the other four for the reason the whole object
   * exists. It is held between decisions, so it is state, and state is saved.
   * `snapshot.ts` walks this generically, so the field costs nothing to persist.
   *
   * It is REQUIRED, like the other four. It was optional once, so that a save
   * written before the fourth head existed could restore a `control` without one
   * and read as "not pressing". But `act()` returns `Control.ecm`
   * unconditionally (`ai-training/policy.ts`: always false for a brain with no
   * logit for it). So nothing this build can write omits it, and the optional
   * field was tolerance for a save that does not exist. Deleted 2026-08-04 with
   * the other four.
   */
  control: {
    pitch: number; roll: number; throttle: number; fire: boolean; ecm: boolean;
  } | null;
}

export function freshAutopilot(): AutopilotState {
  return { pitch: 0, roll: 0, timer: 0, control: null };
}

export class CombatComputer {
  /** @see AutopilotState — public so the snapshot can walk it */
  readonly state: AutopilotState = freshAutopilot();
  // Wide enough for the WIDEST encoder, as npc.ts's buffer is, and for the same
  // reason. Which encoder runs is `observeFor`'s decision from the brain's own
  // shape. So a buffer sized to today's shipped brain reads past its end the
  // day a wider one is promoted. That happened twice already (docs/TODO/71,
  // /91), and `MAX_OBS_SIZE` is policy.ts's answer to it.
  private readonly obs = makeObs();
  private readonly scratch = makeScratch();
  private readonly me = shipView(CC_MAX_SPEED, 0.5, 0);
  /**
   * The threat's speed WAS a constant 280, and is the real one now.
   *
   * game.ts initialised this view with 280 and never updated it. So every
   * defence policy up to `jameson-defend-g1` flew against that value alone. The
   * pirate brains are still fed 300 in npc.ts, which is the same fault. The
   * comment here said, in as many words, "it is load-bearing until the brain is
   * retrained".
   *
   * docs/TODO/71 and /72 retrained it. `jameson-defend-g2` was fitted in
   * `Episode.observeTrader`, which always writes the attacker's REAL speed. So
   * the pin is now the divergence rather than the protection: the constant is
   * what would put the shipped policy out of distribution. The envelope numbers
   * stay — no encoder reads a target's `cls`.
   */
  private readonly target = shipView(300, 1.1, 0);

  /** Forget the ramped rates, so the next engagement starts from level flight. */
  reset(): void {
    this.state.pitch = 0;
    this.state.roll = 0;
    this.state.timer = 0;
    this.state.control = null;
  }

  /** the threat this co-pilot fights — see game/threat-lock.ts for the rule */
  private readonly threatLock = new ThreatLock<NpcShip>();

  /**
   * @param manualInput the pilot touched the controls — always hands back.
   * @param brain the defence policy, or null if the weights failed to load.
   * @param missilePos where the hostile warhead in the sky is, or null when
   * there is none. It is `Ordnance.hostileMissilePos`, the world's answer. The
   * step that calls this reads it once a frame. Its EXISTENCE is slot 15 and
   * the E.C.M. gate: `autopilotEcm` lets the policy decide whether to answer a
   * warhead, not whether there is one. Its BEARING is slots 24-26.
   */
  step(
    dt: number,
    player: AutopilotShip,
    sys: ShipSystems,
    npcs: readonly NpcShip[],
    legalStatus: number,
    manualInput: boolean,
    brain: Brain | null,
    missilePos: V3 | null = null,
    playerToStation = Infinity,
  ): AutopilotStep {
    if (manualInput) return { kind: 'disengage', reason: 'MANUAL OVERRIDE' };

    // COMMITTED, not merely nearest. A fresh-every-frame pick flipped the
    // fought ship up to 26.8 times a minute, and the brain's bearing slots
    // jumped about 90 degrees at each flip. The rule and the measurements are
    // game/threat-lock.ts's, shared with the armed trader and the trainer.
    //
    // The station's truce is read here too, and one home is the point of it. A
    // co-pilot that fought a ship the ship itself will not fight would start
    // the fight the truce exists to prevent (docs/TODO/158).
    const hostiles = npcs.filter(
      (npc) => isHostileToPlayer(npc, legalStatus, playerToStation)
        && npc.object.position.distanceTo(player.position) < THREAT_RANGE);
    const threat = this.threatLock.pick(
      dt, hostiles, (npc) => npc.object.position.distanceTo(player.position),
    );
    if (!threat || !brain) {
      this.threatLock.clear();
      return { kind: 'disengage', reason: 'AREA CLEAR — COMBAT COMPUTER OFF' };
    }

    this.state.timer -= dt;
    if (!this.state.control || this.state.timer <= 0) {
      this.state.timer = DECISION_INTERVAL;
      writeView(this.me, player.position, player.quaternion);
      this.me.speed = player.speed;
      this.me.laserTemp = sys.laserTemp;
      this.me.laserCooldown = sys.laserCooldown;
      // HOW HURT SHE IS, and whether a warhead is on its way. Those are the two
      // things docs/TODO/71 and /72 found absent. They come from `systems.ts`'s
      // own expressions, so the game and the trainer cannot come to compute
      // them differently. A 14-input brain never reads them; `observeFor`
      // decides.
      this.me.hp = poolsLeft(sys);
      this.me.energy = energyLeft(sys);
      this.me.missileInbound = missilePos !== null;
      this.me.fore = foreShieldLeft(sys);
      this.me.aft = aftShieldLeft(sys);
      this.me.pitchRate = this.state.pitch;
      this.me.rollRate = this.state.roll;
      writeView(this.target, threat.object.position, threat.object.quaternion);
      // ...and how fast it actually flies. The trainer always fed the policy
      // that number, and this file used to pin it at 280. See `target` above.
      this.target.speed = threat.state.speed;
      // Which encoder this brain wants is policy.ts's question, asked the same
      // way npc.ts asks it. It was `observe()` outright, which was correct for
      // exactly as long as every defence policy had 14 inputs.
      const threats: ThreatsView = {
        others: hostiles.filter((npc) => npc !== threat)
          .map((npc) => ({ pos: npc.object.position })),
        count: hostiles.length,
        missilePos,
      };
      this.state.control = act(
        brain,
        observeFor(brain, this.me, this.target, null, this.obs, threats),
        this.scratch);
    }

    const c = this.state.control;
    this.state.pitch = ccRamp(this.state.pitch, c.pitch * CC_MAX_PITCH, c.pitch !== 0, dt);
    this.state.roll = ccRamp(this.state.roll, c.roll * CC_MAX_ROLL, c.roll !== 0, dt);
    return {
      kind: 'fly',
      ecm: autopilotEcm(c.ecm, missilePos !== null),
      demand: {
        pitchRate: this.state.pitch,
        rollRate: this.state.roll,
        throttle: c.throttle,
        fire: c.fire,
        // it cruises rather than sprints — see FlightDemand.limits
        limits: { accel: CC_ACCEL, maxSpeed: CC_MAX_SPEED },
      },
    };
  }
}

/**
 * The rate ramp an NPC's brain flies with, applied to the player's ship.
 *
 * The RULE is player.ts's `rampToward` — it was written out here a third time,
 * constants and all. Only the constants are this module's: the defence policy
 * was fitted at the NPC ramp, so the autopilot flies at the NPC ramp.
 *
 * Exported so train/jameson-autopilot.js — the console harness that stands in
 * for this autopilot — can use it rather than write 4.0/5.0 out again.
 */
export function ccRamp(cur: number, target: number, active: boolean, dt: number): number {
  return rampToward(cur, target, active, dt, BRAIN_RATE_RAMP, BRAIN_RATE_DECAY);
}
