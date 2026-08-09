// The /viewer page's headless gate (docs/TODO/102).
//
// The viewer broke at import on 2026-08-05 — a module-scope call in its entry
// still asked for a trained brain after the trained line was retired, so the
// whole page threw before drawing anything — and nothing went red, because no
// test loaded the entry. The entry modules themselves cannot be imported under
// node: every live page's entry touches the DOM at module scope
// (viewer/main.ts and gallery-main.ts call createStage() for a WebGL canvas,
// src/main.ts builds a browser shell, manual.ts and encyclopaedia/main.ts
// write into the document). So the gate is this instead: everything in the
// viewer that can go stale against the game — the row table, and which pilot
// each row flies — lives in the DOM-free `viewer/scenarios.ts`, imported here,
// and every row is BUILT and FLOWN. A row asking for a pilot the game no
// longer has throws in `npm test`, not on the live page.
//
// What this cannot see is the thin DOM shell (canvas, HUD, keys); that is the
// flown browser check in docs/PROCESS.md. The other entries' decision content
// is already gated elsewhere: the play page's game runs headless under the
// portability gate, and the encyclopaedia's entries are rendered for all 256
// systems at build time by vite.config.ts.

import { readFileSync, readdirSync } from 'node:fs';
import { SCENARIOS, SHIPPED_PIRATE, scenarioById } from '../src/viewer/scenarios.ts';
import { FIXED_DT } from '../src/constants/world-clock.ts';
import { pirateBrainNameFor } from '../src/game/brain-names.ts';
import { check } from './harness.ts';

console.log('\nviewer scenarios (the /viewer rows, flown headless — docs/TODO/102)');

// Every row the picker offers builds a real Episode and survives being flown.
// Ten seconds each: long enough to reach the merge and the first shots, short
// enough that four rows stay inside the suite's budget.
for (const s of SCENARIOS) {
  let steps = 0;
  let threw = '';
  try {
    const ep = s.build(1);
    while (!ep.done && steps < 600) {
      ep.step(FIXED_DT);
      steps += 1;
    }
  } catch (e) {
    threw = (e as Error).message;
  }
  check(`row '${s.id}' builds and flies (${steps} steps)${threw ? ` — threw: ${threw}` : ''}`,
    threw === '' && steps > 0);
}

// The page shows what ships: the pirates' shipped pilot, asked of
// brain-names.ts by both sides, is on a row — not a name typed into a label.
check(`a row flies what ships (${pirateBrainNameFor(0, false)})`,
  SHIPPED_PIRATE === pirateBrainNameFor(0, false)
  && SCENARIOS.some((s) => s.flying.startsWith(SHIPPED_PIRATE)));

// The picker cannot dangle: an unknown id falls back to the first row.
check('an unknown scenario id falls back to the first row',
  scenarioById('no-such-row') === SCENARIOS[0]);

// No viewer module may load a policy from the weights bundle: the page died
// once by asking `game/brains.ts` for a brain that had been retired, so the
// whole directory is held away from the socket and the weights files. The
// random-policy control builds its network in memory (`randomBrain`), which
// is exactly the difference this pins.
{
  const dir = new URL('../src/viewer/', import.meta.url);
  const offenders = readdirSync(dir).filter((f) => f.endsWith('.ts')).filter((f) => {
    const src = readFileSync(new URL(f, dir), 'utf8');
    return src.includes("game/brains.ts'") || src.includes('brains/');
  });
  check(`no viewer module imports game/brains.ts or a weights file (${offenders.join(', ') || 'none do'})`,
    offenders.length === 0);
}
