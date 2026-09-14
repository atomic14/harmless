// Deliver: dock at the leg's world. A null target means any station.
//
// The Constrictor's report leg and its courier leg are both this verb. The
// first has no target, and the second has one. The verb carries a `cargo`
// field for a delivery that checks the hold. No shipped leg sets it, and
// this module reads none (docs/TODO/213 M5).

import type { VerbModule } from './verb.ts';

export const deliver: VerbModule = (ctx, input) => {
  if (ctx.leg.verb.kind !== 'deliver') return null;
  if (input.kind !== 'docked') return null;
  const t = ctx.live.target;
  if (t !== null && t !== ctx.commander.systemIndex) return null;
  return { trigger: 'success' };
};
