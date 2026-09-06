// Hunt: find a named ship and destroy it.
//
// The leg's `tag` is the ship's. A `destroyed` input with another tag is some
// other ship, and it means nothing here. That one comparison is what stops a
// second hunt from claiming the first hunt's kill.

import type { VerbModule } from './verb.ts';

export const hunt: VerbModule = (ctx, input) => {
  const verb = ctx.leg.verb;
  if (verb.kind !== 'hunt') return null;
  if (!('tag' in input) || input.tag !== ctx.live.tag) return null;
  if (input.kind === 'destroyed') return { trigger: 'targetDestroyed' };
  if (input.kind === 'escaped' && verb.canEscape) return { trigger: 'targetEscaped' };
  if (input.kind === 'fled') return { trigger: 'targetFled' };
  return null;
};
