// How a far commander hears about a lead: by distance, and one line at a time.
//
// A LEAD is a saved pointer to the next arc's start world. The MISSIONS screen
// lists it and the chart marks it at any distance (orders.ts). This file is
// the rest of the ladder Chris set on 2026-09-06 (docs/TODO/190):
//
//   - inside `LEAD_RUMOUR_JUMPS`, a rumour on the bulletin board and a line
//     on the DATA ON page;
//   - inside one jump, a message from the patron when she docks;
//   - at the world, the offer itself, which `offers.ts` makes.
//
// NO MORE THAN ONE HINT PER DOCKING. A dock that makes an offer says nothing
// else. After `LEAD_NAG_DOCKS` docks with no mission progress the patron
// writes one more time, and then waits.
//
// The words here are the plain fallback. A dossier (docs/TODO/190, item 191)
// carries the patron's own, and replaces them on screen when it exists.

import { LEAD_NAG_DOCKS, LEAD_RUMOUR_JUMPS } from '../constants/missions.ts';
import type { StarSystem } from '../galaxy/galaxy.ts';
import { routeEstimate } from '../galaxy/route.ts';
import type { CommanderFacts, Lead, MissionState } from './model.ts';

/** Jumps from `here` to the lead's world on the full-tank graph, or null. */
export function leadJumps(
  lead: Lead, c: CommanderFacts, systems: readonly StarSystem[],
): number | null {
  if (lead.galaxy !== c.galaxy) return null;
  if (lead.world === c.systemIndex) return 0;
  return routeEstimate(systems, systems[c.systemIndex], systems[lead.world])?.jumps ?? null;
}

/** The nearest lead in this galaxy, with its distance, or null. */
export function nearestLead(
  st: MissionState, c: CommanderFacts, systems: readonly StarSystem[],
): { lead: Lead; jumps: number } | null {
  let best: { lead: Lead; jumps: number } | null = null;
  for (const lead of st.leads) {
    const jumps = leadJumps(lead, c, systems);
    if (jumps === null) continue;
    if (!best || jumps < best.jumps) best = { lead, jumps };
  }
  return best;
}

const worldOf = (lead: Lead, systems: readonly StarSystem[]): string =>
  systems[lead.world].name.toUpperCase();

/** The LEADS row on the MISSIONS screen. */
export function leadLine(lead: Lead, c: CommanderFacts, systems: readonly StarSystem[]): string {
  const jumps = leadJumps(lead, c, systems);
  const far = jumps === null ? 'IN ANOTHER GALAXY'
    : jumps === 0 ? 'HERE' : `${jumps} JUMP${jumps === 1 ? '' : 'S'} AWAY`;
  return `SOMEBODY AT ${worldOf(lead, systems)} WANTS A WORD — ${far}`;
}

/** The bulletin board's rumour, when a lead is inside the rumour range. */
export function boardRumour(
  st: MissionState, c: CommanderFacts, systems: readonly StarSystem[],
): string | null {
  const near = nearestLead(st, c, systems);
  if (!near || near.jumps > LEAD_RUMOUR_JUMPS || near.jumps === 0) return null;
  return `RUMOUR: A PATRON AT ${worldOf(near.lead, systems)} IS ASKING AFTER A PILOT LIKE YOU`;
}

/** The DATA ON page's line about `world`, when a lead there is inside range. */
export function worldNews(
  st: MissionState, c: CommanderFacts, systems: readonly StarSystem[], world: number,
): string | null {
  const lead = st.leads.find((l) => l.world === world && l.galaxy === c.galaxy);
  if (!lead) return null;
  const jumps = leadJumps(lead, c, systems);
  if (jumps === null || jumps > LEAD_RUMOUR_JUMPS) return null;
  return `A PATRON HERE IS LOOKING FOR A PILOT. ASK AT THE STATION.`;
}

/**
 * The one line a dock may say about a lead, or null.
 *
 * `hailed` is whether this dock already made an offer. `idleDocks` counts the
 * docks since the journal last moved, this one included.
 */
export function dockHint(
  st: MissionState, c: CommanderFacts, systems: readonly StarSystem[],
  hailed: boolean, idleDocks: number,
): string | null {
  if (hailed) return null;
  const near = nearestLead(st, c, systems);
  if (!near) return null;
  const world = worldOf(near.lead, systems);
  if (near.jumps === 1) return `A MESSAGE FROM ${world}: COME WHEN YOU CAN. THERE IS WORK.`;
  if (idleDocks === LEAD_NAG_DOCKS) return `A SECOND MESSAGE FROM ${world}: THE OFFER STANDS.`;
  return null;
}
