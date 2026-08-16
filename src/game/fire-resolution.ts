// A ship pulled its trigger: what happens.
//
// Invariant 15 splits the world in half. An NPC returns a `FireEvent`, and the
// Game resolves every consequence. There are two Games: `world-step.ts` for the
// sky, and `ai-training/scenario.ts` for a training episode. So the decision
// half had one home each — `NpcShip`, `gunnery.ts`, `collisions.ts` and
// `rng.ts` — and the RESOLUTION half had two, kept in step by hope.
//
// Four divergences were found one at a time. Nobody chose any of them, and
// nothing reported any of them:
//
//   - docs/TODO/62;
//   - docs/TODO/63;
//   - docs/TODO/73;
//   - this file's own reason to exist — the laser's dice, its damage and the
//     shield face it lands on.
//
// This is the rule. Four things decide a fight:
//
//   1. the round a ship spends;
//   2. the roll that says whether a bolt connects;
//   3. the choice of what that bolt is worth;
//   4. the push of that worth into the target.
//
// A tracer, a bolt's sound and an explosion are what a fight looks like. THE
// SPLIT IS THE WHOLE DESIGN. Everything below the line is here. Everything
// above it stays with the caller. Neither caller may keep a copy of anything
// below.
//
// The seam is the one this codebase used three times before:
//
//   - `engine/shell.ts` for the platform;
//   - `StepHost` for the orchestrator;
//   - `OrdnanceWorld` as of docs/TODO/62.
//
// Each side implements a narrow interface. The rules above that interface sit
// in one file, and both sides call it. The seam is deliberately NOT "the Game".
// `resolveNpcFire` used to reach for tracers, sounds, the station, despawn and
// the commander's equipment. An episode has none of those. `FireWorld` is four
// members, and a test implements it in ten lines.
//
// WHAT IT REPORTS is a measurement, never an instruction. The caller counts the
// shot, draws the bolt and says it out loud. A caller that wants none of those
// drops the value. Same bargain as `DealtEvent` and `OrdnanceOutcome`.

import type * as THREE from 'three';

import { NPC_VS_NPC_HIT } from '../constants/npc-gun.ts';
import { npcHitChance, npcLaserDamageToPlayer } from './gunnery.ts';
import { npcCrossfireDamage } from './npc-energy.ts';
import type { PlayerPoolPoints } from './damage-units.ts';
import type { FireEvent, NpcShip } from './npc.ts';
import { launchNpcMissile, type Ordnance, type OrdnanceOutcome } from './ordnance.ts';
import { random } from './rng.ts';
import type { PlayerHullId } from './ship-identity.ts';

/**
 * The ship an NPC shoots AT, as much of one as a resolved shot needs.
 *
 * It is the commander in the sky. It is the episode's target in a training
 * run. Either one has to say only two things:
 *
 * 1. which hull it IS, because that is the armour an NPC laser meets once
 *    (`gunnery.ts`);
 * 2. where it is, because that is the range the dice run against.
 *
 * `damage()` is the seam and not the rule. WHICH pool a hit spends is
 * `shield-face.ts` and `systems.ts`, and both sides already run them. What
 * differs is the extra work the game does: it flashes the console, it
 * attributes the source, and it can end the run. An episode does none of that.
 */
export interface FireTarget {
  /** which of the flyable hulls it is — its per-hit armour and its pools */
  readonly hullId: PlayerHullId;
  /** where it is, for the range the hit curve reads */
  readonly pos: THREE.Vector3;
  /** it took `damage` finished pool points, from `from` */
  damage(damage: PlayerPoolPoints, from: THREE.Vector3): void;
}

/** The sky a resolved shot needs: something to shoot at, and somewhere to put a warhead. */
export interface FireWorld {
  readonly target: FireTarget;
  /** where a launched round goes — `ordnance.ts`, over either side's own sky */
  readonly ordnance: Ordnance;
  /**
   * An NPC shot another NPC out of the sky.
   *
   * WRECKED, never destroyed: nobody is credited for a fight they watched, and
   * an episode has no bounty to pay at all.
   */
  wreck(npc: NpcShip): void;
}

/**
 * What the shot DID — for a tracer, a tally, or nothing.
 *
 * The three cases are the three the `FireEvent` union already has, so a caller
 * that handles them all handles every shot the game can produce.
 */
export type NpcShot =
  /** a round left the rail: the rack is spent and the warhead is in the sky */
  | { weapon: 'missile'; launch: OrdnanceOutcome }
  /** a bolt at the hunted ship, and what it cost her pools */
  | { weapon: 'laser'; at: 'target'; range: number; hit: boolean; damage: number }
  /** a bolt at another ship, and what came off its bank */
  | { weapon: 'laser'; at: NpcShip; hit: boolean; damage: number; destroyed: boolean };

/**
 * Resolve one `FireEvent`. The ship chose the weapon; this rolls the dice.
 *
 * THE ORDER OF THE DRAWS IS LOAD-BEARING. It is unchanged from the step this
 * file came out of: the hit roll first and alone, then whatever the damage
 * itself draws. That second part is `applyDamage`'s one equipment roll, with a
 * breach roll behind it.
 *
 * A caller that wants randomness of its own takes it AFTER this function
 * returns. The game scatters a missed bolt, so that its tracer goes wide. A
 * draw taken any earlier moves every seeded outcome in the project
 * (game/rng.ts).
 *
 * This function measures the range rather than takes it as a parameter. A range
 * measured by the caller is exactly how these two resolvers came to disagree.
 * The step took it after the ship moved. The episode took it before.
 */
export function resolveNpcFire(
  npc: NpcShip, event: FireEvent, world: FireWorld,
): NpcShot {
  if (event.at === 'player') {
    // The SHIP chose the weapon (npc.ts `chooseWeapon`); "spend the round, put
    // it in the sky" is ordnance.ts's, and was the first slice of this file to
    // have one home (docs/TODO/62).
    if (event.weapon === 'missile') {
      return { weapon: 'missile', launch: launchNpcMissile(npc, world.ordnance) };
    }
    const range = npc.object.position.distanceTo(world.target.pos);
    const hit = random() < npcHitChance(range);
    if (!hit) return { weapon: 'laser', at: 'target', range, hit, damage: 0 };
    // WHETHER it lands is Harmless's dice, above. What it is WORTH is the
    // released game's, and nothing rolls for it. The exact build of the ship
    // that shoots supplies the laser power. The target hull supplies the armour
    // that power comes off — see gunnery.ts. A build whose power cannot beat
    // that armour still connects, still flashes and still costs nothing. That
    // is what the pack's zero rows say.
    const damage = npcLaserDamageToPlayer(npc.weaponByte, world.target.hullId);
    world.target.damage(damage, npc.object.position);
    return { weapon: 'laser', at: 'target', range, hit, damage };
  }

  // One NPC shoots another. One flat chance rather than the range curve,
  // because crossfire is scenery a player watches rather than a fight they are
  // in.
  const victim = event.at;
  if (random() >= NPC_VS_NPC_HIT) {
    return { weapon: 'laser', at: victim, hit: false, damage: 0, destroyed: false };
  }
  // WHAT A CROSSFIRE HIT IS WORTH comes from the same oracle as the two
  // directions that face the player. It sets the laser strength of the ship
  // that shoots against the TARGET's own defence (`npcCrossfireDamage`).
  const points = npcCrossfireDamage(npc.weaponByte, victim.energyPolicy);
  const before = victim.state.energy;
  const destroyed = victim.takeDamage(points, npc.object.position);
  if (destroyed) world.wreck(victim);
  // What came OFF the bank, not what was spent on it — the same measurement
  // `dealToNpc` reports, so the two are comparable.
  return {
    weapon: 'laser', at: victim, hit: true,
    damage: before - victim.state.energy, destroyed,
  };
}
