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
// IT TAKES EACH INGREDIENT SEPARATELY and never a GameState. That is what makes
// the class testable, and what lets `destroy()` be handed a different commander.
// To assemble the seven arguments the player's own trigger wants is a different
// job. `combat-player.ts` is where that job lives (docs/TODO/156).

import * as THREE from 'three';
import type { World } from './world.ts';
import type { NpcShip } from './npc.ts';
import type { ShipSystems } from './systems.ts';
import type { PlayerPoolPoints } from './damage-units.ts';
import { type CommanderData, formatCredits, killValue } from './commander.ts';
import { laserForView, canFire, chargeShot } from './gunnery.ts';
import { traceShot } from './shot.ts';
import { applyDamage, canAffordLaserShot, spendLaserEnergy } from './systems.ts';
import { hitFromAhead } from './shield-face.ts';
import { harmVerdict, offenceFor } from './law.ts';
import { OFFENDER, FUGITIVE, CONTRABAND } from '../constants/law.ts';
import { constrictorDestroyed } from './missions.ts';
import { random, randomInt } from './rng.ts';
import { heard, later, say, type CombatEvent } from './combat-events.ts';
import { ESCAPE_CHANCE, HERMIT_CONTRABAND_MIN, HERMIT_CONTRABAND_SPAN,
  MINING_YIELD_MIN, MINING_YIELD_SPAN } from '../constants/wreck.ts';
import {
  CHARACTER_LINE_SECONDS, DISREPUTE_HERMIT_KILL, DISREPUTE_MURDER,
} from '../constants/character.ts';
import { afterDeed, characterVerdict } from './character.ts';
import { ORE, ORDINARY_GOODS } from '../constants/commodities.ts';

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
    const shot = traceShot(
      playerPos, viewDir, this.world.npcs, this.world.cargo.items,
      witchspace ? null : this.world.station, scratch.ray, scratch.a);

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
      const harm = turned ? harmVerdict(shot.ship.role) : null;
      if (harm) out.push(say(harm, 3));
      out.push({ kind: 'offence', level: offenceFor(shot.ship.role, false) });
      if (destroyed) {
        // destroy() reports its explosion before its semantic consequences;
        // keep all sounds ahead of events the Game applies after this returns.
        for (const event of this.destroy(commander, shot.ship)) {
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
   */
  destroy(commander: CommanderData, npc: NpcShip): CombatEvent[] {
    const out = this.wreck(npc);
    const c = commander;

    if (npc.role !== 'asteroid') {
      c.kills += 1;
      // rating counts difficulty, not bodies: see killValue()
      c.combatScore += killValue(npc.state.threatTier);
    }

    if (npc.role === 'pirate') {
      for (const k of c.contracts) {
        if (k.kind !== 'bounty' || k.destination !== c.systemIndex) continue;
        if (k.progress >= k.qty) continue;
        k.progress += 1;
        if (k.progress >= k.qty) {
          out.push(say('BOUNTY CONTRACT COMPLETE — RETURN TO A STATION', 5));
        }
      }
    }

    const crime = offenceFor(npc.role, true);
    out.push({ kind: 'offence', level: crime });
    // ...and the other direction. A pirate down is police work, and it pays a
    // record off a rung at a time (docs/TODO/160). It is pushed for every kill
    // and answered by the rule, which is what keeps the role list in one file.
    out.push({ kind: 'atonement', role: npc.role });

    // What it does to your REPUTATION, which the fine will not wash off. To
    // crack a hermit marks a career; so does the destruction of any lawful ship
    // (the Fugitive-grade offence). Reached only through `destroy`, the
    // player-credited path.
    const wasDisrepute = c.disrepute ?? 0;
    if (npc.role === 'hermit') {
      c.disrepute = afterDeed(wasDisrepute, DISREPUTE_HERMIT_KILL);
    } else if (crime === FUGITIVE) {
      c.disrepute = afterDeed(wasDisrepute, DISREPUTE_MURDER);
    }
    // ...and what THAT is called, once the bounty and the record are read
    // (docs/TODO/129). Either deed is 40, so it can cross two rungs at
    // once; `characterVerdict` names the one you landed on, not each one you
    // passed through.
    const verdict = characterVerdict(wasDisrepute, c.disrepute ?? 0);
    if (verdict) out.push(later(verdict, CHARACTER_LINE_SECONDS));

    if (npc.bounty > 0) {
      c.credits += npc.bounty;
      out.push(say(`BOUNTY: ${formatCredits(npc.bounty)}`, 3));
    }
    if (npc.role === 'asteroid' && c.equipment.miningLaser) {
      this.world.cargo.spawn(npc.object.position,
        MINING_YIELD_MIN + randomInt(MINING_YIELD_SPAN), ORE);
    }
    if (npc.state.isMissionTarget) {
      const e = constrictorDestroyed(c);
      if (e) {
        out.push(say(`CONSTRICTOR DESTROYED — ${formatCredits(e.bounty)} NAVY BOUNTY`, 6));
      }
    }
    return out;
  }

  /**
   * Take a ship out of the sky, with no credit to anyone.
   *
   * This is the shared path. An NPC killed by another NPC, or by a collision,
   * goes through here and NOT through destroy(). That is what stops a bounty
   * for a fight you watched.
   */
  wreck(npc: NpcShip): CombatEvent[] {
    const out: CombatEvent[] = [{ kind: 'wrecked', npc }];
    // Taken before the despawn below. The sound is placed here now, and the
    // ship is gone by the time the Game reads the event (docs/TODO/142).
    const at = npc.object.position.clone();
    this.world.effects.explosion(at.clone());
    this.world.despawn(npc);

    // wily traders and many pirates punch out at the last moment
    if (npc.role === 'trader' || npc.role === 'pirate' || npc.role === 'hunter') {
      const chance = npc.role === 'trader' ? ESCAPE_CHANCE.trader : ESCAPE_CHANCE.other;
      // The role goes WITH the capsule. The ship is despawned three lines up,
      // and nothing else remembers whose ship it was (GitHub #28).
      if (random() < chance) {
        this.world.cargo.spawnCapsule(npc.object.position.clone(), npc.role);
      }
    }
    if (npc.cargoDrop > 0) {
      this.world.cargo.spawn(npc.object.position,
        Math.floor(random() * (npc.cargoDrop + 1)), ORDINARY_GOODS);
    }
    // a cracked hermit spills the contraband it dealt in — the smuggler's payday
    if (npc.role === 'hermit') {
      this.world.cargo.spawn(npc.object.position,
        HERMIT_CONTRABAND_MIN + randomInt(HERMIT_CONTRABAND_SPAN), CONTRABAND);
    }
    // the drones go dead when the last mothership does
    if (npc.role === 'thargoid'
        && !this.world.npcs.some((n) => n.state.alive && n.role === 'thargoid')) {
      for (const t of this.world.npcs) {
        if (t.role === 'thargon') t.state.inert = true;
      }
      out.push(say('THARGONS DEACTIVATED', 3));
    }
    return [heard('explosion', at), ...out];
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
