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
//
// EACH JOB CARRIES A PLAIN SUMMARY, written here for the site (docs/TODO/199).
// The skeleton's pitch is the station board's own shouted line, and a case
// conversion cannot tell a Krait from a krait. So the page says what a job is
// in the site's voice first, and quotes the patron second. A test holds the
// table complete, so a new job cannot ship without its sentence.

import type { StarSystem } from '../galaxy/galaxy.ts';
import { routeTable } from '../galaxy/route.ts';
import { dossierFor } from './dossiers.ts';
import type { CommanderFacts, Dossier, Patron, Skeleton, Verb } from './model.ts';
import { patronFor } from './patrons.ts';
import { routeMapSvg } from './route-map.ts';
import { ARC_TOUR, SKELETONS, skeletonById } from './skeletons/index.ts';
import { fillSlots } from './text.ts';
import { sameTrigger, successTrigger } from './triggers.ts';

export interface TourLeg {
  id: string;
  /** the verb's word for a reader: Hunt, Deliver, Recover... */
  verb: string;
  /** true for a leg only a loss leads to */
  recovery: boolean;
}

/**
 * What each job is, in the site's voice: one or two plain sentences a
 * visitor reads before the patron speaks. Keyed by skeleton id.
 */
export const JOB_SUMMARIES: Readonly<Record<string, string>> = {
  'arc-lave': 'The governor of Lave lost the export ledger to a smuggler. '
    + 'Recover the canister, then hunt the smuggler down.',
  'arc-rabedira': 'An envoy at Rabedira needs a truce paper carried to a neighbour. '
    + 'Then he needs an escort to the meeting itself.',
  'arc-vetitice': 'Pirates hold the lane a shipment must cross at Vetitice. '
    + 'Clear the lane, bring a survey pilot home alive, then carry the manifest on.',
  'arc-xeer': 'An Anaconda is forging the harvest figures at Xeer. '
    + 'Watch it without firing, then find and destroy the ship that carries the false papers.',
  'arc-edle': 'A colonel at Edle has a manifest to move and a transporter to guard. '
    + 'After that, an Asp is marked for destruction.',
  'side-hunt': 'A Krait is taking ships on the lane. Destroy it.',
  'side-deliver': 'Carry a sealed packet to a station one jump away. It takes no hold space.',
  'side-recover': 'A canister went adrift one jump away. Scoop it and bring it back.',
  'side-rescue': 'A survey pilot is adrift in a pod one jump away. Bring her in alive.',
  'side-ambush': 'Pirates hold the lane to a neighbour. Fly it, fight through, and dock there.',
  'side-smuggle': 'Carry three tonnes of narcotics to a neighbour, past the patrols. You are paid at the far end.',
  'side-escort': 'A Python is leaving for a neighbour and wants a gun beside her. See her into station range.',
  'side-scan': 'An Anaconda is working a neighbour. Hold it on your scanner for twenty seconds, and do not fire.',
};

export interface TourArc {
  id: string;
  title: string;
  world: { index: number; name: string };
  patron: Patron;
  /** what the job is, in the site's voice */
  summary: string;
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
  /** what the job is, in the site's voice */
  summary: string;
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

/** The job's sentence for the site, or the board's own line where none is written. */
function summaryOf(s: Skeleton): string {
  return JOB_SUMMARIES[s.id] ?? s.pitch;
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
    summary: summaryOf(s),
    briefing: d ? d.briefing.map((p) => fillSlots(p, slots)) : [s.pitch],
    legs: s.legs.map((l) => ({ id: l.id, verb: verbWord(l.verb), recovery: recovery.has(l.id) })),
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
    const job: TourJob = { id: s.id, title: d?.title ?? s.id.replace(/-/g, ' ').toUpperCase(), summary: summaryOf(s) };
    byVerb.set(verb, [...(byVerb.get(verb) ?? []), job]);
  }
  const sideJobs = [...byVerb.entries()].map(([verb, jobs]) => ({ verb, jobs }));

  return { arcs: entries, sideJobs, routeSvg: routeMapSvg(systems, entries.map((a) => a.world.index)) };
}
