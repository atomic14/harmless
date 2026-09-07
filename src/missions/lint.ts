// The rules a skeleton must keep, checked as data before the game ships it.
//
// `lintSkeleton` returns a list of problems, in words, and an empty list is a
// clean skeleton. `test/mission-skeletons.test.ts` runs it over every entry of
// `SKELETONS`. It also runs it over fixtures with one fault each, so the gate
// is proved able to fail (docs/TODO/190 M1 step 5).
//
// The five failure rules Chris set on 2026-09-06 are the heart of it. Every
// leg has a `failed` branch. Every leg reaches an end. Success and failure
// carry the same lead. A lead names a skeleton that exists, and neither arc
// shuts the other out.
//
// docs/TODO/192 adds two. An arc's final leg ends two to four jumps from
// the lead's start world, measured on the full-tank graph. Two legs that
// force two different blueprint sets at one world are a conflict.

import { ARC_HANDOVER_JUMPS } from '../constants/missions.ts';
import type { StarSystem } from '../galaxy/galaxy.ts';
import { distanceTenths } from '../galaxy/navigation.ts';
import { routeTable } from '../galaxy/route.ts';
import type { Leg, Skeleton } from './model.ts';
import { specForDesign } from '../game/ship-specs.ts';
import { verbJob, verbModule, verbNeedsShip } from './verbs/registry.ts';

export function lintSkeleton(
  s: Skeleton, all: readonly Skeleton[], systems: readonly StarSystem[],
): string[] {
  const out: string[] = [];
  const ids = new Set(s.legs.map((l) => l.id));
  if (s.legs.length === 0) out.push(`${s.id}: no legs`);
  if (ids.size !== s.legs.length) out.push(`${s.id}: a leg id repeats`);

  for (const leg of s.legs) {
    const at = `${s.id}/${leg.id}`;
    if (!verbModule(leg.verb.kind)) out.push(`${at}: no module for verb ${leg.verb.kind}`);
    if (verbNeedsShip(leg.verb)) {
      const role = verbJob(leg.verb) === 'hunt' ? 'pirate' : 'trader';
      if (!specForDesign(role, leg.verb.ship)) out.push(`${at}: no ${role} row for ${leg.verb.ship}`);
    }
    if (!leg.next.some((b) => b.on === 'failed')) out.push(`${at}: no failed branch`);
    for (const b of leg.next) {
      if (b.to !== 'complete' && b.to !== 'fail' && !ids.has(b.to)) {
        out.push(`${at}: branch to unknown leg ${b.to}`);
      }
    }
    if (leg.place.kind === 'handover' && !all.some((t) => t.id === (leg.place as { toward: string }).toward)) {
      out.push(`${at}: handover toward unknown skeleton ${leg.place.toward}`);
    }
    if (leg.place.kind === 'band') {
      const band = leg.place;
      const dry = systems.filter((from) => !systems.some((to) => {
        const d = distanceTenths(from, to);
        return to.index !== from.index && d >= band.min && d <= band.max;
      }));
      if (dry.length) out.push(`${at}: band ${band.min}-${band.max} has no candidate from ${dry[0].name}`);
    }
  }

  for (const leg of s.legs) {
    if (!reachesEnd(s, leg.id)) out.push(`${s.id}/${leg.id}: no path to complete or fail`);
  }

  if (s.complete.lead !== undefined) {
    if (s.fail.lead !== s.complete.lead) out.push(`${s.id}: success and failure lead to different arcs`);
    out.push(...leadProblems(s, s.complete.lead, all));
    out.push(...handoverProblems(s, s.complete.lead, all, systems));
  } else if (s.fail.lead !== undefined) {
    out.push(...leadProblems(s, s.fail.lead, all));
  }
  out.push(...overrideProblems(s, all));
  return out;
}

/** The start world of a skeleton: its world patron's, or null for a patron with no home. */
function startOf(s: Skeleton): number | null {
  return s.patron.kind === 'world' ? s.patron.seedSlot : null;
}

/**
 * Every final leg of an arc with a lead ends inside `ARC_HANDOVER_JUMPS` of
 * the lead's start world. A handover toward that lead inside the band
 * passes by construction. A fixed world is measured. A band of tenths is
 * measured over every candidate from every world, so it fails unless the
 * galaxy is tiny. A `here`, `origin`, `anywhere` or `entity` placement
 * cannot be measured before the game runs, and is a fault on a final leg.
 */
function handoverProblems(
  s: Skeleton, lead: string, all: readonly Skeleton[], systems: readonly StarSystem[],
): string[] {
  const target = all.find((t) => t.id === lead);
  const goal = target ? startOf(target) : null;
  if (goal === null) return [];
  const out: string[] = [];
  const toGoal = routeTable(systems, goal).jumps;
  const inside = (w: number) => toGoal[w] >= ARC_HANDOVER_JUMPS.min && toGoal[w] <= ARC_HANDOVER_JUMPS.max;
  const finals = s.legs.filter((l) => l.next.some((b) => b.to === 'complete'));
  for (const leg of finals) {
    const at = `${s.id}/${leg.id}`;
    const p = leg.place;
    if (p.kind === 'handover') {
      if (p.toward !== lead) out.push(`${at}: hands over toward ${p.toward}, and the lead is ${lead}`);
      if (p.min < ARC_HANDOVER_JUMPS.min || p.max > ARC_HANDOVER_JUMPS.max) {
        out.push(`${at}: handover band ${p.min}-${p.max} is outside ${ARC_HANDOVER_JUMPS.min}-${ARC_HANDOVER_JUMPS.max}`);
      }
    } else if (p.kind === 'world') {
      if (!inside(p.seedSlot)) out.push(`${at}: ends ${toGoal[p.seedSlot]} jumps from the lead's world ${systems[goal].name}`);
    } else if (p.kind === 'band') {
      const far = systems.find((from) => systems.some((to) => {
        const d = distanceTenths(from, to);
        return to.index !== from.index && d >= p.min && d <= p.max && !inside(to.index);
      }));
      if (far) out.push(`${at}: a band of tenths can end too far from the lead's world (from ${far.name})`);
    } else {
      out.push(`${at}: a final leg placed by ${p.kind} cannot be measured against the lead`);
    }
  }
  return out;
}

/** Whether two legs can force two different sets at one world. */
function conflict(a: Leg, b: Leg): boolean {
  if (!a.override || !b.override || a.override.set === b.override.set) return false;
  if (a.override.where === 'everywhere' || b.override.where === 'everywhere') return true;
  return a.place.kind === 'world' && b.place.kind === 'world' && a.place.seedSlot === b.place.seedSlot;
}

/**
 * Two legs of two skeletons that force different sets at one world. Two
 * legs of ONE skeleton are never live together, because a mission is on
 * one leg at a time. So the Constrictor's hunt and its courier run may
 * disagree. Each pair of skeletons is read once.
 */
function overrideProblems(s: Skeleton, all: readonly Skeleton[]): string[] {
  const out: string[] = [];
  for (const leg of s.legs) {
    if (!leg.override) continue;
    for (const t of all) {
      if (t.id <= s.id) continue;
      for (const other of t.legs) {
        if (conflict(leg, other)) {
          out.push(`${s.id}/${leg.id}: forces ${leg.override.set} where ${t.id}/${other.id} forces ${other.override?.set}`);
        }
      }
    }
  }
  return out;
}

/** Whether a walk from `legId` over the branches can end the mission. */
function reachesEnd(s: Skeleton, legId: string): boolean {
  const seen = new Set<string>();
  const stack = [legId];
  while (stack.length) {
    const id = stack.pop() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    const leg = s.legs.find((l) => l.id === id);
    if (!leg) continue;
    for (const b of leg.next) {
      if (b.to === 'complete' || b.to === 'fail') return true;
      stack.push(b.to);
    }
  }
  return false;
}

/** A lead must name an arc that exists, and neither arc can bar the other. */
function leadProblems(s: Skeleton, lead: string, all: readonly Skeleton[]): string[] {
  const target = all.find((t) => t.id === lead);
  if (!target) return [`${s.id}: lead names unknown skeleton ${lead}`];
  const out: string[] = [];
  if (s.excludes?.includes(lead)) out.push(`${s.id}: leads to ${lead} and excludes it`);
  if (s.offer.done?.includes(lead)) out.push(`${s.id}: leads to ${lead} and needs it finished first`);
  if (target.excludes?.includes(s.id)) out.push(`${s.id}: leads to ${lead}, which excludes it`);
  return out;
}
