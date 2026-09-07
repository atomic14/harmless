// Every skeleton the game ships, in one list.
//
// The machine looks a mission up here by id, unless a test hands it a list of
// its own. `test/mission-skeletons.test.ts` lints every entry, so a skeleton
// with a leg that cannot fail, or a lead that names nothing, never ships.

import type { Skeleton } from '../model.ts';
import { CONSTRICTOR } from './constrictor.ts';
import { SIDE_JOBS } from './side.ts';

export const SKELETONS: readonly Skeleton[] = [CONSTRICTOR, ...SIDE_JOBS];

/**
 * The arcs of the tour, in order. The arc at index k starts at the k-th
 * world `arcStarts` (tour.ts) places. The Constrictor is a Navy arc outside
 * the tour, with its own gate. The five arcs of docs/TODO/192 M2 fill this.
 */
export const ARC_TOUR: readonly string[] = [];

export function skeletonById(
  id: string, from: readonly Skeleton[] = SKELETONS,
): Skeleton | null {
  return from.find((s) => s.id === id) ?? null;
}
