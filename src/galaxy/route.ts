// What a journey costs in days when one jump cannot make it.
//
// `navigation.ts` prices one hop. A contract destination is often further than
// one tank, and before this file no route search existed anywhere in the
// codebase. So the chart priced the jumps a pilot could already see and said
// nothing at all about the one they had to plan (docs/TODO/140 M3).
//
// THE GRAPH USES A FULL TANK, NOT THE FUEL ABOARD. Fuel costs money, and every
// station sells it. Fuel costs no days. So the longest jump the ship can make
// is the honest edge, and the estimate does not get worse because the pilot
// runs low. `oneJumpDays` is the opposite rule for the opposite reason: it
// prices the jump you can make NOW, so it reads the tank.
//
// The answer is a number, not a picture. It gives days and jumps. It names no
// waypoint and draws no path, so the pilot still chooses every jump.
//
// The word ESTIMATE is earned. `MISJUMP_CHANCE` is 0.09, and a mis-jump costs
// the 3-day tow in game/game.ts. Over a four-jump route the chance of at least
// one mis-jump is about 31%.
//
// SOME DESTINATIONS HAVE NO ROUTE, and shipped galaxies hold them. No system in
// galaxy 8 is within a full tank of Oresrati. Galaxy 7 splits into a mainland
// of 229 systems and an island of 27. Galaxies 3, 4 and 6 each strand a small
// group as well. `null` is therefore an answer about the map, not a guard
// against bad input.

import type { StarSystem } from './galaxy.ts';
import { distanceTenths, daysForJump } from './navigation.ts';
import { MAX_FUEL } from '../constants/commander.ts';

/** The cheapest journey between two systems, in the two numbers a pilot uses. */
export interface RouteEstimate {
  /** Total days: the sum of `daysForJump` over every leg. */
  days: number;
  /** How many jumps that route takes. */
  jumps: number;
}

/**
 * The cheapest route from `from` to `to`, in days and jumps, or null when no
 * chain of full-tank jumps joins them.
 *
 * Cheapest in DAYS first, then in JUMPS. Two routes of the same length in days
 * are not the same offer, because each jump is another chance of a mis-jump.
 *
 * A system to itself is 0 days and 0 jumps. You do not jump to where you are.
 * That differs from `daysForJump(0)`, which is 1, because that number prices a
 * jump and this one prices a journey.
 *
 * Dijkstra, with a linear scan for the next system instead of a heap. The map
 * holds 256 systems with about 7 neighbours each, and the scan settles a target
 * in well under a millisecond. A heap would win at a size this map cannot have.
 * The neighbours are measured on demand rather than built into a table first.
 * One search reads fewer pairs than a full table holds. A table would also need
 * an owner and a moment to become stale in.
 */
export function routeEstimate(
  systems: readonly StarSystem[],
  from: StarSystem,
  to: StarSystem,
): RouteEstimate | null {
  const table = settle(systems, from.index, to.index);
  return table.days[to.index] === Infinity ? null
    : { days: table.days[to.index], jumps: table.jumps[to.index] };
}

/** Days and jumps from one system to every other; `Infinity` where no chain joins them. */
export interface RouteTable {
  days: readonly number[];
  jumps: readonly number[];
}

/**
 * The cheapest route from `from` to EVERY system, in one search.
 *
 * The mission tour and the handover placement (missions/tour.ts,
 * missions/placement.ts) measure a band of jumps over the whole galaxy at
 * once. 256 pair searches from one source repeat the same work 256 times.
 * This runs the search to the end instead. An unreachable system
 * reads `Infinity` in both arrays, so `jumps` is never 0 for a system that
 * cannot be reached.
 */
export function routeTable(systems: readonly StarSystem[], from: number): RouteTable {
  return settle(systems, from, -1);
}

/**
 * Dijkstra from `from`, stopped when `stopAt` settles, or run to the end for
 * -1. The rules are `routeEstimate`'s, and this is their one home.
 */
function settle(systems: readonly StarSystem[], from: number, stopAt: number): RouteTable {
  const n = systems.length;
  const days = new Array<number>(n).fill(Infinity);
  const jumps = new Array<number>(n).fill(Infinity);
  const settled = new Array<boolean>(n).fill(false);
  days[from] = 0;
  jumps[from] = 0;

  for (;;) {
    // The next system to settle: the cheapest in days, and among those the one
    // reached in fewest jumps. The tie-break belongs in this choice as well as
    // in the relaxation below. A system settled on the wrong side of a tie
    // keeps its jump count for good.
    let at = -1;
    let bestDays = Infinity;
    let bestJumps = Infinity;
    for (let i = 0; i < n; i++) {
      if (settled[i]) continue;
      if (days[i] < bestDays || (days[i] === bestDays && jumps[i] < bestJumps)) {
        bestDays = days[i];
        bestJumps = jumps[i];
        at = i;
      }
    }
    // Everything left is unreachable, and the target, if any, is in it.
    if (at < 0 || bestDays === Infinity) return { days, jumps };
    if (at === stopAt) return { days, jumps };
    settled[at] = true;

    for (let v = 0; v < n; v++) {
      if (settled[v]) continue;
      const tenths = distanceTenths(systems[at], systems[v]);
      if (tenths > MAX_FUEL) continue;
      const cost = bestDays + daysForJump(tenths);
      const hops = bestJumps + 1;
      if (cost < days[v] || (cost === days[v] && hops < jumps[v])) {
        days[v] = cost;
        jumps[v] = hops;
      }
    }
  }
}
