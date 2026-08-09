// The probes' retired `evades` row (docs/TODO/102).
//
// `train/ram-probe.ts`'s evades row flew the shipped defence policy until the
// trained line was retired on 2026-08-05; after that it tried to load a
// weights file named after a CODE pilot (`attack-run.json`, a file that never
// existed) and crashed the whole table. The row is a research hook now:
// `DEFEND_BRAIN` names a candidate, and with nothing named the row is absent
// and the table says why. These checks pin both sides of that hook without
// flying an episode; `train/gap-probe.ts` reads the same `evadesAvailable`,
// so one rule covers both tables.
//
// NOT named `ram-probe.test.ts`: the probe's own main-module check is
// `argv[1].endsWith('ram-probe.ts')`, which a test file of that name run
// directly would satisfy — and the 40-episode table would fly inside the test.

import { EVADES_RETIRED, evadesAvailable, pilotFor } from '../train/ram-probe.ts';
import { check } from './harness.ts';

console.log('\nprobe rows (the evades row is retired honestly — docs/TODO/102)');

const saved = process.env.DEFEND_BRAIN;
delete process.env.DEFEND_BRAIN;
try {
  check('holds and weaves fly without a candidate',
    pilotFor('holds').kind === 'holding' && pilotFor('weaves').kind === 'weaving');
  check('with nothing named there is no evades pilot', !evadesAvailable());

  let asked = '';
  try {
    pilotFor('evades');
  } catch (e) {
    asked = (e as Error).message;
  }
  check('asking for evades by name states the retirement, not a missing file',
    asked.includes(EVADES_RETIRED));

  // The hook reaches the loader: naming a candidate attempts exactly that file.
  process.env.DEFEND_BRAIN = 'no-such-candidate';
  let named = '';
  try {
    pilotFor('evades');
  } catch (e) {
    named = (e as Error).message;
  }
  check('naming a candidate loads that candidate\'s own file',
    evadesAvailable() && named.includes('no-such-candidate.json'));
} finally {
  if (saved === undefined) delete process.env.DEFEND_BRAIN;
  else process.env.DEFEND_BRAIN = saved;
}
