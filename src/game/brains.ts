// The trained brains, loaded — and today there are NONE. All pilots are code
// (the attack run, the pursuit dogfighter, the scripted AI), so no weights ship.
//
// THE FILE STAYS, EMPTY, AS THE SOCKET. A future candidate re-enters the game
// by being imported here, named in brain-names.ts, and profiled in BRAINS —
// one row, both pickers. `npm test` holds the weights directory to exactly
// what this file imports (nothing, today), so an experiment cannot drift into
// the bundle and a shipped brain cannot go missing unnoticed.
//
// Loading stays defensive when there is something to load: a brain whose
// shape does not match the policy code must become null and a fallback, never
// a crash.

import {
  act, makeScratch, brainFromFile, type Brain,
} from '../ai-training/policy.ts';
import {
  observe, observePack, observeDefend, observeFor,
} from '../ai-training/observation.ts';
import { energyLeft, poolsLeft } from './systems.ts';
import {
  SHIPPED_BRAINS, type BrainName, type BrainSelection,
} from './brain-names.ts';

/**
 * Every policy, by name. All are CODE pilots — the attack run, the pursuit
 * dogfighter, and the scripted AI — so nothing here has weights behind it.
 */
const LOADED: Record<BrainName, Brain | null> = {
  'attack-run': null,
  pursuit: null,
  scripted: null,
};

/** The weights behind a name, or null if the game cannot fly it. */
export function brainByName(name: BrainName): Brain | null {
  return LOADED[name];
}

/**
 * Pure value behind the optional console handle used by training harnesses.
 * The platform decides whether and where to publish it.
 */
export function policyKit(): Record<string, unknown> {
  return {
    act, observe, observePack, makeScratch, brainFromFile,
    // `observeFor` is what a harness should actually call: it picks the encoder
    // off the brain\'s own input count, so a console script cannot feed the
    // wrong width to a policy — which is silent, and reads as "the defender has
    // no ship left" (docs/TODO/71). `poolsLeft` and `energyLeft` are here for
    // the same reason: those slots must be filled from systems.ts\'s
    // expressions, not a harness\'s arithmetic.
    observeDefend, observeFor, poolsLeft, energyLeft,
    // no shipped defence weights — load a candidate file with `brainFromFile`
    defendBrain: null,
  };
}

/**
 * The trained defence policy an armed trader or the combat computer would fly —
 * null, since no trained line ships. The SOCKET stays because npc.ts\'s defence
 * path and game.ts\'s combat computer still ask, and a future candidate answers
 * by being imported above; which CODE pilot replaces a null answer is the
 * caller\'s question, asked of `defenceBrainNameFor`.
 */
export function defenceBrain(sel: BrainSelection = SHIPPED_BRAINS): Brain | null {
  void sel;
  return null;
}
