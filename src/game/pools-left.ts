// What is left of the pools, 0..1, for a policy and a HUD to read.
//
// Five reporters, out of `systems.ts` for the size gate (docs/TODO/219 M5).
// They READ the pools and write none, so the gate on who writes a pool is
// not theirs. `systems.ts` still owns the pools and every write to them.
//
// ONE HOME for each number: `observeDefend` reads them in two worlds, the
// trainer's target and the game's combat computer, and a copy would drift.

import { MAX_ENERGY, MAX_SHIELD } from '../constants/pools.ts';
import type { ShipSystems } from './systems.ts';

/**
 * How much damage this ship can absorb before energy reaches zero, in POOL
 * POINTS. It is one shield face plus the whole energy bank. It is both faces
 * for a commander who manoeuvres, so that hits land front and back.
 *
 * There is no multiplier into energy. The facing shield takes a hit, and the
 * remainder spills straight into the bank. So this is a plain sum, and the
 * balance harness reads it.
 */
export function durability(bothFaces = false): number {
  return (bothFaces ? MAX_SHIELD * 2 : MAX_SHIELD) + MAX_ENERGY;
}

/**
 * HOW MUCH OF THIS SHIP IS LEFT, 0..1 — both faces and the bank, over
 * everything they can hold.
 *
 * ONE HOME: it is the number a defence policy observes (`observeDefend` slot
 * 14), observed in two worlds (the trainer's `TargetShip` and the game's combat
 * computer). Written out twice it would drift. The policy would then fly out of
 * the distribution it was fitted in, and no gate would say so.
 */
export function poolsLeft(sys: ShipSystems): number {
  return (sys.foreShield + sys.aftShield + sys.energy) / durability(true);
}

/**
 * The ENERGY BANK alone, 0..1 — `observeDefend` slot 15, and the same one-home
 * argument as `poolsLeft`.
 *
 * It is separate from `poolsLeft`, because the bank is three things at once:
 *
 * 1. what the ship DIES at;
 * 2. what the shields will not recover past (`energyLow`);
 * 3. what the E.C.M. spends a quarter of.
 *
 * A full pair of shields hides an empty one.
 */
export function energyLeft(sys: ShipSystems): number {
  return sys.energy / MAX_ENERGY;
}

/**
 * Each shield FACE alone, 0..1 — `observeDefend` slots 27 and 28, same one-home
 * argument as the two above.
 *
 * The pair exists because `poolsLeft` hides the split. An attacker on your six
 * spends a different face from one head-on (`applyDamage`, `hitFromAhead`). So
 * "keep the good face toward him" is flyable only if the policy can see which
 * face is the good one.
 */
export function foreShieldLeft(sys: ShipSystems): number {
  return sys.foreShield / MAX_SHIELD;
}

export function aftShieldLeft(sys: ShipSystems): number {
  return sys.aftShield / MAX_SHIELD;
}
