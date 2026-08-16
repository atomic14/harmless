// The combat viewer's rows: every fight the page offers, and nothing else.
//
// **Every row flies a code pilot the game ships, or a stated control.** That
// is the rule this table exists to keep, and three edits broke it. Twice a
// label and its weights came from different places.
//
// The third was fatal. A row still asked for a trained brain after the trained
// line was retired (2026-08-05). `defenceBrain()` went null. A module-scope
// `shipped()` call threw. The whole page died at import, and nothing went red,
// because no test loaded the viewer entry (docs/TODO/102).
//
// So the rows live HERE, DOM-free. `test/viewer-scenarios.test.ts` imports this
// module headless, builds every row and flies it. A row that asks for a pilot
// the game no longer has throws in `npm test`, and not on the live page.
//
// The pilots are asked for BY NAME, through `game/brain-names.ts`, which
// imports no weights. So a change to what ships moves this page with it.
// Nothing here may import `game/brains.ts` or a weights file, and the same test
// holds that.
//
// `main.ts` is the thin DOM shell over this table: canvas, HUD and keys, and
// nothing that can go stale against the game.

import { Episode, type Controller } from '../ai-training/scenario.ts';
import { randomBrain } from '../ai-training/policy.ts';
import { makeRng } from '../game/rng.ts';
import {
  defenceBrainNameFor, pirateBrainNameFor, type BrainName,
} from '../game/brain-names.ts';

/**
 * What the shipped opposition is CALLED. It is `pursuit` today. It is asked for
 * rather than typed out, so the rows below follow `SHIPPED_BRAINS` if the
 * default ever moves.
 *
 * Tier 0, unorganised. The answer depends on neither today, and a page is not
 * the place to enumerate the tiers.
 */
export const SHIPPED_PIRATE: BrainName = pirateBrainNameFor(0, false);

/** ...and the defence's one name, for the HUD's SHIPPED line. */
export const SHIPPED_DEFENCE: BrainName = defenceBrainNameFor();

/**
 * The episode controller a named code pilot flies under — pirates only.
 *
 * The defence name (`attack-run`) is deliberately absent. Its two flights live
 * behind `NpcShip.update`'s defence path and `scripted-co-pilot.ts`. An
 * episode's PlayerShip target cannot drive either. A request for it here should
 * throw in the gate, rather than quietly fly something else.
 */
function pirateController(name: BrainName): Controller {
  if (name === 'pursuit') return { kind: 'pursuit' };
  if (name === 'scripted') return { kind: 'scripted' };
  throw new Error(`viewer: no episode controller flies '${name}' as a pirate`);
}

export interface ViewerScenario {
  id: string;
  /** the picker row */
  label: string;
  /** which pilot flies, for the label and the HUD: a name, or a stated control */
  flying: string;
  build(seed: number): Episode;
}

/**
 * Every fight the page offers.
 *
 * Two rows fly the shipped opposition. Two more are controls, and they say so:
 * the pre-pursuit scripted attack run, which is the game's A/B control, and an
 * untrained random policy. Those two are the baselines every figure in
 * docs/TRAINING-LOG.md is measured against.
 *
 * The defence's flights cannot be staged here (see `pirateController`). They
 * are still watchable. The armed trader's half IS the attack run the `scripted`
 * rows fly. The co-pilot's half IS the pursuit the shipped rows fly, turned on
 * your side.
 */
export const SCENARIOS: readonly ViewerScenario[] = [
  {
    id: 'shipped-vs-trader',
    label: 'Shipped pirate vs trader',
    flying: `${SHIPPED_PIRATE} — what every pirate flies`,
    build: (seed) => new Episode({
      seed, pirates: [pirateController(SHIPPED_PIRATE)], trader: { kind: 'scripted' },
    }),
  },
  {
    id: 'shipped-gang-vs-armed',
    label: 'Shipped gang of 3 vs armed trader',
    flying: `${SHIPPED_PIRATE} — what an organised gang flies`,
    build: (seed) => new Episode({
      seed,
      pirates: [
        pirateController(SHIPPED_PIRATE),
        pirateController(SHIPPED_PIRATE),
        pirateController(SHIPPED_PIRATE),
      ],
      trader: { kind: 'scripted' }, traderArmed: true, maxTime: 60,
    }),
  },
  {
    id: 'scripted-vs-trader',
    label: 'Scripted pirate vs trader',
    flying: 'the scripted attack run — the A/B control',
    build: (seed) => new Episode({
      seed, pirates: [{ kind: 'scripted' }], trader: { kind: 'scripted' },
    }),
  },
  {
    id: 'random-vs-trader',
    label: 'Random policy vs trader',
    flying: 'an untrained network — a control',
    build: (seed) => new Episode({
      seed,
      pirates: [{ kind: 'policy', brain: randomBrain(makeRng(seed ^ 0xbeef)) }],
      trader: { kind: 'scripted' },
    }),
  },
];

export const scenarioById = (id: string): ViewerScenario =>
  SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];
