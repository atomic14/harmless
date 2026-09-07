// The mission tour as data, for the site's missions page (docs/TODO/193).
//
// PURE, and built under Node at build time: it reads the skeletons, the
// patrons, the dossiers and the galaxy, and returns words and one SVG. It
// reaches no document and no window. The page's plugin (vite.config.ts)
// turns it into markup. A test reads it as data.
//
// It shows what the game shows a commander before she accepts: each arc's
// title, patron, start world and briefing, and the shape of its legs. It
// names which legs are recovery legs, because a failure that becomes a
// branch is the tour's own point (docs/TODO/190). It does not show the
// branches or the endings, so the page does not spoil an arc.

import type { StarSystem } from '../galaxy/galaxy.ts';
import { routeTable } from '../galaxy/route.ts';
import { dossierFor } from './dossiers.ts';
import type { CommanderFacts, Dossier, Leg, Patron, Skeleton, Verb } from './model.ts';
import { patronFor } from './patrons.ts';
import { routeMapSvg } from './route-map.ts';
import { ARC_TOUR, SKELETONS, skeletonById } from './skeletons/index.ts';
import { fillSlots } from './text.ts';
import { sameTrigger, successTrigger } from './triggers.ts';

export interface TourLeg {
  id: string;
  /** the verb's word for a reader: Hunt, Deliver, Recover... */
  verb: string;
  /** the standing order in plain words, with the target unnamed */
  line: string;
  /** true for a leg only a loss leads to */
  recovery: boolean;
}

export interface TourArc {
  id: string;
  title: string;
  world: { index: number; name: string };
  patron: Patron;
  /** the dossier's pages with the patron and the world filled, or the plain pitch */
  briefing: string[];
  legs: TourLeg[];
  /** the next arc's id, or null for the last */
  next: string | null;
  /** jumps from this arc's world to the next arc's, or null for the last */
  jumpsToNext: number | null;
}

export interface TourJob {
  id: string;
  title: string;
  pitch: string;
}

export interface TourModel {
  arcs: TourArc[];
  /** the side jobs, grouped by verb, in verb order */
  sideJobs: { verb: string; jobs: TourJob[] }[];
  /** the route through the arc start worlds */
  routeSvg: string;
}

/** The verb's word for a reader. */
export function verbWord(verb: Verb): string {
  return verb.kind.charAt(0).toUpperCase() + verb.kind.slice(1);
}

/** The order for a reader, with the target unnamed. */
function plainLine(leg: Leg): string {
  return fillSlots(leg.line, { TARGET: 'the target', PAY: 'the fee' });
}

/**
 * The legs that only a loss leads to. A leg is on the happy path when the
 * first leg is, or when a success branch of a happy leg names it. Every
 * other leg is a recovery leg.
 */
export function recoveryLegs(s: Skeleton): Set<string> {
  const happy = new Set<string>();
  const stack = [s.legs[0]?.id].filter((id): id is string => id !== undefined);
  while (stack.length) {
    const id = stack.pop() as string;
    if (happy.has(id)) continue;
    happy.add(id);
    const leg = s.legs.find((l) => l.id === id);
    if (!leg) continue;
    for (const b of leg.next) {
      const good = sameTrigger(b.on, successTrigger(leg.verb)) || sameTrigger(b.on, { survivor: 'landed' });
      if (good && b.to !== 'complete' && b.to !== 'fail') stack.push(b.to);
    }
  }
  return new Set(s.legs.map((l) => l.id).filter((id) => !happy.has(id)));
}

const facts = (galaxy: number, systemIndex: number): CommanderFacts => ({
  galaxy, systemIndex, kills: 0, combatScore: 0, legalStatus: 0, day: 0, cargo: [],
});

function arcEntry(
  s: Skeleton, next: Skeleton | null, systems: readonly StarSystem[], galaxy: number,
  dossiers: (id: string) => Dossier | null,
): TourArc {
  const world = s.patron.kind === 'world' ? s.patron.seedSlot : 0;
  const patron = patronFor(s.patron, facts(galaxy, world), systems);
  const d = dossiers(s.id);
  const slots = { PATRON: patron.name, HERE: systems[world].name };
  const recovery = recoveryLegs(s);
  const nextWorld = next?.patron.kind === 'world' ? next.patron.seedSlot : null;
  return {
    id: s.id,
    title: d?.title ?? s.id.replace(/-/g, ' ').toUpperCase(),
    world: { index: world, name: systems[world].name },
    patron,
    briefing: d ? d.briefing.map((p) => fillSlots(p, slots)) : [s.pitch],
    legs: s.legs.map((l) => ({ id: l.id, verb: verbWord(l.verb), line: plainLine(l), recovery: recovery.has(l.id) })),
    next: next?.id ?? null,
    jumpsToNext: nextWorld === null ? null : routeTable(systems, world).jumps[nextWorld],
  };
}

/**
 * The tour, in order, with the side jobs by verb and the route.
 *
 * `dossiers` and `skeletons` are injectable, so a test can empty the table
 * or swap the order. The page still builds with the plain words when a
 * dossier is absent, as the game does.
 */
export function tourModel(
  systems: readonly StarSystem[], galaxy = 1,
  dossiers: (id: string) => Dossier | null = dossierFor,
  skeletons: readonly Skeleton[] = SKELETONS, tour: readonly string[] = ARC_TOUR,
): TourModel {
  const arcs = tour.map((id) => skeletonById(id, skeletons)).filter((s): s is Skeleton => s !== null);
  const entries = arcs.map((s, i) => arcEntry(s, arcs[i + 1] ?? null, systems, galaxy, dossiers));

  const byVerb = new Map<string, TourJob[]>();
  for (const s of skeletons) {
    if (s.kind !== 'side') continue;
    const verb = verbWord(s.legs[0].verb);
    const d = dossiers(s.id);
    const job: TourJob = { id: s.id, title: d?.title ?? s.id.replace(/-/g, ' ').toUpperCase(), pitch: s.pitch };
    byVerb.set(verb, [...(byVerb.get(verb) ?? []), job]);
  }
  const sideJobs = [...byVerb.entries()].map(([verb, jobs]) => ({ verb, jobs }));

  return { arcs: entries, sideJobs, routeSvg: routeMapSvg(systems, entries.map((a) => a.world.index)) };
}
