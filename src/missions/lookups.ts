// Three readings of a skeleton that every part of the mission machine asks
// for. A leg by id. A patron's key. Where a skeleton is offered.
//
// They left machine.ts when docs/TODO/192 M3 pushed it over the size
// ceiling. The machine, the queries, the bridge and the patrons all read
// them, and none of them should reach through the machine to do so.

import type { CommanderFacts, Leg, Skeleton } from './model.ts';

/** The leg of a skeleton by id. The lint test makes a miss impossible. */
export function legOf(skeleton: Skeleton, id: string): Leg {
  const leg = skeleton.legs.find((l) => l.id === id);
  if (!leg) throw new Error(`mission ${skeleton.id}: no leg ${id}`);
  return leg;
}

/**
 * The key that `MissionState.standing` and a dossier file use for a patron.
 * A local patron is whoever runs the station the job was taken at, so the
 * key names `origin` where the caller knows it. Without one it names the
 * world the commander stands at, which is right on the board. It named
 * that world at every settlement until docs/TODO/213 M4, so a delivery credited the
 * far end's patron.
 */
export function patronId(skeleton: Skeleton, commander: CommanderFacts, origin?: number): string {
  const p = skeleton.patron;
  if (p.kind === 'navy') return 'navy';
  if (p.kind === 'wheel') return 'wheel';
  return `world-${p.kind === 'world' ? p.seedSlot : (origin ?? commander.systemIndex)}`;
}

/**
 * Where a skeleton is offered. A world patron waits at home. The Navy has no
 * home, and a local patron is every home, so their leads open wherever the
 * commander stands.
 */
export function startWorld(skeleton: Skeleton, commander: CommanderFacts): number {
  return skeleton.patron.kind === 'world' ? skeleton.patron.seedSlot : commander.systemIndex;
}
