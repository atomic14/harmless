// What a journey costs in days when one jump cannot make it (docs/TODO/140 M3).
//
// HOW THIS IS CHECKED. A second shortest-path search written here would be the
// same idea twice, and two copies of one idea agree on one wrong answer. So the
// checks below verify the ANSWER instead of the algorithm, with the standard
// certificate for a shortest path:
//
//   1. NO EDGE IMPROVES IT. For every pair of systems within a full tank,
//      `days[to] <= days[from] + daysForJump`. A cheaper route would contain an
//      edge that fails this, so no cheaper route exists.
//   2. EVERY ANSWER IS A REAL ROUTE. Each system's cost is exactly its cost
//      through some neighbour. Each leg costs at least one day, so those steps
//      walk strictly downwards and end at the home system's zero.
//
// Together they say: the number cannot be beaten, and it is not made up. The
// jump count gets the same treatment against the same neighbours.
//
// The edge rule (a full tank, `daysForJump`) is shared with the code under
// test, because it is the question, not the answer.

import { generateGalaxy, type StarSystem } from '../src/galaxy/galaxy.ts';
import { distanceTenths, daysForJump } from '../src/galaxy/navigation.ts';
import { routeEstimate, type RouteEstimate } from '../src/galaxy/route.ts';
import { MAX_FUEL } from '../src/constants/commander.ts';
import { g1 } from './fixtures.ts';
import { check } from './harness.ts';

/** The cheapest journey from `home` to every system, as the module answers. */
function fromHome(systems: StarSystem[], home: StarSystem): (RouteEstimate | null)[] {
  return systems.map((s) => routeEstimate(systems, home, s));
}

/**
 * The two certificate rules above, over every system. Returns the first fault,
 * or '' when the whole answer set holds.
 */
function faultIn(systems: StarSystem[], home: StarSystem): string {
  const got = fromHome(systems, home);
  const cost = (a: StarSystem, b: StarSystem): number | null => {
    const tenths = distanceTenths(a, b);
    return tenths > MAX_FUEL ? null : daysForJump(tenths);
  };

  for (const to of systems) {
    const here = got[to.index];
    if (to.index === home.index) {
      if (here === null || here.days !== 0 || here.jumps !== 0) {
        return `${to.name} is home and cost ${JSON.stringify(here)}`;
      }
      continue;
    }

    // Rule 1: no edge improves the answer. This also covers the unreachable
    // systems — a null neighbour of a priced system would be a route the
    // search missed.
    let best = Infinity;
    let bestJumps = Infinity;
    for (const via of systems) {
      const leg = cost(via, to);
      const upto = got[via.index];
      if (leg === null || upto === null || via.index === to.index) continue;
      const total = upto.days + leg;
      if (here === null) return `${to.name} was called unreachable, but ${via.name} reaches it`;
      if (total < here.days) {
        return `${to.name} costs ${here.days} days, but ${via.name} gets there in ${total}`;
      }
      if (total < best || (total === best && upto.jumps + 1 < bestJumps)) {
        best = total;
        bestJumps = upto.jumps + 1;
      }
    }
    if (here === null) continue; // nothing reaches it, and rule 1 agreed

    // Rule 2: the answer is one of those routes, and it is the shortest of the
    // cheapest ones. `best` is the cost through the best neighbour, so equality
    // makes the number a real journey rather than an assertion.
    if (best !== here.days) {
      return `${to.name} claims ${here.days} days; the best neighbour gives ${best}`;
    }
    if (bestJumps !== here.jumps) {
      return `${to.name} claims ${here.jumps} jumps; the best neighbour gives ${bestJumps}`;
    }
  }
  return '';
}

console.log('\nthe cheapest route cannot be beaten, and it is a real route');
{
  // Two galaxies and two homes in each. One neighbourhood can agree with a
  // wrong search by luck; a whole map twice cannot.
  const g5 = generateGalaxy(5);
  for (const [name, systems] of [['galaxy 1', g1], ['galaxy 5', g5]] as const) {
    for (const home of [7, 130]) {
      const fault = faultIn(systems, systems[home]);
      check(`${name} from ${systems[home].name.toUpperCase()}: every one of the`
        + ` ${systems.length} systems (${fault || 'no fault'})`, fault === '');
    }
  }
}

console.log('\na system one jump away costs exactly one jump');
{
  // A journey of two legs pays `JUMP_DAYS_BASE` twice and covers at least the
  // same ground, so no split of a reachable hop can beat it. The estimate must
  // therefore agree with `daysForJump` wherever the pilot can already read it
  // off the chart, and must say one jump.
  const lave = g1[7];
  let neighbours = 0;
  let wrong = '';
  for (const s of g1) {
    const tenths = distanceTenths(lave, s);
    if (s.index === 7 || tenths > MAX_FUEL) continue;
    neighbours++;
    const r = routeEstimate(g1, lave, s)!;
    if (r.days !== daysForJump(tenths) || r.jumps !== 1) {
      wrong ||= `${s.name} is ${(tenths / 10).toFixed(1)} LY away and cost ${JSON.stringify(r)}`;
    }
  }
  check(`all ${neighbours} systems within a full tank of Lave cost`
    + ` daysForJump and one jump (${wrong || 'none wrong'})`, wrong === '' && neighbours > 0);
}

console.log('\nsome destinations have no route at all');
{
  // Not a guard against bad input: a shipped galaxy strands these systems. No
  // system in galaxy 8 is within a full tank of Oresrati, and galaxy 7 splits
  // into a mainland and an island that cannot trade with each other.
  const g8 = generateGalaxy(8);
  const alone = g8.find((s) => s.name === 'Oresrati')!;
  const nearest = g8.filter((s) => s.index !== alone.index)
    .sort((a, b) => distanceTenths(alone, a) - distanceTenths(alone, b))[0];
  check(`nothing is within a full tank of ${alone.name.toUpperCase()}`
    + ` (nearest ${nearest.name} at ${(distanceTenths(alone, nearest) / 10).toFixed(1)} LY)`,
  distanceTenths(alone, nearest) > MAX_FUEL);
  check('...so no route reaches it', routeEstimate(g8, g8[7], alone) === null);
  check('...and no route leaves it', routeEstimate(g8, alone, g8[7]) === null);

  // The island in galaxy 7 is the case a single-system check would miss: every
  // one of its 27 systems has neighbours, and none of them is a way out.
  const g7 = generateGalaxy(7);
  const reached = g7.filter((s) => routeEstimate(g7, g7[0], s) !== null);
  check(`galaxy 7 reaches ${reached.length} of its 256 systems from ${g7[0].name}`,
    reached.length > 1 && reached.length < g7.length);
  const stranded = g7.find((s) => routeEstimate(g7, g7[0], s) === null)!;
  const home = g7[0];
  check(`${stranded.name.toUpperCase()} has neighbours of its own`,
    g7.some((s) => s.index !== stranded.index && distanceTenths(stranded, s) <= MAX_FUEL));
  check('...and still no route to it, or back from it',
    routeEstimate(g7, home, stranded) === null && routeEstimate(g7, stranded, home) === null);
}

console.log('\na route costs the same in both directions');
{
  // Every edge is measured by the same metric both ways, so the journey is too.
  // A search that leaked the direction it started from would pass every check
  // above. This is also the only check that catches a lost tie-break on jumps:
  // the certificate reads the search's own answers, which stay self-consistent
  // in one direction. Both breaks were run.
  let wrong = '';
  let compared = 0;
  for (let i = 0; i < g1.length; i += 17) {
    for (let j = 0; j < g1.length; j += 23) {
      const there = routeEstimate(g1, g1[i], g1[j]);
      const back = routeEstimate(g1, g1[j], g1[i]);
      compared++;
      if (JSON.stringify(there) !== JSON.stringify(back)) {
        wrong ||= `${g1[i].name}->${g1[j].name} is ${JSON.stringify(there)},`
          + ` and back is ${JSON.stringify(back)}`;
      }
    }
  }
  check(`${compared} pairs cost the same both ways (${wrong || 'none wrong'})`,
    wrong === '' && compared > 100);
}

console.log('\nthe journey to where you stand is no journey');
{
  // `daysForJump(0)` is 1, because the base day is the jump itself. A journey
  // of no jumps is 0. The charts depend on the difference: the system under the
  // cursor is the one it rests on most.
  const here = routeEstimate(g1, g1[7], g1[7])!;
  check('Lave to Lave is 0 days and 0 jumps', here.days === 0 && here.jumps === 0);
  check('...although one jump of no distance would cost 1 day', daysForJump(0) === 1);
}
