// The hostility rule names no ship class, and a fixture proves it.
//
// `game/hostility.ts` came out of `game/npc.ts` in docs/TODO/169 M2. The move
// had a choice: keep `NpcShip` in the signatures, or take a narrow interface.
// It took the interface, so this file holds the claim that buys.
//
// TWO KINDS OF EVIDENCE, and neither one is enough alone:
//
//  1. A SOURCE SCAN. The word `NpcShip` is nowhere in the file's CODE, and the
//     file imports nothing from `npc.ts`. The scan strips the comments first,
//     so the prose may still name the class. It names it three times, and each
//     one tells a reader which callers hand one in. A scan can also go green
//     because the scan itself is broken. So a file that DOES name the class is
//     read by the same code, as the control.
//  2. A FIXTURE. Four flags, a role and a position drive all four exported
//     functions. It is an object literal, and it constructs no ship at all. A
//     scan cannot say whether the type is honestly narrow. This can.
//
// WHAT IS NOT HERE. Whether the rule gives the RIGHT answer is asserted in
// `station-truce.test.ts`, `combat.test.ts` and `bribe-flight.test.ts`, and
// each of those drives a real `NpcShip`. A moved function pinned against
// itself is the check `CLAUDE.md` forbids.

import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import {
  isHostileToPlayer, hostilesNear, nearestEngaging, nearestNpc,
  type HostileShip,
} from '../src/game/hostility.ts';
import { PLAYER_INTEREST_RANGE } from '../src/constants/player-interest.ts';
import { check } from './harness.ts';

// --- the rule names no ship class -------------------------------------------

console.log('\nthe hostility rule names no ship class');
{
  const code = (path: string) =>
    readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  const rule = code('game/hostility.ts');
  check('game/hostility.ts never writes NpcShip', !/\bNpcShip\b/.test(rule));
  check('...and it imports nothing from npc.ts', !rule.includes("npc.ts"));

  // The control. Without it a scan that reads the wrong file, or a regular
  // expression that matches nothing, would report exactly the same green.
  const reader = code('game/combat-computer.ts');
  check('...and the scan is not vacuous — game/combat-computer.ts writes it',
    /\bNpcShip\b/.test(reader) && reader.includes('npc.ts'));
}

// --- a ship the rule accepts is not a ship ----------------------------------
//
// The narrowest thing `HostileShip` describes. There is no hull here, no
// geometry, no energy bank and no flight model. `NpcShip` satisfies the same
// interface, and this fixture shows that it does not have to.

console.log('\nthe rule reads four flags, a role and a position');
{
  const ship = (
    role: HostileShip['role'], z: number, flags: Partial<HostileShip['state']> = {},
  ): HostileShip => ({
    role,
    object: { position: new THREE.Vector3(0, 0, z) },
    state: {
      alive: true, inert: false, satisfied: false, provokedByPlayer: false, ...flags,
    },
  });

  const CLEAN = 0, FUGITIVE = 2, NO_TRUCE = Infinity;
  const here = new THREE.Vector3();

  check('a pirate attacks a clean commander',
    isHostileToPlayer(ship('pirate', 100), CLEAN, NO_TRUCE));
  check('...and a dead one does not',
    !isHostileToPlayer(ship('pirate', 100, { alive: false }), CLEAN, NO_TRUCE));
  check('...and a bought-off one does not',
    !isHostileToPlayer(ship('pirate', 100, { satisfied: true }), CLEAN, NO_TRUCE));
  check('a policeman comes for a Fugitive and not for a clean commander',
    isHostileToPlayer(ship('police', 100), FUGITIVE, NO_TRUCE)
    && !isHostileToPlayer(ship('police', 100), CLEAN, NO_TRUCE));

  // The three sweeps, off the same fixture. Each one reads the rule above, so
  // each one is a second way the interface has to be wide enough.
  check('the condition light reads a pirate inside the range',
    hostilesNear([ship('pirate', PLAYER_INTEREST_RANGE - 10)], here, CLEAN, NO_TRUCE));
  check('...and it does not read one outside it',
    !hostilesNear([ship('pirate', PLAYER_INTEREST_RANGE + 10)], here, CLEAN, NO_TRUCE));

  const near = ship('pirate', 200), far = ship('pirate', 400);
  check('the bribe key finds the nearer of two pirates in the fight',
    nearestEngaging([far, near], here, CLEAN, 'pirate', NO_TRUCE)?.npc === near);
  check('...and it finds none of a role that is not in the fight',
    nearestEngaging([near], here, CLEAN, 'police', NO_TRUCE) === null);

  // `nearestNpc` asks less again: a position and `alive`. It never reads the
  // role itself, so the predicate is where a caller puts that question.
  check('the sweep skips a dead ship and reports the distance of the live one',
    nearestNpc([ship('pirate', 100, { alive: false }), far], here, () => true)
      ?.distance === 400);
}
