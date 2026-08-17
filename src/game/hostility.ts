// Who is in this fight: whether a ship attacks the commander, and the fleet
// sweeps that read the answer.
//
// ONE RESPONSIBILITY. `isHostileToPlayer` is the single home of "does this ship
// attack the player?". Six surfaces read it, and all six must give one answer
// (docs/TODO/158). They are the ship's own decision loop, the scanner blip, the
// threat arrow, the condition light, the bought combat computer and the bribe
// key.
//
// IT NAMES NO SHIP CLASS, and `test/hostility.test.ts` holds that. The rule
// reads a role, four state flags and a position. It reads no hull, no weapon
// and no flight model. So `NpcShip` is one thing that satisfies `HostileShip`,
// rather than the type of the rule itself (invariant 15).
//
// THE LAW OWNS THE TWO PIECES THIS FILE SPENDS. `lawTakesInterest` says which
// legal status each of the law's two roles comes for. `truceHolds` says where
// the station's peace holds. Both live in `game/law.ts`. This file asks them,
// and it restates neither.
//
// It came out of `game/npc.ts`, where it sat inside a class file of 1,676
// lines (docs/TODO/169 M2).

import type * as THREE from 'three';

import type { NpcRole } from './ship-roles.ts';
import { PLAYER_INTEREST_RANGE } from '../constants/player-interest.ts';
import { LAW_ROLE_NAMES } from '../constants/law.ts';
import { lawTakesInterest, truceHolds } from './law.ts';

/**
 * What a fleet sweep reads: where a ship is, and whether it still exists.
 *
 * `nearestNpc` asks nothing else. It is stated apart from `HostileShip` below
 * so that the narrower question keeps the narrower dependency.
 */
export interface FleetShip {
  readonly object: { readonly position: THREE.Vector3 };
  readonly state: { readonly alive: boolean };
}

/**
 * What the hostility rule reads, and the whole of it.
 *
 * Four flags and a role. A caller that can answer these can ask the rule, so a
 * test fixture needs no hull, no geometry and no flight model.
 */
export interface HostileShip extends FleetShip {
  readonly role: NpcRole;
  readonly state: {
    readonly alive: boolean;
    readonly inert: boolean;
    readonly satisfied: boolean;
    readonly provokedByPlayer: boolean;
  };
}

/**
 * The single source of truth for "does this ship attack the player?".
 *
 * Both the NPC's own decision loop and the game's condition and HUD logic use
 * it. legalStatus: 0 clean, 1 offender, 2 fugitive.
 *
 * @param playerToStation how far the commander is from the station, for the
 * truce below. It is REQUIRED rather than defaulted. A reader that forgot it
 * would treat a ship that attacks nobody as a threat. That is a red blip, or
 * the commander's own combat computer aimed at it (docs/TODO/158).
 */
export function isHostileToPlayer(
  npc: HostileShip, legalStatus: number, playerToStation: number,
): boolean {
  if (!npc.state.alive || npc.state.inert) return false;
  // A ship that took its payday stops caring about you. That is what makes a
  // jettisoned cargo a real escape rather than a donation. It is asked FIRST,
  // before the role, so it means the same thing for every ship that can be
  // bought. A pirate takes cargo and a policeman takes credits (docs/TODO/123).
  // What they have in common is that they are done with you.
  if (npc.state.satisfied) return false;
  // The station's truce, and the commander who ends it. `provokedByPlayer` is
  // set by `takeDamage` for damage from the commander, whatever the role. So a
  // ship shot at inside the truce answers exactly as it does outside one. A
  // truce that covered that case would make the port a free firing position.
  if (!npc.state.provokedByPlayer && truceHolds(npc.role, playerToStation)) return false;
  return (
    npc.role === 'pirate' || npc.role === 'thargoid' || npc.role === 'thargon' ||
    // The law's two roles. They come for you on the record, by
    // `lawTakesInterest` in game/law.ts, which owns which status each of them
    // reads. They also come because you shot at them.
    //
    // provokedByPlayer, not provoked. takeDamage() flags `provoked` for damage
    // from any source. To read it would let a Viper in a firefight with a
    // pirate turn on a clean commander as though he were a fugitive.
    ((npc.role === 'police' || npc.role === 'hunter')
      && (npc.state.provokedByPlayer || lawTakesInterest(npc.role, legalStatus)))
  );
}

/**
 * Is this ship both cross with you and close enough to act on it?
 *
 * The same range the ship itself engages at, from
 * `constants/player-interest.ts`. One home for it, because everything that
 * answers "who is in this fight" has to agree. Those are the condition light
 * below, and the bribe key, which may only buy off a ship that is on you.
 */
function engaging(
  npc: HostileShip, playerPos: THREE.Vector3, legalStatus: number, playerToStation: number,
): boolean {
  return isHostileToPlayer(npc, legalStatus, playerToStation)
    && npc.object.position.distanceTo(playerPos) < PLAYER_INTEREST_RANGE;
}

/**
 * Is anything close enough and cross enough to turn the condition light red?
 *
 * The light reports the rule rather than restating it. That is what stops the
 * console from going red at a ship which decided nothing.
 */
export function hostilesNear(
  npcs: readonly HostileShip[], playerPos: THREE.Vector3, legalStatus: number,
  playerToStation: number,
): boolean {
  return npcs.some((npc) => engaging(npc, playerPos, legalStatus, playerToStation));
}

/**
 * Which of the law's roles are in this fight for a reason the RECORD cannot
 * explain.
 *
 * A **grudge** is one ship's private quarrel with the commander.
 * `NpcShip.takeDamage` sets `provokedByPlayer` for damage from her gun,
 * whatever the role. The flag never comes down, and the legal record has
 * nothing to do with it.
 *
 * So the console can say `LEGAL STATUS: OFFENDER — BOUNTY HUNTERS WILL ATTACK
 * YOU` while the ship shooting at her is a police Viper she grazed. That is
 * docs/TODO/175, and GitHub #35 reported it in the player's own words.
 *
 * `recordVerdict` is right to read `lawTakesInterest` alone. It is the one home
 * of what a moved RECORD says. This is the other half, and `law.ts`'s
 * `grudgeVerdict` puts the words on it.
 *
 * IT READS `isHostileToPlayer` RATHER THAN THE FLAG. So one place answers for a
 * dead ship, an inert one, a bought-off one and the station's truce. That is
 * this file's whole point.
 *
 * It then drops every role the record already accounts for. So the line it
 * feeds never repeats the line beside it, and a Fugitive hears nothing at all:
 * her record explains both roles already.
 *
 * The roles come back in `LAW_ROLE_NAMES` order, so one sky gives one sentence.
 */
export function grudgeRolesNear(
  npcs: readonly HostileShip[], playerPos: THREE.Vector3, legalStatus: number,
  playerToStation: number,
): readonly string[] {
  return LAW_ROLE_NAMES
    .map(([role]) => role)
    .filter((role) => !lawTakesInterest(role, legalStatus)
      && npcs.some((npc) => npc.role === role
        && engaging(npc, playerPos, legalStatus, playerToStation)));
}

/**
 * The nearest ship of `role` that is engaging you, and how far off it is.
 *
 * What the bribe key spends. An offer can only go to a ship that is in this
 * fight, and "in this fight" is the rule the red light reports. It is not a
 * range of its own.
 */
export function nearestEngaging<T extends HostileShip>(
  npcs: readonly T[], playerPos: THREE.Vector3, legalStatus: number, role: string,
  playerToStation: number,
): { npc: T; distance: number } | null {
  return nearestNpc(npcs, playerPos,
    (npc) => npc.role === role && engaging(npc, playerPos, legalStatus, playerToStation));
}

/**
 * The nearest LIVING ship the predicate accepts, and how far off it is — or
 * null when the sky holds none.
 *
 * "Which one is nearest, of the ones that count?" was written out wherever it
 * was asked. The step's police scan had its own loop. The bribe key
 * (game/law-actions.ts) needed the same sweep at the same range, plus a second
 * one for the ships already in the fight.
 *
 * The predicate is the only thing that differs between them, so it is the only
 * thing passed. The aliveness and the distance are the part nobody should
 * restate.
 *
 * `inert` is deliberately NOT filtered here. A ship that stopped deciding is
 * still a ship in the sky, and `isHostileToPlayer` is the rule that knows
 * which questions care.
 *
 * The type travels with the caller. A caller that hands in `NpcShip`s gets an
 * `NpcShip` back, so the sweep needs no knowledge of the class.
 */
export function nearestNpc<T extends FleetShip>(
  npcs: readonly T[], from: THREE.Vector3, wants: (npc: T) => boolean,
): { npc: T; distance: number } | null {
  let best: { npc: T; distance: number } | null = null;
  for (const npc of npcs) {
    if (!npc.state.alive || !wants(npc)) continue;
    const distance = npc.object.position.distanceTo(from);
    if (!best || distance < best.distance) best = { npc, distance };
  }
  return best;
}
