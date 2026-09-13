// A lead: the word that the next arc waits at a world.
//
// A mission that ends may leave one (model.ts `Outcome.lead`). This file
// saves it on the record, once, and asks the game to announce it. It came
// out of `machine.ts` for the size gate (docs/TODO/217 M1). What a dock says
// about a lead is `hints.ts`, and where it is offered is `offers.ts`.

import type { MissionContext } from './machine.ts';
import type { MissionEffect, MissionState } from './model.ts';
import { startWorld } from './lookups.ts';
import { SKELETONS, skeletonById } from './skeletons/index.ts';

/**
 * Save a lead, once. A lead to an arc the commander holds or finished is
 * dropped, as failure rule 3 asks. The effect tells the game to announce it.
 * The lead is in the arc's own galaxy where its gate names one. So an arc
 * that fails on a galactic jump leaves its lead behind, in the galaxy the
 * next arc is offered in (docs/TODO/213 M2).
 */
export function offerLead(
  st: MissionState, id: string, ctx: MissionContext, effects: MissionEffect[],
): void {
  const target = skeletonById(id, ctx.skeletons ?? SKELETONS);
  if (!target) return;
  if (id in st.done || st.live.some((l) => l.skeleton === id)) return;
  if (st.leads.some((l) => l.skeleton === id)) return;
  const c = ctx.commander;
  const world = startWorld(target, c);
  const galaxy = target.offer.galaxy ?? c.galaxy;
  st.leads.push({ skeleton: id, galaxy, world, sinceDay: c.day });
  effects.push({ kind: 'lead', skeleton: id, galaxy, world });
}
