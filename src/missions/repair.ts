// A mission record read from a save: kept when it has the shape, replaced
// when it does not.
//
// Two loaders read a commander. `parseSnapshot` reads a world snapshot, and
// `repairCommander` (storage.ts) reads a commander record. Both call this, so
// "no missions" and "a spoiled record" have one answer each. An old save
// carries a `mission` field with a stage number instead. That field is
// dropped by the caller, and this installs an empty record in its place. The
// save loads, and only the mission progress is lost (docs/TODO/190).

import type { MissionState } from './model.ts';
import { emptyMissionState } from './state.ts';

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** The stored record when every field has its shape, else an empty one. */
export function repairMissionState(raw: unknown): MissionState {
  const empty = emptyMissionState();
  if (!isRecord(raw)) return empty;
  const arrays = ['live', 'leads', 'flags', 'passengers', 'journal'] as const;
  const records = ['done', 'standing', 'entities'] as const;
  if (!arrays.every((k) => Array.isArray(raw[k]))) return empty;
  if (!records.every((k) => isRecord(raw[k]))) return empty;
  const kept = structuredClone(raw) as unknown as MissionState;
  // Fields added after the first records were written: absent reads as none.
  if (typeof kept.idleDocks !== 'number') kept.idleDocks = 0;
  if (!Array.isArray(kept.changes)) kept.changes = [];
  return kept;
}
