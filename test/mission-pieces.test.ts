// The four pieces of the mission model that waited for an arc (docs/TODO/192
// M3): a gate by jumps, a flag that fires a branch, a change to a world
// that expires, and a choice a screen sends.
//
// Each piece has the test the plan asked for, and two carry the fault the
// plan named. A flag that fired on every settlement would move a leg twice,
// so the journal is counted. A change that never expired would force a set
// for good, so the day is walked past its end.

import { newCommander, type CommanderData } from '../src/game/commander.ts';
import { runMissions } from '../src/game/mission-bridge.ts';
import { MissionsScreen } from '../src/game/screens/missions.ts';
import { renderMissions, type HeldRow } from '../src/ui/screens.ts';
import { stepMissions, type MissionContext } from '../src/missions/machine.ts';
import type { CommanderFacts, MissionState, Skeleton } from '../src/missions/model.ts';
import { canAccept } from '../src/missions/offers.ts';
import { legChoices, missionOverride, missionSpawns } from '../src/missions/queries.ts';
import { repairMissionState } from '../src/missions/repair.ts';
import { emptyMissionState } from '../src/missions/state.ts';
import { routeTable } from '../src/galaxy/route.ts';
import { captureById } from './screen-capture.ts';
import { g1 } from './fixtures.ts';
import { check, eq } from './harness.ts';

const LAVE = 7;
const facts = (over: Partial<CommanderFacts> = {}): CommanderFacts => ({
  galaxy: 1, systemIndex: LAVE, kills: 0, combatScore: 0, legalStatus: 0, day: 10, cargo: [], ...over,
});
const half = () => 0.5;

/** A one-leg world-patron arc at Lave, to build the fixtures from. */
function arc(id: string, over: Partial<Skeleton> = {}): Skeleton {
  return {
    id, kind: 'arc', anchor: 'fixed', patron: { kind: 'world', seedSlot: LAVE },
    hail: 'HAIL', pitch: 'GO', offer: {},
    legs: [{
      id: 'one', verb: { kind: 'deliver' }, place: { kind: 'here' }, line: 'ONE',
      next: [{ on: 'success', to: 'complete' }, { on: 'failed', to: 'fail' }],
    }],
    complete: { pay: 0 }, fail: { pay: 0 },
    ...over,
  };
}

console.log('\na gate by jumps: an arc is offered inside withinJumps of its world');
{
  const near = arc('near', { offer: { withinJumps: 2 } });
  const home = arc('home');
  const empty = emptyMissionState();
  const at = (systemIndex: number) => ({ commander: facts({ systemIndex }), skeletons: [near, home], systems: g1 });
  // Leesti is one jump from Lave and Diso two, by the full-tank graph.
  const one = g1.find((s) => s.name === 'Leesti')!.index;
  const two = g1.find((s) => s.name === 'Diso')!.index;
  check('at home both are open', canAccept(empty, 'near', at(LAVE)) && canAccept(empty, 'home', at(LAVE)));
  check('one jump out the gated one is open, and the other is shut',
    canAccept(empty, 'near', at(one)) && !canAccept(empty, 'home', at(one)));
  check('two jumps out it is still open', canAccept(empty, 'near', at(two)));
  const far = routeTable(g1, LAVE).jumps.findIndex((j) => j === 3);
  check(`three jumps out it is shut (${g1[far].name})`, !canAccept(empty, 'near', at(far)));
  check('...and with no galaxy to measure, home is the only place',
    !canAccept(empty, 'near', { commander: facts({ systemIndex: one }), skeletons: [near, home] }));
}

console.log('\na flag fires the branch that names it, once');
{
  // `giver` sets the flag when it completes. `waiter` holds a leg that
  // moves on that flag, and a second leg that waits on it too.
  const giver = arc('giver', { complete: { pay: 0, setFlags: ['plans'] } });
  const waiter = arc('waiter', {
    legs: [
      {
        id: 'wait', verb: { kind: 'deliver' }, place: { kind: 'anywhere' }, line: 'WAIT',
        next: [{ on: { flag: 'plans' }, to: 'after', settle: { pay: 100 } }, { on: 'failed', to: 'fail' }],
      },
      {
        id: 'after', verb: { kind: 'deliver' }, place: { kind: 'here' }, line: 'AFTER',
        next: [{ on: 'success', to: 'complete' }, { on: 'failed', to: 'fail' }],
      },
    ],
  });
  const ctx: MissionContext = { commander: facts(), systems: g1, rng: half, skeletons: [giver, waiter] };
  let st = emptyMissionState();
  st = stepMissions(st, { kind: 'accept', skeleton: 'waiter' }, ctx).state;
  st = stepMissions(st, { kind: 'accept', skeleton: 'giver' }, ctx).state;
  eq('the waiting leg waits', st.live.find((l) => l.skeleton === 'waiter')?.leg, 'wait');
  const r = stepMissions(st, { kind: 'docked' }, ctx);
  eq('the giver completes and sets the flag', r.state.flags.join(), 'plans');
  eq('...and the waiter moves on the flag in the same step', r.state.live.find((l) => l.skeleton === 'waiter')?.leg, 'after');
  eq('...paid once', r.effects.filter((e) => e.kind === 'pay').length, 1);
  eq('...with one journal entry for the flag',
    r.state.journal.filter((j) => j.outcome === 'flag:plans').length, 1);
  // A second settlement with the same flag fires nothing: the flag is not new.
  const again = arc('again', { complete: { pay: 0, setFlags: ['plans'] } });
  const ctx2: MissionContext = { ...ctx, skeletons: [giver, waiter, again] };
  let st2 = stepMissions(r.state, { kind: 'accept', skeleton: 'again' }, ctx2).state;
  st2 = stepMissions(st2, { kind: 'docked' }, ctx2).state;
  eq('a flag set again fires nothing', st2.journal.filter((j) => j.outcome === 'flag:plans').length, 1);
  // A leg accepted after the flag was set moves at once.
  const late = arc('late', { legs: waiter.legs });
  const ctx3: MissionContext = { ...ctx, skeletons: [giver, waiter, late] };
  const r3 = stepMissions({ ...emptyMissionState(), flags: ['plans'] }, { kind: 'accept', skeleton: 'late' }, ctx3);
  eq('a leg that starts after its flag was set moves at once', r3.state.live[0]?.leg, 'after');
}

console.log('\na change to a world holds until its day, and then it is gone');
{
  const changer = arc('changer', {
    legs: [{
      id: 'one', verb: { kind: 'deliver' }, place: { kind: 'here' }, line: 'ONE',
      next: [
        { on: 'success', to: 'complete', settle: { pay: 0, override: { set: 'thargoid', days: 3 }, spawn: { ships: [{ ship: 'elite-a:design:19', tag: 'changer#guard', job: 'hunt' }], days: 3 } } },
        { on: 'failed', to: 'fail' },
      ],
    }],
  });
  const c: CommanderData = { ...newCommander(), systemIndex: LAVE, day: 10, contracts: [] };
  const from = [changer];
  const ctxSk: Skeleton[] = from;
  c.missions.live.push({ skeleton: 'changer', leg: 'one', target: LAVE, tag: null, progress: 0, deadlineDay: null });
  c.missions.journal.push({ skeleton: 'changer', leg: 'one', outcome: 'accepted', day: 10, world: LAVE });
  const ctx: MissionContext = { commander: facts(), systems: g1, rng: half, skeletons: ctxSk };
  const r = stepMissions(c.missions, { kind: 'docked' }, ctx);
  check('the machine asks for both changes at the branch\'s world',
    r.effects.some((e) => e.kind === 'worldOverride' && e.world === LAVE && e.until === 13)
    && r.effects.some((e) => e.kind === 'standingSpawn' && e.world === LAVE && e.until === 13));
  // The queries read the record. It is written by hand here, and by the
  // bridge below.
  c.missions = r.state;
  c.missions.changes.push({ world: LAVE, until: 13, override: 'thargoid' });
  c.missions.changes.push({ world: LAVE, until: 13, ships: [{ ship: 'elite-a:design:19', tag: 'changer#guard', job: 'hunt' }] });
  eq('the override reads at that world', missionOverride(c.missions, LAVE, from), 'thargoid');
  eq('...and not at another', missionOverride(c.missions, 8, from), null);
  eq('the standing spawn reads at that world', missionSpawns(c.missions, LAVE, from).map((s) => s.tag).join(), 'changer#guard');
  c.day = 13;
  c.missions = stepMissions(c.missions, { kind: 'dayPassed', days: 1 }, { ...ctx, commander: facts({ day: 13 }) }).state;
  eq('on its last day the change still holds', c.missions.changes.length, 2);
  c.missions = stepMissions(c.missions, { kind: 'dayPassed', days: 1 }, { ...ctx, commander: facts({ day: 14 }) }).state;
  eq('the day after, it is gone', c.missions.changes.length, 0);
  eq('...and the override with it', missionOverride(c.missions, LAVE, from), null);
  // The bridge itself writes the record from the effects.
  const b: CommanderData = { ...newCommander(), systemIndex: LAVE, day: 10, contracts: [] };
  b.missions.live.push({ skeleton: 'changer', leg: 'one', target: LAVE, tag: null, progress: 0, deadlineDay: null });
  b.missions.journal.push({ skeleton: 'changer', leg: 'one', outcome: 'accepted', day: 10, world: LAVE });
  runMissions(b, { kind: 'docked' }, g1, half, from);
  eq('the bridge writes both changes on the record', b.missions.changes.map((ch) => `${ch.world}:${ch.until}:${ch.override ?? ch.ships?.[0]?.tag}`).join('|'),
    `${LAVE}:13:thargoid|${LAVE}:13:changer#guard`);
  b.day = 14;
  runMissions(b, { kind: 'dayPassed', days: 1 }, g1, half, from);
  eq('...and through the bridge the day after, they are gone', b.missions.changes.length, 0);
  eq('a save without the field reads as none', repairMissionState({ ...emptyMissionState(), changes: undefined }).changes.length, 0);
}

console.log('\na choice on the MISSIONS screen sends the input, and an unanswered one starts nothing');
{
  const chooser = arc('chooser', {
    legs: [
      {
        id: 'ask', verb: { kind: 'deliver' }, place: { kind: 'anywhere' }, line: 'ASK',
        next: [
          { on: { choice: 'pay-them' }, to: 'complete', settle: { pay: 500 } },
          { on: { choice: 'refuse' }, to: 'fail' },
          { on: 'failed', to: 'fail' },
        ],
      },
    ],
  });
  eq('the leg lists its choices in branch order', legChoices(chooser, 'ask').join(), 'pay-them,refuse');
  const ctx: MissionContext = { commander: facts(), systems: g1, rng: half, skeletons: [chooser] };
  let st: MissionState = stepMissions(emptyMissionState(), { kind: 'accept', skeleton: 'chooser' }, ctx).state;
  const idle = stepMissions(st, { kind: 'docked' }, ctx);
  eq('a dock with the prompt unanswered starts nothing', idle.state.live[0]?.leg, 'ask');
  const wrong = stepMissions(st, { kind: 'choice', id: 'shrug' }, ctx);
  eq('a choice the leg does not name starts nothing', wrong.state.live[0]?.leg, 'ask');
  const r = stepMissions(st, { kind: 'choice', id: 'pay-them' }, ctx);
  eq('the named choice takes its branch', r.state.done.chooser, 'complete');
  eq('...and settles it', r.effects.filter((e) => e.kind === 'pay').length, 1);
  eq('...under the choice\'s label in the journal', r.state.journal[1]?.outcome, 'choice:pay-them');

  // The screen: a held row that waits on a choice draws one key per option,
  // and a row that waits on none draws no prompt. The screen reads the
  // shipped skeletons for its rows, and none ships a choice leg yet, so the
  // renderer is driven through its own row type.
  const c: CommanderData = { ...newCommander(), systemIndex: LAVE, contracts: [] };
  const row = (choices: string[]): HeldRow => ({
    kind: 'mission', line: 'ASK', destination: null, reward: 500, warning: '', patron: 'THE GOVERNOR OF LAVE',
    live: st.live[0], choices, title: 'LAVE MISSION', pages: [],
  });
  const html = captureById(() => {
    renderMissions({ offers: [], held: [row(['pay-them', 'refuse'])], leads: [], systems: g1, selected: 0, atStation: true });
  }).get('screen') ?? '';
  check('a held leg that waits on a choice draws one key per option',
    html.includes('data-key="Digit1">1 PAY THEM') && html.includes('data-key="Digit2">2 REFUSE'));
  const plain = captureById(() => {
    renderMissions({ offers: [], held: [row([])], leads: [], systems: g1, selected: 0, atStation: true });
  }).get('screen') ?? '';
  check('...and a leg that waits on none draws no prompt', !plain.includes('Digit1'));
  // The screen builds its rows from the shipped skeletons, and a held leg
  // of one that has no choice draws no prompt.
  c.missions = st;
  const screen = new MissionsScreen(() => ({
    commander: c, systems: g1, offers: [], atStation: true,
    accept: () => {}, abandon: () => {}, choose: () => {},
  }));
  const shipped = captureById(() => { screen.render(); }).get('screen') ?? '';
  check('a held leg with no choice on the screen draws no prompt', !shipped.includes('Digit1'));
}
