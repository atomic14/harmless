// What a station offers: which skeletons the commander can accept where she
// stands, and why the rest are shut.
//
// A gate is the skeleton's own conditions. A LEAD opens the offer regardless
// of the gate, at the lead's world (docs/TODO/190, failure rule 3). Neither
// opens a slot: `MISSION_LIVE_CAP` holds, and a lead waits for one. A side
// job with a `cap` comes back after `MISSION_REOFFER_DAYS`, and an arc she
// holds or finished never comes back (failure rule 5).
//
// It is read by the machine on `accept` and on `docked`, by the desk that
// lists the MISSIONS screen, and by the tests. It changes nothing.

import { MISSION_LIVE_CAP, MISSION_REOFFER_DAYS } from '../constants/missions.ts';
import type { StarSystem } from '../galaxy/galaxy.ts';
import { routeEstimate } from '../galaxy/route.ts';
import { ratingRung } from '../game/rating.ts';
import type { CommanderFacts, Gate, MissionState, Skeleton } from './model.ts';
import { SKELETONS, skeletonById } from './skeletons/index.ts';

/** What an offer decision reads: the facts, and the skeletons in force. */
export interface OfferContext {
  commander: CommanderFacts;
  skeletons?: readonly Skeleton[];
  /** the galaxy, for a local patron's roster; absent means every job everywhere */
  systems?: readonly StarSystem[];
}

/**
 * Whether a local patron's job is on this world's board.
 *
 * Every world offers about a third of the side jobs, picked off the world's
 * chart position and the job's id. So the same world offers the same jobs
 * on every visit. It is a placeholder for the patrons the pipeline plan
 * (item 191 of docs/TODO/190) derives from the 1984 seed.
 */
function localJobHere(s: Skeleton, c: CommanderFacts, systems: readonly StarSystem[] | undefined): boolean {
  if (s.patron.kind !== 'local' || !systems) return true;
  const w = systems[c.systemIndex];
  let hash = 0;
  for (const ch of s.id) hash = (hash * 31 + ch.charCodeAt(0)) % 997;
  return (w.x + w.y * 3 + hash) % 3 === 0;
}

/**
 * A world patron waits at home, so her arc is offered there (docs/TODO/192
 * M2), and inside `withinJumps` of there when the gate says so (M3). The
 * jumps are the full-tank graph's. Without the galaxy, home is the only
 * place.
 */
function nearHome(s: Skeleton, ctx: OfferContext): boolean {
  if (s.patron.kind !== 'world') return true;
  const home = s.patron.seedSlot;
  const here = ctx.commander.systemIndex;
  if (here === home) return true;
  const reach = s.offer.withinJumps;
  if (reach === undefined || !ctx.systems) return false;
  const jumps = routeEstimate(ctx.systems, ctx.systems[here], ctx.systems[home])?.jumps;
  return jumps !== undefined && jumps <= reach;
}

function gateOpen(gate: Gate, st: MissionState, c: CommanderFacts): boolean {
  if (gate.galaxy !== undefined && c.galaxy !== gate.galaxy) return false;
  if (gate.minKills !== undefined && c.kills < gate.minKills) return false;
  if (gate.minRating !== undefined && ratingRung(c.combatScore) < gate.minRating) return false;
  if (gate.legalStatus === 'clean' && c.legalStatus !== 0) return false;
  if (gate.flags?.some((f) => !st.flags.includes(f))) return false;
  if (gate.notFlags?.some((f) => st.flags.includes(f))) return false;
  if (gate.done?.some((d) => !(d in st.done))) return false;
  return true;
}

/** The journal's endings for this skeleton, by either outcome. */
function endings(st: MissionState, id: string): { count: number; lastDay: number } {
  let count = 0;
  let lastDay = -Infinity;
  for (const j of st.journal) {
    if (j.skeleton !== id || (j.outcome !== 'complete' && j.outcome !== 'fail')) continue;
    count += 1;
    lastDay = Math.max(lastDay, j.day);
  }
  return { count, lastDay };
}

/** A skeleton the commander holds, or held, shuts this one out for good. */
function excluded(st: MissionState, id: string, from: readonly Skeleton[]): boolean {
  const held = [...st.live.map((l) => l.skeleton), ...Object.keys(st.done)];
  return held.some((h) => skeletonById(h, from)?.excludes?.includes(id) ?? false);
}

/** A saved lead names this skeleton, and the commander stands at its world. */
export function leadHere(st: MissionState, id: string, c: CommanderFacts): boolean {
  return st.leads.some((l) => l.skeleton === id
    && l.galaxy === c.galaxy && l.world === c.systemIndex);
}

/**
 * Whether the commander can accept this skeleton where she stands.
 *
 * A LEAD OPENS THE OFFER regardless of the gate. It does not open a slot, and
 * it does not restart an arc she holds or finished. A side job with a `cap`
 * comes back until the cap is spent, and not before `MISSION_REOFFER_DAYS`
 * from the day it last ended.
 */
export function canAccept(st: MissionState, id: string, ctx: OfferContext): boolean {
  const from = ctx.skeletons ?? SKELETONS;
  const s = skeletonById(id, from);
  if (!s) return false;
  if (st.live.length >= MISSION_LIVE_CAP) return false;
  if (st.live.some((l) => l.skeleton === id)) return false;
  // An arc that ended never comes back. `done` says so even when the journal
  // was not written, which a hand-built record can do.
  if (s.kind !== 'side' && id in st.done) return false;
  const ended = endings(st, id);
  if (ended.count >= (s.kind === 'side' ? (s.cap ?? 1) : 1)) return false;
  if (ended.count > 0 && ctx.commander.day < ended.lastDay + MISSION_REOFFER_DAYS) return false;
  if (excluded(st, id, from)) return false;
  if (leadHere(st, id, ctx.commander)) return true;
  if (!nearHome(s, ctx)) return false;
  return localJobHere(s, ctx.commander, ctx.systems) && gateOpen(s.offer, st, ctx.commander);
}

/** Every skeleton on offer where the commander stands. */
export function offersFor(st: MissionState, ctx: OfferContext): Skeleton[] {
  return (ctx.skeletons ?? SKELETONS).filter((s) => canAccept(st, s.id, ctx));
}
