// The mission machine, driven with no game world: the Constrictor from the
// Navy's hail to the plans' delivery, and the rules around it.
//
// `stepMissions` (src/missions/machine.ts) is pure. It takes a record, one
// input and the facts it may read, and it returns a new record with the
// effects the game must apply. So every assertion here is on data, and the
// numbers are the ones test/missions.test.ts pinned on the old machine
// (docs/TODO/190 M1).

import { emptyMissionState } from '../src/missions/state.ts';
import { stepMissions } from '../src/missions/machine.ts';
import { canAccept, offersFor } from '../src/missions/offers.ts';
import type { MissionContext } from '../src/missions/machine.ts';
import type {
  CommanderFacts, MissionEffect, MissionInput, MissionState, Skeleton,
} from '../src/missions/model.ts';
import {
  carryingPlans, missionOverride, missionSpawns, orderLine,
} from '../src/missions/queries.ts';
import { distanceTenths } from '../src/galaxy/navigation.ts';
import { CONSTRICTOR_SPEC } from '../src/game/ship-specs.ts';
import { CONSTRICTOR } from '../src/missions/skeletons/constrictor.ts';
import { MISSION_REOFFER_DAYS } from '../src/constants/missions.ts';
import { g1 } from './fixtures.ts';
import { check, eq } from './harness.ts';

const LAVE = 7;

/** A commander at Lave with `over` on top: the facts, and nothing else. */
const facts = (over: Partial<CommanderFacts> = {}): CommanderFacts => ({
  galaxy: 1, systemIndex: LAVE, kills: 0, combatScore: 0, legalStatus: 0, day: 0, cargo: [], ...over,
});

/** A generator that counts its draws, so a test can say how many it made. */
function counting(value = 0.5): { rng: () => number; draws: () => number } {
  let n = 0;
  return { rng: () => { n += 1; return value; }, draws: () => n };
}

// The Constrictor alone, so the eight side jobs on Lave's board stay quiet.
const ctx = (c: CommanderFacts, rng: () => number = () => 0.5, skeletons: Skeleton[] = [CONSTRICTOR]): MissionContext =>
  ({ commander: c, systems: g1, rng, skeletons });

const paid = (effects: MissionEffect[]): number =>
  effects.reduce((sum, e) => sum + (e.kind === 'pay' ? e.tenths : 0), 0);
const said = (effects: MissionEffect[]): string[] =>
  effects.flatMap((e) => (e.kind === 'say' ? [e.text] : []));

console.log('\nmission machine: the Constrictor');
{
  const empty = emptyMissionState();

  // --- the offer ------------------------------------------------------------
  {
    const c = ctx(facts({ kills: 15 }));
    check('the Navy ignores you below the kill threshold', !canAccept(empty, 'constrictor', c));
    const r = stepMissions(empty, { kind: 'docked' }, c);
    eq('...and a dock says nothing', said(r.effects).length, 0);
  }
  check('the mission is galaxy 1 only',
    !canAccept(empty, 'constrictor', ctx(facts({ kills: 16, galaxy: 2 }))));
  {
    const draws = counting();
    const c = ctx(facts({ kills: 16 }), draws.rng);
    const r = stepMissions(empty, { kind: 'docked' }, c);
    check('at sixteen kills the Navy hails you on docking',
      said(r.effects).includes('INCOMING NAVY TRANSMISSION'));
    eq('...with a link to the MISSIONS screen',
      r.effects.find((e) => e.kind === 'say')?.command, 'openMissions');
    eq('...and the offer alone starts nothing', r.state.live.length, 0);
    eq('...and draws nothing', draws.draws(), 0);
    eq('the offer is listed', offersFor(empty, c).map((s) => s.id).join(), 'constrictor');
  }

  // --- acceptance, and the hunt ----------------------------------------------
  const draws = counting();
  const c16 = ctx(facts({ kills: 16 }), draws.rng);
  let st: MissionState = stepMissions(empty, { kind: 'accept', skeleton: 'constrictor' }, c16).state;
  const hunt = st.live[0];
  check('acceptance opens the hunt', hunt?.leg === 'hunt');
  eq('...with one draw for the target', draws.draws(), 1);
  check('...at a target that is somewhere else', hunt.target !== LAVE);
  {
    const d = distanceTenths(g1[LAVE], g1[hunt.target as number]);
    check(`...three to eight light years out (${d / 10})`, d >= 30 && d <= 80);
  }
  eq('the journal opens with the acceptance', st.journal[0]?.outcome, 'accepted');
  check('a second acceptance is refused', !canAccept(st, 'constrictor', c16));
  check('the target ship is tagged and waits at the target',
    hunt.tag !== null && st.entities[hunt.tag as string]?.ship === CONSTRICTOR_SPEC.designId);
  eq('...and the game is told to spawn it there',
    missionSpawns(st, hunt.target as number)[0]?.tag, hunt.tag);
  eq('...but not elsewhere', missionSpawns(st, LAVE).length, 0);
  eq('the Constrictor\'s world flies set G', missionOverride(st, hunt.target as number), 'constrictor');
  eq('...and Lave does not', missionOverride(st, LAVE), null);
  check('the hunt is not the courier run', !carryingPlans(st));
  check('the standing order names the world',
    orderLine(hunt, g1).includes(g1[hunt.target as number].name.toUpperCase()));

  const atTarget = ctx(facts({ kills: 16, systemIndex: hunt.target as number }));
  {
    const r = stepMissions(st, { kind: 'destroyed', tag: 'somebody-else' }, atTarget);
    eq('another ship\'s death pays nothing', paid(r.effects), 0);
    eq('...and moves nothing', r.state.live[0].leg, 'hunt');
  }
  {
    const r = stepMissions(st, { kind: 'destroyed', tag: hunt.tag as string }, atTarget);
    eq('killing it pays the Navy bounty', paid(r.effects), 25_000);
    eq('...and moves you to the report leg', r.state.live[0].leg, 'report');
    check('...and says so', said(r.effects).some((t) => t.includes('CONSTRICTOR DESTROYED')));
    check('...with the bounty in the line', said(r.effects).some((t) => t.includes('2500.0 Cr')));
    check('the record handed in is untouched', st.live[0].leg === 'hunt');
    eq('the ship is recorded dead', r.state.entities[hunt.tag as string]?.alive, false);
    eq('...so it is never spawned again', missionSpawns(r.state, hunt.target as number).length, 0);
    const again = stepMissions(r.state, { kind: 'destroyed', tag: hunt.tag as string }, atTarget);
    eq('...and it cannot be claimed twice', paid(again.effects), 0);
    st = r.state;
  }

  // --- the report, and the courier run ----------------------------------------
  {
    const draws2 = counting();
    const c = ctx(facts({ kills: 16, systemIndex: hunt.target as number }), draws2.rng);
    const r = stepMissions(st, { kind: 'docked' }, c);
    eq('reporting back gets the courier orders', r.state.live[0].leg, 'courier');
    eq('...with one draw for the delivery world', draws2.draws(), 1);
    check('...and a warning about the Thargoids',
      said(r.effects).some((t) => t.includes('THARGOID')));
    eq('...and no fee yet', paid(r.effects), 0);
    const courier = r.state.live[0];
    const d = distanceTenths(g1[hunt.target as number], g1[courier.target as number]);
    check(`the delivery world is five to nine light years out (${d / 10})`, d >= 50 && d <= 90);
    check('the plans are aboard', carryingPlans(r.state));
    eq('...and the Thargoids are in force everywhere', missionOverride(r.state, LAVE), 'thargoid');
    st = r.state;
  }
  {
    const elsewhere = ctx(facts({ kills: 16, systemIndex: LAVE }));
    const r = stepMissions(st, { kind: 'docked' }, elsewhere);
    eq('a dock at the wrong world delivers nothing', paid(r.effects), 0);
    eq('...and the run goes on', r.state.live[0]?.leg, 'courier');
  }
  {
    const there = ctx(facts({ kills: 16, systemIndex: st.live[0].target as number, day: 9 }));
    const r = stepMissions(st, { kind: 'docked' }, there);
    eq('delivering the plans pays', paid(r.effects), 15_000);
    eq('...and completes it', r.state.done.constrictor, 'complete');
    eq('...and frees the slot', r.state.live.length, 0);
    check('...and says so', said(r.effects).some((t) => t.includes('PLANS DELIVERED')));
    check('the plans are off the ship', !carryingPlans(r.state));
    const last = r.state.journal[r.state.journal.length - 1];
    check('the journal closes on the day and the world',
      last.outcome === 'complete' && last.day === 9 && last.world === st.live[0].target);
    eq('the journal reads accepted, kill, report, delivery, complete',
      r.state.journal.map((j) => j.outcome).join(','),
      'accepted,targetDestroyed,success,success,complete');
    check('a finished arc is never offered again', !canAccept(r.state, 'constrictor', c16));
    const again = stepMissions(r.state, { kind: 'docked' }, there);
    eq('...and a second dock pays nothing', paid(again.effects), 0);
  }
}

console.log('\nmission machine: the rules around a mission');
{
  const empty = emptyMissionState();
  const c16 = ctx(facts({ kills: 16 }));
  const accepted = stepMissions(empty, { kind: 'accept', skeleton: 'constrictor' }, c16).state;

  {
    const r = stepMissions(accepted, { kind: 'abandon', skeleton: 'constrictor' }, c16);
    eq('abandonment fails the mission', r.state.done.constrictor, 'fail');
    eq('...frees the slot', r.state.live.length, 0);
    eq('...pays nothing', paid(r.effects), 0);
    eq('...and the journal says why', r.state.journal[1]?.outcome, 'abandoned');
    const twice = stepMissions(r.state, { kind: 'abandon', skeleton: 'constrictor' }, c16);
    eq('a second abandon changes nothing', JSON.stringify(twice.state), JSON.stringify(r.state));
  }
  {
    const r = stepMissions(empty, { kind: 'accept', skeleton: 'no-such-mission' }, c16);
    eq('an unknown skeleton is refused', r.state.live.length, 0);
  }

  // --- a fixture pair: two arcs, and the lead between them -------------------
  //
  // No second arc ships yet (item 192 of docs/TODO/190), so the lead rules are held on a
  // pair built here. The second arc has a gate the first arc's success would
  // satisfy and its failure would not.
  const first: Skeleton = {
    id: 'first', kind: 'arc', anchor: 'local', patron: { kind: 'world', seedSlot: LAVE },
    hail: 'A WORD FROM THE GOVERNOR', pitch: 'GO', offer: {},
    legs: [{
      id: 'go', verb: { kind: 'deliver' }, place: { kind: 'anywhere' }, line: 'GO', deadlineDays: 3,
      next: [
        { on: 'success', to: 'complete', settle: { pay: 100, setFlags: ['plans'], standing: 1 } },
        { on: 'failed', to: 'fail', settle: { pay: 0, standing: -1 } },
      ],
    }],
    complete: { pay: 0, lead: 'second' },
    fail: { pay: 0, lead: 'second' },
  };
  const second: Skeleton = {
    id: 'second', kind: 'arc', anchor: 'local', patron: { kind: 'world', seedSlot: 12 },
    hail: 'HAIL', pitch: 'GO', offer: { flags: ['plans'], minKills: 999 },
    legs: [{
      id: 'go', verb: { kind: 'deliver' }, place: { kind: 'here' }, line: 'GO',
      next: [{ on: 'success', to: 'complete' }, { on: 'failed', to: 'fail' }],
    }],
    complete: { pay: 0 },
    fail: { pay: 0 },
  };
  const pair = [first, second];
  const at = (systemIndex: number, day = 0) => ctx(facts({ systemIndex, day }), () => 0.5, pair);

  check('the second arc is shut without the flag', !canAccept(empty, 'second', at(12)));
  const held = stepMissions(empty, { kind: 'accept', skeleton: 'first' }, at(LAVE)).state;
  {
    const r = stepMissions(held, { kind: 'docked' }, at(LAVE, 1));
    eq('success saves the lead', r.state.leads[0]?.skeleton, 'second');
    eq('...at the next patron\'s world', r.state.leads[0]?.world, 12);
    check('...and announces it', r.effects.some((e) => e.kind === 'lead' && e.world === 12));
    eq('...and the flag is set', r.state.flags.join(), 'plans');
    eq('...and standing rose', r.state.standing['world-7'], 1);
    check('the lead opens the next arc at its world', canAccept(r.state, 'second', at(12)));
    check('...and nowhere else', !canAccept(r.state, 'second', at(LAVE)));
    const next = stepMissions(r.state, { kind: 'accept', skeleton: 'second' }, at(12));
    eq('acceptance spends the lead', next.state.leads.length, 0);
    eq('...and the lead is not saved twice', r.state.leads.length, 1);
  }
  {
    const late = stepMissions(held, { kind: 'dayPassed', days: 4 }, at(LAVE, 4));
    eq('a passed deadline fails the leg', late.state.done.first, 'fail');
    eq('...with no flag set', late.state.flags.length, 0);
    eq('...and standing fell', late.state.standing['world-7'], -1);
    eq('...and the same lead is saved', late.state.leads[0]?.skeleton, 'second');
    check('failure without the flag still opens the next arc', canAccept(late.state, 'second', at(12)));
    const ontime = stepMissions(held, { kind: 'dayPassed', days: 1 }, at(LAVE, 3));
    eq('the deadline day itself is not late', ontime.state.live.length, 1);
  }
  {
    const r = stepMissions(held, { kind: 'abandon', skeleton: 'first' }, at(LAVE));
    check('abandonment keeps the lead too', r.state.leads[0]?.skeleton === 'second');
  }
  {
    // Three slots, and a lead waits for one (failure rule 3).
    const full: MissionState = {
      ...emptyMissionState(),
      live: ['a', 'b', 'c'].map((skeleton) => ({
        skeleton, leg: 'go', target: null, tag: null, progress: 0, deadlineDay: null,
      })),
      leads: [{ skeleton: 'second', galaxy: 1, world: 12, sinceDay: 0 }],
    };
    check('a lead cannot open a fourth slot', !canAccept(full, 'second', at(12)));
    const freed = { ...full, live: full.live.slice(1) };
    check('...and it waits until one frees', canAccept(freed, 'second', at(12)));
  }
}

console.log('\nmission machine: the ambush verb');
{
  const trap: Skeleton = {
    id: 'trap', kind: 'side', anchor: 'local', patron: { kind: 'world', seedSlot: LAVE },
    hail: 'HAIL', pitch: 'RUN', offer: {}, cap: 2,
    legs: [{
      id: 'run', verb: { kind: 'ambush' }, place: { kind: 'band', min: 30, max: 80 }, line: 'RUN',
      next: [{ on: 'success', to: 'complete', settle: { pay: 10 } }, { on: 'failed', to: 'fail' }],
    }],
    complete: { pay: 0 },
    fail: { pay: 0 },
  };
  const at = (systemIndex: number) => ctx(facts({ systemIndex }), () => 0.5, [trap]);
  const held = stepMissions(emptyMissionState(), { kind: 'accept', skeleton: 'trap' }, at(LAVE)).state;
  const target = held.live[0].target as number;
  const early = stepMissions(held, { kind: 'docked' }, at(LAVE));
  eq('a dock before the arrival completes nothing', early.state.live.length, 1);
  const arrived = stepMissions(held, { kind: 'arrived' }, at(target)).state;
  eq('arrival at the world is progress', arrived.live[0].progress, 1);
  const done = stepMissions(arrived, { kind: 'docked' }, at(target));
  eq('...and the next dock completes it', paid(done.effects), 10);
  const later = (systemIndex: number) =>
    ctx(facts({ systemIndex, day: MISSION_REOFFER_DAYS }), () => 0.5, [trap]);
  check('a capped side job comes back, after the delay', canAccept(done.state, 'trap', later(LAVE)));
  const twice = stepMissions(
    stepMissions(done.state, { kind: 'accept', skeleton: 'trap' }, later(LAVE)).state,
    { kind: 'abandon', skeleton: 'trap' }, later(LAVE)).state;
  check('...until the cap is spent', !canAccept(twice, 'trap', later(LAVE)));
}

console.log('\nmission machine: a day passed, and the deadline speaks (docs/TODO/203 M1)');
{
  const dated: Skeleton = {
    id: 'dated', kind: 'side', anchor: 'local', patron: { kind: 'world', seedSlot: LAVE },
    hail: 'HAIL', pitch: 'RUN', offer: {},
    legs: [{
      id: 'run', verb: { kind: 'deliver' }, place: { kind: 'band', min: 30, max: 80 }, line: 'RUN',
      deadlineDays: 10,
      next: [{ on: 'success', to: 'complete', settle: { pay: 10 } }, { on: 'failed', to: 'fail' }],
    }],
    complete: { pay: 0 },
    fail: { pay: 0 },
  };
  const on = (day: number) => ctx(facts({ systemIndex: LAVE, day }), () => 0.5, [dated]);
  const held = stepMissions(emptyMissionState(), { kind: 'accept', skeleton: 'dated' }, on(0)).state;
  const target = g1[held.live[0].target as number].name.toUpperCase();
  const quiet = stepMissions(held, { kind: 'dayPassed', days: 2 }, on(2));
  check('a day well inside the deadline says nothing', said(quiet.effects).length === 0);
  const near = stepMissions(held, { kind: 'dayPassed', days: 5 }, on(7));
  eq('three days out, the console says how many are left',
    said(near.effects).join('|'), `THE JOB AT ${target} HAS 3 DAYS LEFT.`);
  const last = stepMissions(held, { kind: 'dayPassed', days: 3 }, on(10));
  eq('...and on the last day, that it must be done today',
    said(last.effects).join('|'), `THE JOB AT ${target} MUST BE DONE TODAY.`);
  const late = stepMissions(held, { kind: 'dayPassed', days: 1 }, on(11));
  check('a day past the deadline fails the job',
    late.state.live.length === 0 && late.state.done.dated === 'fail');
  eq('...and says so', said(late.effects)[0], `THE JOB AT ${target} RAN OUT OF TIME, AND IT IS LOST.`);
}

const inputs: MissionInput['kind'][] = ['arrived', 'misjumped', 'scooped', 'policeScan', 'choice'];
check('an input no live leg reads changes nothing', inputs.every((kind) => {
  const st = emptyMissionState();
  const r = stepMissions(st, { kind, tag: 'x', id: 'x' } as MissionInput, ctx(facts()));
  return r.effects.length === 0 && JSON.stringify(r.state) === JSON.stringify(st);
}));
