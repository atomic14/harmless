// Scan: hold a tagged ship under the scanner lock for the leg's seconds.
//
// The game counts the seconds (world-step.ts) and sends `scanned` once they
// are up. A target destroyed before then is `targetDestroyed`, and a patron
// who wanted it watched, not killed, says what that costs.

import type { VerbModule } from './verb.ts';

export const scan: VerbModule = (ctx, input) => {
  if (ctx.leg.verb.kind !== 'scan') return null;
  if (!('tag' in input) || input.tag !== ctx.live.tag) return null;
  if (input.kind === 'scanned') return { trigger: 'success' };
  if (input.kind === 'destroyed') return { trigger: 'targetDestroyed' };
  if (input.kind === 'escaped') return { trigger: 'targetEscaped' };
  return null;
};
