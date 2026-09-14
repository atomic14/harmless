// The Dark Wheel comes for a commander (docs/TODO/219).
//
// M1: the Wheel is a patron with no world, its word is on the board at the
// lawless worlds alone, the first whisper waits for Above Average, and the
// mark is a gang hunt whose pilot must die.

import { patronFor } from '../src/missions/patrons.ts';
import { canAccept, offersFor } from '../src/missions/offers.ts';
import { stepMissions } from '../src/missions/machine.ts';
import { emptyMissionState } from '../src/missions/state.ts';
import { missionName, missionDestinations } from '../src/missions/queries.ts';
import { lintSkeleton } from '../src/missions/lint.ts';
import { SKELETONS } from '../src/missions/skeletons/index.ts';
import { WHEEL_MARK } from '../src/missions/skeletons/wheel/mark.ts';
import { WHEEL_BLOCKADE } from '../src/missions/skeletons/wheel/blockade.ts';
import { WHEEL_PILOT } from '../src/missions/skeletons/wheel/pilot.ts';
import { WHEEL_DOOR } from '../src/missions/skeletons/wheel/door.ts';
import { WHEEL_DOOR_RUNG } from '../src/constants/missions.ts';
import { newCommander } from '../src/game/commander.ts';
import { renderStatus } from '../src/ui/screens.ts';
import { capture } from './screen-capture.ts';
import { placeLeg } from '../src/missions/placement.ts';
import { lineSlots } from '../src/missions/text.ts';
import { missionItems } from '../src/missions/queries.ts';
import { WITCHSPACE_TARGET } from '../src/constants/missions.ts';
import { runMissions } from '../src/game/mission-bridge.ts';
import { missionSpawns } from '../src/missions/queries.ts';
import { jobRole } from '../src/missions/verbs/registry.ts';
import { NARCOTICS } from '../src/constants/commodities.ts';
import { SMUGGLE_TONNES } from '../src/constants/missions.ts';
import type { CommanderFacts, MissionEffect } from '../src/missions/model.ts';
import { GOVERNMENT_NAMES } from '../src/galaxy/galaxy.ts';
import { RATINGS } from '../src/constants/rating.ts';
import { WHEEL_PAY, WHEEL_WHISPER_RUNG } from '../src/constants/missions.ts';
import { g1, paid } from './fixtures.ts';
import { arrived } from './course-fixtures.ts';
import { spawnTaggedShips } from '../src/game/spawning.ts';
import { withoutSaving } from '../src/game/storage.ts';
import { SOURCE_DESIGN } from '../src/game/ship-specs.ts';
import { shipDesignIdOf } from '../src/game/ship-identity.ts';
import { check, eq } from './harness.ts';

const anarchy = g1.find((s) => GOVERNMENT_NAMES[s.government] === 'Anarchy')!;
const feudal = g1.find((s) => GOVERNMENT_NAMES[s.government] === 'Feudal')!;
const democracy = g1.find((s) => GOVERNMENT_NAMES[s.government] === 'Democracy')!;
const aboveAverage = RATINGS[WHEEL_WHISPER_RUNG][0];
const facts = (systemIndex: number, combatScore: number): CommanderFacts => ({
  galaxy: 1, systemIndex, kills: combatScore, combatScore, legalStatus: 0, day: 0, cargo: [], scoops: true,
});
const board = (systemIndex: number, combatScore: number): string[] =>
  offersFor(emptyMissionState(), { commander: facts(systemIndex, combatScore), systems: g1 }).map((s) => s.id);

console.log('\nthe Dark Wheel is a patron with no world and no face');
{
  const p = patronFor({ kind: 'wheel' }, facts(7, 0), g1);
  eq('its name', p.name, 'THE DARK WHEEL');
  check('...no world, no face, no species', p.world === 'wheel' && p.portrait === '' && p.species === '');
  eq('a held Wheel mission is named as the Wheel\'s on the chart',
    missionName({ ...emptyMissionState(), live: [{ skeleton: 'wheel-mark', leg: 'mark', target: 7, tag: null, progress: 0, deadlineDay: null }] },
      { skeleton: 'wheel-mark', leg: 'mark', target: 7, tag: null, progress: 0, deadlineDay: null }, g1), 'DARK WHEEL MISSION');
  eq('the lint passes the mark', lintSkeleton(WHEEL_MARK, SKELETONS, g1).join('; '), '');
  eq(`the whisper waits for the rung of Above Average, ${aboveAverage} kills`, RATINGS[WHEEL_WHISPER_RUNG][1], 'Above Average');
}

console.log('\nthe Wheel\'s word is on the lawless boards, once the rating opens it');
{
  check(`an Above Average commander finds the mark at ${anarchy.name}, an Anarchy`, board(anarchy.index, aboveAverage).includes('wheel-mark'));
  check(`...and at ${feudal.name}, a Feudal world`, board(feudal.index, aboveAverage).includes('wheel-mark'));
  check(`...and not at ${democracy.name}, a Democracy`, !board(democracy.index, aboveAverage).includes('wheel-mark'));
  check('an Average commander finds nothing at the Anarchy', !board(anarchy.index, aboveAverage - 1).includes('wheel-mark'));
  check('the mark is the only Wheel job on the board', board(anarchy.index, aboveAverage).filter((id) => id.startsWith('wheel-')).join() === 'wheel-mark');
  // The whisper is the hail: the dock says it, by name, as an arc's patron
  // does. It queues behind the Navy's line, since a commander with the
  // Wheel's rating has the Navy's kills too.
  const docked = stepMissions(emptyMissionState(), { kind: 'docked' }, { commander: facts(anarchy.index, aboveAverage), systems: g1, rng: () => 0.5 });
  check('the dock at the Anarchy says the whisper',
    docked.effects.some((e) => (e.kind === 'say' || e.kind === 'later') && e.text === 'A NOTE WAITS FOR YOU. NO SENDER, NO NAME.'));
}

console.log('\nthe mark is a gang hunt whose pilot must die');
{
  const ctx = { commander: facts(anarchy.index, aboveAverage), systems: g1, rng: () => 0.5 };
  const st = stepMissions(emptyMissionState(), { kind: 'accept', skeleton: 'wheel-mark' }, ctx).state;
  const live = st.live[0];
  const tag = live.tag as string;
  check('accepted, with a Fer-de-Lance and two Asps on the record',
    live !== undefined && st.entities[tag]?.alive === true
    && st.entities[`${tag}#gang-1`]?.alive === true && st.entities[`${tag}#gang-2`]?.alive === true);
  const said = (e: MissionEffect[]): string[] => e.flatMap((x) => (x.kind === 'say' ? [x.text] : []));
  let r = stepMissions(st, { kind: 'destroyed', tag: `${tag}#gang-1` }, ctx);
  r = stepMissions(r.state, { kind: 'destroyed', tag: `${tag}#gang-2` }, ctx);
  r = stepMissions(r.state, { kind: 'destroyed', tag }, ctx);
  eq('the pilot down last completes the trial', r.state.done['wheel-mark'], 'complete');
  eq('...and pays the mark', paid(r.effects), WHEEL_PAY.mark);
  check('...and marks the commander', r.state.flags.includes('wheel.marked'));
  check('...with a word from the Wheel', said(r.effects).some((t) => /WE WILL FIND YOU AGAIN/.test(t)));
  check('...and the Wheel does not offer the mark again', !canAccept(r.state, 'wheel-mark', { commander: facts(anarchy.index, aboveAverage), systems: g1 }));

  // The pilot got away: the trial fails, and the Wheel gives one more chance.
  let f = stepMissions(st, { kind: 'fled', tag }, ctx);
  f = stepMissions(f.state, { kind: 'destroyed', tag: `${tag}#gang-1` }, ctx);
  f = stepMissions(f.state, { kind: 'destroyed', tag: `${tag}#gang-2` }, ctx);
  eq('a pilot that ran fails the trial, whatever became of the gang', f.state.done['wheel-mark'], 'fail');
  check('...and the Wheel says what it wanted', said(f.effects).some((t) => /WANTED THE PILOT/.test(t)));
  const later = { commander: { ...facts(anarchy.index, aboveAverage), day: 30 }, systems: g1 };
  check('...and offers the mark once more, later', canAccept(f.state, 'wheel-mark', later));
  let f2 = stepMissions(f.state, { kind: 'accept', skeleton: 'wheel-mark' }, { ...later, rng: () => 0.5 });
  const tag2 = f2.state.live[0].tag as string;
  f2 = stepMissions(f2.state, { kind: 'fled', tag: tag2 }, { ...later, rng: () => 0.5 });
  const much = { commander: { ...facts(anarchy.index, aboveAverage), day: 60 }, systems: g1 };
  check('...and after a second failure, never', !canAccept(f2.state, 'wheel-mark', much));
}

console.log('\nthe blockade: a parcel past three Vipers, on a clean record (docs/TODO/219 M2)');
{
  eq('the lint passes the blockade', lintSkeleton(WHEEL_BLOCKADE, SKELETONS, g1).join('; '), '');
  eq('a police job flies as the law', jobRole('police'), 'police');
  const marked = { ...emptyMissionState(), flags: ['wheel.marked'] };
  const clean = { commander: facts(anarchy.index, aboveAverage), systems: g1 };
  check('the blockade waits for the mark', !canAccept(emptyMissionState(), 'wheel-blockade', clean)
    && canAccept(marked, 'wheel-blockade', clean));
  check('...and for a clean record',
    !canAccept(marked, 'wheel-blockade', { ...clean, commander: { ...clean.commander, legalStatus: 1 } }));
  const ctx = { ...clean, rng: () => 0.5 };
  const taken = stepMissions(marked, { kind: 'accept', skeleton: 'wheel-blockade' }, ctx);
  const live = taken.state.live[0];
  check('accepted, and the parcel comes aboard',
    taken.effects.some((e) => e.kind === 'cargo' && e.commodity === NARCOTICS && e.tonnes === SMUGGLE_TONNES));
  const there = missionSpawns(taken.state, live.target as number);
  check('three Vipers wait at the far end, as the law', there.length === 3 && there.every((s) => s.job === 'police'));
  const cargo: number[] = []; cargo[NARCOTICS] = SMUGGLE_TONNES;
  const at = { ...ctx, commander: { ...ctx.commander, systemIndex: live.target as number, cargo } };
  const landed = stepMissions(taken.state, { kind: 'docked' }, at);
  eq('the parcel landed unread completes the trial', landed.state.done['wheel-blockade'], 'complete');
  eq('...and pays', paid(landed.effects), WHEEL_PAY.blockade);
  check('...and the commander is trusted', landed.state.flags.includes('wheel.trusted'));
  const read = stepMissions(taken.state, { kind: 'policeScan' }, ctx);
  eq('a scan on the way fails it', read.state.done['wheel-blockade'], 'fail');
  check('...and the Wheel says why', read.effects.some((e) => e.kind === 'say' && /DOES NOT USE A PILOT THE POLICE KNOW/.test(e.text)));
}

console.log('\n...and the world spawns a police job as the law');
{
  const g = arrived(20_260_970);
  const viper = shipDesignIdOf(SOURCE_DESIGN.viper);
  const ships = withoutSaving(() => spawnTaggedShips(g.state.world, g.state.player.position,
    [{ ship: viper, tag: 'blockade#viper-1', job: 'police' }], 2000, 100)).value;
  eq('one Viper spawned', ships.length, 1);
  eq('...as police', ships[0].role, 'police');
  eq('...with its tag', ships[0].state.missionTag, 'blockade#viper-1');
}

console.log('\na leg in witchspace: the pilot (docs/TODO/219 M3)');
{
  eq('the lint passes the pilot', lintSkeleton(WHEEL_PILOT, SKELETONS, g1).join('; '), '');
  const dock = { ...WHEEL_PILOT, id: 'no-dock', legs: [{ ...WHEEL_PILOT.legs[0], verb: { kind: 'deliver' as const } }] };
  check('...and refuses a leg that must dock in witchspace', /cannot end in witchspace/.test(lintSkeleton(dock, SKELETONS, g1).join('; ')));
  const placed = placeLeg({ kind: 'witchspace' }, emptyMissionState(), facts(anarchy.index, aboveAverage), g1, () => 0.5, 'wheel-pilot');
  check('the placement is the witchspace sentinel', placed.ok && placed.target === WITCHSPACE_TARGET);
  eq('...and the words say WITCHSPACE for it', lineSlots(g1, WITCHSPACE_TARGET).TARGET, 'WITCHSPACE');

  const trusted = { ...emptyMissionState(), flags: ['wheel.marked', 'wheel.trusted'] };
  const ctx = { commander: facts(anarchy.index, aboveAverage), systems: g1, rng: () => 0.5 };
  check('the pilot waits for the trust', !canAccept(emptyMissionState(), 'wheel-pilot', ctx) && canAccept(trusted, 'wheel-pilot', ctx));
  const taken = stepMissions(trusted, { kind: 'accept', skeleton: 'wheel-pilot' }, ctx).state;
  const live = taken.live[0];
  const tag = live.tag as string;
  eq('accepted, with the pod placed in witchspace', live.target, WITCHSPACE_TARGET);
  check('...and the pod is adrift there, on the record', missionItems(taken, WITCHSPACE_TARGET).some((i) => i.tag === tag && i.kind === 'capsule'));
  check('...and not on the chart', !missionDestinations(taken).has(WITCHSPACE_TARGET));
  const scooped = stepMissions(taken, { kind: 'scooped', tag }, ctx);
  check('the pod scooped puts the pilot aboard', scooped.state.passengers.some((p) => p.tag === tag)
    && scooped.effects.some((e) => e.kind === 'say' && /LAND THE PILOT/.test(e.text)));
  const landed = stepMissions(scooped.state, { kind: 'survivor', tag, fate: 'landed' }, ctx);
  eq('the pilot landed alive completes the trial', landed.state.done['wheel-pilot'], 'complete');
  eq('...and pays', paid(landed.effects), WHEEL_PAY.pilot);
  check('...and proves the commander', landed.state.flags.includes('wheel.proven'));
  const sold = stepMissions(scooped.state, { kind: 'survivor', tag, fate: 'sold' }, ctx);
  eq('a pilot sold fails it', sold.state.done['wheel-pilot'], 'fail');
  check('...and the Wheel says it does not sell its own', sold.effects.some((e) => e.kind === 'say' && /DOES NOT SELL ITS OWN/.test(e.text)));
}

console.log('\n...and a mis-jump on the pilot\'s leg finds the pod among the Thargoids');
{
  const g = arrived(20_260_971);
  const c = g.state.commander;
  c.combatScore = aboveAverage; c.kills = aboveAverage;
  c.missions.flags.push('wheel.marked', 'wheel.trusted');
  const at = g1.find((s) => GOVERNMENT_NAMES[s.government] === 'Anarchy')!;
  c.systemIndex = at.index;
  withoutSaving(() => runMissions(c, { kind: 'accept', skeleton: 'wheel-pilot' }, g.state.systems, () => 0.5));
  const live = c.missions.live.find((l) => l.skeleton === 'wheel-pilot');
  check('the trial is accepted at the Anarchy', live !== undefined);
  withoutSaving(() => g.enterWitchspace());
  check('the ship is in witchspace', g.state.session.witchspace);
  const pod = g.state.world.cargo.items.find((i) => i.missionTag === live?.tag);
  check('...and the pod is adrift there, tagged for the leg', pod !== undefined);
  check('...among the Thargoids', g.state.world.npcs.some((n) => n.role === 'thargoid' && n.state.alive));
  const words = g.state.commander.missions.live.map((l) => l.target);
  check('...and the standing order names witchspace', words.includes(WITCHSPACE_TARGET));
}

console.log('\nthe door: a Thargoid guards it, and the cloak is behind it (docs/TODO/219 M4)');
{
  const competent = RATINGS[WHEEL_DOOR_RUNG][0];
  eq('the door waits for Competent', RATINGS[WHEEL_DOOR_RUNG][1], 'Competent');
  eq('the lint passes the door', lintSkeleton(WHEEL_DOOR, SKELETONS, g1).join('; '), '');
  eq('a Thargoid job flies as a Thargoid', jobRole('thargoid'), 'thargoid');
  const proven = { ...emptyMissionState(), flags: ['wheel.marked', 'wheel.trusted', 'wheel.proven'] };
  const above = { commander: facts(anarchy.index, aboveAverage), systems: g1, rng: () => 0.5 };
  const ctx = { commander: facts(anarchy.index, competent), systems: g1, rng: () => 0.5 };
  check('the door waits for the proof and the rung',
    !canAccept(proven, 'wheel-door', above) && !canAccept({ ...emptyMissionState(), flags: ['wheel.marked'] }, 'wheel-door', ctx)
    && canAccept(proven, 'wheel-door', ctx));
  const taken = stepMissions(proven, { kind: 'accept', skeleton: 'wheel-door' }, ctx).state;
  const tag = taken.live[0].tag as string;
  check('the guard is a Thargoid on the record, in witchspace',
    taken.live[0].target === WITCHSPACE_TARGET && missionSpawns(taken, WITCHSPACE_TARGET).some((s) => s.tag === tag && s.job === 'thargoid'));
  const cleared = stepMissions(taken, { kind: 'destroyed', tag }, ctx);
  eq('the guard down opens the door', cleared.state.done['wheel-door'], 'complete');
  check('...which grants the cloak', cleared.effects.some((e) => e.kind === 'grant' && e.fit === 'cloak'));
  check('...and makes the commander one of the Wheel', cleared.state.flags.includes('wheel.member'));
  check('...with a word of Raxxla', cleared.effects.some((e) => e.kind === 'say' && /RAXXLA/.test(e.text)));
  eq('...and pays nothing, because the reward is the fit', paid(cleared.effects), 0);

  // The game puts the fit on the ship, and the status screen says both.
  const c = newCommander();
  c.combatScore = competent; c.kills = competent; c.systemIndex = anarchy.index;
  c.missions.flags.push('wheel.marked', 'wheel.trusted', 'wheel.proven');
  withoutSaving(() => runMissions(c, { kind: 'accept', skeleton: 'wheel-door' }, g1, () => 0.5));
  const live = c.missions.live.find((l) => l.skeleton === 'wheel-door');
  check('the door is accepted on a real commander', live !== undefined);
  check('...with no cloak yet', !c.equipment.cloak);
  withoutSaving(() => runMissions(c, { kind: 'destroyed', tag: live?.tag as string }, g1));
  check('the guard down fits the cloak on the ship', c.equipment.cloak === true);
  const status = capture(() => renderStatus(g1, c, null, 'Clean'));
  check('the status screen names the Wheel under the rating', /OF THE DARK WHEEL/.test(status));
  check('...and lists the cloaking device', /Cloaking Device/.test(status));
}

console.log('\n...and a mis-jump on the door\'s leg finds the guard');
{
  const g = arrived(20_260_972);
  const c = g.state.commander;
  c.combatScore = RATINGS[WHEEL_DOOR_RUNG][0]; c.kills = c.combatScore;
  c.missions.flags.push('wheel.marked', 'wheel.trusted', 'wheel.proven');
  c.systemIndex = anarchy.index;
  withoutSaving(() => runMissions(c, { kind: 'accept', skeleton: 'wheel-door' }, g.state.systems, () => 0.5));
  const live = c.missions.live.find((l) => l.skeleton === 'wheel-door');
  withoutSaving(() => g.enterWitchspace());
  const guard = g.state.world.npcs.find((n) => n.state.missionTag === live?.tag);
  check('the guard is in witchspace, tagged for the leg', guard !== undefined);
  eq('...and it flies as a Thargoid', guard?.role, 'thargoid');
}
