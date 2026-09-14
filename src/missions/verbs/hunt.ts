// Hunt: find a named ship and destroy it.
//
// The leg's `tag` is the ship's. A `destroyed` input with another tag is some
// other ship, and it means nothing here. That one comparison is what stops a
// second hunt from claiming the first hunt's kill.
//
// A HUNTED SHIP CAN DIE WITHOUT THE COMMANDER (docs/TODO/208 M3). A pirate
// takes it, or it flies into a rock. The world sends `escortLost` for a
// tagged ship wrecked with credit to nobody, and the hunt ignored it until
// now. The leg then stayed live with no ship left in the galaxy to kill. The
// ship is gone either way, so the hunt takes it as destroyed. A branch that
// paid less for another's kill would be a third outcome, and no skeleton
// has one.
//
// A SHIP THAT CANNOT ESCAPE CANNOT RUN OUT EITHER (docs/TODO/213 M5). The
// Constrictor is always where the Navy says. `fled` reached this module
// for any hunt. So the lint's table of what a hunt can emit needed the
// Constrictor to ignore a word it can never hear.
//
// A GANG IS COUNTED (docs/TODO/217 M1). A hunt whose verb names a gang ends
// when every ship is gone, and `progress` counts them. A member's tag is
// the leader's with `#gang-N` on the end (machine.ts). A member fights to
// the end, so only a kill takes one off. The leader may run, and the record
// says so once it did. So the last ship gone decides the trigger by the
// leader's fate: killed pays the gang, and a leader that ran pays half.

import type { VerbContext, VerbModule, VerbReaction } from './verb.ts';
import type { MissionInput } from '../model.ts';

export const hunt: VerbModule = (ctx, input) => {
  const verb = ctx.leg.verb;
  if (verb.kind !== 'hunt') return null;
  if (!('tag' in input)) return null;
  if (verb.gang !== undefined && verb.gang.length > 0) return gangHunt(ctx, input, verb.gang.length, verb.canEscape);
  if (input.tag !== ctx.live.tag) return null;
  if (input.kind === 'destroyed' || input.kind === 'escortLost') {
    return { trigger: 'targetDestroyed' };
  }
  if (!verb.canEscape) return null;
  if (input.kind === 'escaped') return { trigger: 'targetEscaped' };
  if (input.kind === 'fled') return { trigger: 'targetFled' };
  return null;
};

/** One ship of the gang gone, and what that makes of the leg. */
function gangHunt(
  ctx: VerbContext, input: Extract<MissionInput, { tag: string }>, members: number, canEscape: boolean,
): VerbReaction | null {
  const leader = ctx.live.tag;
  if (leader === null) return null;
  const isLeader = input.tag === leader;
  const isMember = input.tag.startsWith(`${leader}#gang-`);
  if (!isLeader && !isMember) return null;
  const killed = input.kind === 'destroyed' || input.kind === 'escortLost';
  const left = input.kind === 'fled' || input.kind === 'escaped';
  if (!killed && !left) return null;
  // A member fights to the end. A leader that cannot escape cannot leave.
  if (left && (isMember || !canEscape)) return null;
  const gone = ctx.live.progress + 1;
  const remaining = members + 1 - gone;
  // The leader's fate: it left now, or the record says it did.
  const leaderRan = isLeader ? left : ctx.entities[leader]?.fled === true;
  if (remaining > 0) {
    const say = isLeader
      ? `THE LEADER ${left ? 'RAN FOR IT' : 'IS DOWN'}. ${remaining} OF THE GANG LEFT.`
      : `ONE OF THE GANG IS DOWN. ${remaining} LEFT.`;
    return { progress: gone, say };
  }
  if (!leaderRan) return { progress: gone, trigger: 'targetDestroyed' };
  return { progress: gone, trigger: input.kind === 'escaped' && isLeader ? 'targetEscaped' : 'targetFled' };
}
