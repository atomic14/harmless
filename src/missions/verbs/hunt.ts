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

import type { VerbModule } from './verb.ts';

export const hunt: VerbModule = (ctx, input) => {
  const verb = ctx.leg.verb;
  if (verb.kind !== 'hunt') return null;
  if (!('tag' in input) || input.tag !== ctx.live.tag) return null;
  if (input.kind === 'destroyed' || input.kind === 'escortLost') {
    return { trigger: 'targetDestroyed' };
  }
  if (input.kind === 'escaped' && verb.canEscape) return { trigger: 'targetEscaped' };
  if (input.kind === 'fled') return { trigger: 'targetFled' };
  return null;
};
