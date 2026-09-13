// The probes behind docs/MISSIONS-REVIEW.md. Each block drives the real
// mission machine with no game world, as test/mission-machine.test.ts does.
//
//   node --experimental-strip-types --no-warnings docs/reviews/missions-2026-09-12/probe.ts
//
// The output is committed beside it as results.txt.

import { generateGalaxy } from '../../../src/galaxy/galaxy.ts';
import { routeTable } from '../../../src/galaxy/route.ts';
import { stepMissions } from '../../../src/missions/machine.ts';
import { canAccept, offersFor, sideJobsAt } from '../../../src/missions/offers.ts';
import { emptyMissionState } from '../../../src/missions/state.ts';
import { SKELETONS } from '../../../src/missions/skeletons/index.ts';
import { SIDE_JOBS } from '../../../src/missions/skeletons/side.ts';
import { pickByJumps } from '../../../src/missions/placement.ts';
import { patronFor } from '../../../src/missions/patrons.ts';
import { storyPages } from '../../../src/missions/story.ts';
import { NARCOTICS } from '../../../src/constants/commodities.ts';
import { specForDesign, SOURCE_DESIGN } from '../../../src/game/ship-specs.ts';
import { shipDesignIdOf } from '../../../src/game/ship-identity.ts';
import type { CommanderFacts, MissionState } from '../../../src/missions/model.ts';

const g1 = generateGalaxy(1);
const g2 = generateGalaxy(2);
const facts = (o: Partial<CommanderFacts> = {}): CommanderFacts => ({
  galaxy: 1, systemIndex: 7, kills: 0, combatScore: 0, legalStatus: 0, day: 0, cargo: new Array(17).fill(0), scoops: true, ...o,
});
const ctx = (c: Partial<CommanderFacts> = {}, systems = g1, skeletons?: readonly typeof SKELETONS[number][]) =>
  ({ commander: facts(c), systems, rng: () => 0.5, ...(skeletons ? { skeletons } : {}) });
const boardWith = (id: string): number =>
  g1.find((s) => sideJobsAt(s, SKELETONS).some((j) => j.id === id))!.index;
const start = (id: string) => {
  const here = boardWith(id);
  const r = stepMissions(emptyMissionState(), { kind: 'accept', skeleton: id }, ctx({ systemIndex: here }));
  if (!r.state.live.length) throw new Error(`${id} not accepted at ${here}`);
  return { r, here };
};
const kinds = (effects: { kind: string; text?: string }[]): string[] =>
  effects.map((e) => e.kind + (e.text ? ':' + e.text : ''));

console.log('[1] an arc is offered in every galaxy at its seed index');
{
  const c2 = { commander: facts({ galaxy: 2, systemIndex: 7 }), systems: g2 };
  console.log('  canAccept arc-lave at galaxy 2 index 7:', canAccept(emptyMissionState(), 'arc-lave', c2));
  console.log('  galaxy-2 world at index 7:', g2[7].name, '| patron:', patronFor({ kind: 'world', seedSlot: 7 }, facts({ galaxy: 2 }), g2).name);
  console.log('  offers there:', offersFor(emptyMissionState(), c2).map((s) => s.id).join(' '));
  // After a galactic jump the lead moves to the tour world, and the arc it opens
  // then hands over toward a seed index, not the tour.
  let r = stepMissions(emptyMissionState(), { kind: 'accept', skeleton: 'arc-lave' }, ctx());
  r = stepMissions(r.state, { kind: 'galaxyChanged', from: 1, to: 2 }, ctx({ galaxy: 2, systemIndex: 7 }, g2));
  const lead = r.state.leads[0];
  console.log('  lead after the jump:', JSON.stringify(lead), '| announced world:', (r.effects.find((e) => e.kind === 'lead') as { world: number } | undefined)?.world);
  r = stepMissions(r.state, { kind: 'accept', skeleton: 'arc-rabedira' }, ctx({ galaxy: 2, systemIndex: lead.world }, g2));
  console.log('  arc-rabedira accepted at the relocated lead:', r.state.live.length === 1);
  const paper = r.state.live[0];
  if (paper) {
    r = stepMissions(r.state, { kind: 'docked' }, ctx({ galaxy: 2, systemIndex: paper.target! }, g2));
    const toGoal = routeTable(g2, 100).jumps;
    console.log(`  convoy leg placed ${toGoal[r.state.live[0].target!]} jumps from galaxy-2 index 100 (${g2[100].name}), which is not the tour`);
  }
}

console.log('\n[2] a side job with no cap is offered once per career');
{
  console.log('  caps:', SIDE_JOBS.map((s) => `${s.id}=${s.cap}`).join(' '));
  const { r, here } = start('side-recover');
  const ended = stepMissions(r.state, { kind: 'abandon', skeleton: 'side-recover' }, ctx({ systemIndex: here, day: 10 }));
  for (const day of [11, 17, 18, 400]) {
    console.log(`  canAccept side-recover at its board on day ${day}:`, canAccept(ended.state, 'side-recover', { commander: facts({ systemIndex: here, day }), systems: g1 }));
  }
}

console.log('\n[3] a smuggle run pays and leaves the goods aboard');
{
  const { r } = start('side-smuggle');
  const cargo = new Array(17).fill(0); cargo[NARCOTICS] = 3;
  const done = stepMissions(r.state, { kind: 'docked' }, ctx({ systemIndex: r.state.live[0].target!, cargo }));
  console.log('  effects on success:', done.effects.map((e) => e.kind + (e.kind === 'pay' ? `(${e.tenths})` : e.kind === 'cargo' ? `(${e.tonnes})` : '')).join(' '));
}

console.log('\n[4] what each ship verb makes of the four ways a target can go');
for (const id of ['side-hunt', 'side-scan', 'side-escort']) {
  const { r } = start(id);
  const tag = r.state.live[0].tag!;
  for (const kind of ['fled', 'escaped', 'escortLost', 'destroyed'] as const) {
    const s = stepMissions(r.state, { kind, tag }, ctx());
    const pay = s.effects.filter((e) => e.kind === 'pay').map((e) => (e as { tenths: number }).tenths).join(',');
    console.log(`  ${id.padEnd(11)} ${kind.padEnd(10)} live=${s.state.live.length} done=${s.state.done[id] ?? '-'} entityAlive=${s.state.entities[tag]?.alive} pay=${pay || '-'} says=${s.effects.filter((e) => e.kind === 'say').length}`);
  }
}

console.log('\n[5] the dock hint is shadowed by the side-job count');
{
  const jumps = routeTable(g1, 6).jumps;
  const oneOut = g1.find((s) => jumps[s.index] === 1)!;
  const st: MissionState = { ...emptyMissionState(), done: { 'arc-lave': 'complete' }, leads: [{ skeleton: 'arc-rabedira', galaxy: 1, world: 6, sinceDay: 0 }] };
  const r = stepMissions(st, { kind: 'docked' }, ctx({ systemIndex: oneOut.index }));
  console.log(`  dock at ${oneOut.name}, one jump from Rabedira:`, kinds(r.effects).join(' | '));
  const r2 = stepMissions(st, { kind: 'docked' }, ctx({ systemIndex: oneOut.index }, g1, SKELETONS.filter((s) => s.kind !== 'side')));
  console.log('  the same dock with the side jobs removed:', kinds(r2.effects).join(' | '));
  const far = g1.find((s) => jumps[s.index] === 3)!;
  const r3 = stepMissions({ ...st, idleDocks: 3 }, { kind: 'docked' }, ctx({ systemIndex: far.index }));
  console.log(`  fourth idle dock at ${far.name}, three jumps out:`, kinds(r3.effects).join(' | '));
}

console.log('\n[6] a saved record that names a ghost skeleton or leg');
{
  const ghost: MissionState = { ...emptyMissionState(), live: [{ skeleton: 'arc-ghost', leg: 'x', target: null, tag: null, progress: 0, deadlineDay: null }] };
  const oldLeg: MissionState = { ...emptyMissionState(), live: [{ skeleton: 'arc-lave', leg: 'old', target: null, tag: null, progress: 0, deadlineDay: null }] };
  for (const [name, st, input] of [
    ['ghost skeleton, docked', ghost, { kind: 'docked' }],
    ['ghost skeleton, abandon', ghost, { kind: 'abandon', skeleton: 'arc-ghost' }],
    ['ghost leg, docked', oldLeg, { kind: 'docked' }],
  ] as const) {
    try { stepMissions(st, input, ctx()); console.log(`  ${name}: ok`); }
    catch (e) { console.log(`  ${name}: THROWS "${(e as Error).message}"`); }
  }
}

console.log('\n[7] the journal holds no galaxy, so the log misnames a world after a jump');
{
  let r = stepMissions(emptyMissionState(), { kind: 'accept', skeleton: 'arc-lave' }, ctx());
  r = stepMissions(r.state, { kind: 'galaxyChanged', from: 1, to: 2 }, ctx({ galaxy: 2, systemIndex: 7 }, g2));
  const inG1 = storyPages(r.state, g1)[0].lines[0];
  const inG2 = storyPages(r.state, g2)[0].lines[0];
  console.log('  the acceptance line, rendered with galaxy 1:', inG1);
  console.log('  the same line, rendered with galaxy 2:    ', inG2);
}

console.log('\n[8] a local patron\'s standing is keyed by where the branch settles');
{
  const { r, here } = start('side-deliver');
  const target = r.state.live[0].target!;
  const done = stepMissions(r.state, { kind: 'docked' }, ctx({ systemIndex: target }));
  console.log(`  accepted at ${g1[here].name} (${here}), delivered at ${g1[target].name} (${target}), standing:`, JSON.stringify(done.state.standing));
}

console.log('\n[9] the pirate row a restored mission ship is looked up under');
for (const k of ['python', 'cobraMk3', 'anaconda', 'boa', 'transporter'] as const) {
  const id = shipDesignIdOf(SOURCE_DESIGN[k]);
  console.log(`  ${k.padEnd(12)} pirate row: ${String(!!specForDesign('pirate', id)).padEnd(5)} trader row: ${!!specForDesign('trader', id)}`);
}

console.log('\n[10] handover placement has a candidate from every world of galaxy 1');
for (const [g, name] of [[6, 'Rabedira'], [100, 'Vetitice'], [150, 'Xeer'], [162, 'Edle']] as const) {
  const dry = g1.filter((s) => pickByJumps(g1, s.index, g, { min: 2, max: 4 }, () => 0.5) === null);
  console.log(`  toward ${name.padEnd(9)} worlds with no candidate: ${dry.length}`);
}
