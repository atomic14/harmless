// The tour: where each arc starts, from the seed.
//
// Chris set the shape on 2026-09-06 (docs/TODO/190, docs/TODO/192). There
// are five arcs. Each starts four to six jumps farther across the galaxy.
// Each ends two to four jumps from the next one's start. This file places
// the starts.
// Everything derives from the systems and the first world, never from the
// world's random stream, so the tour is the same in every career. Lave's
// tour is Lave's tour.
//
// A galactic jump runs the same rule on the new galaxy from the arrival
// world (machine.ts). Galaxies 3, 4, 6, 7 and 8 each strand a group of
// worlds. A commander who arrives on an island gets a tour of the island.
// The bands widen when a band is empty, and a start is never a world no
// chain of jumps reaches.

import { TOUR_ARCS, TOUR_STEP_JUMPS } from '../constants/missions.ts';
import type { StarSystem } from '../galaxy/galaxy.ts';
import { routeTable } from '../galaxy/route.ts';
import { seedPick } from './seed-pick.ts';

/**
 * The start world of each arc, `TOUR_ARCS` long, the first being `first`.
 *
 * Each next start is inside `TOUR_STEP_JUMPS` of the previous one. It is
 * also farther from `first` than the previous one was, so the tour crosses
 * the galaxy rather than circling. Where no world does both, the second rule
 * drops. Where the band is empty, it widens by one jump each way until a
 * world is inside it. A galaxy with nothing reachable at all repeats the
 * previous start, so the list is always full.
 */
export function arcStarts(systems: readonly StarSystem[], first: number, count = TOUR_ARCS): number[] {
  const starts = [first];
  const fromFirst = routeTable(systems, first).jumps;
  for (let step = 1; step < count; step += 1) {
    const prev = starts[step - 1];
    const fromPrev = routeTable(systems, prev).jumps;
    let chosen = prev;
    for (let widen = 0; widen < systems.length; widen += 1) {
      const min = Math.max(1, TOUR_STEP_JUMPS.min - widen);
      const max = TOUR_STEP_JUMPS.max + widen;
      const inBand = systems.filter((s) => fromPrev[s.index] >= min && fromPrev[s.index] <= max);
      const outward = inBand.filter((s) => fromFirst[s.index] > fromFirst[prev]);
      const pool = outward.length ? outward : inBand;
      if (pool.length) { chosen = pool[seedPick(systems[prev], step, pool.length)].index; break; }
      if (min === 1 && max >= systems.length) break;
    }
    starts.push(chosen);
  }
  return starts;
}

/**
 * Where a lead to the arc at `tourIndex` points in a galaxy entered at
 * `arrival`. A skeleton outside the tour waits at the arrival world.
 */
export function leadWorldIn(systems: readonly StarSystem[], arrival: number, tourIndex: number): number {
  if (tourIndex < 0) return arrival;
  return arcStarts(systems, arrival)[tourIndex] ?? arrival;
}
