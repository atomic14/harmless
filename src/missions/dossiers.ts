// The dossiers the game ships: a mission's generated words, by skeleton id.
//
// A DOSSIER is written offline by a model and committed as JSON, one file
// per skeleton under `dossiers/` (docs/TODO/190, docs/TODO/191). The
// generated `dossiers/index.ts` imports each one. A dossier that fails
// `tools/dossier-faults.ts` never reaches this table. A reader never treats
// an absent dossier as an error. Every reader falls back to the skeleton's
// plain words.

import { DOSSIER_FILES } from './dossiers/index.ts';
import type { Dossier } from './model.ts';

const DOSSIERS: Readonly<Record<string, Dossier>> = Object.fromEntries(
  DOSSIER_FILES.map((f) => [f.dossier.skeleton, f.dossier]),
);

/** The dossier for a skeleton, or null when none was written. */
export function dossierFor(skeleton: string): Dossier | null {
  return DOSSIERS[skeleton] ?? null;
}
