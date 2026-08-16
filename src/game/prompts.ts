// What a key can do about the situation RIGHT NOW.
//
// docs/TODO/122 and 123 grew two keys that only matter for a few seconds at a
// time, and the game told a pilot about neither. `POLICE PATROL CLOSING` named
// a problem and no answer. The two answers — dump the evidence, or pay the man
// — lived in the `?` guide, the manual and the README. Nobody reads any of
// those three while a Viper closes on their narcotics.
//
// So this file decides which commands are worth an offer, and what each is
// worth this instant. It is the cockpit's half of what the help surfaces do at
// rest.
//
// TWO RULES hold it together:
//
//   - **A prompt carries a `Command`, never a letter.** `controls.ts` is the
//     one home of what key asks for what (invariant 9). "PRESS B" written here
//     would be a sixth surface, free to lie the moment anything is rebound.
//     That is exactly what the strand message did before this file existed.
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
import type { NpcShip } from './npc.ts';
import { nearestEngaging, nearestNpc } from './hostility.ts';
import { PROMPT_LIMIT } from '../constants/console.ts';
import { DISREPUTE_BRIBE } from '../constants/character.ts';
import { DOCK_COMPUTER_RANGE } from '../constants/docking-computer.ts';
import { WITCHSPACE_ESCAPE_COST } from '../constants/jump.ts';
import { ECM_ENERGY_COST } from '../constants/ordnance.ts';

/** One key worth a press, and what it does about this. */
export interface Prompt {
  /** which command — the KEY is the binding table's business, not this file's */
  readonly command: Command;
  /**
   * What one press does about the situation that raised it. Upper case and
   * terse: it sits beside a key on one line of a cockpit, not in a manual.
   */
  readonly what: string;
}

/**
 * Everything a prompt can be raised from.
 *
 * Deliberately a flat view rather than `GameState`. The rule reads a hold, a
 * record, a sky and two flags. This shape states that, and the statement is
 * what lets a test raise a situation with no world behind it.
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
  /** a hostile warhead runs at you — `Ordnance.missileInbound` */
  readonly missileInbound: boolean;
  /** the beacon is already on the air, so there is nothing left to send */
  readonly beaconSent: boolean;
  /** how far off the station is; in witch-space it is banished out of reach */
  readonly stationDistance: number;
  /** the docking computer already has the ship — `SessionState.dcEngaged` */
  readonly dcEngaged: boolean;
}

/**
 * What a bribe costs besides the money, when it costs anything.
 *
 * Every offer moves `disrepute` by `DISREPUTE_BRIBE`, whether he takes it or
 * turns you in (law.ts). Until now the console only said so AFTER the key was
 * pressed. The design of that feature is that the credits are not the
 * expensive half, so the prompt says it first.
 *
 * It reads the constant rather than a fixed phrase. Retune the deed to
 * nothing, and the prompt stops the claim of a price the law no longer
 * charges.
 */
const REPUTATION_COST = DISREPUTE_BRIBE > 0 ? ' AND YOUR REPUTATION' : '';

/**
 * What the cockpit should offer, most urgent first, capped at `PROMPT_LIMIT`.
 *
 * The order is the order below, and it is the ranking. A ship that shoots
 * outranks one that is merely close. Both outrank anything you could do at
 * your leisure.
 *
 * It offers nothing that the ship cannot do. A prompt for a key that answers
 * NOT FITTED is worse than silence.
 */
export function flightPrompts(w: PromptWorld): Prompt[] {
  const out: Prompt[] = [];
  const c = w.commander;

  // A warhead already in the air. First of everything, because it is the only
  // problem on this list measured in seconds. It is gated on both of the
  // E.C.M.'s own refusals (`triggerEcm`). With no unit fitted, or with a bank
  // too flat to fire it, the cockpit has nothing to offer.
  if (w.missileInbound && c.equipment.ecm && w.energy > ECM_ENERGY_COST) {
    out.push({ command: 'fireEcm', what: 'FIRE E.C.M.' });
  }

  // A policeman with his guns already on you. It is the most expensive problem
  // in the game that money can still answer. It is priced off the rung you are
  // on (`patrolPrice`), so the line says what one press will really cost.
  const hunter = nearestEngaging(
    w.npcs, w.playerPos, c.legalStatus, 'police', w.stationDistance);
  if (hunter) {
    out.push({
      command: 'bribePolice',
      what: `PAY ${formatCredits(patrolPrice(c.legalStatus))}${REPUTATION_COST} TO BREAK OFF`,
    });
  }

  // Pirates came for the cargo, not for you. A tonne over the side is what
  // makes an opportunist break off (jettison.ts). It sits below the fight the
  // law is in, because a Viper you did not pay shoots on whatever you dump.
  //
  // `stationDistance` is the truce's own measurement (game/law.ts), and this
  // view already carries it for the docking prompt. Inside the truce no pirate
  // engages, so the cockpit offers no tonne over the side.
  if (nearestEngaging(w.npcs, w.playerPos, c.legalStatus, 'pirate', w.stationDistance)
    && holdHasCargo(c.cargo)) {
    out.push({ command: 'jettison1', what: 'JETTISON A TONNE' });
  }

  // 122's window, and both answers to it. The order is what each costs: the
  // money first, because the tonne is gone for good and the credits are not.
  //
  // `!hunter` for the same reason the key itself takes the fight first
  // (game.ts, `bribePolice`). One press buys ONE ship. So the inspection price
  // offered beside a Viper with its guns up would quote a figure L will not
  // charge.
  if (!hunter && !w.policeScanned && !w.witchspace && carryingContraband(c.cargo)
    && inPatrolBand(w)) {
    out.push({
      command: 'bribePolice',
      what: `PAY ${formatCredits(inspectionPrice(c.cargo))}${REPUTATION_COST}`,
    });
    out.push({ command: 'jettisonContraband', what: 'DUMP THE EVIDENCE' });
  }

  // Stranded in witch-space. No clock runs against you, and nothing else will
  // happen either. So it sits below anything with its guns up. This is the one
  // home of "stranded" now. The world step used to say it in a message with
  // the letter B written into the words.
  if (w.witchspace && c.fuel < WITCHSPACE_ESCAPE_COST && !w.beaconSent) {
    out.push({ command: 'distressBeacon', what: 'DISTRESS BEACON — NO FUEL TO JUMP' });
  }

  // ...and last, the only one that is not about trouble: the aid you paid for.
  // It is offered exactly where `toggleDocking` would accept the job, rather
  // than at a range of this file's own.
  if (c.equipment.dockingComputer && !w.dcEngaged
    && w.stationDistance <= DOCK_COMPUTER_RANGE) {
    out.push({ command: 'toggleDockingComputer', what: 'DOCKING COMPUTER' });
  }

  return out.slice(0, PROMPT_LIMIT);
}

/**
 * Is a patrol close enough to be about to read you?
 *
 * `patrolReach` (law.ts) owns both ranges, and the world step spends the same
 * function. So the prompt appears with the warning that raises it, rather than
 * on a range of its own.
 */
function inPatrolBand(w: PromptWorld): boolean {
  const cop = nearestNpc(w.npcs, w.playerPos, (npc) => npc.role === 'police');
  return cop !== null && patrolReach(cop.distance) !== 'none';
}
