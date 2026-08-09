// The combat viewer's rows: every fight the page offers, and nothing else.
//
// **Every row flies a code pilot the game ships, or a stated control.** That
// is the rule this table exists to keep, and it has been broken three times —
// twice by a label and its weights coming from different places, and once,
// fatally, by a row still asking for a trained brain after the trained line
// was retired (2026-08-05): `defenceBrain()` went null, a module-scope
// `shipped()` call threw, and the whole page died at import with nothing going
// red, because no test loaded the viewer entry (docs/TODO/102).
//
// So the rows live HERE, DOM-free, and `test/viewer-scenarios.test.ts` imports
// this module headless, builds every row and flies it — a row that asks for a
// pilot the game no longer has throws in `npm test`, not on the live page.
// The pilots are asked for BY NAME through `game/brain-names.ts` (which
// imports no weights), so a change to what ships moves this page with it;
// nothing here may import `game/brains.ts` or a weights file, and the same
// test holds that. `main.ts` is the thin DOM shell over this table: canvas,
// HUD and keys, nothing that can go stale against the game.

import { Episode, type Controller } from '../ai-training/scenario.ts';
import { randomBrain } from '../ai-training/policy.ts';
import { makeRng } from '../game/rng.ts';
import {
  defenceBrainNameFor, pirateBrainNameFor, type BrainName,
} from '../game/brain-names.ts';

/**
 * What the shipped opposition is CALLED — `pursuit` today, and asked for
 * rather than typed out, so the rows below follow `SHIPPED_BRAINS` if the
 * default ever moves. Tier 0, unorganised: the answer does not depend on
 * either today, and a page is not the place to enumerate tiers.
 */
export const SHIPPED_PIRATE: BrainName = pirateBrainNameFor(0, false);

/** ...and the defence's one name, for the HUD's SHIPPED line. */
export const SHIPPED_DEFENCE: BrainName = defenceBrainNameFor();

/**
 * The episode controller a named code pilot flies under — pirates only. The
 * defence name (`attack-run`) is deliberately absent: its two flights live
 * behind `NpcShip.update`'s defence path and `scripted-co-pilot.ts`, which an
 * episode's PlayerShip target cannot drive; asking for it here should throw
 * in the gate rather than quietly fly something else.
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
  /** what is flying, for the label and the HUD: a pilot's name, or a stated control */
  flying: string;
  build(seed: number): Episode;
}

/**
 * Every fight the page offers. Two rows fly the shipped opposition and two are
 * controls that say so — the pre-pursuit scripted attack run (the game's A/B
 * control), and an untrained random policy, the two baselines every figure in
 * docs/TRAINING-LOG.md is measured against. The defence's flights cannot be
 * staged here (see `pirateController`), but they are not unwatchable: the
 * armed trader's half IS the attack run the `scripted` rows fly, and the
 * co-pilot's half IS the pursuit the shipped rows fly, turned on your side.
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
