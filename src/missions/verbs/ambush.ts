// Ambush: reach the leg's world, meet what waits there, and dock alive.
//
// `progress` is 1 once the player arrives at the world. The leg succeeds on
// the next dock after that. A dock before the arrival is somewhere else, and
// it does not count. The ships that wait there come from the leg's override
// and its standing spawns, which the game reads through `queries.ts`.

import type { VerbModule } from './verb.ts';

export const ambush: VerbModule = (ctx, input) => {
  if (ctx.leg.verb.kind !== 'ambush') return null;
  const here = ctx.commander.systemIndex;
  const atTarget = ctx.live.target === null || ctx.live.target === here;
  if (input.kind === 'arrived' && atTarget) return { progress: 1 };
  if (input.kind === 'docked' && ctx.live.progress >= 1) return { trigger: 'success' };
  return null;
};
