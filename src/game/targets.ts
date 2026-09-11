// What the ship can fight, and which one the pilot picked (docs/TODO/206 M1).
//
// In a fight the computer lines the ship up, and the pilot fires. The pilot
// chooses what to fight from this list: every ship, rock and derelict within
// scanner range. Chris's words of 2026-09-11: a trader is on the list, and
// the law answers as it does today.
//
// THE LIST IS DERIVED STATE, as the course list is (`courses.ts`). The pick
// is saved, because it decides what the computer flies at. It is one flag on
// the picked ship's own state, `NpcState.targeted`. A ship has no stable id,
// and its state is saved with it, so the flag goes where the ship goes.
//
// THE PICK SITS ON TOP OF `threat-lock.ts`, and it never changes that rule.
// Three places share the lock: the co-pilot, an armed trader, and the
// training episode. With no pick, the co-pilot takes the lock's threat.
//
// It is pure over the fleet. It spends no rule of its own: who attacks the
// commander is `hostility.ts`, and whom the law protects is `law.ts`.

import type * as THREE from 'three';
import type { NpcShip } from './npc.ts';
import { isHostileToPlayer } from './hostility.ts';
import { harmVerdict } from './law.ts';
import { SCANNER_RANGE } from '../constants/console.ts';

/** One row of the list. */
export interface TargetRow {
  readonly ship: NpcShip;
  /** what the player sees the ship called, as the arrival lines name it */
  readonly name: string;
  readonly range: number;
  /** what the ship is to the pilot, in the player's words */
  readonly standing: string;
  /** what an attack costs, where it costs something beyond the fight */
  readonly cost: string | null;
  readonly picked: boolean;
}

/** Everything the list is raised from. */
export interface TargetView {
  readonly npcs: readonly NpcShip[];
  readonly playerPos: THREE.Vector3;
  readonly legalStatus: number;
  /** for the station's truce, as `isHostileToPlayer` asks */
  readonly playerToStation: number;
}

/** What each role is to the pilot, when it is not attacking. */
const STANDING: Readonly<Record<string, string>> = {
  trader: 'TRADER',
  police: 'POLICE',
  pirate: 'PIRATE',
  hunter: 'BOUNTY HUNTER',
  thargoid: 'THARGOID',
  thargon: 'THARGON',
  asteroid: 'ASTEROID',
  hermit: 'ROCK HERMIT',
  generation: 'DERELICT SHIP',
};

/**
 * The ships the pilot can fight, in order. The ships that attack come first,
 * nearest first. Every other ship follows, nearest first. The picked ship is
 * always on the list, even beyond scanner range.
 */
export function targetList(v: TargetView): TargetRow[] {
  const rows = v.npcs
    .filter((n) => n.state.alive && !n.state.docked
      && (n.state.targeted || n.object.position.distanceTo(v.playerPos) <= SCANNER_RANGE))
    .map((ship) => {
      const hostile = isHostileToPlayer(ship, v.legalStatus, v.playerToStation);
      return {
        row: {
          ship,
          name: ship.object.name.toUpperCase(),
          range: ship.object.position.distanceTo(v.playerPos),
          standing: hostile ? 'HOSTILE' : STANDING[ship.role] ?? 'SHIP',
          cost: costOf(ship.role),
          picked: ship.state.targeted,
        },
        hostile,
      };
    });
  rows.sort((a, b) => Number(b.hostile) - Number(a.hostile) || a.row.range - b.row.range);
  return rows.map((r) => r.row);
}

/**
 * What an attack costs beyond the fight. The law's own rule says whom it
 * protects (`harmVerdict`). The hermit is not the law's, and a dead hermit
 * costs the commander's name (`DISREPUTE_HERMIT_KILL`).
 */
function costOf(role: string): string | null {
  if (harmVerdict(role) !== null) return 'THE LAW PROTECTS THIS SHIP';
  if (role === 'hermit') return 'KILLING THE HERMIT HURTS YOUR REPUTATION';
  return null;
}

/** The ship the pilot picked, if it still lives. */
export function pickedTarget(npcs: readonly NpcShip[]): NpcShip | null {
  return npcs.find((n) => n.state.targeted && n.state.alive) ?? null;
}

/** Pick one ship, and let go of any other. Null lets go of all of them. */
export function pickTarget(npcs: readonly NpcShip[], ship: NpcShip | null): void {
  for (const n of npcs) n.state.targeted = n === ship;
}
