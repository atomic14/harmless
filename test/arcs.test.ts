// The five arcs, walked end to end through the machine (docs/TODO/192 M2).
//
// Two claims. The arcs sit on the tour: each arc's patron is the world the
// seed places for it, in order, and each arc ends near the next one's
// world. And each arc can be finished, on the path where every leg goes
// right and on the path through its recovery leg, and the next arc is on
// offer at its world after either. A skeleton that lints clean and cannot
// be walked would be a mission nobody can finish, which the lint alone
// cannot see.

import { ARC_HANDOVER_JUMPS } from '../src/constants/missions.ts';
import { routeTable } from '../src/galaxy/route.ts';
import { stepMissions } from '../src/missions/machine.ts';
import type { CommanderFacts, MissionInput, MissionState, Skeleton } from '../src/missions/model.ts';
import { offersFor } from '../src/missions/offers.ts';
import { patronFile } from '../src/missions/patrons.ts';
import { ARC_TOUR, SKELETONS, skeletonById } from '../src/missions/skeletons/index.ts';
import { ARCS } from '../src/missions/skeletons/arcs/index.ts';
import { emptyMissionState } from '../src/missions/state.ts';
import { arcStarts } from '../src/missions/tour.ts';
import { g1 } from './fixtures.ts';
import { check, eq } from './harness.ts';

const LAVE = 7;
const startOf = (s: Skeleton): number => (s.patron.kind === 'world' ? s.patron.seedSlot : -1);

console.log('\nthe five arcs sit on the tour');
{
  const starts = arcStarts(g1, LAVE);
  eq('the tour lists the five arcs in order', ARC_TOUR.join(), ARCS.map((a) => a.id).join());
  eq('each arc\'s patron is the world the seed places for it',
    ARCS.map((a) => startOf(a)).join(), starts.join());
  check('every arc is a world patron with a committed name',
    ARCS.every((a) => patronFile(1)?.entries[String(startOf(a))] !== undefined));
  check('every arc but the last leads to the next, by both outcomes',
    ARCS.every((a, i) => (i === ARCS.length - 1
      ? a.complete.lead === undefined && a.fail.lead === undefined
      : a.complete.lead === ARCS[i + 1].id && a.fail.lead === ARCS[i + 1].id)));
  check('every arc has two to four legs, and mixes its verbs',
    ARCS.every((a) => a.legs.length >= 2 && a.legs.length <= 4
      && new Set(a.legs.map((l) => l.verb.kind)).size >= 2));
  check('the first arc opens with no gate, and each later one waits for the one before',
    Object.keys(ARCS[0].offer).length === 0
    && ARCS.slice(1).every((a, i) => a.offer.done?.join() === ARCS[i].id));
  check('every arc is in SKELETONS', ARCS.every((a) => SKELETONS.includes(a)));
}

// --- walking an arc ---------------------------------------------------------

/**
 * The input that moves a leg forward on its happy path, or, when `avoid`
 * is the happy path, the loss that turns onto a recovery leg the happy path
 * never visits.
 */
function inputFor(st: MissionState, arc: Skeleton, avoid: readonly string[] | null): MissionInput {
  const live = st.live.find((l) => l.skeleton === arc.id) as MissionState['live'][number];
  const leg = arc.legs.find((l) => l.id === live.leg) as Skeleton['legs'][number];
  const tag = live.tag ?? '';
  const off = avoid && leg.next.find((b) => (b.on === 'targetDestroyed' || b.on === 'targetEscaped')
    && b.to !== 'fail' && b.to !== 'complete' && !avoid.includes(b.to));
  if (off) return { kind: off.on === 'targetDestroyed' ? 'destroyed' : 'escaped', tag };
  switch (leg.verb.kind) {
    case 'hunt': return { kind: 'destroyed', tag };
    case 'recover': return { kind: 'scooped', tag };
    case 'rescue': return live.progress < 1 ? { kind: 'scooped', tag } : { kind: 'survivor', tag, fate: 'landed' };
    case 'escort': return { kind: 'escortSafe', tag };
    case 'scan': return { kind: 'scanned', tag };
    case 'ambush': return live.progress < 1 ? { kind: 'arrived' } : { kind: 'docked' };
    case 'deliver': return { kind: 'docked' };
    case 'smuggle': return { kind: 'docked' };
  }
}

/**
 * Accept the arc at its world and drive it to an end. With `avoid` set to
 * the happy path, the walk turns onto the first recovery leg off it, once.
 * Every input moves the commander to the leg's world first, as a dock
 * would.
 */
function walk(arc: Skeleton, avoid: readonly string[] | null, done: string[]): { st: MissionState; legs: string[]; c: CommanderFacts } {
  const c: CommanderFacts = { galaxy: 1, systemIndex: startOf(arc), kills: 0, combatScore: 0, legalStatus: 0, day: 1, cargo: [] };
  const ctx = () => ({ commander: c, systems: g1, rng: () => 0.37 });
  let st = emptyMissionState();
  for (const d of done) st.done[d] = 'complete';
  st = stepMissions(st, { kind: 'accept', skeleton: arc.id }, ctx()).state;
  const legs: string[] = [];
  let recovered = false;
  for (let guard = 0; guard < 12 && st.live.some((l) => l.skeleton === arc.id); guard += 1) {
    const live = st.live.find((l) => l.skeleton === arc.id) as MissionState['live'][number];
    if (legs[legs.length - 1] !== live.leg) legs.push(live.leg);
    if (live.target !== null) c.systemIndex = live.target;
    const input = inputFor(st, arc, recovered ? null : avoid);
    if (input.kind === 'destroyed' || input.kind === 'escaped') recovered = true;
    st = stepMissions(st, input, ctx()).state;
    c.day += 1;
  }
  return { st, legs, c };
}

for (const [i, arc] of ARCS.entries()) {
  console.log(`\n${arc.id}: walked on success and through its recovery`);
  const done = ARCS.slice(0, i).map((a) => a.id);
  const next = ARCS[i + 1];
  const goal = next ? startOf(next) : null;

  const happy = walk(arc, null, done);
  eq(`${arc.id} completes on its happy path (${happy.legs.join(' > ')})`, happy.st.done[arc.id], 'complete');
  check('...and pays at least once', happy.st.journal.length > 2);
  const back = walk(arc, happy.legs, done);
  check(`...and ends through a recovery leg the happy path never visits (${back.legs.join(' > ')})`,
    back.st.done[arc.id] !== undefined && back.legs.some((l) => !happy.legs.includes(l)));

  if (next && goal !== null) {
    const finalWorld = (w: { st: MissionState }) => w.st.journal[w.st.journal.length - 1].world;
    const jumpsOut = (w: number) => routeTable(g1, goal).jumps[w];
    check(`...its end is ${ARC_HANDOVER_JUMPS.min}-${ARC_HANDOVER_JUMPS.max} jumps from ${g1[goal].name} on both paths (${jumpsOut(finalWorld(happy))}, ${jumpsOut(finalWorld(back))})`,
      [happy, back].every((w) => jumpsOut(finalWorld(w)) >= ARC_HANDOVER_JUMPS.min && jumpsOut(finalWorld(w)) <= ARC_HANDOVER_JUMPS.max));
    check('...and both paths leave a lead to the next arc at its world',
      [happy, back].every((w) => w.st.leads.some((l) => l.skeleton === next.id && l.world === goal)));
    const there = { ...back.c, systemIndex: goal };
    check(`...so ${next.id} is on offer at ${g1[goal].name}`,
      offersFor(back.st, { commander: there, systems: g1 }).some((s) => s.id === next.id));
    check('...and nowhere else',
      !offersFor(back.st, { commander: { ...there, systemIndex: LAVE === goal ? 0 : LAVE }, systems: g1 }).some((s) => s.id === next.id));
  } else {
    eq('the last arc leaves no lead', happy.st.leads.length, 0);
  }
}

console.log('\nan arc is offered at its world only');
{
  const c: CommanderFacts = { galaxy: 1, systemIndex: LAVE, kills: 0, combatScore: 0, legalStatus: 0, day: 1, cargo: [] };
  check('the first arc is on offer at Lave from the first dock',
    offersFor(emptyMissionState(), { commander: c, systems: g1 }).some((s) => s.id === 'arc-lave'));
  check('...and not at Leesti', !offersFor(emptyMissionState(), { commander: { ...c, systemIndex: 8 }, systems: g1 }).some((s) => s.id === 'arc-lave'));
  check('the second arc waits for the first, even at its own world',
    !offersFor(emptyMissionState(), { commander: { ...c, systemIndex: startOf(ARCS[1]) }, systems: g1 }).some((s) => s.id === 'arc-rabedira'));
  check('the Constrictor still needs its kills', skeletonById('constrictor')?.offer.minKills === 16);
}
