// Rescue: scoop a tagged capsule, and bring its passenger to a station.
//
// The scoop is progress, not success. The passenger rides in the crew spaces
// under the pod's own tag (`MissionState.passengers`). The leg ends when she
// answers for them at a dock. That answer is `landed` for medical or a
// release, and `sold` for the Slaves row. A branch on each says what the
// patron makes of it.
//
// A pod shot before the scoop is `targetDestroyed`. The scientist example in
// docs/TODO/190 turns that into a delivery leg at a lower fee.

import type { VerbModule } from './verb.ts';

export const rescue: VerbModule = (ctx, input) => {
  if (ctx.leg.verb.kind !== 'rescue') return null;
  if (!('tag' in input) || input.tag !== ctx.live.tag) return null;
  if (input.kind === 'scooped') return { progress: 1, passenger: true };
  if (input.kind === 'destroyed' && ctx.live.progress < 1) return { trigger: 'targetDestroyed' };
  if (input.kind === 'survivor') return { trigger: { survivor: input.fate } };
  return null;
};
