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

import type { StarSystem } from '../galaxy/galaxy.ts';
import { distanceTenths } from '../galaxy/navigation.ts';
import type { Skeleton } from './model.ts';
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
    if (leg.place.kind === 'handover') out.push(`${at}: handover placement is not built yet`);
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
  } else if (s.fail.lead !== undefined) {
    out.push(...leadProblems(s, s.fail.lead, all));
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
