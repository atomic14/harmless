// The dossiers the game ships: a mission's generated words, by skeleton id.
//
// A DOSSIER is written offline by a model and committed as JSON, one file
// per skeleton under `dossiers/` (docs/TODO/190, docs/TODO/191). The
// generated `dossiers/index.ts` imports each one. A dossier that fails
// `tools/dossier-faults.ts` never reaches this table. A reader never treats
// an absent dossier as an error. Every reader falls back to the skeleton's
// plain words.

import type { StarSystem } from '../galaxy/galaxy.ts';
import { DOSSIER_FILES } from './dossiers/index.ts';
import type { CommanderFacts, Dossier, DossierWord } from './model.ts';
import { patronFor } from './patrons.ts';
import { skeletonById } from './skeletons/index.ts';
import { fillSlots } from './text.ts';

const DOSSIERS: Readonly<Record<string, Dossier>> = Object.fromEntries(
  DOSSIER_FILES.map((f) => [f.dossier.skeleton, f.dossier]),
);

/** The dossier for a skeleton, or null when none was written. */
export function dossierFor(skeleton: string): Dossier | null {
  return DOSSIERS[skeleton] ?? null;
}

/** The slots a hint about a lead's world may carry: the world, and its patron. */
export function hintSlots(
  skeleton: string, world: number, c: CommanderFacts, systems: readonly StarSystem[],
): Record<string, string> {
  const s = skeletonById(skeleton);
  return {
    WORLD: systems[world].name.toUpperCase(),
    PATRON: s ? patronFor(s.patron, c, systems, world).name.toUpperCase() : '',
  };
}

/**
 * The dossier's line for a word the machine named, filled and shouted for
 * the console, or null when no dossier carries one. The bridge asks this
 * for every `say` and `later` that names a word (docs/TODO/191 M3).
 */
export function dossierWord(
  word: DossierWord, c: CommanderFacts, systems: readonly StarSystem[],
  dossiers: (id: string) => Dossier | null = dossierFor,
): string | null {
  const d = dossiers(word.skeleton);
  if (!d) return null;
  if (word.kind === 'near') {
    return d.rumour.near ? fillSlots(d.rumour.near, hintSlots(word.skeleton, word.world, c, systems)).toUpperCase() : null;
  }
  const line = d.legs[word.leg]?.[word.kind];
  return line ? fillSlots(line, word.slots).toUpperCase() : null;
}
