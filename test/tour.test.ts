// The tour: five start worlds from the seed, the handover placement that
// ends an arc near the next one, and the lead that follows a galactic jump
// (docs/TODO/192 M1).
//
// The claim under all of it is determinism. A tour drawn from the world's
// random stream would differ between careers, and Lave's governor would
// send one commander east and the next one west. So the first block draws
// the tour twice around a reseed and asks for the same answer.

import { ARC_HANDOVER_JUMPS, TOUR_ARCS, TOUR_STEP_JUMPS } from '../src/constants/missions.ts';
import { generateGalaxy } from '../src/galaxy/galaxy.ts';
import { routeEstimate, routeTable } from '../src/galaxy/route.ts';
import { random, seedWorld } from '../src/game/rng.ts';
import { stepMissions } from '../src/missions/machine.ts';
import type { Skeleton } from '../src/missions/model.ts';
import { pickByJumps, placeLeg } from '../src/missions/placement.ts';
import { emptyMissionState } from '../src/missions/state.ts';
import { arcStarts, leadWorldIn } from '../src/missions/tour.ts';
import { g1 } from './fixtures.ts';
import { check, eq } from './harness.ts';

const LAVE = 7;
const jumps = (a: number, b: number) => routeEstimate(g1, g1[a], g1[b])?.jumps ?? Infinity;

console.log('\nthe tour: five starts from the seed, each a step farther out');
{
  seedWorld(1);
  random();
  const starts = arcStarts(g1, LAVE);
  seedWorld(2);
  random();
  random();
  eq('the tour is the same after a reseed, so it never reads the world stream',
    arcStarts(g1, LAVE).join(), starts.join());
  eq(`the tour holds ${TOUR_ARCS} starts`, starts.length, TOUR_ARCS);
  eq('...and the first is Lave', starts[0], LAVE);
  eq('every start is a different world', new Set(starts).size, starts.length);
  const steps = starts.slice(1).map((s, i) => jumps(starts[i], s));
  check(`each start is ${TOUR_STEP_JUMPS.min} to ${TOUR_STEP_JUMPS.max} jumps from the one before (${steps.join(', ')})`,
    steps.every((j) => j >= TOUR_STEP_JUMPS.min && j <= TOUR_STEP_JUMPS.max));
  const fromLave = starts.map((s) => jumps(LAVE, s));
  check(`...and farther from Lave each time (${fromLave.join(', ')})`,
    fromLave.every((j, i) => i === 0 || j > fromLave[i - 1]));
  check('every start is reachable from Lave', fromLave.every((j) => j !== Infinity));
  console.log(`     the tour: ${starts.map((s) => g1[s].name).join(' -> ')}`);
}

console.log('\n...the handover placement ends an arc near the next start');
{
  const starts = arcStarts(g1, LAVE);
  const goal = starts[1];
  const half = () => 0.5;
  const dry = g1.filter((s) => pickByJumps(g1, s.index, goal, ARC_HANDOVER_JUMPS, half) === null);
  eq('from every world of galaxy 1 a handover world exists', dry.length, 0);
  const picked = pickByJumps(g1, LAVE, goal, ARC_HANDOVER_JUMPS, half) as number;
  const d = routeTable(g1, goal).jumps[picked];
  check(`...inside the band of jumps toward the goal (${d})`, d >= ARC_HANDOVER_JUMPS.min && d <= ARC_HANDOVER_JUMPS.max);
  check('...and never the world she stands at',
    g1.every((s) => pickByJumps(g1, s.index, goal, ARC_HANDOVER_JUMPS, half) !== s.index));
  // The band counts jumps, not tenths: a world one jump from the goal is
  // outside a band that starts at two, however close it is on the chart.
  const one = g1.find((s) => routeTable(g1, goal).jumps[s.index] === 1) as { index: number };
  let draws = 0;
  const counting = () => { draws += 1; return 0; };
  const many = g1.filter((s) => {
    const t = pickByJumps(g1, s.index, goal, { min: 1, max: 1 }, counting);
    return t !== null && routeTable(g1, goal).jumps[t] === 1;
  });
  check('a band of one jump picks a world one jump out', many.length > 0 && one !== undefined);
  eq('...with one draw per placement', draws, g1.length);

  // Through the machine: a leg placed by handover toward a world patron's arc.
  const next: Skeleton = {
    id: 'next', kind: 'arc', anchor: 'fixed', patron: { kind: 'world', seedSlot: goal },
    hail: 'H', pitch: 'P', offer: {},
    legs: [{ id: 'one', verb: { kind: 'deliver' }, place: { kind: 'here' }, line: 'ONE',
      next: [{ on: 'success', to: 'complete' }, { on: 'failed', to: 'fail' }] }],
    complete: { pay: 0 }, fail: { pay: 0 },
  };
  const arc: Skeleton = {
    ...next, id: 'arc', patron: { kind: 'world', seedSlot: LAVE },
    legs: [{ id: 'end', verb: { kind: 'deliver' }, place: { kind: 'handover', toward: 'next', ...ARC_HANDOVER_JUMPS },
      line: 'END', next: [{ on: 'success', to: 'complete' }, { on: 'failed', to: 'fail' }] }],
    complete: { pay: 0, lead: 'next' }, fail: { pay: 0, lead: 'next' },
  };
  const facts = { galaxy: 1, systemIndex: LAVE, kills: 0, combatScore: 0, legalStatus: 0, day: 0, cargo: [] };
  const placed = placeLeg(arc.legs[0].place, emptyMissionState(), facts, g1, half, 'arc', [arc, next]);
  check('placeLeg places a handover leg', placed.ok && placed.target !== null);
  const r = stepMissions(emptyMissionState(), { kind: 'accept', skeleton: 'arc' }, {
    commander: facts, systems: g1, rng: half, skeleton: undefined, skeletons: [arc, next],
  } as never);
  const target = r.state.live[0]?.target as number;
  check('...and the machine accepts it with a target in the band',
    routeTable(g1, goal).jumps[target] >= ARC_HANDOVER_JUMPS.min && routeTable(g1, goal).jumps[target] <= ARC_HANDOVER_JUMPS.max);
}

console.log('\n...and a lead follows a galactic jump to a world she can reach');
{
  let bad = 0;
  let checked = 0;
  for (let g = 1; g <= 8; g += 1) {
    const systems = generateGalaxy(g);
    for (const arrival of [0, 63, 127, 191, 255]) {
      const reach = routeTable(systems, arrival).jumps;
      const starts = arcStarts(systems, arrival);
      checked += 1;
      if (starts.length !== TOUR_ARCS || starts[0] !== arrival) bad += 1;
      if (starts.some((s) => reach[s] === Infinity)) bad += 1;
      for (let k = 0; k < TOUR_ARCS; k += 1) if (reach[leadWorldIn(systems, arrival, k)] === Infinity) bad += 1;
    }
  }
  eq(`in all eight galaxies, from ${checked} arrival worlds, every start is reachable`, bad, 0);
  eq('a skeleton outside the tour waits at the arrival world', leadWorldIn(g1, 99, -1), 99);
  // Galaxy 8 strands Oresrati: a tour from there is a tour of one world.
  const g8 = generateGalaxy(8);
  const alone = g8.find((s) => routeTable(g8, s.index).jumps.filter((j) => j !== Infinity).length === 1);
  check('a stranded arrival gives a tour that never leaves it',
    alone !== undefined && arcStarts(g8, alone.index).every((s) => s === alone.index));
}
