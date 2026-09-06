// The patrons the game ships: who offers a mission, by name and by face.
//
// A PATRON is the person who offers a mission (docs/TODO/190). A world
// patron is derived from the 1984 seed of her world, so Lave always has the
// same governor. A model writes the name and the voice offline, and the
// result is committed as JSON (tools/generate-patrons.ts, docs/TODO/191 M1).
// The Navy is the exception: no world, no face, and fixed here in code.
//
// AN ABSENT RECORD IS NORMAL. The file ships empty until a generation run
// happens, and a record a run dropped never comes. A world with no record
// gets a plain patron named by her world and its government, and the
// world's own portrait. A reader never treats an absent record as an error.
//
// The face is the world's portrait for every world patron, because one
// exists for every world of galaxy 1. A portrait per patron is a later
// option, and `Patron.portrait` already carries a path for it.

import { speciesName, type StarSystem } from '../galaxy/galaxy.ts';
import { portraitUrl } from '../ui/portrait.ts';
import type { CommanderFacts, Patron, PatronRef } from './model.ts';
import galaxy1 from './patrons/galaxy-1.json' with { type: 'json' };

/** One committed patron. `system` is checked against the live galaxy, not trusted. */
export interface PatronRecord {
  system: string;
  /** the prompt hash it was generated from; `--check` compares it */
  hash: string;
  name: string;
  role: string;
  voice: string;
}

export interface PatronFile {
  galaxy: number;
  promptVersion: number;
  /** which model wrote these, for the record; '' while empty */
  model: string;
  generated: string;
  /** what the run cost, in tokens, dropped records included */
  usage: { requests: number; inputTokens: number; outputTokens: number };
  entries: Record<string, PatronRecord>;
}

/** Galaxy 1 only, for the reason `portraitUrl` is: the eight galaxies share a name pool. */
const FILES: Record<number, PatronFile> = { 1: galaxy1 as PatronFile };

/** The raw file, for tests and the drift gate. */
export function patronFile(galaxy: number): PatronFile | undefined {
  return FILES[galaxy];
}

/** The one patron with no world. */
export const NAVY_PATRON: Patron = {
  id: 'navy', world: 'navy', name: 'THE NAVY', role: 'the Navy', species: '', voice: '', portrait: '',
};

/**
 * The plain title a world's patron takes when no record exists, by
 * government index. It is the fallback's own rule, not a copy of the
 * generation variants in tools/patron-prompts.ts. Those are what a model is
 * asked to write around. This is what a screen prints without one.
 */
const PLAIN_ROLE: readonly string[] = [
  'dock boss', 'steward', 'council envoy', 'governor',
  'committee secretary', 'delegate', 'port administrator', 'company director',
];

/**
 * The patron a reference names.
 *
 * A local patron is whoever runs the station the job was taken at, so a
 * caller that knows the origin passes it. Without one, she is the patron of
 * the world the commander stands at. That is right on the board. It is wrong
 * for a held job read at its far end. `id` is the key `patronId`
 * (machine.ts) writes standing under.
 */
export function patronFor(
  ref: PatronRef, facts: CommanderFacts, systems: readonly StarSystem[], origin?: number,
): Patron {
  if (ref.kind === 'navy') return NAVY_PATRON;
  const world = ref.kind === 'world' ? ref.seedSlot : (origin ?? facts.systemIndex);
  const sys = systems[world];
  const base = {
    id: `world-${world}`, world, species: speciesName(sys), portrait: portraitUrl(sys, facts.galaxy),
  };
  const record = patronFile(facts.galaxy)?.entries[String(world)];
  if (record && record.system === sys.name) {
    return { ...base, name: record.name, role: record.role, voice: record.voice };
  }
  const role = PLAIN_ROLE[sys.government] ?? PLAIN_ROLE[0];
  return {
    ...base,
    name: `THE ${role.toUpperCase()} OF ${sys.name.toUpperCase()}`,
    role: `the ${role}`,
    voice: '',
  };
}
