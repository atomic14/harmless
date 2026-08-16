// WHEN A MISSILE LEAVES THE RAIL — the decision to launch, pure and worldless
// so a test can reach it. The pair to `ordnance.ts`, which owns missiles IN
// FLIGHT. The gates it reads are constants/ordnance.ts.

import {
  MISSILE_COMMIT_PASSES, MISSILE_LAST_STAND_GATE, MISSILE_LAST_STAND_HULL,
  MISSILE_LAST_STAND_MIN_RANGE, MISSILE_MAX_RANGE,
} from '../constants/ordnance.ts';

/**
 * Is this ship in enough trouble to spend a missile?
 *
 * Two ways in, and each is a REASON rather than a roll. A ship EARNS a missile
 * in the fight. It is not a die rolled off a stand-off distance band:
 *
 *   - `hull <= MISSILE_LAST_STAND_HULL` — about to die, spend it or lose it.
 *   - `passes >= MISSILE_COMMIT_PASSES` — it flew at the target twice, and the
 *     target is still in the air ("tougher than you thought").
 *
 * The range and bearing gates apply on top: `dist` inside the seeker's
 * envelope, and a bearing the ship could plausibly launch on.
 */
export function npcMissileEmergency(
  hull: number, passes: number, dist: number, bearing: number,
): boolean {
  if (dist <= MISSILE_LAST_STAND_MIN_RANGE || dist >= MISSILE_MAX_RANGE) return false;
  if (bearing >= MISSILE_LAST_STAND_GATE) return false;
  return hull <= MISSILE_LAST_STAND_HULL
    || passes >= MISSILE_COMMIT_PASSES;
}
