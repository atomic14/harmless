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
  const n = systems.length;
  const days = new Array<number>(n).fill(Infinity);
  const jumps = new Array<number>(n).fill(0);
  const settled = new Array<boolean>(n).fill(false);
  days[from.index] = 0;

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
    // Everything left is unreachable, and the target is in it.
    if (at < 0 || bestDays === Infinity) return null;
    if (at === to.index) return { days: bestDays, jumps: bestJumps };
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
