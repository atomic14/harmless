// What a trigger is called, how two compare, and which one means success.
//
// A TRIGGER is the name a verb module gives an event: `success`, `failed`,
// `targetDestroyed`, or an object form such as `{ survivor: 'landed' }`. Three
// readers agree through this file. The machine (machine.ts) finds the branch
// a trigger selects. The journal records the label, and a dossier's story
// lines are filed under it (tools/dossier-prompts.ts). The bridge asks which
// dossier line a branch may speak with (docs/TODO/191 M3).

import type { Branch, Leg, Trigger, Verb } from './model.ts';

export function sameTrigger(a: Trigger, b: Trigger): boolean {
  if (typeof a === 'string' || typeof b === 'string') return a === b;
  return JSON.stringify(a) === JSON.stringify(b);
}

/** `targetDestroyed`, or `flag:plans` for the object forms: the journal's word. */
export function triggerLabel(t: Trigger): string {
  if (typeof t === 'string') return t;
  const [k, v] = Object.entries(t)[0];
  return `${k}:${v}`;
}

/** The trigger that means a leg went right: a hunt's kill, and every other verb's `success`. */
export function successTrigger(verb: Verb): Trigger {
  return verb.kind === 'hunt' ? 'targetDestroyed' : 'success';
}

/**
 * Which dossier line a branch may speak with, or null for a branch that is
 * neither. The rescue's lost pod goes on to a delivery leg, and only the
 * skeleton's own word fits that.
 */
export function wordKind(leg: Leg, branch: Branch): 'success' | 'fail' | null {
  if (branch.to === 'fail') return 'fail';
  if (branch.to === 'complete' || sameTrigger(branch.on, successTrigger(leg.verb))) return 'success';
  return null;
}
