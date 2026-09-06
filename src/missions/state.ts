// An empty mission record, for a new commander and for a save that has none.
//
// ONE constructor, so the two loaders (`snapshot-parse.ts` and `storage.ts`)
// and `newCommander()` cannot disagree about what "no missions" looks like. A
// loader that meets the old `mission` field installs this in its place
// (docs/TODO/190).

import type { MissionState } from './model.ts';

export function emptyMissionState(): MissionState {
  return {
    live: [],
    leads: [],
    done: {},
    flags: [],
    standing: {},
    entities: {},
    passengers: [],
    journal: [],
    idleDocks: 0,
  };
}
