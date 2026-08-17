// Your laser lands on a ship the law protects, and the console says so.
//
// The defect is docs/TODO/173, and it came out of GitHub #35. A commander
// killed a pirate, the held burst carried on into the Viper flying the same
// fight, and the police attacked. Measured, the console could say NOTHING AT
// ALL: `raiseLegal` speaks only when the record moves, and
// `callStationDefence` latches after the first launch.
//
// So every claim here drives the real `Game` and reads `session.messageText`
// frame by frame, as a pilot does. That is `test/record-line.test.ts`'s rig and
// its reason: the words are the feature, and no pure call can show what
// reached the screen.
//
// `test/law.test.ts` owns the arithmetic of a record. This file owns one
// question the arithmetic cannot answer — what a commander was told.

import * as THREE from 'three';
import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { withoutSaving } from '../src/game/storage.ts';
import { seedWorld } from '../src/game/rng.ts';
import { harmVerdict, offenceFor } from '../src/game/law.ts';
import { CLEAN, HARM_LINES } from '../src/constants/law.ts';
import { WITCHPOINT_RADII } from '../src/constants/planet.ts';
import type { NpcRole } from '../src/game/ship-roles.ts';
import type { NpcShip } from '../src/game/npc.ts';
import { check, consoleWatcher, dismissBriefing, eq } from './harness.ts';

const DEFENCE = 'STATION DEFENCE LAUNCHED';

/** Seconds of frames, long enough for two queued lines to reach the console. */
const SETTLE = 60 * 14;

/**
 * A commander in flight with an empty sky, out of the launch tunnel and at
 * rest, and a way to watch the console.
 *
 * @param atWitchpoint put her out where no fleet can launch. The station's
 * Vipers are a second voice, and three of the blocks below are about one voice.
 */
function flying(seed: number, atWitchpoint = false): { g: Game; fly: (steps: number) => string[] } {
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
  if (atWitchpoint) {
    g.state.player.position.copy(g.state.world.station.position).normalize()
      .multiplyScalar(g.state.world.planetRadius * WITCHPOINT_RADII);
  }
  return { g, fly };
}

/** A point `d` ahead of where the ship actually points, whatever that is. */
const ahead = (g: Game, d: number): THREE.Vector3 => g.state.player.position.clone()
  .add(new THREE.Vector3(0, 0, -1).applyQuaternion(g.state.player.quaternion)
    .multiplyScalar(d));

/** A ship in front of the nose, its matrix current so a ray can find it. */
function target(g: Game, role: NpcRole, d = 600): NpcShip {
  const ship = g.spawnNpc(role, ahead(g, d), 9);
  ship.object.updateMatrixWorld(true);
  return ship;
}

console.log('\nthe console names the ship your laser just turned against you');
{
  // ALL THREE ROLES, because each answers differently and one is not evidence
  // for another. A policeman and a bounty hunter come for you. A trader runs,
  // so its line promises no fight that `isHostileToPlayer` would refuse.
  for (const [role] of HARM_LINES) {
    const { g, fly } = flying(35_000_101, true);
    const ship = target(g, role as NpcRole);
    g.fireLaser();
    const said = fly(SETTLE);
    check(`${role}: the console says what was hit (${said.join(' / ')})`,
      said[0] === harmVerdict(role));
    check(`${role}: ...and the ship knows it was the commander`,
      ship.state.provokedByPlayer);
  }
}

console.log('...once, however many hits land on it');
{
  // THE CASE THAT DECIDES THE RULE. Every player hit on a lawful ship reaches
  // here, so a line per HIT would shout the same sentence down the length of a
  // fight. It is `raiseLegal`'s "only a MOVE speaks", read against the ship.
  const { g, fly } = flying(35_000_102, true);
  const cop = target(g, 'police');
  let hits = 0;
  const said: string[] = [];
  for (let volley = 0; volley < 12; volley++) {
    cop.object.position.copy(ahead(g, 600));
    cop.object.updateMatrixWorld(true);
    cop.state.energy = cop.maxEnergy;         // keep it in the fight, not dead
    const was = cop.state.energy;
    g.fireLaser();
    hits += cop.state.energy < was ? 1 : 0;
    said.push(...fly(30));
  }
  said.push(...fly(SETTLE));
  eq(`twelve hits landed (${hits})`, hits, 12);
  eq(`...and the line was said once (${said.join(' / ')})`,
    said.filter((t) => t === harmVerdict('police')).length, 1);
}

console.log('...ahead of the fleet that launched and the record that moved');
{
  // docs/TODO/130's running order, which this line joins at the front: what you
  // did, what the sky did about it, where you now stand. Near the station, so
  // all three voices speak in one flight.
  const { g, fly } = flying(35_000_103);
  const c = g.state.commander;
  target(g, 'police');
  g.fireLaser();
  const said = fly(SETTLE);
  const deed = said.indexOf(harmVerdict('police') ?? '');
  const launch = said.indexOf(DEFENCE);
  const record = said.findIndex((t) => t.startsWith('LEGAL STATUS:'));
  check(`all three were said (${said.join(' / ')})`,
    deed >= 0 && launch >= 0 && record >= 0);
  check('the deed came first', deed < launch);
  check('...the sky answered second', launch < record);
  eq('...and the record is where the hit left it', c.legalStatus, 1);
}

console.log('...and says nothing for a ship the law does not protect');
{
  // THE CONTROL. A pirate, a Thargoid and a rock are nobody's business but your
  // own, and `offenceFor` is the one home of that set. A line here would be the
  // rule written down twice.
  const { g, fly } = flying(35_000_104, true);
  target(g, 'pirate');
  g.fireLaser();
  const said = fly(SETTLE);
  eq(`shooting a pirate explains nothing (${said.join(' / ')})`,
    said.filter((t) => t.endsWith('COMING FOR YOU')).length, 0);
  eq('...and the rule agrees, asked directly', harmVerdict('pirate'), null);
}

console.log('...and nothing for a ship the same shot destroyed');
{
  // A destroyed ship comes for nobody. `destroy` has its own words, and the
  // record goes to Fugitive rather than Offender.
  const { g, fly } = flying(35_000_105, true);
  const trader = target(g, 'trader');
  trader.state.energy = 1;                    // one hit finishes it
  g.fireLaser();
  const said = fly(SETTLE);
  check('the trader went down', !trader.state.alive);
  eq(`...and nothing said it was coming for anybody (${said.join(' / ')})`,
    said.filter((t) => t === harmVerdict('trader')).length, 0);
}

console.log('...and every role the law protects has words of its own');
{
  // THE ONE-HOME GATE. `harmVerdict` asks `offenceFor` which roles are covered
  // and `HARM_LINES` for the words. A role added to the rule with no line would
  // fall silently back to null, and only this check would see it.
  const roles: NpcRole[] = ['police', 'trader', 'hunter', 'pirate', 'thargoid',
    'thargon', 'asteroid'];
  const covered = roles.filter((role) => offenceFor(role, false) !== CLEAN);
  eq(`three roles are protected (${covered.join(', ')})`, covered.length, 3);
  check('...and each of the three has a line',
    covered.every((role) => typeof harmVerdict(role) === 'string'));
  check('...and no other role has one',
    roles.filter((role) => !covered.includes(role))
      .every((role) => harmVerdict(role) === null));
}
