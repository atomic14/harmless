// What the game asks the mission record without changing it.
//
// Arrival asks three things: which ships to spawn, which blueprint override is
// in force, and whether the plans aboard raise the mis-jump chance. The
// screens ask a fourth: the standing order for each live leg, in words. Each
// answer reads the skeleton through the live leg, so a stage number lives
// nowhere (docs/TODO/190).

import type { BlueprintOverride } from '../game/blueprint-set.ts';
import type { StarSystem } from '../galaxy/galaxy.ts';
import { legOf } from './machine.ts';
import type { Leg, LiveMission, MissionState, Skeleton, TaggedShip } from './model.ts';
import { SKELETONS, skeletonById } from './skeletons/index.ts';
import { fillSlots, lineSlots } from './text.ts';

function liveLegs(
  st: MissionState, from: readonly Skeleton[],
): { live: LiveMission; leg: Leg }[] {
  const out: { live: LiveMission; leg: Leg }[] = [];
  for (const live of st.live) {
    const s = skeletonById(live.skeleton, from);
    if (s) out.push({ live, leg: legOf(s, live.leg) });
  }
  return out;
}

/**
 * The override a live leg puts in force at `here`, or null.
 *
 * The first live mission that names one wins. Two live legs with two
 * overrides at one world is a conflict the skeleton lint does not see yet.
 * The arc plan, item 192 of docs/TODO/190, decides it when a second arc exists.
 */
export function missionOverride(
  st: MissionState, here: number, from: readonly Skeleton[] = SKELETONS,
): BlueprintOverride | null {
  for (const { live, leg } of liveLegs(st, from)) {
    if (!leg.override) continue;
    if (leg.override.where === 'everywhere' || live.target === here) return leg.override.set;
  }
  return null;
}

/** Whether any live leg raises the mis-jump chance. */
export function carryingPlans(st: MissionState, from: readonly Skeleton[] = SKELETONS): boolean {
  return liveLegs(st, from).some(({ leg }) => leg.carryingPlans === true);
}

/** The tagged ships that wait at `here`, alive, for a live leg. */
export function missionSpawns(
  st: MissionState, here: number, from: readonly Skeleton[] = SKELETONS,
): TaggedShip[] {
  const out: TaggedShip[] = [];
  for (const { live } of liveLegs(st, from)) {
    if (live.tag === null || live.target !== here) continue;
    const e = st.entities[live.tag];
    if (e && e.alive) out.push({ ship: e.ship, tag: live.tag });
  }
  return out;
}

/** The standing order for one live mission, in the game's voice. */
export function orderLine(
  live: LiveMission, systems: readonly StarSystem[], from: readonly Skeleton[] = SKELETONS,
): string {
  const s = skeletonById(live.skeleton, from);
  if (!s) return '';
  return fillSlots(legOf(s, live.leg).line, lineSlots(systems, live.target));
}

/** Every world a live leg sends the commander to. */
export function missionDestinations(st: MissionState): ReadonlySet<number> {
  const out = new Set<number>();
  for (const l of st.live) if (l.target !== null) out.add(l.target);
  return out;
}
