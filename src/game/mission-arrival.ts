// What the console says about a mission when the player arrives in a system
// (docs/TODO/203 M4).
//
// The machine says what a leg is for. It cannot say where the target is,
// because it knows no positions. This file does: it reads the tagged things
// the world spawned, and it says, in words, how far each one is and which way.
// For a job at another world it says how many jumps away that world is. Each
// line is a full sentence. A pilot who arrives with a job open wants to know
// what to do next, and not to decode a label.
//
// It is pure. The arrival (hyperspace-actions.ts) gathers the sightings and
// hands them in, so a test needs no world.

import type * as THREE from 'three';
import type { StarSystem } from '../galaxy/galaxy.ts';
import { routeTable } from '../galaxy/route.ts';
import { legOf } from '../missions/lookups.ts';
import type { MissionState, Skeleton } from '../missions/model.ts';
import { SKELETONS, skeletonById } from '../missions/skeletons/index.ts';

/** A tagged thing the world holds, as the arrival sees it. */
export interface Sighting {
  tag: string;
  /** what it is, in capitals: a hull's name, CANISTER or POD */
  name: string;
  position: THREE.Vector3;
}

/** `3,200`, rounded to the hundred, for a line a pilot reads at a glance. */
export function roundDistance(units: number): string {
  const rounded = Math.max(100, Math.round(units / 100) * 100);
  return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Which way a thing lies, in the ship's own words: AHEAD or BEHIND, TO PORT
 * or TO STARBOARD, ABOVE or BELOW. At most two of the three, the largest
 * first, and only a direction that carries more than a third of the distance.
 *
 * @param local the offset from the ship, in the ship's frame: x right, y up,
 * -z ahead (invariant 7)
 */
export function bearingWords(local: { x: number; y: number; z: number }): string {
  const dist = Math.hypot(local.x, local.y, local.z);
  if (dist === 0) return 'RIGHT HERE';
  const axes: [number, string][] = [
    [Math.abs(local.z), local.z < 0 ? 'AHEAD' : 'BEHIND'],
    [Math.abs(local.x), local.x > 0 ? 'TO STARBOARD' : 'TO PORT'],
    [Math.abs(local.y), local.y > 0 ? 'ABOVE' : 'BELOW'],
  ];
  const words = axes
    .filter(([size]) => size > dist / 3)
    .sort((a, b) => b[0] - a[0])
    .slice(0, 2)
    .map(([, word]) => word);
  return words.length ? words.join(' AND ') : 'AHEAD';
}

/** The lines for every live leg, at `here`, in the order the legs are held. */
export function arrivalLines(
  st: MissionState,
  systems: readonly StarSystem[],
  here: number,
  sightings: readonly Sighting[],
  playerPos: THREE.Vector3,
  playerQuat: THREE.Quaternion,
  skeletons: readonly Skeleton[] = SKELETONS,
): string[] {
  const out: string[] = [];
  const inverse = playerQuat.clone().invert();
  const where = (position: THREE.Vector3): string => {
    const rel = position.clone().sub(playerPos);
    return `${roundDistance(rel.length())} AWAY, ${bearingWords(rel.applyQuaternion(inverse))}`;
  };
  let routes: ReturnType<typeof routeTable> | null = null;
  for (const live of st.live) {
    const s = skeletonById(live.skeleton, skeletons);
    if (!s) continue;
    const leg = legOf(s, live.leg);
    if (live.target !== null && live.target !== here) {
      routes ??= routeTable(systems, here);
      const jumps = routes.jumps[live.target];
      const world = systems[live.target].name.toUpperCase();
      out.push(!Number.isFinite(jumps)
        ? `YOUR JOB AT ${world} IS OUT OF REACH FROM HERE.`
        : `YOUR JOB AT ${world} IS ${jumps} JUMP${jumps === 1 ? '' : 'S'} AWAY.`);
      continue;
    }
    const world = systems[here].name.toUpperCase();
    const seen = live.tag === null ? undefined : sightings.find((x) => x.tag === live.tag);
    switch (leg.verb.kind) {
      case 'deliver':
        out.push(`THIS IS ${world}. DOCK AT THE STATION TO DELIVER.`);
        break;
      case 'smuggle':
        out.push(`THIS IS ${world}. DOCK UNSCANNED TO LAND THE GOODS.`);
        break;
      case 'recover':
        if (seen) out.push(`THE CANISTER YOU WERE SENT FOR IS ADRIFT ${where(seen.position)}.`);
        break;
      case 'rescue':
        if (seen) out.push(`THE POD YOU WERE SENT FOR IS ADRIFT ${where(seen.position)}.`);
        break;
      case 'hunt':
        if (seen) out.push(`THE ${seen.name} YOU WERE SENT TO DESTROY IS ${where(seen.position)}.`);
        break;
      case 'scan':
        if (seen) out.push(`THE ${seen.name} YOU WERE SENT TO WATCH IS ${where(seen.position)}. KEEP IT IN VIEW.`);
        break;
      case 'escort':
        if (seen) out.push(`THE ${seen.name} YOU ARE ESCORTING IS ${where(seen.position)}. STAY WITH IT TO THE STATION.`);
        break;
      case 'ambush':
        // the verb itself speaks on arrival, through the machine
        break;
    }
  }
  return out;
}
