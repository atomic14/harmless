// What a mission asks the ship to do here, as a course (docs/TODO/208 M1).
//
// A mission was a line on a screen and a line on the console. It is a button
// over the view now: the first row of the course list, in the words of the
// job. Chris asked for that on 2026-09-11: *"the missions are becoming much
// more important - they need to feel part of the game"*.
//
// It reads the live legs (`missions/queries.ts`) and the sky. It matches the
// leg's tag to the ship or the canister that the world spawned for it
// (`spawning.ts`). What comes back is the words for the row, and what the
// ship must DO about it.
//
// FOUR SHAPES cover the five verbs that need a flight:
//
//   - a HUNT is a fight, so the course picks the ship and the aim flies it;
//   - a SCAN is a hold: stay near it, and keep the nose on it;
//   - an ESCORT flies alongside, and the fight comes to the pilot;
//   - a RECOVER and a RESCUE are a scoop;
//   - a SMUGGLE is a slip: the station, on a line wide of every policeman.
//
// A deliver and an ambush need no course of their own. Both end at the
// station, and the station course flies there.

import type * as THREE from 'three';
import type { NpcShip } from './npc.ts';
import type { Canister } from './cargo.ts';
import { liveLegs } from '../missions/queries.ts';
import type { MissionState, Skeleton } from '../missions/model.ts';
import { SKELETONS } from '../missions/skeletons/index.ts';

/** What the ship does about this leg. */
export type MissionHow = 'fight' | 'hold' | 'escort' | 'scoop' | 'slip';

/** The mission's course: its words, what to do, and what to do it to. */
export interface MissionCourse {
  /** the row's words, in the job's own terms */
  readonly what: string;
  readonly how: MissionHow;
  /** the ship the leg is about, or null when the leg is about a canister */
  readonly ship: NpcShip | null;
  readonly at: THREE.Vector3;
  /** how fast that target is moving, so a hold and an escort can match it */
  readonly speed: number;
}

/**
 * What this system's live leg asks for, or null when nothing here does.
 *
 * The first live leg that has work in this system wins. A commander with two
 * jobs in one system flies them one at a time.
 */
export function missionCourse(
  st: MissionState,
  here: number,
  npcs: readonly NpcShip[],
  items: readonly Canister[],
  stationPos: THREE.Vector3,
  skeletons: readonly Skeleton[] = SKELETONS,
): MissionCourse | null {
  for (const { live, leg } of liveLegs(st, skeletons)) {
    if (live.target !== here) continue;
    // A smuggling run has no tagged thing in the sky: what it asks for is a
    // way past the police. Every other course below needs its target, and a
    // leg with no tag has none.
    const ship = live.tag === null ? null
      : npcs.find((n) => n.state.alive && n.state.missionTag === live.tag) ?? null;
    const item = live.tag === null ? null
      : items.find((c) => c.missionTag === live.tag) ?? null;
    const name = ship?.object.name.toUpperCase() ?? '';
    switch (leg.verb.kind) {
      case 'hunt':
        if (ship) {
          return { what: `HUNT THE ${name}`, how: 'fight', ship, at: ship.object.position, speed: ship.state.speed };
        }
        break;
      case 'scan':
        if (ship) {
          return { what: `SCAN THE ${name}`, how: 'hold', ship, at: ship.object.position, speed: ship.state.speed };
        }
        break;
      case 'escort':
        if (ship) {
          return { what: `ESCORT THE ${name}`, how: 'escort', ship, at: ship.object.position, speed: ship.state.speed };
        }
        break;
      case 'recover':
        if (item) {
          return { what: 'RECOVER THE CARGO', how: 'scoop', ship: null, at: item.object.position, speed: 0 };
        }
        break;
      case 'rescue':
        if (item) {
          return { what: 'PICK UP THE SURVIVOR', how: 'scoop', ship: null, at: item.object.position, speed: 0 };
        }
        break;
      case 'smuggle':
        return {
          what: 'SLIP PAST THE POLICE', how: 'slip', ship: null, at: stationPos, speed: 0,
        };
      default:
        // A deliver and an ambush both end at the station, and the station
        // course flies there.
        break;
    }
  }
  return null;
}
