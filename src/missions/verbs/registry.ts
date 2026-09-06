// The verb table: one module per verb kind.
//
// A verb the table does not hold is a verb no leg can use, and
// `test/mission-skeletons.test.ts` fails on a skeleton that names one. The
// five verbs still absent arrive with docs/TODO/190 M4.

import type { Verb } from '../model.ts';
import { ambush } from './ambush.ts';
import { deliver } from './deliver.ts';
import { hunt } from './hunt.ts';
import type { VerbModule } from './verb.ts';

const VERBS: Partial<Record<Verb['kind'], VerbModule>> = { hunt, deliver, ambush };

/** The module for a verb, or null when none is written yet. */
export function verbModule(kind: Verb['kind']): VerbModule | null {
  return VERBS[kind] ?? null;
}

/** Whether a hunt, an escort or a scan names a ship that needs a tag. */
export function verbNeedsShip(verb: Verb): verb is Extract<Verb, { ship: string }> {
  return 'ship' in verb;
}
