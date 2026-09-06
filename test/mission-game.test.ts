// The mission machine, wired into the game: the sky, the kill, the save and
// the galactic drive (docs/TODO/190 M2).
//
// test/mission-machine.test.ts drives the machine with no world. This file
// is the other half, and it is where docs/TODO/140 M2's defect lives: a
// correct function that nothing calls. So every block here goes through the
// real Game, the real wreck resolver, or a real loader.

import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { withoutSaving, readSave, writeSave, makeRecord } from '../src/game/storage.ts';
import { seedWorld } from '../src/game/rng.ts';
import { newCommander, type CommanderData } from '../src/game/commander.ts';
import { destroyShip } from '../src/game/combat-wreck.ts';
import { runMissions } from '../src/game/mission-bridge.ts';
import { parseSnapshot } from '../src/game/snapshot-parse.ts';
import { CONSTRICTOR_BLUEPRINT_SET } from '../src/constants/blueprint-set.ts';
import { generateGalaxy } from '../src/galaxy/galaxy.ts';
import { routeEstimate } from '../src/galaxy/route.ts';
import { stepMissions } from '../src/missions/machine.ts';
import type { Skeleton, MissionState } from '../src/missions/model.ts';
import { emptyMissionState } from '../src/missions/state.ts';
import { installStore } from './save-fixtures.ts';
import { constrictorAt } from './fixtures.ts';
import { check, cmds, dismissBriefing, eq, eqc } from './harness.ts';

const LAVE = 7;

// --- the two loaders drop the old field ---------------------------------------

console.log('\nan old save loads with its mission progress dropped');
{
  seedWorld(190);
  const g = withoutSaving(() => new Game(() => headlessShell())).value;
  dismissBriefing(g);
  const snap = g.captureSnapshot();
  const old = structuredClone(snap) as unknown as { commander: Record<string, unknown> };
  delete old.commander.missions;
  old.commander.mission = { stage: 3, targetIndex: 42 };
  const parsed = parseSnapshot(old);
  check('the world loader installs an empty mission record',
    JSON.stringify(parsed.commander.missions) === JSON.stringify(emptyMissionState()));
  check('...and leaves no stray field', !('mission' in parsed.commander));
  eq('...and the version is the one it was', parsed.version, snap.version);

  const kept = structuredClone(snap);
  kept.commander.missions = constrictorAt('courier', 42);
  eq('a record with the shape is kept as it is',
    JSON.stringify(parseSnapshot(kept).commander.missions), JSON.stringify(kept.commander.missions));

  const { restore } = installStore();
  const stale = { ...newCommander(), mission: { stage: 3, targetIndex: 42 } } as unknown as CommanderData;
  delete (stale as unknown as Record<string, unknown>).missions;
  writeSave('old', makeRecord('OLD', 'OLD', 'file', null, stale));
  const read = readSave('old')?.commander;
  check('the commander loader installs an empty mission record',
    JSON.stringify(read?.missions) === JSON.stringify(emptyMissionState()));
  check('...and leaves no stray field', read !== undefined && !('mission' in (read as object)));
  restore();
}

// --- the sky, the kill, and the save -------------------------------------------

console.log('\nthe Constrictor waits where the machine sent her, and dies once');
{
  const g = withoutSaving(() => {
    seedWorld(1901);
    const game = new Game(() => headlessShell());
    dismissBriefing(game);
    return game;
  }).value;
  const c = g.state.commander;
  const s = g.state;
  c.kills = 16;
  withoutSaving(() => g.enterDocked());
  runMissions(c, { kind: 'accept', skeleton: 'constrictor' }, s.systems, () => 0.5);
  const live = c.missions.live[0];
  const target = live.target as number;
  const tag = live.tag as string;

  withoutSaving(() => g.launch());
  c.systemIndex = target;
  withoutSaving(() => g.arriveInSystem());
  const ship = s.world.npcs.find((n) => n.state.missionTag === tag);
  check('the tagged ship is in the sky at the target', ship !== undefined);
  eq('...and the world flies the Constrictor\'s own set', s.session.blueprintSet, CONSTRICTOR_BLUEPRINT_SET);

  const before = c.credits;
  const events = destroyShip(s.world, c, ship!);
  eq('the kill pays the bounty through the wreck resolver', c.credits - before, 25_000 + ship!.bounty);
  eq('...and moves the mission on', c.missions.live[0]?.leg, 'report');
  check('...and says so', events.some((e) => e.kind === 'message' && e.text.includes('CONSTRICTOR DESTROYED')));

  const paid = c.credits;
  runMissions(c, { kind: 'destroyed', tag }, s.systems);
  eq('a second report of the same kill pays nothing', c.credits, paid);

  // A save written after the payment restores a commander who was paid, and
  // who is owed nothing for that kill again.
  const snap = g.captureSnapshot();
  withoutSaving(() => g.restoreSnapshot(parseSnapshot(structuredClone(snap))));
  const back = g.state.commander;
  eq('a reload keeps the credits', back.credits, paid);
  eq('...and the leg', back.missions.live[0]?.leg, 'report');
  runMissions(back, { kind: 'destroyed', tag }, g.state.systems);
  eq('...and a reload cannot be paid again', back.credits, paid);

  // Another world, another arrival: nothing waits there.
  back.systemIndex = LAVE;
  withoutSaving(() => g.arriveInSystem());
  eq('no tagged ship waits at a world the machine did not name',
    g.state.world.npcs.filter((n) => n.state.missionTag !== null).length, 0);
}

console.log('\na tagged ship that jumps out is reported, and the Constrictor may not');
{
  const g = withoutSaving(() => {
    seedWorld(1902);
    const game = new Game(() => headlessShell());
    dismissBriefing(game);
    return game;
  }).value;
  const c = g.state.commander;
  c.missions = constrictorAt('hunt', 12);
  withoutSaving(() => g.launch());
  c.systemIndex = 12;
  withoutSaving(() => g.arriveInSystem());
  const ship = g.state.world.npcs.find((n) => n.state.missionTag !== null);
  check('the fixture put the ship in the sky', ship !== undefined);
  ship!.state.wantsDespawn = true;
  withoutSaving(() => { g.update(1 / 60, 1); });
  check('the ship is gone', !g.state.world.npcs.includes(ship!));
  eq('...and the hunt goes on, because the Constrictor cannot escape', c.missions.live[0]?.leg, 'hunt');
}

// --- the galactic drive asks first -----------------------------------------------

console.log('\nthe galactic drive asks before it fails a held mission');
{
  eqc('⇧H in the cockpit is the drive', cmds('flight', ['KeyH'], ['ShiftLeft']), ['galacticJump']);
  eqc('Y confirms the jump', cmds('confirmGalacticJump', ['KeyY']), ['confirmGalacticJump']);
  eqc('Escape stays', cmds('confirmGalacticJump', ['Escape']), ['cancelGalacticJump']);
  eqc('...and so does N', cmds('confirmGalacticJump', ['KeyN']), ['cancelGalacticJump']);
  eqc('the confirmation swallows every other key',
    cmds('confirmGalacticJump', ['KeyH', 'KeyR', 'KeyL'], ['ShiftLeft']), []);

  const g = withoutSaving(() => {
    seedWorld(1903);
    const game = new Game(() => headlessShell());
    dismissBriefing(game);
    return game;
  }).value;
  const c = g.state.commander;
  c.equipment.galacticDrive = true;
  withoutSaving(() => g.launch());
  let t = 1;
  const step = (): void => { withoutSaving(() => { g.update(1 / 60, t); }); t += 1 / 60; };
  for (let i = 0; i < 120; i++) step();

  // Nothing held: one key, as it always was. Undone by hand for the next case.
  const galaxyBefore = c.galaxy;
  g.input.injectPress('KeyH', true);
  step();
  eq('with nothing held the drive fires on the one key', c.galaxy, galaxyBefore + 1);
  for (let i = 0; i < 150; i++) step();   // the arrival tunnel plays out
  c.galaxy = 1;
  c.systemIndex = LAVE;
  g.state.systems = generateGalaxy(1);
  c.equipment.galacticDrive = true;

  c.missions = constrictorAt('hunt', 12);
  const before = JSON.stringify(c.missions);
  g.input.injectPress('KeyH', true);
  step();
  eq('with a mission held the drive asks instead', c.galaxy, 1);
  check('...and the cockpit says what a jump costs',
    g.state.session.messageText.includes('HELD MISSION'));
  g.input.injectPress('Escape');
  step();
  eq('Escape leaves the galaxy as it was', c.galaxy, 1);
  eq('...and the mission record untouched', JSON.stringify(c.missions), before);

  g.input.injectPress('KeyH', true);
  step();
  g.input.injectPress('KeyY');
  step();
  eq('Y jumps', c.galaxy, 2);
  eq('...and the held mission failed', c.missions.done.constrictor, 'fail');
  eq('...with the departure as the reason',
    c.missions.journal.find((j) => j.outcome === 'galaxyLeft')?.skeleton, 'constrictor');
  eq('...and the slot is free', c.missions.live.length, 0);
  eq('...and no tagged entity is left behind', Object.keys(c.missions.entities).length, 0);
}

console.log('\na lead crosses the galaxy with her, to a world she can reach');
{
  // No shipped arc leaves a lead yet, so the pair is built here, as
  // test/mission-machine.test.ts builds its own.
  const first: Skeleton = {
    id: 'first', kind: 'arc', anchor: 'local', patron: { kind: 'world', seedSlot: LAVE },
    hail: 'HAIL', pitch: 'GO', offer: {},
    legs: [{
      id: 'go', verb: { kind: 'deliver' }, place: { kind: 'anywhere' }, line: 'GO',
      next: [{ on: 'success', to: 'complete' }, { on: 'failed', to: 'fail' }],
    }],
    complete: { pay: 0, lead: 'second' },
    fail: { pay: 0, lead: 'second' },
  };
  const second: Skeleton = { ...first, id: 'second', patron: { kind: 'world', seedSlot: 12 }, complete: { pay: 0 }, fail: { pay: 0 } };
  const pair = [first, second];
  const g2 = generateGalaxy(2);
  const arrival = 200;
  const state: MissionState = {
    ...emptyMissionState(),
    live: [{ skeleton: 'first', leg: 'go', target: null, tag: null, progress: 0, deadlineDay: null }],
    leads: [{ skeleton: 'second', galaxy: 1, world: 12, sinceDay: 0 }],
  };
  const r = stepMissions(state, { kind: 'galaxyChanged', from: 1, to: 2 }, {
    commander: { galaxy: 2, systemIndex: arrival, kills: 0, combatScore: 0, legalStatus: 0, day: 5 },
    systems: g2, rng: () => 0.5, skeletons: pair,
  });
  eq('the held arc failed', r.state.done.first, 'fail');
  eq('...and the lead it leaves is saved once', r.state.leads.length, 1);
  const lead = r.state.leads[0];
  eq('the earlier lead now names the new galaxy', lead.galaxy, 2);
  check('...and a world a chain of full-tank jumps reaches from the arrival',
    lead.world === arrival || routeEstimate(g2, g2[arrival], g2[lead.world]) !== null);

  // A save carries the pair together. An index alone names nothing across
  // galaxies.
  seedWorld(1904);
  const g = withoutSaving(() => new Game(() => headlessShell())).value;
  dismissBriefing(g);
  g.state.commander.missions = r.state;
  const snap = parseSnapshot(structuredClone(g.captureSnapshot()));
  eq('a save keeps the lead\'s galaxy and world together',
    JSON.stringify(snap.commander.missions.leads), JSON.stringify(r.state.leads));
}
