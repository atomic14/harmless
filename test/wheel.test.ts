// The Dark Wheel comes for a commander (docs/TODO/219).
//
// M1: the Wheel is a patron with no world, its word is on the board at the
// lawless worlds alone, the first whisper waits for Above Average, and the
// mark is a gang hunt whose pilot must die.

import { patronFor } from '../src/missions/patrons.ts';
import { canAccept, offersFor } from '../src/missions/offers.ts';
import { stepMissions } from '../src/missions/machine.ts';
import { emptyMissionState } from '../src/missions/state.ts';
import { missionName } from '../src/missions/queries.ts';
import { lintSkeleton } from '../src/missions/lint.ts';
import { SKELETONS } from '../src/missions/skeletons/index.ts';
import { WHEEL_MARK } from '../src/missions/skeletons/wheel/mark.ts';
import type { CommanderFacts, MissionEffect } from '../src/missions/model.ts';
import { GOVERNMENT_NAMES } from '../src/galaxy/galaxy.ts';
import { RATINGS } from '../src/constants/rating.ts';
import { WHEEL_PAY, WHEEL_WHISPER_RUNG } from '../src/constants/missions.ts';
import { g1, paid } from './fixtures.ts';
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
