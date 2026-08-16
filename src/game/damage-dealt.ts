// What the commander landed on a ship — the four causes, and the measurement.
//
// The other direction has a home since TODO 28. `DamageSource` in combat.ts
// names the five things that can hurt YOU, and every `applyPlayerDamage` call
// carries one.
//
// Outbound had nothing. The laser measured itself inside the exercise. The
// missile, the ram and the energy bomb went straight to `takeDamage`, and then
// to the kill. So a record of a fight won with ordnance read `damageDealt: 0`
// beside `kills: 1`. That is a report of nothing at all (TODO 47).
//
// Two things live here, and they are the same rule seen twice.
//
// `DealtSource` is the causes. It is NOT `DamageSource`. You cannot deal a
// canister on the hull, or a Coriolis scrape. Nothing can drop an energy bomb
// on you. The three words the two lists share are the same words by
// construction (`Extract`). So a rename of one cannot leave the report with two
// spellings of `ram`.
//
// `dealToNpc()` spends the points, and says what they COST. It reports the fall
// in the target's own bank, rather than the number spent on it. A 250-point
// warhead into a Sidewinder with 73 energy left did 73 points of damage. A
// credit of 250 would put more damage on that opponent's line than the ship
// ever had.
//
// That is also exactly what the laser path already measures: combat-sim.ts's
// `pullTrigger` reads the bank on either side of the discharge. So the four
// buckets are comparable.
//
// It applies and reports, and it decides nothing else. Three questions are the
// caller's: who is billed, whether a bounty is paid, and whether anybody saw
// it. The ram and the warhead go on to `StepHost.destroyNpc` through a returned
// event. That is how `npcFired` already reaches a caller that measures
// (docs/INVARIANTS.md invariant 15).

import type * as THREE from 'three';

import type { DamageSource } from './combat.ts';
import type { NpcEnergyPoints } from './damage-units.ts';
import type { NpcShip } from './npc.ts';

/**
 * What the commander can hurt a ship WITH.
 *
 * `Extract` rather than a fresh list of strings. `laser`, `missile` and `ram`
 * are the same three words in both directions. Two copies of them is how a
 * report grows two spellings of one cause.
 */
export type DealtSource = Extract<DamageSource, 'laser' | 'missile' | 'ram'> | 'bomb';

/**
 * A ship took damage from the commander — reported, never a side effect.
 *
 * It travels in a `StepEvent`, so the world step says it and never learns
 * whether anybody keeps a count. The career drops it. An exercise credits it to
 * the record (combat-sim.ts).
 */
export interface DealtEvent {
  kind: 'playerDealt';
  npc: NpcShip;
  /** source energy points, as they came OFF the bank — see the header */
  damage: number;
  source: DealtSource;
}

/** What `dealToNpc` did: the report, and whether that was the end of the ship. */
export interface DealtOutcome {
  event: DealtEvent;
  /** true if this is the hit that finished it — the caller decides who is credited */
  destroyed: boolean;
}

/**
 * Spend `points` on `npc` on the commander's behalf, and measure what it cost.
 *
 * @param points already minted by the module that owns the rule — a ram, a
 * warhead or the energy bomb from `impact-damage.ts`. Nothing is minted here.
 * @param from the attacker's position, which is how a trader decides where to
 * flee to and what marks the ship as provoked BY THE PLAYER.
 */
export function dealToNpc(
  npc: NpcShip, points: NpcEnergyPoints, from: THREE.Vector3, source: DealtSource,
): DealtOutcome {
  const before = npc.state.energy;
  const destroyed = npc.takeDamage(points, from, true);
  return {
    event: { kind: 'playerDealt', npc, damage: before - npc.state.energy, source },
    destroyed,
  };
}
