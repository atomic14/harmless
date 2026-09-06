// Offers, leads and hints: what a station offers, what it says about the
// next arc, and how far the word travels (docs/TODO/190 M3).
//
// `offers.ts` decides what she can accept. `hints.ts` decides the one line a
// dock may say about a lead, and what the board and the DATA ON page carry.
// Both are pure, and the machine asks them on `docked`. The fixture pair here
// is the same shape test/mission-machine.test.ts builds, because no shipped
// arc leaves a lead yet.

import { canAccept, offersFor } from '../src/missions/offers.ts';
import { stepMissions } from '../src/missions/machine.ts';
import { boardRumour, leadJumps, leadLine, worldNews } from '../src/missions/hints.ts';
import { emptyMissionState } from '../src/missions/state.ts';
import type { CommanderFacts, MissionEffect, MissionState, Skeleton } from '../src/missions/model.ts';
import { LEAD_NAG_DOCKS, LEAD_RUMOUR_JUMPS, MISSION_REOFFER_DAYS } from '../src/constants/missions.ts';
import { routeEstimate } from '../src/galaxy/route.ts';
import { newCommander, type CommanderData } from '../src/game/commander.ts';
import { leadDestinations, orderVerdict, ordersSummary, standingOrders } from '../src/game/orders.ts';
import { renderMissions } from '../src/ui/screens.ts';
import { drawChart } from '../src/ui/chart-galactic.ts';
import { drawLocalChart } from '../src/ui/chart-local.ts';
import type { ChartState } from '../src/game/chart-state.ts';
import type { ChartOverlays } from '../src/game/chart-overlay.ts';
import { CHART_CANVAS_W, CHART_CANVAS_H, LOCAL_CANVAS } from '../src/constants/chart-metric.ts';
import { HUD } from '../src/palette.ts';
import { captureById, captureCanvas } from './screen-capture.ts';
import { constrictorAt, g1 } from './fixtures.ts';
import { check, eq } from './harness.ts';

const LAVE = 7;
const facts = (over: Partial<CommanderFacts> = {}): CommanderFacts => ({
  galaxy: 1, systemIndex: LAVE, kills: 0, combatScore: 0, legalStatus: 0, day: 0, cargo: [], ...over,
});

/** An arc at Lave that leads to a second arc at `world`. */
const arcs = (world: number): Skeleton[] => {
  const first: Skeleton = {
    id: 'first', kind: 'arc', anchor: 'local', patron: { kind: 'world', seedSlot: LAVE },
    hail: 'A WORD FROM THE GOVERNOR', pitch: 'GO', offer: {},
    legs: [{
      id: 'go', verb: { kind: 'deliver' }, place: { kind: 'anywhere' }, line: 'GO',
      next: [{ on: 'success', to: 'complete' }, { on: 'failed', to: 'fail' }],
    }],
    complete: { pay: 0, lead: 'second' },
    fail: { pay: 0, lead: 'second' },
  };
  const second: Skeleton = {
    ...first, id: 'second', patron: { kind: 'world', seedSlot: world },
    hail: 'A WORD FROM THE NEXT PATRON', offer: { minKills: 999 },
    complete: { pay: 0 }, fail: { pay: 0 },
  };
  return [first, second];
};
const said = (effects: MissionEffect[]): string[] =>
  effects.flatMap((e) => (e.kind === 'say' || e.kind === 'later' ? [e.text] : []));
const jumpsFromLave = (index: number): number =>
  routeEstimate(g1, g1[LAVE], g1[index])?.jumps ?? Infinity;

console.log('\noffers: the slots, the lead and the delay');
{
  const three: MissionState = {
    ...emptyMissionState(),
    live: ['a', 'b', 'c'].map((skeleton) => ({
      skeleton, leg: 'go', target: null, tag: null, progress: 0, deadlineDay: null,
    })),
  };
  const pair = arcs(12);
  eq('three held missions shut every offer', offersFor(three, { commander: facts(), skeletons: pair }).length, 0);
  const two = { ...three, live: three.live.slice(1) };
  eq('...and one slot freed opens the gate again',
    offersFor(two, { commander: facts(), skeletons: pair }).map((s) => s.id).join(), 'first');

  const withLead = { ...three, leads: [{ skeleton: 'second', galaxy: 1, world: 12, sinceDay: 0 }] };
  check('a lead waits while the slots are full', !canAccept(withLead, 'second', { commander: facts({ systemIndex: 12 }), skeletons: pair }));
  const freed = { ...withLead, live: withLead.live.slice(1) };
  check('...and opens at its world when one frees', canAccept(freed, 'second', { commander: facts({ systemIndex: 12 }), skeletons: pair }));
  check('...and nowhere else', !canAccept(freed, 'second', { commander: facts({ systemIndex: LAVE }), skeletons: pair }));

  // An ignored offer starts nothing, however many docks pass.
  let st = emptyMissionState();
  for (let dock = 0; dock < 3; dock++) {
    const r = stepMissions(st, { kind: 'docked' }, { commander: facts({ day: dock }), systems: g1, rng: () => 0.5, skeletons: pair });
    st = r.state;
    check(`dock ${dock + 1} makes the offer`, said(r.effects).includes('A WORD FROM THE GOVERNOR'));
  }
  eq('...and three ignored offers start nothing', st.live.length, 0);
  eq('...and leave no journal', st.journal.length, 0);

  // Abandonment frees the slot and keeps the lead (failure rule 3).
  const accepted = stepMissions(st, { kind: 'accept', skeleton: 'first' }, { commander: facts(), systems: g1, rng: () => 0.5, skeletons: pair }).state;
  const dropped = stepMissions(accepted, { kind: 'abandon', skeleton: 'first' }, { commander: facts(), systems: g1, rng: () => 0.5, skeletons: pair }).state;
  eq('abandonment frees the slot', dropped.live.length, 0);
  eq('...and keeps the lead', dropped.leads[0]?.skeleton, 'second');
  check('...which opens the next arc at its world',
    canAccept(dropped, 'second', { commander: facts({ systemIndex: 12 }), skeletons: pair }));
  check('...and the finished arc never comes back',
    !canAccept(dropped, 'first', { commander: facts({ day: 400 }), skeletons: pair }));

  // A side job comes back after the delay, and not before (failure rule 5).
  const side: Skeleton = { ...pair[0], id: 'side', kind: 'side', cap: 3, complete: { pay: 0 }, fail: { pay: 0 } };
  const ctxAt = (day: number) => ({ commander: facts({ day }), systems: g1, rng: () => 0.5, skeletons: [side] });
  const done = stepMissions(
    stepMissions(emptyMissionState(), { kind: 'accept', skeleton: 'side' }, ctxAt(10)).state,
    { kind: 'docked' }, ctxAt(10)).state;
  eq('the side job ended on day 10', done.done.side, 'complete');
  check('it is shut the next day', !canAccept(done, 'side', ctxAt(11)));
  check(`...and open ${MISSION_REOFFER_DAYS} days on`, canAccept(done, 'side', ctxAt(10 + MISSION_REOFFER_DAYS)));
}

console.log('\nhints: the word travels by distance, one line per dock');
{
  const far = g1.find((s) => jumpsFromLave(s.index) > LEAD_RUMOUR_JUMPS + 2)!;
  const near = g1.find((s) => jumpsFromLave(s.index) === 2)!;
  const next = g1.find((s) => jumpsFromLave(s.index) === 1)!;
  const pairFar = arcs(far.index);
  const lead = (world: number): MissionState => ({
    ...emptyMissionState(), leads: [{ skeleton: 'second', galaxy: 1, world, sinceDay: 0 }],
  });
  const dock = (st: MissionState, world: number, skeletons: Skeleton[]) =>
    stepMissions(st, { kind: 'docked' }, { commander: facts({ systemIndex: world }), systems: g1, rng: () => 0.5, skeletons });
  // The first arc at Lave would hail on every dock; a held one keeps it quiet.
  const quiet = (st: MissionState): MissionState => ({ ...st, done: { first: 'complete' } });

  eq(`${far.name} is ${jumpsFromLave(far.index)} jumps out`, leadJumps(lead(far.index).leads[0], facts(), g1), jumpsFromLave(far.index));
  check('the MISSIONS row names the world and the distance at any range',
    leadLine(lead(far.index).leads[0], facts(), g1).includes(far.name.toUpperCase())
    && leadLine(lead(far.index).leads[0], facts(), g1).includes(`${jumpsFromLave(far.index)} JUMPS`));
  eq('beyond the rumour range the board says nothing', boardRumour(lead(far.index), facts(), g1), null);
  eq('...and the DATA ON page says nothing', worldNews(lead(far.index), facts(), g1, far.index), null);
  eq('...and a dock says nothing', said(dock(quiet(lead(far.index)), LAVE, pairFar).effects).length, 0);

  check('inside the range the board carries a rumour that names the world',
    boardRumour(lead(near.index), facts(), g1)?.includes(near.name.toUpperCase()) === true);
  check('...and the DATA ON page for that world carries the news',
    worldNews(lead(near.index), facts(), g1, near.index) !== null);
  eq('...but not the page of a world nobody named', worldNews(lead(near.index), facts(), g1, LAVE), null);
  eq('...and a dock two jumps out still says nothing', said(dock(quiet(lead(near.index)), LAVE, arcs(near.index)).effects).length, 0);

  const r = dock(quiet(lead(next.index)), LAVE, arcs(next.index));
  check('one jump out, the patron writes when she docks',
    said(r.effects).some((t) => t.includes('MESSAGE FROM') && t.includes(next.name.toUpperCase())));
  eq('...and once only', said(r.effects).length, 1);
  check('...queued, so it never takes the console from an order',
    r.effects.every((e) => e.kind !== 'say'));

  // One hint per dock: an offer here beats a message from next door.
  const both = dock(lead(next.index), LAVE, arcs(next.index));
  eq('a dock that makes an offer says nothing about a lead',
    said(both.effects).join('|'), 'A WORD FROM THE GOVERNOR');

  // The second message, after docks with no progress.
  let st = quiet(lead(near.index));
  const seen: string[] = [];
  for (let d = 0; d < LEAD_NAG_DOCKS + 2; d++) {
    const step = dock(st, LAVE, arcs(near.index));
    st = step.state;
    seen.push(said(step.effects).join('|'));
  }
  eq(`the patron writes again on dock ${LEAD_NAG_DOCKS}, and then waits`,
    seen.map((t) => (t.includes('SECOND MESSAGE') ? 'M' : '-')).join(''),
    '-'.repeat(LEAD_NAG_DOCKS - 1) + 'M' + '-'.repeat(2));
  eq('...and the count is in the record', st.idleDocks, LEAD_NAG_DOCKS + 2);
  const moved = stepMissions(st, { kind: 'accept', skeleton: 'second' },
    { commander: facts({ systemIndex: near.index }), systems: g1, rng: () => 0.5, skeletons: arcs(near.index) });
  const after = dock(moved.state, near.index, arcs(near.index));
  eq('progress resets the count', after.state.idleDocks, 0);
}

console.log('\ninvariant 16: a lead has a screen, and a hint is not an order');
{
  const near = g1.find((s) => jumpsFromLave(s.index) === 2)!;
  const c: CommanderData = { ...newCommander(), systemIndex: LAVE, day: 100, contracts: [] };
  c.missions = constrictorAt('hunt', 12);
  c.missions.leads.push({ skeleton: 'second', galaxy: 1, world: near.index, sinceDay: 0 });

  const html = captureById(() => {
    renderMissions({
      offers: [],
      held: standingOrders(c, g1).filter((o) => o.kind === 'mission')
        .map((o) => ({ ...o, patron: 'THE NAVY' })) as never,
      leads: c.missions.leads.map((l) => leadLine(l, facts({ systemIndex: LAVE }), g1)),
      systems: g1, selected: 0, atStation: true,
    });
  }).get('screen') ?? '';
  check('the MISSIONS screen lists the lead by its world',
    html.includes('LEADS') && html.includes(near.name.toUpperCase()));

  const lines = ordersSummary(standingOrders(c, g1));
  check('the amber line carries the held order', lines.some((l) => l.startsWith('NAVY MISSION')));
  check('...and no lead, because a lead is not an order',
    lines.every((l) => !l.includes(near.name.toUpperCase()) && !l.includes('LEAD')));

  eq('the chart marks the lead\'s world', [...leadDestinations(c)].join(), String(near.index));
  eq('...in this galaxy only',
    leadDestinations({ ...c, galaxy: 2 }).size, 0);
  eq('...and the readout names it as a lead, not a job',
    orderVerdict(c, near.index, 3, g1)?.text, 'A LEAD · 3 DAYS AWAY');

  const NO_OVERLAYS: ChartOverlays = {
    mode: 'none', danger: new Set<number>(), lanes: [], prices: new Map(), hovered: null, day: 500,
  };
  const chart: ChartState = { cursorX: g1[LAVE].x, cursorY: g1[LAVE].y, targetIndex: null };
  const closes = (ops: { method: string; strokeStyle: string }[]): number =>
    ops.filter((o) => o.method === 'closePath' && o.strokeStyle === HUD.amber).length;
  const wide = captureCanvas(() => drawChart(g1, c, chart, NO_OVERLAYS), CHART_CANVAS_W, CHART_CANVAS_H).get('chart-canvas') ?? [];
  const local = captureCanvas(() => drawLocalChart(g1, c, chart, NO_OVERLAYS), LOCAL_CANVAS, LOCAL_CANVAS).get('local-canvas') ?? [];
  const plain = { ...c, missions: { ...c.missions, leads: [] } };
  const wideNoLead = captureCanvas(() => drawChart(g1, plain, chart, NO_OVERLAYS), CHART_CANVAS_W, CHART_CANVAS_H).get('chart-canvas') ?? [];
  eq('the galactic chart draws one more closed amber shape for the lead',
    closes(wide) - closes(wideNoLead), 1);
  check('...and so does the short range chart', closes(local) >= 1);
}
