// Optional, outside-in observation of a live game.
//
// The human-flight combat recorder used to replace Game methods at runtime:
// applyPlayerDamage, fireLaser and update, plus NpcShip.update on its prototype.
// The typed CombatSimRecorder has since absorbed that recorder.
//
// This small seam keeps one fact available to a future console recorder: what
// damaged the player. Only production can publish it. No Game method's name,
// visibility or argument order becomes an instrumentation API.

import * as THREE from 'three';

import type { DamageSource } from './combat.ts';
import type { PlayerPoolPoints } from './damage-units.ts';

/**
 * Events a live-combat recorder may observe.
 *
 * The position is a snapshot owned by the notification. Callers may retain it
 * or mutate it without changing the world or a scratch vector used by the
 * simulation.
 */
export interface CombatObserver {
  onPlayerDamaged?(
    amount: PlayerPoolPoints, from: THREE.Vector3, source: DamageSource): void;
}

/**
 * The optional observer slot. It is separate from Game, so that a test drives
 * it with no renderer, no HUD and no world. Two things then get a test: what it
 * does with no observer at all, and how long a registration lives.
 */
export class CombatInstrumentation {
  private observer: CombatObserver | null = null;

  /**
   * Replace the current observer and return a safe disposer for this exact
   * registration. Passing null explicitly disables instrumentation.
   */
  setObserver(observer: CombatObserver | null): () => void {
    this.observer = observer;
    return () => {
      if (this.observer === observer) this.observer = null;
    };
  }

  playerDamaged(
    amount: PlayerPoolPoints, from: THREE.Vector3, source: DamageSource): void {
    this.observer?.onPlayerDamaged?.(amount, from.clone(), source);
  }
}
