// The three layers of "nothing that happens in the simulator leaves it".
//
// The safety-critical surface of the combat trainer, in one file because the
// argument only makes sense read as one thing. docs/COMBAT-SIM.md states it;
// test/combat-sim-career.test.ts proves it.
//
//   1. the COMMANDER CLONE — the layer that does the work. A laser kill never
//      passes through StepHost.destroyNpc: combat.ts calls destroy() internally.
//      `Combat` takes the commander per call so a different one can be handed
//      in, covering that call, the survivor counts, scooped cargo, fuel and
//      missiles.
//   2. the alternative STEP HOST — below. 1 pass-through, 5 redirects, 6
//      refusals.
//   3. the entry SNAPSHOT, taken by CombatSim.begin and restored by teardown,
//      which also puts the rng stream back.
//
// The load-bearing rule: it must not advance you toward E L I T E, which
// requires real kills. Crediting `commander.kills` or `commander.combatScore`
// would let a player grind the whole ladder in a training room, for free.

import type { StepHost } from './world-step.ts';
import type { NpcShip } from './npc.ts';
import type { DamageSource } from './combat.ts';
import type { PlayerPoolPoints } from './damage-units.ts';
import type { CommanderData } from './commander.ts';
import { MAX_FUEL, MAX_MISSILES } from '../constants/commander.ts';
import { CLEAN } from '../constants/law.ts';
import type { ExerciseFit } from './combat-sim.ts';
import * as THREE from 'three';

/**
 * What the host needs from the running exercise: seven verbs, no Game.
 *
 * It is an interface rather than a closure over `this`. So the exercise's whole
 * influence over the world step is a list you read in one screen.
 */
export interface ExerciseVerbs {
  fighting(): boolean;
  takeHit(amount: PlayerPoolPoints, from: THREE.Vector3, source: DamageSource): void;
  destroyNpc(npc: NpcShip): void;
  wreckNpc(npc: NpcShip): void;
  pullTrigger(): void;
  die(reason: string): void;
  say(text: string, seconds: number): void;
}

/** Layer 2: what the world step may and may not do during an exercise. */
export function exerciseStepHost(x: ExerciseVerbs): StepHost {
  return {
      inFlight: () => x.fighting(),
      applyPlayerDamage: (amount, from, source) => x.takeHit(amount, from, source),
      destroyNpc: (npc) => x.destroyNpc(npc),
      wreckNpc: (npc) => x.wreckNpc(npc),
      fireLaser: () => x.pullTrigger(),
      // An offence in a training room is not an offence. It is also what
      // scrambles the station's defence Vipers, which would fly 77,000 units to
      // join a fight the scenario did not author.
      raiseLegal: () => {},
      die: (reason) => x.die(reason),
      // Unreachable from the arena and refused anyway: docking pays a fine,
      // writes the save, clears the world blob and opens the station menu.
      dock: () => {},
      completeHyperspace: () => {
        x.say('HYPERSPACE IS OFFLINE IN THE SIMULATOR', 3);
      },
      completeRescue: () => {},
      openHermitTrade: () => {},
      autoSave: () => {},
  };
}

/**
 * Layer 1. The commander the exercise flies: a clone, with no cargo and no
 * reputation.
 *
 * What is DROPPED matters as much as what is kept:
 *
 *   - no cargo, so a breach cannot cost a tonne held for a contract, and a scan
 *     cannot read contraband;
 *   - no contracts, so a simulated pirate cannot tick a bounty job along;
 *   - no legal status, so an exercise cannot make you a Fugitive.
 *
 * `kills` and `combatScore` are COPIED rather than zeroed. They are the two
 * fields the rule is about. Copied, the exercise credits this clone exactly as
 * the game credits you. So the difference between the two objects afterwards is
 * the proof, rather than an absence of evidence.
 */
export function exerciseCommander(career: CommanderData, fit: ExerciseFit = {}): CommanderData {
  const c = structuredClone(career);
  c.cargo = c.cargo.map(() => 0);
  c.survivors = 0;
  c.contracts = [];
  c.legalStatus = CLEAN;
  c.trumbles = 0;
  c.fuel = MAX_FUEL;
  c.equipment = { ...c.equipment, ...(fit.equipment ?? {}) };
  c.missiles = Math.max(0, Math.min(MAX_MISSILES, Math.round(fit.missiles ?? career.missiles)));
  return c;
}
