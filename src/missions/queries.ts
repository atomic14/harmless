// What the game asks the mission record without changing it.
//
// Arrival asks three things: which ships to spawn, which blueprint override is
// in force, and whether the plans aboard raise the mis-jump chance. The
// screens ask a fourth: the standing order for each live leg, in words. Each
// answer reads the skeleton through the live leg, so a stage number lives
// nowhere (docs/TODO/190).

import type { BlueprintOverride } from '../game/blueprint-set.ts';
import type { StarSystem } from '../galaxy/galaxy.ts';
import { legOf } from './lookups.ts';
import type { Leg, LiveMission, MissionState, Skeleton, TaggedItem, TaggedShip } from './model.ts';
import { verbJob, verbNeedsShip } from './verbs/registry.ts';
import { SKELETONS, skeletonById } from './skeletons/index.ts';
import { fillSlots, legPay, lineSlots } from './text.ts';

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
  // A settlement's change to this world, while it holds (docs/TODO/192 M3).
  for (const ch of st.changes) if (ch.world === here && ch.override) return ch.override;
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
  for (const { live, leg } of liveLegs(st, from)) {
    if (live.tag === null || live.target !== here || !verbNeedsShip(leg.verb)) continue;
    const e = st.entities[live.tag];
    if (e && e.alive && e.kind === 'ship') out.push({ ship: e.ship, tag: live.tag, job: verbJob(leg.verb) });
  }
  // A standing spawn a settlement left here, on every arrival while it holds.
  for (const ch of st.changes) if (ch.world === here && ch.ships) out.push(...ch.ships);
  return out;
}

/** The tagged canisters and capsules adrift at `here`, for a live leg. */
export function missionItems(
  st: MissionState, here: number, from: readonly Skeleton[] = SKELETONS,
): TaggedItem[] {
  const out: TaggedItem[] = [];
  for (const { live } of liveLegs(st, from)) {
    if (live.tag === null || live.target !== here) continue;
    const e = st.entities[live.tag];
    if (e && e.alive && e.kind !== 'ship') out.push({ tag: live.tag, kind: e.kind });
  }
  return out;
}

/** The choice ids a leg's branches wait on, in branch order, for the MISSIONS screen's prompt. */
export function legChoices(s: Skeleton, legId: string): string[] {
  const leg = s.legs.find((l) => l.id === legId);
  if (!leg) return [];
  return leg.next.flatMap((b) => (typeof b.on !== 'string' && 'choice' in b.on ? [b.on.choice] : []));
}

/** The seconds a scan leg wants of the ship with `tag`, or null. */
export function scanSecondsFor(
  st: MissionState, tag: string, from: readonly Skeleton[] = SKELETONS,
): number | null {
  for (const { live, leg } of liveLegs(st, from)) {
    if (live.tag === tag && leg.verb.kind === 'scan') return leg.verb.seconds;
  }
  return null;
}

/** The standing order for one live mission, in the game's voice. */
export function orderLine(
  live: LiveMission, systems: readonly StarSystem[], from: readonly Skeleton[] = SKELETONS,
): string {
  const s = skeletonById(live.skeleton, from);
  if (!s) return '';
  return fillSlots(legOf(s, live.leg).line, lineSlots(systems, live.target));
}

/**
 * What a live leg pays when it goes right, in tenths of a credit.
 *
 * The largest settlement on a branch that is not the leg's failure. A screen
 * quotes this, and it is the same number the branch settles, so the screen
 * cannot name a price the mission does not pay.
 */
export function legReward(live: LiveMission, from: readonly Skeleton[] = SKELETONS): number {
  const s = skeletonById(live.skeleton, from);
  return s ? legPay(legOf(s, live.leg)) : 0;
}

/**
 * The world a mission's latest run was accepted at, or undefined before any.
 * A local patron is whoever runs that station, so her name and her face read
 * from here (patrons.ts).
 */
export function acceptedAt(st: MissionState, skeleton: string): number | undefined {
  return st.journal.filter((j) => j.skeleton === skeleton && j.outcome === 'accepted').pop()?.world;
}

/**
 * `NAVY MISSION`, or `LAVE MISSION` for a world patron: the chart's word. A
 * local patron is named by the world the job was accepted at.
 */
export function missionName(
  st: MissionState, live: LiveMission, systems: readonly StarSystem[],
  from: readonly Skeleton[] = SKELETONS,
): string {
  const s = skeletonById(live.skeleton, from);
  if (!s || s.patron.kind === 'navy') return 'NAVY MISSION';
  const world = s.patron.kind === 'world' ? s.patron.seedSlot : acceptedAt(st, live.skeleton);
  return world === undefined ? 'MISSION' : `${systems[world].name.toUpperCase()} MISSION`;
}

/** Every world a live leg sends the commander to. */
export function missionDestinations(st: MissionState): ReadonlySet<number> {
  const out = new Set<number>();
  for (const l of st.live) if (l.target !== null) out.add(l.target);
  return out;
}
