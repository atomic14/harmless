// What a verb module is: one function that reads an event for one leg.
//
// A module DECIDES and returns a trigger. The machine applies the branch that
// trigger selects. That is invariant 15's shape, one level down: the verb
// reports, and the machine resolves. A module never pays, never moves a leg,
// and never reads the commander's purse.

import type { CommanderFacts, Leg, LiveMission, MissionInput, Trigger } from '../model.ts';

export interface VerbContext {
  readonly live: LiveMission;
  readonly leg: Leg;
  readonly commander: CommanderFacts;
}

/**
 * What an input means for this leg. `trigger` names the branch to take.
 * `progress` records a step that takes no branch, such as an arrival.
 */
export interface VerbReaction {
  trigger?: Trigger;
  progress?: number;
  /** the scooped pod is this mission's passenger; the machine records it */
  passenger?: boolean;
  /**
   * What the console says about a step that takes no branch, with `{TARGET}`
   * for the leg's world (docs/TODO/203 M4). A branch speaks through its
   * settlement. A step that only moves progress said nothing before, so the
   * pilot aboard and the lane reached were silent.
   */
  say?: string;
}

export type VerbModule = (ctx: VerbContext, input: MissionInput) => VerbReaction | null;
