// The patrons: who offers a mission, by name and by face (docs/TODO/191 M1).
//
// Two claims, and they pull in opposite directions on purpose. The first is
// that an ABSENT record is normal: the file ships empty, and every reader
// must render a plain patron without one. The second is that what is
// committed obeys the rules it was generated under, and names a world that
// exists at that index. A suite that proved only the populated case would
// pass today and prove nothing.

import { NAVY_PATRON, patronFile, patronFor } from '../src/missions/patrons.ts';
import {
  PATRON_PROMPT_VERSION, patronDrift, patronFaults, patronPrompts, patronRole,
} from '../tools/patron-prompts.ts';
import { GOVERNMENT_NAMES, generateGalaxy } from '../src/galaxy/galaxy.ts';
import { MissionsScreen } from '../src/game/screens/missions.ts';
import { LogScreen } from '../src/game/screens/log.ts';
import { newCommander, type CommanderData } from '../src/game/commander.ts';
import type { CommanderFacts } from '../src/missions/model.ts';
import { SIDE_HUNT } from '../src/missions/skeletons/side.ts';
import { captureById } from './screen-capture.ts';
import { constrictorAt, g1 } from './fixtures.ts';
import { check, eq } from './harness.ts';

const LAVE = 7;
const facts = (systemIndex: number, galaxy = 1): CommanderFacts => ({
  galaxy, systemIndex, kills: 0, combatScore: 0, legalStatus: 0, day: 0, cargo: [],
});

console.log('\na patron has a name and a face, and the Navy has neither');
{
  const navy = patronFor({ kind: 'navy' }, facts(LAVE), g1);
  check('the Navy is the fixed patron', navy === NAVY_PATRON && navy.portrait === '' && navy.world === 'navy');
  eq('...under the key the machine writes standing under', navy.id, 'navy');

  // Galaxy 2 has no file, so every world there is the fallback.
  const g2 = generateGalaxy(2);
  const plain = patronFor({ kind: 'world', seedSlot: LAVE }, facts(LAVE, 2), g2);
  check('a world with no record gets a plain patron named by its world',
    plain.name.endsWith(` OF ${g2[LAVE].name.toUpperCase()}`));
  check('...and by its government',
    plain.role.length > 0 && plain.name.startsWith(`THE ${plain.role.slice(4).toUpperCase()} OF`));
  eq('...with no face outside galaxy 1', plain.portrait, '');
  eq('...and the world\'s key', plain.id, `world-${LAVE}`);

  const lave = patronFor({ kind: 'world', seedSlot: LAVE }, facts(0), g1);
  eq('a galaxy 1 world patron has the world\'s face', lave.portrait, 'species/007-lave.png');
  eq('...and the world\'s species', lave.species, 'Human Colonials');
  const record = patronFile(1)?.entries[String(LAVE)];
  eq('...and the record\'s name when one is committed, or the plain one',
    lave.name, record ? record.name : 'THE GOVERNOR OF LAVE');

  const local = patronFor({ kind: 'local' }, facts(LAVE), g1);
  eq('a local patron is the world she stands at', local.world, LAVE);
  eq('...or the world the job was taken at, when the caller knows it',
    patronFor({ kind: 'local' }, facts(LAVE), g1, 12).world, 12);

  check('every world of galaxy 1 has a patron with a name and a face',
    g1.every((s) => {
      const p = patronFor({ kind: 'world', seedSlot: s.index }, facts(0), g1);
      return p.name.length > 0 && p.portrait.startsWith('species/');
    }));
}

console.log('\n...and what is committed names a world that exists');
{
  const file = patronFile(1);
  check('galaxy 1 has a patron file', file !== undefined);
  eq('...at the current prompt version', file?.promptVersion, PATRON_PROMPT_VERSION);
  const drift = file ? patronDrift(file, 1) : ['no file'];
  check(`every committed record matches its prompt${drift.length ? `: ${drift.slice(0, 3).join('; ')}` : ''}`,
    drift.length === 0);
  const broken: string[] = [];
  for (const [index, r] of Object.entries(file?.entries ?? {})) {
    if (g1[Number(index)]?.name !== r.system) broken.push(`${index}: names ${r.system}`);
    if (r.role !== patronRole(g1[Number(index)])) broken.push(`${index}: role drifted`);
    broken.push(...patronFaults(r.name, r.voice).map((f) => `${r.system}: ${f}`));
  }
  check(`every committed record obeys the rules${broken.length ? `: ${broken.slice(0, 3).join('; ')}` : ''}`,
    broken.length === 0);

  // The drift gate itself, on a fixture, because the file above passes
  // trivially while it is empty.
  const stale = {
    galaxy: 1, promptVersion: PATRON_PROMPT_VERSION, model: '', generated: '',
    usage: { requests: 0, inputTokens: 0, outputTokens: 0 },
    entries: {
      '7': { system: 'Lave', hash: '00000000', name: 'Ostrun Vale', role: 'the governor', voice: 'Short.' },
      '8': { system: 'Notleesti', hash: '00000000', name: 'Ostrun Vale', role: 'the governor', voice: 'Short.' },
      '999': { system: 'Nowhere', hash: '00000000', name: 'Ostrun Vale', role: 'the governor', voice: 'Short.' },
    },
  };
  const bad = patronDrift(stale, 1);
  check('a changed prompt is drift', bad.some((b) => b.includes('Lave') && b.includes('prompt changed')));
  check('...so is a world at the wrong index', bad.some((b) => b.includes('Notleesti')));
  check('...and an index the galaxy lacks', bad.some((b) => b.startsWith('999')));
  check('...and an old prompt version',
    patronDrift({ ...stale, promptVersion: PATRON_PROMPT_VERSION - 1, entries: {} }, 1).length === 1);
}

console.log('\n...and the prompts derive from the seed');
{
  const prompts = patronPrompts(1);
  eq('one patron per world', prompts.length, 256);
  eq('every hash is distinct', new Set(prompts.map((p) => p.hash)).size, 256);
  eq('the same galaxy gives the same manifest',
    JSON.stringify(patronPrompts(1)), JSON.stringify(prompts));
  // A role is one of three per government, and the seed spreads the worlds
  // across them. One variant for all thirty-odd dictatorships would be the
  // parity bug the species prompts found.
  const byGov = new Map<string, Set<string>>();
  for (const s of g1) {
    const gov = GOVERNMENT_NAMES[s.government];
    byGov.set(gov, (byGov.get(gov) ?? new Set()).add(patronRole(s)));
  }
  check('every government has two or three roles in use',
    [...byGov.values()].every((roles) => roles.size >= 2 && roles.size <= 3));
  check('the facts name the role and the manner',
    prompts[7].facts.includes('Role: ') && prompts[7].facts.includes('Manner: '));

  eq('a plain name and a usable voice pass',
    patronFaults('Ostrun Vale', 'She gives the order first and the reason never.').length, 0);
  check('a digit in the name is a fault', patronFaults('Unit 7', 'Short and dry.').length > 0);
  check('a system name is a fault', patronFaults('Riedquat Vel', 'Short and dry.').length > 0);
  check('...in the voice too', patronFaults('Ostrun Vale', 'She speaks of Diso.').length > 0);
  check('a banned word is a fault', patronFaults('Gem Vale', 'Short and dry.').length > 0);
  check('four words are too many', patronFaults('One Two Three Four', 'Short and dry.').length > 0);
  check('the voice may not address the reader',
    patronFaults('Ostrun Vale', 'She will tell you the price.').length > 0);
  check('...nor run to three sentences',
    patronFaults('Ostrun Vale', 'Short. Dry. Cold.').length > 0);
}

console.log('\n...and both screens show the patron');
{
  const c: CommanderData = { ...newCommander(), systemIndex: LAVE, contracts: [] };
  c.missions = constrictorAt('hunt', 12);
  const screen = new MissionsScreen(() => ({
    commander: c, systems: g1, offers: [SIDE_HUNT], atStation: true,
    accept: () => {}, abandon: () => {},
  }));
  const html = captureById(() => { screen.render(); }).get('screen') ?? '';
  const local = patronFor({ kind: 'local' }, facts(LAVE), g1).name.toUpperCase();
  check('the MISSIONS screen names the offer\'s patron', html.includes('PATRON') && html.includes(local));
  check('...and the held mission\'s', html.includes('THE NAVY'));

  const taken: CommanderData = { ...newCommander(), systemIndex: 12, contracts: [] };
  taken.missions.journal.push({ skeleton: SIDE_HUNT.id, leg: 'hunt', outcome: 'accepted', day: 1, world: LAVE });
  const log = captureById(() => { new LogScreen(() => ({ commander: taken, systems: g1 })).render(); })
    .get('screen') ?? '';
  check('the LOG screen shows the face of the world the job was taken at, not where she reads it',
    log.includes('species/007-lave.png'));
  check('...captioned with the patron\'s name', log.includes(`<figcaption>${local}</figcaption>`));
}
