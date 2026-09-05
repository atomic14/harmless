// What happens when things get shot.
//
// The player pulls the trigger, and something takes the hit. A chain of
// consequences follows:
//
// - an explosion;
// - a legal offence;
// - a bounty;
// - a contract tick;
// - cargo that spills into space;
// - a Navy mission that closes.
//
// It has one responsibility: it resolves a hit. So it is one file. The pattern
// is ordnance.ts and trumbles.ts: this decides and reports, the Game applies.
// That matters most for `offence`. A raised legal status launches the station's
// Vipers, and combat has no business with that fact.
//
// The geometry of what a shot passes through is shot.ts; the numbers are
// gunnery.ts. The vocabulary it reports in is combat-events.ts. This is the
// consequences.
//
// ONE THING HERE DECIDES WHETHER A HIT COUNTS AT ALL. For `WRECK_BURST_GRACE`
// seconds after the commander's own shot destroys a ship, her beam registers
// nothing on a bystander. `inTheFireball` is the whole of that rule, and
// `hostility.ts` says who counts as a bystander (docs/TODO/173).
//
// IT TAKES EACH INGREDIENT SEPARATELY and never a GameState. That is what makes
// the class testable, and what lets `destroy()` be handed a different commander.
// To assemble the seven arguments the player's own trigger wants is a different
// job. `combat-player.ts` is where that job lives (docs/TODO/156).

import * as THREE from 'three';
import type { World } from './world.ts';
import type { NpcShip } from './npc.ts';
import type { Canister } from './cargo.ts';
import type { ShipSystems } from './systems.ts';
import type { PlayerPoolPoints } from './damage-units.ts';
import type { CommanderData } from './commander.ts';
import { laserForView, canFire, chargeShot } from './gunnery.ts';
import { traceShot, type ShotHit } from './shot.ts';
import { applyDamage, canAffordLaserShot, spendLaserEnergy } from './systems.ts';
import { hitFromAhead } from './shield-face.ts';
import { harmVerdict, offenceFor } from './law.ts';
import { isHostileToPlayer } from './hostility.ts';
import { OFFENDER } from '../constants/law.ts';
import { heard, later, say, type CombatEvent } from './combat-events.ts';
import { destroyShip, wreckShip } from './combat-wreck.ts';
import { WRECK_BURST_GRACE } from '../constants/wreck.ts';
import {
  CHARACTER_LINE_SECONDS, DISREPUTE_MURDER, HERMIT_HIT_LINE,
} from '../constants/character.ts';
import { afterDeed, characterVerdict } from './character.ts';

/** Seconds the cockpit beams stay lit after a shot. */
export const BEAM_FLASH = 0.12;

/**
 * What hurt the player. Five things can, and this is the whole list — the five
 * `StepHost.applyPlayerDamage` calls in world-step.ts.
 *
 * It exists because the source is a STATIC fact at each call site. A guess made
 * afterwards, from the size of the number, cannot error. It can only be quietly
 * wrong. Any balance change to the ram or the shot roll would also rewrite that
 * guess. What each of the five costs is a row of the inventory in
 * docs/DAMAGE-PATHS.md.
 */
export type DamageSource =
  /** an NPC's gun found you */
  | 'laser'
  /** a missile got past the E.C.M. */
  | 'missile'
  /** a ship flew into you */
  | 'ram'
  /** you flew into the Coriolis */
  | 'station'
  /** a canister broke on the hull */
  | 'cargo';

/** Scratch vectors, so no allocation happens when a shot is resolved. */
export interface CombatScratch {
  a: THREE.Vector3;
  b: THREE.Vector3;
  q: THREE.Quaternion;
  ray: THREE.Raycaster;
}

export class Combat {
  private readonly world: World;

  /**
   * Holds the World and nothing else.
   *
   * The commander is passed per call, deliberately. `Game.commander` is
   * REPLACED on a respawn, and again when a snapshot is restored. So a held
   * reference would quietly credit bounties to a commander who no longer
   * exists.
   */
  constructor(world: World) {
    this.world = world;
  }

  /**
   * Pull the trigger in the current view.
   *
   * @param viewDir where THIS view points — not where the nose does, which is
   * why rear-view shots hit what is behind you.
   */
  fire(
    commander: CommanderData,
    sys: ShipSystems,
    playerPos: THREE.Vector3,
    viewDir: THREE.Vector3,
    view: number,
    witchspace: boolean,
    scratch: CombatScratch,
  ): CombatEvent[] {
    const laser = laserForView(commander, view);
    // Three conditions let the gun go off:
    //
    // 1. a mount is fitted for this view;
    // 2. that mount is cooled and not overheated;
    // 3. the bank can pay the shot and still hold one point in reserve.
    //
    // A shot blocked for any of these spends nothing — no heat, no energy, no
    // beam. That is why all three sit in this one guard, before chargeShot.
    if (!laser || !canFire(sys) || !canAffordLaserShot(sys)) return [];
    chargeShot(sys, laser);
    spendLaserEnergy(sys);

    const sounds: CombatEvent[] = [heard('laser')];
    const out: CombatEvent[] = [{ kind: 'fired' }];
    const traced = traceShot(
      playerPos, viewDir, this.world.npcs, this.world.cargo.items,
      witchspace ? null : this.world.station, scratch.ray, scratch.a);
    // THE FIREBALL TAKES THE REST OF THE BURST (docs/TODO/173, GitHub #35).
    //
    // `traceShot` skips a dead ship at once and `Combat.wreck` despawns the
    // hull in the frame it dies. So the shot after a kill reaches whatever was
    // behind the target, and a commander who held the trigger never chose it.
    // Measured, that shot is 0.25 seconds later. It turns a Viper flying the
    // same fight into a hunter for the rest of the flight.
    //
    // IT IS TURNED INTO A MISS HERE, before anything reads it. So the beam, the
    // flash, the offence and the hit all agree that the shot did not get there.
    // A branch further down would leave the cockpit beams converging on a ship
    // that took nothing.
    //
    // ONLY A BYSTANDER IS COVERED, and `isHostileToPlayer` is the one home of
    // that question (hostility.ts). A pirate out in the lane is hostile by its
    // role, so a queue of pirates costs the commander nothing there. A Viper
    // she already provoked stays shootable, because she is in a fight with it.
    // Inside the station's truce an unprovoked pirate is a bystander too, and
    // that follows the truce rather than widening this rule.
    const shot = this.inTheFireball(sys, traced, commander, playerPos, witchspace)
      ? { kind: 'miss' as const } : traced;

    // Aim assist, the visible half: bend the cockpit beams onto whatever the
    // shot found. Beams that visibly converge on the target read as a gunsight
    // at work. A silent near-miss-counts-as-hit reads as a bug. The shot is
    // already resolved; this only makes it legible.
    out.push({
      kind: 'beam',
      at: shot.kind === 'ship' ? shot.ship.object.position
        : shot.kind === 'cargo' ? shot.cargo.object.position : null,
    });

    if (shot.kind === 'cargo') {
      sounds.push(heard('hit', shot.cargo.object.position.clone()));
      // The HIT goes across, exactly as it does to a ship: the canister's own
      // released bank decides whether it breaks up (cargo.ts). Every laser a
      // flyable hull carries still breaks one in a single hit.
      const broke = this.world.cargo.takeLaserHit(shot.cargo, laser.hit);
      this.world.effects.explosion(shot.cargo.object.position.clone(), 0x8ad0ff,
        broke ? { count: 10, speed: 55, duration: 0.4 }
          : { count: 4, speed: 30, duration: 0.25 });
      if (!broke) return [...sounds, ...out];
      if (shot.cargo.kind === 'capsule') {
        // there is someone in that thing
        out.push(say('ESCAPE CAPSULE DESTROYED', 3), ...this.podKilled(commander, shot.cargo));
      } else {
        out.push(say('CARGO DESTROYED', 2));
      }
      return [...sounds, ...out];
    }

    if (shot.kind === 'station') {
      // sparks off the hull, but the station itself shrugs it off. The impact
      // point is worked out before the bang rather than after it, because the
      // bang is placed there now (docs/TODO/142). A station is big enough that
      // where you scraped it is not where its centre is.
      const impact = playerPos.clone().addScaledVector(viewDir, shot.distance);
      sounds.push(heard('hit', impact));
      this.world.effects.explosion(impact, 0xd8ffcc, { count: 10, speed: 60, duration: 0.4 });
      // Offender, not fugitive. A stray shot on the way into a dock is easy to
      // make, and fugitive means every police ship in the galaxy hunts you
      // forever. The Vipers are the real punishment. A shot at *them* escalates
      // you to fugitive the normal way.
      out.push(say('STATION HULL HIT — DEFENCES SCRAMBLING', 3),
        { kind: 'offence', level: OFFENDER });
      return [...sounds, ...out];
    }

    if (shot.kind === 'ship') {
      sounds.push(heard('hit', shot.ship.object.position.clone()));
      // impact flash at the target so hits read clearly
      this.world.effects.explosion(shot.ship.object.position.clone(), 0xd8ffcc,
        { count: 8, speed: 70, duration: 0.35 });
      // Read before the hit, because the hit is what sets it. A false-to-true
      // move is the first shot this ship took from the commander. So the line
      // below is said once per ship, however long the fight runs.
      const wasProvoked = shot.ship.state.provokedByPlayer;
      // The HIT goes across, not the damage. What a hit is worth depends on the
      // target's own defence, immunity and multiplier, and the ship applies its
      // own (npc.ts `takeLaserHit`). A station shrugs it off with no case here,
      // and the Constrictor halves it without a word to the mission.
      const destroyed = shot.ship.takeLaserHit(laser.hit, playerPos, true);
      // WHAT YOU JUST HIT, ahead of the launch and the record. docs/TODO/130
      // fixed the running order once: what you did, what the sky did about it,
      // where you now stand. This deed had no first line at all until
      // docs/TODO/173, so a stray shot on a Viper explained nothing.
      //
      // Not for a kill. A destroyed ship comes for nobody, and `destroy` below
      // has its own words for it.
      const turned = !wasProvoked && shot.ship.state.provokedByPlayer && !destroyed;
      // The law's words for the three roles it protects. A hermit is outside
      // the law and inside the character's ledger, so its warning is
      // `constants/character.ts`'s, and it takes the same once-per-ship frame
      // (docs/TODO/187).
      const harm = !turned ? null
        : shot.ship.role === 'hermit' ? HERMIT_HIT_LINE
        : harmVerdict(shot.ship.role);
      if (harm) out.push(say(harm, 3));
      out.push({ kind: 'offence', level: offenceFor(shot.ship.role, false) });
      if (destroyed) {
        // The grace is armed HERE and nowhere else, because this is the one
        // branch where the commander's own trigger did the killing. A ram, a
        // missile and a collision each kill without a held burst behind them.
        sys.wreckGrace = WRECK_BURST_GRACE;
        // destroy() reports its explosion before its semantic consequences;
        // keep all sounds ahead of events the Game applies after this returns.
        for (const event of destroyShip(this.world, commander, shot.ship)) {
          if (event.kind === 'sound'
              || event.kind === 'countdown'
              || event.kind === 'dockingMusic') sounds.push(event);
          else out.push(event);
        }
      }
    }
    return [...sounds, ...out];
  }

  /**
   * Is this shot spent on the fireball of the ship the commander just killed?
   *
   * Two conditions, and both must hold. The grace still runs, and the shot
   * found a bystander. A **bystander** is a ship that
   * `isHostileToPlayer` says is not in the fight with the commander.
   *
   * The station, a canister and a miss are all false. The grace is about a ship
   * that was minding its own business, and none of those three is one.
   *
   * @param witchspace there is no station out there, so the truce cannot hold.
   * `Infinity` says that, rather than a distance to a station the world left
   * behind.
   */
  private inTheFireball(
    sys: ShipSystems, shot: ShotHit<NpcShip, Canister>, commander: CommanderData,
    playerPos: THREE.Vector3, witchspace: boolean,
  ): boolean {
    if (sys.wreckGrace <= 0 || shot.kind !== 'ship') return false;
    const toStation = witchspace ? Infinity
      : playerPos.distanceTo(this.world.station.position);
    return !isHostileToPlayer(shot.ship, commander.legalStatus, toStation);
  }

  /**
   * What it costs to kill the pilot in a capsule: the record, and the
   * reputation.
   *
   * THE LAW ASKS THE SAME QUESTION IT ASKS ABOUT THE SHIP. `offenceFor` is the
   * one home of "whose destruction is a crime", and the capsule carries the role
   * it needs (`Canister.occupant`). Every capsule used to be a Fugitive offence
   * whoever was in it. So the destruction of a raider's pod outranked the
   * destruction of the raider itself — which is GitHub #28. A Clean answer is a
   * no-op at `raiseLegal`, exactly as it is for a pirate's hull.
   *
   * THE REPUTATION IS CHARGED WHATEVER THE RECORD SAYS. A pirate in a capsule
   * is still somebody who cannot shoot back, so the deed is `DISREPUTE_MURDER`
   * like any other murder. This is the clearest case in the game where the two
   * ladders move apart. Shoot a raider's capsule: no Viper comes, and your
   * reputation is made anyway.
   */
  private podKilled(c: CommanderData, pod: { occupant: string }): CombatEvent[] {
    const out: CombatEvent[] = [{ kind: 'offence', level: offenceFor(pod.occupant, true) }];
    const wasDisrepute = c.disrepute ?? 0;
    c.disrepute = afterDeed(wasDisrepute, DISREPUTE_MURDER);
    const verdict = characterVerdict(wasDisrepute, c.disrepute);
    if (verdict) out.push(later(verdict, CHARACTER_LINE_SECONDS));
    return out;
  }

  /**
   * Destruction credited to the player: bounty, kills, rating, legal status,
   * contract progress and the Navy mission.
   *
   * The rule is `combat-wreck.ts`'s. This is the delegator that keeps the call
   * site, and there are four of those outside this file.
   */
  destroy(commander: CommanderData, npc: NpcShip): CombatEvent[] {
    return destroyShip(this.world, commander, npc);
  }

  /**
   * Take a ship out of the sky, with no credit to anyone. Same delegation, and
   * `combat-wreck.ts` says why the two paths are separate.
   */
  wreck(npc: NpcShip): CombatEvent[] {
    return wreckShip(this.world, npc);
  }

  /**
   * The player takes a hit of `damage` WHOLE POOL POINTS.
   *
   * Only the caller knows where the ship's nose is. So the direction is
   * resolved here into the one bit the damage model wants: did it come from
   * ahead?
   *
   * The number arrives already finished, and in the commander's own unit. An
   * NPC laser met armour once (`gunnery.ts`). A ram, a canister, the Coriolis
   * wall or a warhead is a stated `IMPACT` (`constants/impact.ts`).
   */
  hitPlayer(
    sys: ShipSystems,
    damage: PlayerPoolPoints,
    from: THREE.Vector3,
    playerPos: THREE.Vector3,
    playerQuat: THREE.Quaternion,
    scratch: CombatScratch,
  ): CombatEvent[] {
    // WHICH FACE is `shield-face.ts` and not this file. A training episode asks
    // the same question of its own target. One rule grows two homes when two
    // places ask it.
    const result = applyDamage(
      sys, damage, hitFromAhead(from, playerPos, playerQuat, scratch.a, scratch.q));

    const out: CombatEvent[] = [heard('damage')];
    if (result.wreckedSomething) out.push({ kind: 'breach' });
    if (result.destroyed) out.push({ kind: 'died', reason: 'SHIP DESTROYED' });
    return out;
  }
}
