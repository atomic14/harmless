// Scan: hold a tagged ship under the scanner lock for the leg's seconds.
//
// The game counts the seconds (world-step.ts) and sends `scanned` once they
// are up. A target destroyed before then is `targetDestroyed`, and a patron
// who wanted it watched, not killed, says what that costs. A subject wrecked
// with credit to nobody is destroyed all the same. One that ran from a hit
// escaped, as much as one that jumped out (docs/TODO/213 M1).

import type { VerbModule } from './verb.ts';

export const scan: VerbModule = (ctx, input) => {
  if (ctx.leg.verb.kind !== 'scan') return null;
  if (!('tag' in input) || input.tag !== ctx.live.tag) return null;
  if (input.kind === 'scanned') return { trigger: 'success', sprung: true };
  if (input.kind === 'destroyed' || input.kind === 'escortLost') return { trigger: 'targetDestroyed' };
  if (input.kind === 'escaped' || input.kind === 'fled') return { trigger: 'targetEscaped' };
  return null;
};
