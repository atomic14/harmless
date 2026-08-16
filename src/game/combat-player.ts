// The player's own gun and the player's own hull, over a GameState.
//
// `Combat` (combat.ts) takes each ingredient separately, and that is
// deliberate. It is what makes the class testable, and what lets `destroy()`
// take a different commander. The player's own trigger always wants the same
// seven
// arguments, and they all come out of one GameState. This is the assembly step.
//
// It is a file rather than the bottom of combat.ts, because it is a different
// responsibility. The header of combat.ts named it as one for as long as it
// lived there.
//
// The proof is in the imports. `GameState` and `viewDirection` belong to the
// assembly rather than to the rule, so combat.ts is free of both now
// (docs/TODO/156).
//
// NEITHER FUNCTION APPLIES ANYTHING. The caller decides what the events mean —
// the HUD and the law for the Game, a report for a caller that wants the
// numbers. That is the same bargain combat.ts keeps.

import * as THREE from 'three';
import type { GameState } from './state.ts';
import type { PlayerPoolPoints } from './damage-units.ts';
import { viewDirection } from './views.ts';
import type { Combat, CombatScratch } from './combat.ts';
import type { CombatEvent } from './combat-events.ts';

/**
 * Pull the player's trigger, in whatever view they are looking through.
 *
 * @param scratch reused across frames; `b` carries the view direction, because
 * `Combat.fire` writes the trace's own working vector into `a`.
 */
export function firePlayerLaser(
  state: GameState, combat: Combat, scratch: CombatScratch,
): CombatEvent[] {
  const { commander, sys, player, session } = state;
  return combat.fire(
    commander, sys, player.position,
    viewDirection(player.quaternion, session.view, scratch.b),
    session.view, session.witchspace, scratch);
}

/**
 * The player takes a hit of `damage` pool points, from `from`.
 *
 * The source of the hit is NOT here. `Combat.hitPlayer` needs to know only
 * whether it came from ahead. Who attributes the damage is the caller's
 * business. See `DamageSource` and `StepHost.applyPlayerDamage`.
 */
export function damagePlayer(
  state: GameState, combat: Combat, damage: PlayerPoolPoints, from: THREE.Vector3,
  scratch: CombatScratch,
): CombatEvent[] {
  const { sys, player } = state;
  return combat.hitPlayer(sys, damage, from, player.position, player.quaternion, scratch);
}
