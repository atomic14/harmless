// Recover: scoop a tagged canister adrift at the leg's world.
//
// The canister is the leg's entity, spawned by the game at the target and
// answered by its tag. A shot that breaks it is `targetDestroyed`, and the
// skeleton says what that costs.

import type { VerbModule } from './verb.ts';

export const recover: VerbModule = (ctx, input) => {
  if (ctx.leg.verb.kind !== 'recover') return null;
  if (!('tag' in input) || input.tag !== ctx.live.tag) return null;
  if (input.kind === 'scooped') return { trigger: 'success' };
  if (input.kind === 'destroyed') return { trigger: 'targetDestroyed' };
  return null;
};
