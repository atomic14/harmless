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
// The words here are the plain fallback. A dossier (docs/TODO/191 M3)
// carries the patron's own, and replaces them where one exists. `lead` is
// the MISSIONS row. `rumour.far` is the board's rumour. `news` is the DATA
// ON line. `rumour.near` is the one-jump message. The second message stays
// plain.
// The dock message is resolved by the bridge, not here, so the machine that
// asks for it never reads a dossier (`DossierWord`, model.ts).

import { LEAD_NAG_DOCKS, LEAD_RUMOUR_JUMPS } from '../constants/missions.ts';
import type { StarSystem } from '../galaxy/galaxy.ts';
import { routeEstimate } from '../galaxy/route.ts';
import { dossierFor, hintSlots } from './dossiers.ts';
import type { CommanderFacts, Dossier, DossierWord, Lead, MissionState } from './model.ts';
import { fillSlots } from './text.ts';

type Dossiers = (id: string) => Dossier | null;

/** A dossier's hint line, filled and shouted, or null when it has none. */
function own(
  lead: Lead, pick: (d: Dossier) => string, c: CommanderFacts, systems: readonly StarSystem[],
  dossiers: Dossiers,
): string | null {
  const d = dossiers(lead.skeleton);
  const line = d ? pick(d) : '';
  return line ? fillSlots(line, hintSlots(lead.skeleton, lead.world, c, systems)).toUpperCase() : null;
}

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

/** The LEADS row on the MISSIONS screen: the dossier's `lead`, or the plain row, then the distance. */
export function leadLine(
  lead: Lead, c: CommanderFacts, systems: readonly StarSystem[], dossiers: Dossiers = dossierFor,
): string {
  const jumps = leadJumps(lead, c, systems);
  const far = jumps === null ? 'IN ANOTHER GALAXY'
    : jumps === 0 ? 'HERE' : `${jumps} JUMP${jumps === 1 ? '' : 'S'} AWAY`;
  const line = own(lead, (d) => d.lead, c, systems, dossiers)
    ?? `SOMEBODY AT ${worldOf(lead, systems)} WANTS A WORD`;
  return `${line} — ${far}`;
}

/** The bulletin board's rumour, when a lead is inside the rumour range. */
export function boardRumour(
  st: MissionState, c: CommanderFacts, systems: readonly StarSystem[], dossiers: Dossiers = dossierFor,
): string | null {
  const near = nearestLead(st, c, systems);
  if (!near || near.jumps > LEAD_RUMOUR_JUMPS || near.jumps === 0) return null;
  return own(near.lead, (d) => d.rumour.far, c, systems, dossiers)
    ?? `RUMOUR: A PATRON AT ${worldOf(near.lead, systems)} IS ASKING AFTER A PILOT LIKE YOU`;
}

/** The DATA ON page's line about `world`, when a lead there is inside range. */
export function worldNews(
  st: MissionState, c: CommanderFacts, systems: readonly StarSystem[], world: number,
  dossiers: Dossiers = dossierFor,
): string | null {
  const lead = st.leads.find((l) => l.world === world && l.galaxy === c.galaxy);
  if (!lead) return null;
  const jumps = leadJumps(lead, c, systems);
  if (jumps === null || jumps > LEAD_RUMOUR_JUMPS) return null;
  return own(lead, (d) => d.news, c, systems, dossiers)
    ?? 'A PATRON HERE IS LOOKING FOR A PILOT. ASK AT THE STATION.';
}

/**
 * The one line a dock may say about a lead, or null.
 *
 * `hailed` is whether this dock already made an offer. `idleDocks` counts the
 * docks since the journal last moved, this one included. The one-jump
 * message names the dossier word the bridge may replace it with.
 */
export function dockHint(
  st: MissionState, c: CommanderFacts, systems: readonly StarSystem[],
  hailed: boolean, idleDocks: number,
): { text: string; word?: DossierWord } | null {
  if (hailed) return null;
  const near = nearestLead(st, c, systems);
  if (!near) return null;
  const world = worldOf(near.lead, systems);
  if (near.jumps === 1) {
    return {
      text: `A MESSAGE FROM ${world}: COME WHEN YOU CAN. THERE IS WORK.`,
      word: { skeleton: near.lead.skeleton, kind: 'near', world: near.lead.world },
    };
  }
  if (idleDocks === LEAD_NAG_DOCKS) return { text: `A SECOND MESSAGE FROM ${world}: THE OFFER STANDS.` };
  return null;
}
