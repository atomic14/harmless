// The Navy mission: find the Constrictor, kill it, carry the plans home.
//
// A five-stage state machine. It was spread across three private methods of
// game.ts and one branch of destroyNpc. One piece got out: the raised mis-jump
// chance on the courier run, which already sat in galaxy/navigation.ts. That
// stray was the clue that the rest belonged somewhere.
//
// Pure: it takes the commander and the galaxy, and returns what happened. The
// Game announces it and pays it, because credits and legal status are its
// business. That also means the headless campaign can score the mission, which
// it could not do before.
//
//   stage 0     not started — needs 16 kills, and galaxy 1
//   stage 1     the hunt for the Constrictor at a known system
//   stage 2     destroyed; report back for the next orders
//   stage 3     the plans, on their way to a named system
//   stage 4     done

import type { CommanderData } from './commander.ts';
import type { BlueprintOverride } from './blueprint-set.ts';
import type { StarSystem } from '../galaxy/galaxy.ts';
import { distanceTenths } from '../galaxy/navigation.ts';
import { playerLaser } from './gunnery.ts';
import { npcEnergyPolicy, playerLaserDamage } from './npc-energy.ts';
import { random } from './rng.ts';
import { CONSTRICTOR_SPEC } from './ship-specs.ts';
import type { LaserType } from './commander.ts';
import {
  CONSTRICTOR_BOUNTY, COURIER_PAYMENT, MISSION_COURIER_RANGE,
  MISSION_HUNT_RANGE, MISSION_KILL_THRESHOLD,
} from '../constants/missions.ts';

export type MissionEvent =
  | { kind: 'briefed'; target: number }
  | { kind: 'courierOrders'; target: number }
  | { kind: 'delivered'; payment: number }
  | { kind: 'constrictorDestroyed'; bounty: number };

/** A system between `min` and `max` tenths away, or null if the galaxy has none. */
function pickTarget(
  systems: readonly StarSystem[], here: StarSystem, currentIndex: number,
  range: { min: number; max: number }, rng: () => number,
): number | null {
  const candidates = systems.filter((s) => {
    const d = distanceTenths(here, s);
    return s.index !== currentIndex && d >= range.min && d <= range.max;
  });
  if (!candidates.length) return null;
  return candidates[Math.floor(rng() * candidates.length)].index;
}

/**
 * Advance the mission on docking. Mutates `commander.mission`, and reports
 * what changed so the Game can announce and pay it.
 */
export function stepMissionAtDock(
  commander: CommanderData,
  systems: readonly StarSystem[],
  rng: () => number = random,
): MissionEvent[] {
  const m = commander.mission;
  const here = systems[commander.systemIndex];
  const events: MissionEvent[] = [];

  if (m.stage === 0 && commander.kills >= MISSION_KILL_THRESHOLD && commander.galaxy === 1) {
    const target = pickTarget(systems, here, commander.systemIndex, MISSION_HUNT_RANGE, rng);
    if (target !== null) {
      m.targetIndex = target;
      m.stage = 1;
      events.push({ kind: 'briefed', target });
    }
  } else if (m.stage === 2) {
    const target = pickTarget(systems, here, commander.systemIndex, MISSION_COURIER_RANGE, rng);
    if (target !== null) {
      m.targetIndex = target;
      m.stage = 3;
      events.push({ kind: 'courierOrders', target });
    }
  } else if (m.stage === 3 && m.targetIndex === commander.systemIndex) {
    m.stage = 4;
    m.targetIndex = null;
    commander.credits += COURIER_PAYMENT;
    events.push({ kind: 'delivered', payment: COURIER_PAYMENT });
  }
  return events;
}

/** The Constrictor died. @returns the event, or null if it was not the target. */
export function constrictorDestroyed(
  commander: CommanderData,
): { kind: 'constrictorDestroyed'; bounty: number } | null {
  if (commander.mission.stage !== 1) return null;
  commander.mission.stage = 2;
  commander.mission.targetIndex = null;
  commander.credits += CONSTRICTOR_BOUNTY;
  return { kind: 'constrictorDestroyed', bounty: CONSTRICTOR_BOUNTY };
}

/** Does the Constrictor wait in this system right now? */
export function constrictorLurksHere(commander: CommanderData): boolean {
  return commander.mission.stage === 1
    && commander.mission.targetIndex === commander.systemIndex;
}

/**
 * Which released blueprint override this mission puts in force, or null.
 *
 * The released game overrode the blueprint file on two of these five stages.
 * Both facts are the mission's rather than the chooser's. `blueprint-set.ts`
 * says in its header that something tells it which override applies, and that
 * it never works one out. So the stage numbers stay in this file, which is
 * their one home.
 *
 *   stage 1, AT the target     the Constrictor's system, which always flies
 *                              set G
 *   stage 3                    the courier run, and the Thargoids want the
 *                              plans back
 *
 * The third case is not a mission fact at all. Witch-space takes the same
 * override, and the Game names that one, because the flag is the Game's.
 */
export function missionBlueprintOverride(
  commander: CommanderData,
): BlueprintOverride | null {
  if (constrictorLurksHere(commander)) return 'constrictor';
  if (commander.mission.stage === 3) return 'thargoid';
  return null;
}

/**
 * What each laser this hull can mount is worth against the Constrictor.
 *
 * DERIVED, every time, through the same two functions a live shot goes
 * through. The first is the fitted laser's byte (`playerLaser`). The second is
 * what a hit off it is worth against the target's own profile
 * (`playerLaserDamage`, which is the oracle).
 *
 * Nothing here restates a rule, and nothing here CHANGES one. TODO 29 rules
 * the Constrictor's source-exact half untouchable, and calls this a signpost
 * problem instead.
 *
 * It is a signpost problem with teeth. The Constrictor halves a player hit
 * BEFORE its three points of defence subtract. So the three guns land like
 * this:
 *
 *   - a BEAM laser's 7 becomes 3, and does exactly nothing;
 *   - a pulse laser scores 1, and needs 115 unbroken hits;
 *   - only the military laser's 3 kills it in a reasonable time.
 *
 * That is the original's own outcome. The one thing a commander must not do is
 * fly forty light years to find it out. The beam laser is the trap: it is the
 * upgrade, and it is worse here than the gun it replaced.
 */
export function constrictorGunCheck(
  commander: CommanderData,
): { fitted: LaserType; perHit: number; best: LaserType; bestPerHit: number } {
  const policy = npcEnergyPolicy(CONSTRICTOR_SPEC.profileId);
  const bite = (type: LaserType): number =>
    playerLaserDamage(policy, playerLaser(commander.shipId, type).hit);
  const MOUNTS: LaserType[] = ['pulse', 'beam', 'military'];
  const best = MOUNTS.reduce((a, b) => (bite(b) > bite(a) ? b : a));
  return {
    fitted: commander.equipment.laser,
    perHit: bite(commander.equipment.laser),
    best,
    bestPerHit: bite(best),
  };
}

/**
 * What the Navy tells you about the job, beyond where to go.
 *
 * It states two NUMBERS and lets the commander decide. It issues no
 * instruction. The first number is what her gun scores against this hull. The
 * second is what the best gun she could fit scores. Both come from the oracle.
 *
 * It returns '' when she already holds the best gun for the job. So the line
 * means something on the day it appears, rather than a line the player learns
 * to skip.
 */
export function constrictorWarning(commander: CommanderData): string {
  const g = constrictorGunCheck(commander);
  if (g.fitted === g.best) return '';
  return `NAVY: TARGET ARMOUR HALVES LASER FIRE — YOUR ${g.fitted.toUpperCase()} LASER`
    + ` SCORES ${g.perHit} A HIT, A ${g.best.toUpperCase()} LASER ${g.bestPerHit}`;
}

/**
 * The standing order itself, without the gun warning that may ride with it.
 *
 * Split out of `missionHeadline` by docs/TODO/144. A screen row wants the order
 * in one cell and the warning under it; one line wants both joined. The words
 * stay here either way, which is the one home rule.
 */
export function missionOrderLine(
  commander: CommanderData, systems: readonly StarSystem[],
): string {
  const m = commander.mission;
  if (m.targetIndex === null) return '';
  const where = systems[m.targetIndex].name.toUpperCase();
  if (m.stage === 1) return `NAVY MISSION: DESTROY THE CONSTRICTOR — LAST SEEN AT ${where}`;
  if (m.stage === 3) return `NAVY MISSION: DELIVER THE PLANS TO ${where}`;
  return '';
}

/**
 * Where the Navy sends her, or null when it sends her nowhere.
 *
 * The charts mark it (docs/TODO/144 M4), and the standing orders report it. It
 * is deliberately NOT a direct read of `mission.targetIndex`. Stage 2 and
 * stage 4 both clear that field. A caller that read it raw would need to know
 * which stages mean anything.
 */
export function missionDestination(commander: CommanderData): number | null {
  const m = commander.mission;
  if (m.stage === 1 || m.stage === 3) return m.targetIndex;
  return null;
}

/** The leg the Navy has her on: where, for how much, and what it needs. */
export interface MissionLeg {
  /** the order in words, upper case, WITHOUT the warning */
  readonly line: string;
  readonly destination: number;
  /** what the leg pays on completion, in tenths of a credit */
  readonly reward: number;
  /** what her gun is worth against the target, or '' when it will do */
  readonly warning: string;
}

/**
 * Every fact about the live leg at once, or null when no leg runs.
 *
 * ONE reader rather than four, because the four cannot disagree. The line, the
 * destination, the fee and the warning all answer for stages 1 and 3. A caller
 * that assembled them itself would need to handle three combinations that the
 * machine cannot produce.
 *
 * The fee comes off the same two constants that `stepMissionAtDock` and
 * `constrictorDestroyed` pay from. So a screen cannot quote a price the
 * mission does not settle. The warning is a stage 1 fact: it prices a gun
 * against the Constrictor's hull, and by stage 3 that ship is wreckage.
 */
export function missionLeg(
  commander: CommanderData, systems: readonly StarSystem[],
): MissionLeg | null {
  const destination = missionDestination(commander);
  if (destination === null) return null;
  const stage1 = commander.mission.stage === 1;
  return {
    line: missionOrderLine(commander, systems),
    destination,
    reward: stage1 ? CONSTRICTOR_BOUNTY : COURIER_PAYMENT,
    warning: stage1 ? constrictorWarning(commander) : '',
  };
}

/** The mission line for the docked menu, or '' when there is nothing to say. */
export function missionHeadline(
  commander: CommanderData, systems: readonly StarSystem[],
): string {
  const leg = missionLeg(commander, systems);
  if (!leg) return '';
  return leg.line + (leg.warning ? ` · ${leg.warning.replace('NAVY: ', '')}` : '');
}
