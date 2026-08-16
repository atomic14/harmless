// The jump: what it costs, whether you can make it, and where you come out.
//
// Four separate concerns were interleaved across two methods of game.ts:
//
//   1. the countdown;
//   2. the fuel;
//   3. the days that pass;
//   4. the roll that drops you into witch-space.
//
// They shared one `if (this.witchspace)` between them.
//
// Witch-space is the awkward case. The target is *retained* for an escape jump,
// and that jump costs a flat rate rather than the chart distance. One statement
// of that, here, is most of the reason this file exists.
//
// The metric itself is galaxy/navigation.ts, and the numbers are
// constants/jump.ts. This is the transaction.

import type { CommanderData } from './commander.ts';
import { generateGalaxy, type StarSystem } from '../galaxy/galaxy.ts';

import {
  distanceTenths, daysForJump, witchspaceChance, nearestSystemTo,
} from '../galaxy/navigation.ts';
import { WITCHSPACE_ESCAPE_COST } from '../constants/jump.ts';
import { random } from './rng.ts';

export type Refusal = 'alreadyJumping' | 'noTarget' | 'noFuel';

/** Fuel for a jump, in tenths of a LY. An escape from a mis-jump is flat. */
export function jumpCost(
  from: StarSystem, to: StarSystem, witchspace: boolean,
): number {
  return witchspace ? WITCHSPACE_ESCAPE_COST : distanceTenths(from, to);
}

/**
 * May the drive spin up? Pure — it answers, it does not start anything.
 *
 * @param target the chart's selected system, or null
 * @param free test mode's JUMP ANYWHERE (docs/TODO/121). The tank is no longer
 *   a reason to refuse.
 *
 *   It is read HERE, where the refusal is decided, rather than copied into the
 *   chart screen. So the rule keeps one home, and a test asks it both ways as
 *   an argument.
 *
 *   It lifts ONLY the fuel refusal. No target is still no target. A countdown
 *   under way is still a countdown under way.
 *
 *   The jump is charged either way, and `resolveJump` takes what is in the
 *   tank. A free jump that also left the gauge full would be two changes.
 */
export function checkJump(
  commander: CommanderData,
  systems: readonly StarSystem[],
  target: number | null,
  witchspace: boolean,
  countdownRunning: boolean,
  free = false,
): { ok: true; cost: number } | { ok: false; reason: Refusal } {
  if (countdownRunning) return { ok: false, reason: 'alreadyJumping' };
  if (target === null || target === commander.systemIndex) {
    return { ok: false, reason: 'noTarget' };
  }
  const cost = jumpCost(systems[commander.systemIndex], systems[target], witchspace);
  if (cost > commander.fuel && !free) return { ok: false, reason: 'noFuel' };
  return { ok: true, cost };
}

export function refusalMessage(reason: Refusal, witchspace: boolean): string {
  if (reason === 'noTarget') return 'NO HYPERSPACE TARGET SET';
  return witchspace
    ? 'INSUFFICIENT FUEL — STRANDED IN WITCH-SPACE'
    : 'TARGET OUT OF FUEL RANGE';
}

export interface JumpResult {
  /** the drive threw you into limbo; the target is retained for the escape */
  misjump: boolean;
  /** days that passed — zero for a mis-jump, which gets you nowhere */
  days: number;
}

/**
 * Spend the fuel and make the jump.
 *
 * It mutates the commander's fuel, day and system. The caller advances the
 * living galaxy by `days`, and rebuilds the world, because those two are its
 * own.
 *
 * A mis-jump still charges full fare. That is the original's cruelty and it is
 * the point: the fuel is gone and you are nowhere.
 */
export function resolveJump(
  commander: CommanderData,
  systems: readonly StarSystem[],
  target: number,
  witchspace: boolean,
  rng: () => number = random,
): JumpResult {
  const here = systems[commander.systemIndex];

  if (witchspace) {
    // an escape from limbo costs a flat rate, and cannot itself mis-jump
    commander.fuel -= Math.min(commander.fuel, WITCHSPACE_ESCAPE_COST);
  } else {
    // Floored, as the escape jump above already is. Ordinarily it changes
    // nothing, because `checkJump` refused anything the tank cannot cover.
    // Test mode's free jump reaches here with a cost it cannot pay. A NEGATIVE
    // tank is a number no gauge, shop or chart in the game reads correctly. So
    // it takes what is there and no more.
    commander.fuel -= Math.min(commander.fuel, distanceTenths(here, systems[target]));
    if (rng() < witchspaceChance(commander.mission.stage)) {
      return { misjump: true, days: 0 };
    }
  }

  const days = daysForJump(distanceTenths(here, systems[target]));
  commander.day += days;
  commander.systemIndex = target;
  return { misjump: false, days };
}

/** Refusals the galactic drive can give, as distinct from the ordinary jump's. */
export type GalacticRefusal = 'noDrive' | 'inExercise';

export interface GalacticJump {
  /** the galaxy you arrive in, 1..8 */
  galaxy: number;
  /** systems of that galaxy, generated */
  systems: StarSystem[];
  /** where you come out: nearest system to the coordinates you left from */
  systemIndex: number;
}

/**
 * The one-shot jump to the next galaxy.
 *
 * This lived in `game.ts` while the ordinary jump lived here. That is one
 * concept with two homes. No test could reach the half in `game.ts`, because a
 * `Game` needs a canvas.
 *
 * It is four rules, and all four are the original's:
 *
 *   1. the drive is consumed, because it is one-shot;
 *   2. the galaxy wraps 8 back to 1;
 *   3. the systems are regenerated rather than stored;
 *   4. you arrive at whichever system in the NEW galaxy sits nearest the
 *      coordinates you left.
 *
 * So a galactic jump moves you sideways, not home.
 *
 * It mutates the commander's galaxy, drive and system. The caller regenerates
 * the world and says the line, because those two are its own.
 */
export function resolveGalacticJump(
  commander: CommanderData, from: StarSystem,
): GalacticJump {
  commander.equipment.galacticDrive = false;
  commander.galaxy = (commander.galaxy % 8) + 1;
  const systems = generateGalaxy(commander.galaxy);
  commander.systemIndex = nearestSystemTo(from, systems).index;
  return { galaxy: commander.galaxy, systems, systemIndex: commander.systemIndex };
}

/** May the galactic drive fire? Pure — it answers, it does not start anything. */
export function checkGalacticJump(
  commander: CommanderData, inExercise: boolean,
): { ok: true } | { ok: false; reason: GalacticRefusal } {
  // The refusal is not for safety. The exercise clone owns the drive it would
  // burn, and the entry snapshot puts the galaxy back. It is refused because an
  // arrival reseeds the world and rebuilds the scene. That would end the fight
  // in a system the report never mentions.
  if (inExercise) return { ok: false, reason: 'inExercise' };
  if (!commander.equipment.galacticDrive) return { ok: false, reason: 'noDrive' };
  return { ok: true };
}

export function galacticRefusalMessage(reason: GalacticRefusal): string {
  return reason === 'inExercise'
    ? 'HYPERSPACE IS OFFLINE IN THE SIMULATOR'
    : 'NO GALACTIC HYPERDRIVE FITTED';
}
