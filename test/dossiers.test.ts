// The dossiers: a mission's generated words, and the gate they pass first
// (docs/TODO/191).
//
// Two claims, and they pull in opposite directions on purpose. The first is
// that an ABSENT dossier is normal: none ships until a generation run
// happens, and every reader must render the skeleton's plain words without
// one. The second is that what is committed obeys the rules it was written
// under, and answers the skeleton it was written for. The committed check
// passes trivially while the directory is empty, so the validator and the
// drift gate are each proved on a dossier built here and then broken.

import { readdirSync, readFileSync } from 'node:fs';
import { newCommander, type CommanderData } from '../src/game/commander.ts';
import { runMissions } from '../src/game/mission-bridge.ts';
import { MissionsScreen } from '../src/game/screens/missions.ts';
import { dossierFor, dossierWord } from '../src/missions/dossiers.ts';
import { DOSSIER_FILES } from '../src/missions/dossiers/index.ts';
import { boardRumour, dockHint, leadJumps, leadLine, worldNews } from '../src/missions/hints.ts';
import { stepMissions, type MissionContext } from '../src/missions/machine.ts';
import type {
  CommanderFacts, Dossier, MissionEffect, MissionState, Skeleton,
} from '../src/missions/model.ts';
import { patronFor } from '../src/missions/patrons.ts';
import { SKELETONS, skeletonById } from '../src/missions/skeletons/index.ts';
import { SIDE_HUNT, SIDE_RESCUE } from '../src/missions/skeletons/side.ts';
import { emptyMissionState } from '../src/missions/state.ts';
import { storyPages } from '../src/missions/story.ts';
import { CONSTRICTOR } from '../src/missions/skeletons/constrictor.ts';
import { dossierFaults } from '../tools/dossier-faults.ts';
import {
  DOSSIER_PROMPT_VERSION, dossierDrift, dossierPromptFor, dossierPrompts, indexSource, shapeOf,
} from '../tools/dossier-prompts.ts';
import { g1 } from './fixtures.ts';
import { check, eq } from './harness.ts';
import { captureById } from './screen-capture.ts';

/** A dossier that passes every check, built from the skeleton's shape. */
export function sampleDossier(s: Skeleton): Dossier {
  const shape = shapeOf(s);
  return {
    skeleton: s.id, hash: dossierPromptFor(s).hash, title: 'The Quiet Errand',
    briefing: ['{PATRON} here, at {HERE}. There is work, and it pays. Take it or leave it.'],
    legs: Object.fromEntries(shape.legs.map((leg) => [leg, {
      arrive: 'Make for {TARGET} and do the thing.',
      success: 'Done, and {PAY} is yours.',
      fail: 'That went wrong, and there is no fee.',
    }])),
    lead: '{PATRON} at {WORLD} has asked for you by name.',
    rumour: { far: 'They say {PATRON} at {WORLD} wants a pilot.', near: 'A message from {WORLD}: come when you can.' },
    news: '{PATRON} is asking after a pilot here.',
    images: {},
    story: {
      opening: 'On day {DAY} she took the errand at {WORLD}.',
      closing: { complete: 'It was done at {WORLD} on day {DAY}.', fail: 'It failed at {WORLD} on day {DAY}.' },
      legs: Object.fromEntries(shape.legs.map((leg) => [leg, Object.fromEntries(
        shape.triggers[leg].map((t) => [t, `On day {DAY}, at {WORLD}, the leg ended by ${t.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[^a-z ]/gi, ' ').toLowerCase()}.`]),
      )])),
    },
  };
}

console.log('\nno dossier ships until a run happens, and the reader says so');
{
  const dir = new URL('../src/missions/dossiers/', import.meta.url);
  const names = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();
  eq('the generated index lists every committed file', readFileSync(new URL('index.ts', dir), 'utf8'), indexSource(names));
  eq('...and the reader holds that many', DOSSIER_FILES.length, names.length);
  check('a skeleton with no dossier reads null, never an error',
    SKELETONS.every((s) => dossierFor(s.id) === null || dossierFor(s.id)?.skeleton === s.id));
  eq('a ghost skeleton reads null', dossierFor('no-such-mission'), null);

  const bad: string[] = [];
  for (const f of DOSSIER_FILES) {
    const s = skeletonById(f.dossier.skeleton);
    if (!s) { bad.push(`${f.dossier.skeleton}: no such skeleton`); continue; }
    bad.push(...dossierDrift(f), ...dossierFaults(f.dossier, s, dossierPromptFor(s).own));
  }
  check(`every committed dossier passes the validator and the drift gate${bad.length ? `: ${bad.slice(0, 3).join('; ')}` : ''}`,
    bad.length === 0);
}

console.log('\n...and the validator refuses what the plan says it must');
{
  const own = (s: Skeleton) => dossierPromptFor(s).own;
  check('a sample dossier passes for every skeleton',
    SKELETONS.every((s) => dossierFaults(sampleDossier(s), s, own(s)).length === 0));

  const broken = (edit: (d: Dossier) => void, s: Skeleton = SIDE_RESCUE): string[] => {
    const d = sampleDossier(s);
    edit(d);
    return dossierFaults(d, s, own(s));
  };
  check('a missing branch line is a fault',
    broken((d) => { delete d.story.legs.pod['survivor:sold']; }).some((f) => f.includes('lacks survivor:sold')));
  check('...and so is a branch the skeleton lacks',
    broken((d) => { d.story.legs.pod.targetFled = 'It fled.'; }).some((f) => f.includes('names targetFled')));
  check('a missing leg is a fault',
    broken((d) => { delete d.legs.data; }).some((f) => f === 'legs lacks data'));
  check('...and so is a leg the skeleton lacks',
    broken((d) => { d.story.legs.extra = {}; }).some((f) => f.includes('names extra')));
  check('{TARGET} in a story line is a slot the field may not carry',
    broken((d) => { d.story.opening = 'She left for {TARGET} on day {DAY}.'; })
      .some((f) => f.includes('carries {TARGET}')));
  check('...and {PAY} in a briefing',
    broken((d) => { d.briefing = ['{PATRON} pays {PAY}.']; }).some((f) => f.includes('carries {PAY}')));
  check('Diso in a side job\'s rumour is a foreign world',
    broken((d) => { d.rumour.far = 'They say the patron at Diso wants a pilot.'; })
      .some((f) => f.includes('names another system (Diso)')));
  // Riedquat rather than Lave: Lave is one of the nineteen names that are
  // also English words, and the name pool leaves those out (system-prompts.ts).
  check('...while the Navy\'s dossier may not name one either',
    broken((d) => { d.news = 'Work waits at Riedquat.'; }, CONSTRICTOR).some((f) => f.includes('(Riedquat)')));
  check('"combat reputation" in a briefing is a ladder word',
    broken((d) => { d.briefing = ['{PATRON} here. A combat reputation like yours is what this needs.']; })
      .some((f) => f.includes('RATING')));
  check('...and so is "your record"',
    broken((d) => { d.briefing = ['{PATRON} here. Your record is your own business.']; })
      .some((f) => f.includes('legal status')));
  check('a digit is a fault', broken((d) => { d.title = 'Job 7'; }).some((f) => f.includes('digit')));
  check('a story line may not say "you"',
    broken((d) => { d.story.opening = 'You took the job at {WORLD}.'; }).some((f) => f.includes('addresses the reader')));
  check('...while a briefing may', broken((d) => { d.briefing = ['You will do, pilot.']; }).length === 0);
  check('a banned word is a fault', broken((d) => { d.news = 'A vibrant offer waits.'; }).some((f) => f.includes('vibrant')));
  check('a fourth briefing page is one too many',
    broken((d) => { d.briefing = ['One.', 'Two.', 'Three.', 'Four.']; }).some((f) => f.includes('wanted 1-3')));
  check('a dossier for another skeleton is refused',
    dossierFaults(sampleDossier(CONSTRICTOR), SIDE_RESCUE, '').some((f) => f.includes('is for constrictor')));
}

console.log('\n...and the drift gate reads the skeleton\'s shape');
{
  const file = (d: Dossier) => ({
    promptVersion: DOSSIER_PROMPT_VERSION, model: '', generated: '',
    usage: { requests: 0, inputTokens: 0, outputTokens: 0 }, dossier: d,
  });
  eq('a fresh dossier is not drift', dossierDrift(file(sampleDossier(SIDE_RESCUE))).length, 0);
  check('a changed hash is drift',
    dossierDrift(file({ ...sampleDossier(SIDE_RESCUE), hash: '00000000' }))[0]?.includes('prompt changed'));
  check('an old prompt version is drift',
    dossierDrift({ ...file(sampleDossier(SIDE_RESCUE)), promptVersion: DOSSIER_PROMPT_VERSION - 1 })
      .some((b) => b.includes('prompt version')));
  check('a ghost skeleton is drift',
    dossierDrift(file({ ...sampleDossier(SIDE_RESCUE), skeleton: 'ghost' }))[0]?.includes('no such skeleton'));
  // The hash covers the shape, not the prompt text alone. A skeleton with a
  // new leg must invalidate its dossier.
  const grown: Skeleton = { ...SIDE_RESCUE, legs: [...SIDE_RESCUE.legs, { ...SIDE_RESCUE.legs[1], id: 'extra' }] };
  check('a skeleton with a new leg has a new hash',
    dossierPromptFor(grown).hash !== dossierPromptFor(SIDE_RESCUE).hash);
  check('...and its old dossier is drift', dossierDrift(file(sampleDossier(SIDE_RESCUE)), [grown]).length > 0);
  check('a changed pitch has a new hash too',
    dossierPromptFor({ ...SIDE_RESCUE, pitch: 'OTHER' }).hash !== dossierPromptFor(SIDE_RESCUE).hash);

  eq('one prompt per skeleton', dossierPrompts().length, SKELETONS.length);
  eq('...or the ones named', dossierPrompts(['constrictor', 'side-hunt']).map((p) => p.skeleton).join(), 'constrictor,side-hunt');
  const rescue = dossierPromptFor(SIDE_RESCUE);
  check('a local job\'s prompt names no world, and says so',
    rescue.own === '' && rescue.facts.includes('{HERE}') && rescue.facts.includes('name neither'));
  check('...and names every leg and every trigger',
    rescue.legs.join() === 'pod,data' && rescue.triggers.pod.includes('survivor:landed')
    && rescue.facts.includes('Leg "data"') && rescue.facts.includes('survivor:sold'));
  eq('the generated index for no files is the empty list', indexSource([]).includes('= [];'), true);
  check('...and for two files imports both',
    indexSource(['side-hunt', 'constrictor']).includes("import d_constrictor from './constrictor.json'")
    && indexSource(['side-hunt', 'constrictor']).includes('d_side_hunt as DossierFile'));
}

console.log('\n...and every reader speaks the dossier\'s words, or the skeleton\'s without one');
{
  const LAVE = 7;
  const facts = (day = 0): CommanderFacts => ({
    galaxy: 1, systemIndex: LAVE, kills: 20, combatScore: 0, legalStatus: 0, day, cargo: [],
  });
  const ctx = (c: CommanderFacts): MissionContext => ({ commander: c, systems: g1, rng: () => 0.5 });
  const full = (id: string): Dossier | null => {
    const s = skeletonById(id);
    return s ? sampleDossier(s) : null;
  };
  const none = (): Dossier | null => null;
  const says = (effects: MissionEffect[]) => effects.filter((e) => e.kind === 'say');

  // The machine names the word and never reads it.
  const taken = stepMissions(emptyMissionState(), { kind: 'accept', skeleton: 'constrictor' }, ctx(facts()));
  const first = says(taken.effects)[0];
  check('an acceptance says the leg line, and names the arrive word',
    first?.text.startsWith('NAVY MISSION') && first.word?.kind === 'arrive' && first.word.skeleton === 'constrictor');
  const tag = taken.state.live[0].tag ?? '';
  const killed = stepMissions(taken.state, { kind: 'destroyed', tag }, ctx(facts()));
  const kill = says(killed.effects).find((e) => e.word?.kind === 'success');
  check('a hunt\'s kill names the success word, with the skeleton\'s own line as the text',
    kill?.text.includes('CONSTRICTOR DESTROYED') === true && kill.word?.kind === 'success' && kill.word.leg === 'hunt');
  const overdue: MissionState = {
    ...emptyMissionState(),
    live: [{ skeleton: 'side-deliver', leg: 'run', target: 12, tag: null, progress: 0, deadlineDay: 10 }],
  };
  const late = stepMissions(overdue, { kind: 'dayPassed', days: 1 }, ctx(facts(11)));
  const fail = says(late.effects).find((e) => e.word?.kind === 'fail');
  check('a silent failure still names the fail word, with no text',
    fail !== undefined && fail.text === '' && late.state.done['side-deliver'] === 'fail');
  check('the rescue\'s lost pod names no word, because only the skeleton\'s line fits it', (() => {
    const pod: MissionState = {
      ...emptyMissionState(),
      journal: [{ skeleton: 'side-rescue', leg: 'pod', outcome: 'accepted', day: 0, world: LAVE }],
      live: [{ skeleton: 'side-rescue', leg: 'pod', target: 12, tag: 'side-rescue#0#pod', progress: 0, deadlineDay: null }],
      entities: { 'side-rescue#0#pod': { kind: 'capsule', ship: '', hull: 1, lastWorld: 12, alive: true } },
    };
    const r = stepMissions(pod, { kind: 'destroyed', tag: 'side-rescue#0#pod' }, ctx(facts()));
    const said = says(r.effects).find((e) => e.text.includes('POD LOST'));
    return said !== undefined && said.word === undefined && r.state.live[0]?.leg === 'data';
  })());

  // The bridge resolves the word.
  const word = kill!.word!;
  eq('a dossier\'s line replaces the skeleton\'s, filled and shouted',
    dossierWord(word, facts(), g1, full), 'DONE, AND 2500.0 CR IS YOURS.');
  eq('...and no dossier means the skeleton\'s line stands', dossierWord(word, facts(), g1, none), null);
  eq('the one-jump message fills the world and the patron',
    dossierWord({ skeleton: 'constrictor', kind: 'near', world: LAVE }, facts(), g1, full),
    'A MESSAGE FROM LAVE: COME WHEN YOU CAN.');
  const c: CommanderData = { ...newCommander(), systemIndex: LAVE, day: 11, contracts: [] };
  c.missions = overdue;
  check('through the bridge, a silent failure with no dossier says nothing',
    runMissions(c, { kind: 'dayPassed', days: 1 }, g1).every((m) => m.text.length > 0)
    && c.missions.done['side-deliver'] === 'fail');

  // The hints.
  const lead = { skeleton: 'constrictor', galaxy: 1, world: LAVE, sinceDay: 0 };
  const near = g1.find((s) => s.index !== LAVE && leadJumps(lead, { ...facts(), systemIndex: s.index }, g1) === 1)!;
  const away = { ...facts(), systemIndex: near.index };
  const st = { ...emptyMissionState(), leads: [lead] };
  check('the LEADS row is the dossier\'s lead line, then the distance',
    leadLine(lead, away, g1, full).startsWith('THE NAVY AT LAVE HAS ASKED FOR YOU BY NAME. —'));
  check('...or the plain row', leadLine(lead, away, g1, none).startsWith('SOMEBODY AT LAVE WANTS A WORD —'));
  eq('the board rumour is rumour.far', boardRumour(st, away, g1, full), 'THEY SAY THE NAVY AT LAVE WANTS A PILOT.');
  check('...or the plain rumour', boardRumour(st, away, g1, none)?.startsWith('RUMOUR:') === true);
  eq('the DATA ON line is news', worldNews(st, away, g1, LAVE, full), 'THE NAVY IS ASKING AFTER A PILOT HERE.');
  check('...or the plain line', worldNews(st, away, g1, LAVE, none)?.startsWith('A PATRON HERE') === true);
  const hint = dockHint(st, away, g1, false, 1);
  check('the one-jump dock message names the near word for the bridge',
    hint?.word?.kind === 'near' && hint.text.includes('A MESSAGE FROM LAVE'));

  // The MISSIONS screen.
  const screen = (dossiers: (id: string) => Dossier | null) => captureById(() => {
    new MissionsScreen(() => ({
      commander: { ...newCommander(), systemIndex: LAVE, contracts: [] }, systems: g1,
      offers: [SIDE_HUNT], atStation: true, accept: () => {}, abandon: () => {}, dossiers,
    })).render();
  }).get('screen') ?? '';
  const patron = patronFor({ kind: 'local' }, facts(), g1).name;
  check('an offer shows the dossier\'s title and its briefing, with the patron and this world filled',
    screen(full).includes('THE QUIET ERRAND') && screen(full).includes(`${patron} here, at Lave.`));
  check('...or the plain pitch', screen(none).includes(SIDE_HUNT.pitch) && !screen(none).includes('ERRAND'));

  // The story.
  const run: MissionState = {
    ...emptyMissionState(),
    journal: [
      { skeleton: 'side-rescue', leg: 'pod', outcome: 'accepted', day: 3, world: LAVE },
      { skeleton: 'side-rescue', leg: 'pod', outcome: 'targetDestroyed', day: 5, world: 12 },
      { skeleton: 'side-rescue', leg: 'data', outcome: 'success', day: 7, world: LAVE },
      { skeleton: 'side-rescue', leg: 'data', outcome: 'complete', day: 7, world: LAVE },
    ],
  };
  const [page] = storyPages(run, g1, undefined, full);
  check('a dossier that names every branch tells the whole path in its own words',
    page.lines.length === 4 && page.lines.every((l) => !l.startsWith('DAY '))
    && page.lines[1].includes('target destroyed') && page.lines[3].includes('done at LAVE on day 7'));
  check('...and the plain words stand without one',
    storyPages(run, g1, undefined, none)[0].lines.every((l) => l.startsWith('DAY ')));
}
