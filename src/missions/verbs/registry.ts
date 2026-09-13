// The verb table: one module per verb kind.
//
// A verb the table does not hold is a verb no leg can use, and
// `test/mission-skeletons.test.ts` fails on a skeleton that names one. All
// eight are here since docs/TODO/190 M4. The table stays partial in type, so
// a ninth verb added to the model is a lint failure until its module lands.
//
// `verbTriggers` says what each module can emit, and the lint holds every
// leg to it. A trigger a verb can emit has a branch, or the leg lists it
// under `ignores` (docs/TODO/213 M5). Three arcs carried a branch the world
// could not reach, and one side job dropped a trigger on the floor, and no
// gate saw either.

import type { TaggedShip, Trigger, Verb } from '../model.ts';
import { ambush } from './ambush.ts';
import { deliver } from './deliver.ts';
import { escort } from './escort.ts';
import { hunt } from './hunt.ts';
import { recover } from './recover.ts';
import { rescue } from './rescue.ts';
import { scan } from './scan.ts';
import { smuggle } from './smuggle.ts';
import type { VerbModule } from './verb.ts';

const VERBS: Partial<Record<Verb['kind'], VerbModule>> = {
  hunt, deliver, ambush, recover, rescue, smuggle, escort, scan,
};

/** The module for a verb, or null when none is written yet. */
export function verbModule(kind: Verb['kind']): VerbModule | null {
  return VERBS[kind] ?? null;
}

/** Whether a hunt, an escort or a scan names a ship that needs a tag. */
export function verbNeedsShip(verb: Verb): verb is Extract<Verb, { ship: string }> {
  return 'ship' in verb;
}

/** The role a tagged ship flies with: a hunt's target is a pirate, the rest are traders. */
export function verbJob(verb: Extract<Verb, { ship: string }>): 'hunt' | 'escort' | 'scan' {
  return verb.kind === 'hunt' ? 'hunt' : verb.kind === 'escort' ? 'escort' : 'scan';
}

/**
 * The roster role a job's ship is spawned and restored under. The spawn and
 * the restore each mapped it alone until docs/TODO/213 M4, and the restore
 * read every tagged ship as a pirate.
 */
export function jobRole(job: TaggedShip['job']): 'pirate' | 'trader' | 'police' {
  if (job === 'police') return 'police';
  return job === 'hunt' ? 'pirate' : 'trader';
}

/**
 * Every trigger a verb's module can emit for a leg with this verb. The
 * machine adds `failed` and `deadlinePassed` of its own, and failure rule 1
 * already holds the `failed` branch.
 */
export function verbTriggers(verb: Verb): Trigger[] {
  switch (verb.kind) {
    case 'hunt': return verb.canEscape
      ? ['targetDestroyed', 'targetEscaped', 'targetFled'] : ['targetDestroyed'];
    case 'deliver': case 'ambush': return ['success'];
    case 'recover': return ['success', 'targetDestroyed'];
    case 'rescue': return [{ survivor: 'landed' }, { survivor: 'sold' }, 'targetDestroyed'];
    case 'smuggle': return ['success', 'failed'];
    case 'escort': case 'scan': return ['success', 'targetDestroyed', 'targetEscaped'];
  }
}

/** The item a recover or a rescue leg puts adrift, or null. */
export function verbItem(verb: Verb): 'cargo' | 'capsule' | null {
  return verb.kind === 'recover' ? 'cargo' : verb.kind === 'rescue' ? 'capsule' : null;
}
