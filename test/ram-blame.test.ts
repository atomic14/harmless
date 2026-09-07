// A ship that flies into you does not hold it against you.
//
// GitHub #42: a police Viper collided with a clean commander, and it was
// hostile for the rest of the flight. The ram took the same door as a missile
// (`dealToNpc`), and that door set `provokedByPlayer`. The geometry reads
// overlap only, so it cannot say who moved. docs/TODO/194 makes contact
// provoke nobody, through `PROVOKES` in damage-dealt.ts.
//
// THROUGH THE REAL STEP, because the rule is a door and not a number. A Viper
// is spawned on the commander's own position, and one frame of flight is the
// collision. The control is the laser door on the same ship: an aimed hit
// still provokes. A pirate is the second control: it is hostile by role, so
// the ram cannot make it less so.

import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { withoutSaving } from '../src/game/storage.ts';
import { seedWorld } from '../src/game/rng.ts';
import { isHostileToPlayer } from '../src/game/hostility.ts';
import { PROVOKES } from '../src/constants/blame.ts';
import { CLEAN } from '../src/constants/law.ts';
import { IMPACT } from '../src/constants/impact.ts';
import { npcImpactDamage } from '../src/game/impact-damage.ts';
import type { NpcRole } from '../src/game/ship-roles.ts';
import type { NpcShip } from '../src/game/npc.ts';
import { check, consoleWatcher, dismissBriefing, eq } from './harness.ts';

/** A clean commander in flight, out of the tunnel, at rest in an empty sky. */
function flying(seed: number): { g: Game; fly: (steps: number) => string[] } {
  const g = withoutSaving(() => {
    seedWorld(seed);
    const game = new Game(() => headlessShell());
    dismissBriefing(game);
    game.launch();
    return game;
  }).value;
  const fly = consoleWatcher(g);
  fly(400);
  g.state.world.clearNpcs();
  g.state.player.speed = 0;
  return { g, fly };
}

/** A ship on the commander's own position: the next frame is a collision. */
function rammed(seed: number, role: NpcRole): { g: Game; ship: NpcShip; said: string[] } {
  const { g, fly } = flying(seed);
  const ship = g.spawnNpc(role, g.state.player.position.clone(), 9);
  const said = fly(1);
  return { g, ship, said };
}

/**
 * The rule, asked CLEAR OF THE TRUCE. A launch puts the commander inside
 * `STATION_TRUCE`, and the truce covers every role a grudge does not. So the
 * distance is Infinity, and only the grudge and the role answer.
 */
const hostile = (g: Game, ship: NpcShip): boolean => isHostileToPlayer(
  ship, g.state.commander.legalStatus, Infinity);

console.log('\na ram provokes nobody');
{
  const { g, ship, said } = rammed(1_940, 'police');
  eq('the commander is clean', g.state.commander.legalStatus, CLEAN);
  check('one frame on the same spot is a collision', said.includes('COLLISION'));
  check('the ram cost the Viper its stated points',
    ship.state.energy < ship.maxEnergy
    && ship.maxEnergy - ship.state.energy === npcImpactDamage(IMPACT.ram));
  check('...and the Viper holds no grudge', ship.state.provokedByPlayer === false);
  check('...so it is not hostile to a clean commander', !hostile(g, ship));
  check('...and the record is untouched', g.state.commander.legalStatus === CLEAN);

  // The control: the same ship, through the laser door.
  ship.takeLaserHit(1, g.state.player.position);
  check('an aimed hit on the same Viper provokes it', ship.state.provokedByPlayer === true);
  check('...and then it is hostile', hostile(g, ship));
}
{
  const { g, ship } = rammed(1_941, 'pirate');
  check('a rammed pirate is hostile by role, with no grudge needed',
    hostile(g, ship) && ship.state.provokedByPlayer === false);
}
{
  const { ship } = rammed(1_942, 'trader');
  check('a rammed trader still flees the contact', ship.state.fleeing === true);
  check('...without a grudge', ship.state.provokedByPlayer === false);
}
{
  eq('every aimed source provokes, and the ram alone does not',
    Object.entries(PROVOKES).filter(([, v]) => !v).map(([k]) => k).join(','), 'ram');
}
