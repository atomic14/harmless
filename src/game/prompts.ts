// What a key can do about what is happening RIGHT NOW.
//
// The game grew two keys in docs/TODO/122 and 123 that only matter for a few
// seconds at a time, and told a pilot about neither: `POLICE PATROL CLOSING`
// named a problem and no answer, while the answers — dump the evidence, or pay
// the man — lived in the `?` guide, the manual and the README, which are three
// places nobody is looking while a Viper closes on their narcotics.
//
// So this decides which commands are worth offering, and what each is worth
// this instant. It is the cockpit's half of what the help surfaces do at rest.
//
// TWO RULES hold it together:
//
//   - **A prompt carries a `Command`, never a letter.** `controls.ts` is the
//     one home of what key asks for what (invariant 9), so writing "PRESS B"
//     here would be a sixth surface free to lie the moment anything is rebound
//     — which is exactly what the strand message did before this file existed.
//     The label is looked up at the edge, in game.ts, through `boundKey`.
//   - **It is pure and it stays portable.** `ui/key-help.ts` is PLATFORM
//     (tools/portability.mjs); this module may not reach for it, and does not
//     need to. It prices things instead, because "press L to pay 141.0 Cr" is
//     the whole point and every price in the game is a pure function.
//
// Prompts are STATE, not messages: they are true while the situation is, and
// they have no timer. The console is deliberately one line — 122's verdict
// queues behind the scan for that reason — so they are painted somewhere else.

import type * as THREE from 'three';
import type { Command } from './controls.ts';
import { formatCredits, type CommanderData } from './commander.ts';
import {
  carryingContraband, inspectionPrice, patrolPrice, patrolReach,
} from './law.ts';
import { nearestEngaging, nearestNpc, type NpcShip } from './npc.ts';
import { PROMPT_LIMIT } from '../constants/console.ts';

/** One thing worth pressing, and what it does about this. */
export interface Prompt {
  /** which command — the KEY is the binding table's business, not this file's */
  readonly command: Command;
  /**
   * What pressing it does about the situation that raised it. Upper case and
   * terse: it sits beside a key on one line of a cockpit, not in a manual.
   */
  readonly what: string;
}

/**
 * Everything a prompt can be raised from.
 *
 * Deliberately a flat view rather than `GameState`: the rule reads a hold, a
 * record, a sky and two flags, and saying so is what lets a test raise a
 * situation without building a world.
 */
export interface PromptWorld {
  readonly commander: CommanderData;
  readonly playerPos: THREE.Vector3;
  readonly npcs: readonly NpcShip[];
  /** already read your hold this visit — `SessionState.policeScanned` */
  readonly policeScanned: boolean;
  readonly witchspace: boolean;
}

/**
 * What the cockpit should offer, most urgent first, capped at `PROMPT_LIMIT`.
 *
 * The order is the order below, and it is the ranking: a ship that is shooting
 * outranks one that is only close, and both outrank anything you could do at
 * your leisure. Nothing is offered that the ship cannot do — a prompt for a key
 * that answers NOT FITTED is worse than silence.
 */
export function flightPrompts(w: PromptWorld): Prompt[] {
  const out: Prompt[] = [];
  const c = w.commander;

  // A policeman already shooting: the most expensive problem in the game that
  // money can still answer. Priced off the rung you are on (`patrolPrice`), so
  // the line says what pressing the key will actually cost.
  if (nearestEngaging(w.npcs, w.playerPos, c.legalStatus, 'police')) {
    out.push({
      command: 'bribePolice',
      what: `PAY ${formatCredits(patrolPrice(c.legalStatus))} TO BREAK OFF`,
    });
  } else if (!w.policeScanned && !w.witchspace && carryingContraband(c.cargo)
    && inPatrolBand(w)) {
    // 122's window, and both answers to it — the order is what each costs: the
    // money first, because the tonne is gone for good and the credits are not.
    out.push({
      command: 'bribePolice',
      what: `PAY ${formatCredits(inspectionPrice(c.cargo))}`,
    });
    out.push({ command: 'jettisonContraband', what: 'DUMP THE EVIDENCE' });
  }

  return out.slice(0, PROMPT_LIMIT);
}

/**
 * Is a patrol close enough to be about to read you?
 *
 * `patrolReach` (law.ts) owns both ranges and the world step spends the same
 * function, so the prompt appears with the warning that prompts it rather than
 * on a range of its own.
 */
function inPatrolBand(w: PromptWorld): boolean {
  const cop = nearestNpc(w.npcs, w.playerPos, (npc) => npc.role === 'police');
  return cop !== null && patrolReach(cop.distance) !== 'none';
}
