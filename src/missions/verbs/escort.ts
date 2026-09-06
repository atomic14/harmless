// Escort: bring a tagged ship into station range with no enemy near it.
//
// The game decides when that holds and sends `escortSafe` (world-step.ts,
// under the rules docs/TODO/190 states). This leg only reads the verdict. A
// ship lost on the way, to anyone, is `targetDestroyed`. One that jumps out
// is `targetEscaped`.

import type { VerbModule } from './verb.ts';

export const escort: VerbModule = (ctx, input) => {
  if (ctx.leg.verb.kind !== 'escort') return null;
  if (!('tag' in input) || input.tag !== ctx.live.tag) return null;
  if (input.kind === 'escortSafe') return { trigger: 'success' };
  if (input.kind === 'escortLost' || input.kind === 'destroyed') return { trigger: 'targetDestroyed' };
  if (input.kind === 'escaped') return { trigger: 'targetEscaped' };
  return null;
};
