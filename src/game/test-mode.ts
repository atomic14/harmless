// What test mode does that is not a row on its screen.
//
// The screen (`screens/test-mode.ts`) owns the door and the levers you pull at
// the station. This owns the two the station cannot give, because both happen
// in the cockpit: dropping a ship off your nose, and a hyperspace jump that
// stops asking about fuel. They are here rather than in `game.ts` because
// `game.ts`'s command table is one-liners on purpose — a rule that fits on one
// line there is a rule with no home.
//
// Neither is a branch inside a game rule. The spawn calls the arena's own
// placement, and the free jump is a PARAMETER of `checkJump` that the Game
// passes `state.cheat` into — so the refusal still has exactly one home, and a
// commander who has never opened the door meets the rule unchanged.

import * as THREE from 'three';
import type { GameState } from './state.ts';
import type { NpcShip } from './npc.ts';
import { spawnOpposition } from './spawning.ts';

/** Reused rather than allocated per press — the nose is read, never kept. */
const _facing = new THREE.Vector3();

/**
 * Put the chosen ship off the commander's nose. Nothing happens with the mode
 * off, which is what makes the key inert for everybody else.
 *
 * `spawnOpposition` and not `spawnPopulation`: this is one authored ship placed
 * relative to a pilot, which is precisely the arena's job and precisely not the
 * system builder's. It comes in pointed AT you, at the arena's own ring
 * distance, and every part of it that is a draw — where on the ring, which hull
 * off the roster — comes from the world's seeded stream (invariant 11), so a
 * spawn in a replayed save lands in the same place twice.
 *
 * @returns the ship, or null when the mode is off.
 */
export function spawnCheatShip(state: GameState): NpcShip | null {
  if (!state.cheat) return null;
  const [ship] = spawnOpposition(
    state.world,
    [{ role: state.cheatRole }],
    state.player.position,
    { facing: state.player.getForward(_facing) },
  );
  return ship ?? null;
}
