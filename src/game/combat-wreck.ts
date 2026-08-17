// What a destroyed ship pays, and what it leaves in the sky.
//
// The other half of `combat.ts`. That file decides what a shot FOUND and what
// the hit costs. This one decides what happens once a hull is finished.
//
// It is two rules, and the split between them is the whole point:
//
// 1. `wreckShip` takes a ship out of the sky, with no credit to anyone. An NPC
//    killed by another NPC, or by a collision, goes through here alone. That is
//    what stops a bounty for a fight the commander only watched.
// 2. `destroyShip` is the player-credited path. It calls the first, and then
//    adds the bounty, the kill, the rating, the record, the contract and the
//    reputation.
//
// IT CAME OUT OF `combat.ts` WHEN THAT FILE CROSSED 400 LINES (docs/TODO/173
// M2). The seam was already in that file's header, which lists this exact chain
// of consequences. `combat-player.ts` left the same file on the same argument
// in docs/TODO/156.
//
// THEY ARE FREE FUNCTIONS OVER A WORLD rather than methods, for the reason
// `combat.ts` states about itself: each ingredient is passed. `Combat` keeps
// two delegators, so `combat.destroy(...)` still reads the same at all four
// call sites outside this file.
//
// A module decides and returns an event; an orchestrator applies the
// consequence (invariant 15). Neither function here applies anything.

import type { World } from './world.ts';
import type { NpcShip } from './npc.ts';
import { type CommanderData, formatCredits, killValue } from './commander.ts';
import { offenceFor } from './law.ts';
import { FUGITIVE, CONTRABAND } from '../constants/law.ts';
import { constrictorDestroyed } from './missions.ts';
import { random, randomInt } from './rng.ts';
import { heard, later, say, type CombatEvent } from './combat-events.ts';
import {
  ESCAPE_CHANCE, HERMIT_CONTRABAND_MIN, HERMIT_CONTRABAND_SPAN,
  MINING_YIELD_MIN, MINING_YIELD_SPAN,
} from '../constants/wreck.ts';
import { CHARACTER_LINE_SECONDS, DISREPUTE_HERMIT_KILL, DISREPUTE_MURDER }
  from '../constants/character.ts';
import { afterDeed, characterVerdict } from './character.ts';
import { ORE, ORDINARY_GOODS } from '../constants/commodities.ts';

/**
 * Destruction credited to the player: bounty, kills, rating, legal status,
 * contract progress and the Navy mission.
 */
export function destroyShip(
  world: World, commander: CommanderData, npc: NpcShip,
): CombatEvent[] {
  const out = wreckShip(world, npc);
  const c = commander;

  if (npc.role !== 'asteroid') {
    c.kills += 1;
    // rating counts difficulty, not bodies: see killValue()
    c.combatScore += killValue(npc.state.threatTier);
  }

  if (npc.role === 'pirate') {
    for (const k of c.contracts) {
      if (k.kind !== 'bounty' || k.destination !== c.systemIndex) continue;
      if (k.progress >= k.qty) continue;
      k.progress += 1;
      if (k.progress >= k.qty) {
        out.push(say('BOUNTY CONTRACT COMPLETE — RETURN TO A STATION', 5));
      }
    }
  }

  const crime = offenceFor(npc.role, true);
  out.push({ kind: 'offence', level: crime });
  // ...and the other direction. A pirate down is police work, and it pays a
  // record off a rung at a time (docs/TODO/160). It is pushed for every kill
  // and answered by the rule, which is what keeps the role list in one file.
  out.push({ kind: 'atonement', role: npc.role });

  // What it does to your REPUTATION, which the fine will not wash off. To
  // crack a hermit marks a career; so does the destruction of any lawful ship
  // (the Fugitive-grade offence). Reached only through this function, the
  // player-credited path.
  const wasDisrepute = c.disrepute ?? 0;
  if (npc.role === 'hermit') {
    c.disrepute = afterDeed(wasDisrepute, DISREPUTE_HERMIT_KILL);
  } else if (crime === FUGITIVE) {
    c.disrepute = afterDeed(wasDisrepute, DISREPUTE_MURDER);
  }
  // ...and what THAT is called, once the bounty and the record are read
  // (docs/TODO/129). Either deed is 40, so it can cross two rungs at
  // once; `characterVerdict` names the one you landed on, not each one you
  // passed through.
  const verdict = characterVerdict(wasDisrepute, c.disrepute ?? 0);
  if (verdict) out.push(later(verdict, CHARACTER_LINE_SECONDS));

  if (npc.bounty > 0) {
    c.credits += npc.bounty;
    out.push(say(`BOUNTY: ${formatCredits(npc.bounty)}`, 3));
  }
  if (npc.role === 'asteroid' && c.equipment.miningLaser) {
    world.cargo.spawn(npc.object.position,
      MINING_YIELD_MIN + randomInt(MINING_YIELD_SPAN), ORE);
  }
  if (npc.state.isMissionTarget) {
    const e = constrictorDestroyed(c);
    if (e) {
      out.push(say(`CONSTRICTOR DESTROYED — ${formatCredits(e.bounty)} NAVY BOUNTY`, 6));
    }
  }
  return out;
}

/**
 * Take a ship out of the sky, with no credit to anyone.
 *
 * This is the shared path. An NPC killed by another NPC, or by a collision,
 * goes through here and NOT through `destroyShip`. That is what stops a bounty
 * for a fight you watched.
 */
export function wreckShip(world: World, npc: NpcShip): CombatEvent[] {
  const out: CombatEvent[] = [{ kind: 'wrecked', npc }];
  // Taken before the despawn below. The sound is placed here now, and the
  // ship is gone by the time the Game reads the event (docs/TODO/142).
  const at = npc.object.position.clone();
  world.effects.explosion(at.clone());
  world.despawn(npc);

  // wily traders and many pirates punch out at the last moment
  if (npc.role === 'trader' || npc.role === 'pirate' || npc.role === 'hunter') {
    const chance = npc.role === 'trader' ? ESCAPE_CHANCE.trader : ESCAPE_CHANCE.other;
    // The role goes WITH the capsule. The ship is despawned three lines up,
    // and nothing else remembers whose ship it was (GitHub #28).
    if (random() < chance) {
      world.cargo.spawnCapsule(npc.object.position.clone(), npc.role);
    }
  }
  if (npc.cargoDrop > 0) {
    world.cargo.spawn(npc.object.position,
      Math.floor(random() * (npc.cargoDrop + 1)), ORDINARY_GOODS);
  }
  // a cracked hermit spills the contraband it dealt in — the smuggler's payday
  if (npc.role === 'hermit') {
    world.cargo.spawn(npc.object.position,
      HERMIT_CONTRABAND_MIN + randomInt(HERMIT_CONTRABAND_SPAN), CONTRABAND);
  }
  // the drones go dead when the last mothership does
  if (npc.role === 'thargoid'
      && !world.npcs.some((n) => n.state.alive && n.role === 'thargoid')) {
    for (const t of world.npcs) {
      if (t.role === 'thargon') t.state.inert = true;
    }
    out.push(say('THARGONS DEACTIVATED', 3));
  }
  return [heard('explosion', at), ...out];
}
