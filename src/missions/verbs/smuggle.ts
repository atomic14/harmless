// Smuggle: carry the patron's goods to the leg's world, past the police.
//
// The goods go aboard when the leg starts (the machine's `cargo` effect). A
// dock at the target with the tonnes still aboard succeeds, and the goods
// leave the hold (the `unload` effect, docs/TODO/213 M2). They stayed aboard
// before that, so a run paid its fee and left the narcotics to sell. A dock
// there with fewer is `failed`: the goods were sold. A police scan on the
// way is `failed` too, because the hold was read.

import type { VerbModule } from './verb.ts';

export const smuggle: VerbModule = (ctx, input) => {
  const verb = ctx.leg.verb;
  if (verb.kind !== 'smuggle') return null;
  if (input.kind === 'policeScan') return { trigger: 'failed' };
  if (input.kind !== 'docked') return null;
  const t = ctx.live.target;
  if (t !== null && t !== ctx.commander.systemIndex) return null;
  const aboard = ctx.commander.cargo[verb.commodity] ?? 0;
  return aboard >= verb.tonnes ? { trigger: 'success', unload: true } : { trigger: 'failed' };
};
