// A record you can work off, and a name you cannot.
//
// GitHub #32 — *"Killing pirates should decrease your criminal status."* A
// legal record only ever went up. `raiseLegal` raised it, and `recordCleared` —
// the fine paid at a station, by choice — was the only rule that took it down.
//
// `recordWorkedOff` (game/law.ts) is the second way, and `KILLS_PER_RUNG` is
// its price: five pirate kills to a rung, so ten take a Fugitive to Clean.
//
// **The record moves and the NAME does not**, and that is the half this file
// guards hardest. If a pirate kill moved both ladders, a commander could murder
// a trader, shoot five pirates, and end Clean and Honest at a profit.
// docs/TODO/156 drew the same line from the other side, when a capsule kill
// cost the name and not the record.
//
// test/record-line.test.ts owns the ORDER of the console lines a moving record
// earns. This file owns the ledger and its price.

import * as THREE from 'three';
import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { withoutSaving } from '../src/game/storage.ts';
import { seedWorld } from '../src/game/rng.ts';
import { recordVerdict, recordWorkedOff } from '../src/game/law.ts';
import { CLEAN, FUGITIVE, KILLS_PER_RUNG, OFFENDER } from '../src/constants/law.ts';
import { SNAPSHOT_VERSION, parseSnapshot } from '../src/game/snapshot.ts';
import type { NpcRole } from '../src/game/ship-roles.ts';
import { check, consoleWatcher, dismissBriefing, eq } from './harness.ts';

// --- the rule ----------------------------------------------------------------

console.log('\nwhat a pirate kill pays off');
{
  check('a Clean commander banks nothing', recordWorkedOff(CLEAN, 0) === null);
  check('...however many they have shot', recordWorkedOff(CLEAN, 99) === null);

  const one = recordWorkedOff(FUGITIVE, 0);
  eq('the first kill of a rung moves no rung', one?.legalStatus, FUGITIVE);
  eq('...and goes on the ledger', one?.atonement, 1);

  const rung = recordWorkedOff(FUGITIVE, KILLS_PER_RUNG - 1);
  eq('the last kill of a rung takes one off the record', rung?.legalStatus, OFFENDER);
  eq('...and returns the ledger to nothing', rung?.atonement, 0);

  eq('a rung falls by ONE, never to Clean in a step',
    recordWorkedOff(FUGITIVE, KILLS_PER_RUNG - 1)?.legalStatus, OFFENDER);
  eq('...and the last rung reaches Clean',
    recordWorkedOff(OFFENDER, KILLS_PER_RUNG - 1)?.legalStatus, CLEAN);
}

// --- flown, through the real Game --------------------------------------------

/** A commander in flight with an empty sky, and a way to watch the console. */
function flying(seed: number): { g: Game; fly: (steps: number) => string[] } {
  const g = withoutSaving(() => {
    seedWorld(seed);
    const game = new Game(() => headlessShell());
    dismissBriefing(game);
    game.launch();
    return game;
  }).value;
  const fly = consoleWatcher(g);
  fly(400);                                  // past the launch tunnel
  g.state.world.clearNpcs();
  g.state.player.speed = 0;
  return { g, fly };
}

/** A point `d` ahead of where the ship is actually pointing. */
const ahead = (g: Game, d: number): THREE.Vector3 => g.state.player.position.clone()
  .add(new THREE.Vector3(0, 0, -1).applyQuaternion(g.state.player.quaternion)
    .multiplyScalar(d));

/**
 * Destroy one ship of `role` in the crosshair, and give back what the console
 * said while it happened.
 *
 * The hull is put on one point of energy rather than fought down: this file is
 * about what a KILL costs and pays, and a real fight would spend its own
 * seconds of console on the bounty and the contract.
 */
function kill(
  g: Game, fly: (steps: number) => string[], role: NpcRole = 'pirate',
): string[] {
  const npc = g.spawnNpc(role, ahead(g, 400), 3);
  npc.state.energy = 1;
  npc.object.updateMatrixWorld(true);
  g.fireLaser();
  check(`the ${role} went down`, !npc.state.alive || !g.state.world.npcs.includes(npc));
  // Long enough for a QUEUED line to reach the console. A kill says the bounty
  // first, for three seconds, and `recordVerdict` waits behind it — which is
  // the rule `raiseLegal` states and this one keeps.
  return fly(260);
}

console.log('\nfive pirates take a rung off a record');
{
  const { g, fly } = flying(20_320_001);
  const c = g.state.commander;
  c.legalStatus = FUGITIVE;
  const nameBefore = c.disrepute ?? 0;

  const said: string[][] = [];
  for (let i = 0; i < KILLS_PER_RUNG; i++) said.push(kill(g, fly));

  eq(`${KILLS_PER_RUNG} pirates take a Fugitive to Offender`, c.legalStatus, OFFENDER);
  eq('...and the ledger starts again', c.atonement, 0);
  // Only a MOVE speaks. Four kills of paperwork on the console would shout the
  // ledger down the length of a fight.
  check('the kills before the last one say nothing about the record',
    said.slice(0, -1).every((lines) => !lines.some((t) => t.startsWith('RECORD:'))),
    said.slice(0, -1).map((l) => l.join('/')).join(' | '));
  const verdict = said[said.length - 1].find((t) => t.startsWith('RECORD:'));
  eq('...and the one that moves it says where it left you',
    verdict, recordVerdict(OFFENDER));

  // THE HALF THAT MUST NOT MOVE.
  eq('the name is untouched by any of it', c.disrepute ?? 0, nameBefore);

  for (let i = 0; i < KILLS_PER_RUNG; i++) kill(g, fly);
  eq(`${KILLS_PER_RUNG * 2} pirates take a Fugitive to Clean`, c.legalStatus, CLEAN);

  // ...and then the ledger stops running, because there is nothing to work off.
  kill(g, fly);
  eq('a Clean commander banks nothing', c.atonement, 0);
  eq('...and stays Clean', c.legalStatus, CLEAN);
}

console.log('...and only a pirate pays anything off');
{
  const { g, fly } = flying(20_320_002);
  const c = g.state.commander;

  for (const role of ['trader', 'police'] as const) {
    c.legalStatus = FUGITIVE;
    c.atonement = 0;
    kill(g, fly, role);
    eq(`destroying a ${role} pays nothing off the ledger`, c.atonement, 0);
    eq(`...and it is still a Fugitive-grade offence`, c.legalStatus, FUGITIVE);
  }

  c.legalStatus = FUGITIVE;
  c.atonement = 0;
  kill(g, fly, 'thargon');
  eq('a Thargon drone pays nothing off either', c.atonement, 0);
  kill(g, fly, 'asteroid');
  eq('...and neither does a rock', c.atonement, 0);
}

console.log('...and a fresh offence clears a part-paid ledger');
{
  const { g, fly } = flying(20_320_003);
  const c = g.state.commander;
  c.legalStatus = OFFENDER;

  for (let i = 0; i < KILLS_PER_RUNG - 1; i++) kill(g, fly);
  eq('four kills of five are on the ledger', c.atonement, KILLS_PER_RUNG - 1);
  eq('...and the record has not moved', c.legalStatus, OFFENDER);

  kill(g, fly, 'trader');
  eq('a fresh crime makes it a Fugitive', c.legalStatus, FUGITIVE);
  eq('...and takes the banked kills with it', c.atonement, 0);
}

console.log('...and the ledger survives a save');
{
  const { g, fly } = flying(20_320_004);
  const c = g.state.commander;
  c.legalStatus = FUGITIVE;
  kill(g, fly);
  kill(g, fly);
  eq('the ledger is part paid', c.atonement, 2);

  // The real save path: capture, over the wire as JSON, and back.
  const wire = JSON.parse(JSON.stringify(g.captureSnapshot()));
  const { g: other } = flying(20_320_005);
  other.restoreSnapshot(parseSnapshot(wire));
  eq('...and a restored commander is exactly as far through the rung',
    other.state.commander.atonement, 2);
  eq('...on the same rung', other.state.commander.legalStatus, FUGITIVE);

  // WHY the version had to move. A version 2 save holds a commander who cannot
  // say how far through a rung they were, and a default of 0 would silently
  // take two pirates back off them.
  let refused = '';
  try {
    parseSnapshot({ version: SNAPSHOT_VERSION - 1, mode: 'flight' });
  } catch (e) {
    refused = String(e);
  }
  check('a snapshot of the version before this one is refused',
    refused.includes(String(SNAPSHOT_VERSION - 1)), refused);
}
