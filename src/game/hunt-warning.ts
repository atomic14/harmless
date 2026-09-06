// What her gun is worth against the ship she is sent to kill, in two numbers.
//
// DERIVED, every time, through the same two functions a live shot goes
// through. The first is the fitted laser's byte (`playerLaser`). The second is
// what a hit off it is worth against the target's own profile
// (`playerLaserDamage`, which is the oracle). Nothing here restates a rule,
// and nothing here CHANGES one.
//
// It was the back half of `game/missions.ts` until docs/TODO/190 M2 replaced
// that machine. The Constrictor is still the case that made it necessary. TODO
// 29 rules the Constrictor's source-exact halving untouchable, and calls this
// a signpost problem instead. It is a signpost problem with teeth. The
// Constrictor halves a player hit BEFORE its three points of defence subtract:
//
//   - a BEAM laser's 7 becomes 3, and does exactly nothing;
//   - a pulse laser scores 1, and needs 115 unbroken hits;
//   - only the military laser's 3 kills it in a reasonable time.
//
// The one thing a commander must not do is fly forty light years to find that
// out. The beam laser is the trap: it is the upgrade, and it is worse here
// than the gun it replaced.

import type { CommanderData, LaserType } from './commander.ts';
import { playerLaser } from './gunnery.ts';
import { npcEnergyPolicy, playerLaserDamage } from './npc-energy.ts';
import { CONSTRICTOR_SPEC, type NpcSpec } from './ship-specs.ts';

export interface GunCheck {
  fitted: LaserType;
  perHit: number;
  best: LaserType;
  bestPerHit: number;
}

/** What each laser this hull can mount is worth against `target`. */
export function huntGunCheck(commander: CommanderData, target: NpcSpec): GunCheck {
  const policy = npcEnergyPolicy(target.profileId);
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
 * The patron's word on what the job needs, beyond where to go.
 *
 * It states two NUMBERS and lets the commander decide. It issues no
 * instruction. It returns '' when she already holds the best gun for the job.
 * So the line means something on the day it appears, rather than a line the
 * player learns to skip.
 */
export function huntWarning(commander: CommanderData, target: NpcSpec, patron = 'NAVY'): string {
  const g = huntGunCheck(commander, target);
  if (g.fitted === g.best) return '';
  return `${patron}: TARGET ARMOUR HALVES LASER FIRE — YOUR ${g.fitted.toUpperCase()} LASER`
    + ` SCORES ${g.perHit} A HIT, A ${g.best.toUpperCase()} LASER ${g.bestPerHit}`;
}

/** The Constrictor's own check, which is the case TODO 29 named. */
export function constrictorGunCheck(commander: CommanderData): GunCheck {
  return huntGunCheck(commander, CONSTRICTOR_SPEC);
}

/** ...and its warning, which test/ui.test.ts measures for length. */
export function constrictorWarning(commander: CommanderData): string {
  return huntWarning(commander, CONSTRICTOR_SPEC);
}
