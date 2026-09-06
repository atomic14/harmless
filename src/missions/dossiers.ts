// The dossiers the game ships: a mission's generated words, by skeleton id.
//
// A DOSSIER is written offline by a model and committed as JSON (docs/TODO/190).
// The pipeline that writes one is item 191's, and no dossier ships yet. So
// this table is empty, and every reader falls back to the skeleton's plain
// words. A reader never treats an absent dossier as an error.

import type { Dossier } from './model.ts';

const DOSSIERS: Readonly<Record<string, Dossier>> = {};

/** The dossier for a skeleton, or null when none was written. */
export function dossierFor(skeleton: string): Dossier | null {
  return DOSSIERS[skeleton] ?? null;
}
