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
import { holdHasCargo } from './jettison.ts';
import {
  carryingContraband, inspectionPrice, patrolPrice, patrolReach,
} from './law.ts';
import { nearestEngaging, nearestNpc, type NpcShip } from './npc.ts';
import { PROMPT_LIMIT } from '../constants/console.ts';
import { DISREPUTE_BRIBE } from '../constants/character.ts';
import { DOCK_COMPUTER_RANGE } from '../constants/docking-computer.ts';
import { WITCHSPACE_ESCAPE_COST } from '../constants/jump.ts';
import { ECM_ENERGY_COST } from '../constants/ordnance.ts';

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
  /** the energy bank, because the E.C.M. refuses a burst it cannot pay for */
  readonly energy: number;
  /** a hostile warhead is homing on you — `Ordnance.missileInbound` */
  readonly missileInbound: boolean;
  /** the beacon is already broadcasting, so there is nothing left to send */
  readonly beaconSent: boolean;
  /** how far off the station is; in witch-space it is banished out of reach */
  readonly stationDistance: number;
  /** the docking computer is already flying — `SessionState.dcEngaged` */
  readonly dcEngaged: boolean;
}

/**
 * What a bribe costs besides the money, when it costs anything.
 *
 * Every offer moves `disrepute` by `DISREPUTE_BRIBE` whether he takes it or
 * turns you in (law.ts), and until now the console only said so AFTER the key
 * was pressed. The design of that feature is that the credits are not the
 * expensive half, so the prompt says it first.
 *
 * Read off the constant rather than written as a fixed phrase: retune the deed
 * to nothing and the prompt stops claiming a price the law no longer charges.
 */
const CHARACTER_COST = DISREPUTE_BRIBE > 0 ? ' AND YOUR CHARACTER' : '';

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

  // A warhead already in the air. First of everything, because it is the only
  // problem on this list measured in seconds — and gated on both of the
  // E.C.M.'s own refusals (`triggerEcm`): no unit fitted, or a bank too flat to
  // fire it, and the cockpit has nothing to offer.
  if (w.missileInbound && c.equipment.ecm && w.energy > ECM_ENERGY_COST) {
    out.push({ command: 'fireEcm', what: 'FIRE E.C.M.' });
  }

  // A policeman already shooting: the most expensive problem in the game that
  // money can still answer. Priced off the rung you are on (`patrolPrice`), so
  // the line says what pressing the key will actually cost.
  const hunter = nearestEngaging(
    w.npcs, w.playerPos, c.legalStatus, 'police', w.stationDistance);
  if (hunter) {
    out.push({
      command: 'bribePolice',
      what: `PAY ${formatCredits(patrolPrice(c.legalStatus))}${CHARACTER_COST} TO BREAK OFF`,
    });
  }

  // Pirates came for the cargo, not for you, and a tonne over the side is what
  // makes an opportunist break off (jettison.ts). Below the fight the law is
  // in, because a Viper you have not paid keeps shooting whatever you dump.
  // `stationDistance` is the truce's own measurement (game/law.ts), and it is
  // already on this view for the docking prompt. Inside the truce no pirate is
  // engaging, so the cockpit offers no tonne over the side.
  if (nearestEngaging(w.npcs, w.playerPos, c.legalStatus, 'pirate', w.stationDistance)
    && holdHasCargo(c.cargo)) {
    out.push({ command: 'jettison1', what: 'JETTISON A TONNE' });
  }

  // 122's window, and both answers to it — the order is what each costs: the
  // money first, because the tonne is gone for good and the credits are not.
  //
  // `!hunter` for the same reason the key itself takes the fight first
  // (game.ts, `bribePolice`): one press buys ONE ship, so offering the
  // inspection price beside a Viper that is shooting would quote a figure L
  // will not charge.
  if (!hunter && !w.policeScanned && !w.witchspace && carryingContraband(c.cargo)
    && inPatrolBand(w)) {
    out.push({
      command: 'bribePolice',
      what: `PAY ${formatCredits(inspectionPrice(c.cargo))}${CHARACTER_COST}`,
    });
    out.push({ command: 'jettisonContraband', what: 'DUMP THE EVIDENCE' });
  }

  // Stranded in witch-space: nothing is chasing the clock, but nothing else is
  // going to happen either, so it sits below anything that is shooting. This is
  // the one home of "stranded" now — the world step used to say it in a message
  // with the letter B written into the words.
  if (w.witchspace && c.fuel < WITCHSPACE_ESCAPE_COST && !w.beaconSent) {
    out.push({ command: 'distressBeacon', what: 'DISTRESS BEACON — NO FUEL TO JUMP' });
  }

  // ...and last, the only one that is not about trouble: the aid you paid for,
  // offered exactly where `toggleDocking` would accept the job rather than at a
  // range of this file's own.
  if (c.equipment.dockingComputer && !w.dcEngaged
    && w.stationDistance <= DOCK_COMPUTER_RANGE) {
    out.push({ command: 'toggleDockingComputer', what: 'DOCKING COMPUTER' });
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
