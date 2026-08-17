// The console answers for the sky, and not only for the record.
//
// The defect is docs/TODO/175, and it came out of the docs/TODO/173
// investigation. Two ships attack a commander for two different reasons, and
// the game only ever explained one of them. `recordVerdict` reads
// `lawTakesInterest`, so at Offender it says BOUNTY HUNTERS. The ship shooting
// at her may be a police Viper she grazed, and no line said so.
//
// A **grudge** is that ship's private quarrel with her. `provokedByPlayer`
// carries it, and docs/TODO/175 M1 measured that the flag has no exit: it still
// holds after 300 seconds, and a record forced back to Clean does not clear it.
//
// THREE KINDS OF EVIDENCE, and no one of them is enough:
//
//  1. THE RULE, off an object literal. `grudgeRolesNear` is a sweep over
//     `isHostileToPlayer`, so a fixture needs no hull and no flight model. This
//     is where every branch of "which roles does the record fail to explain"
//     is asked.
//  2. THE WORDS, through the real `Game`. A rule that returns the right roles
//     and never reaches the screen is the defect docs/TODO/130 is about. So the
//     block below flies a graze and reads `session.messageText` frame by frame.
//  3. THE LINE IT MUST NOT BECOME. `recordVerdict` is asserted directly at all
//     three rungs. M2's whole design is that this is a SECOND line, and nothing
//     else holds that apart.

import * as THREE from 'three';
import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { withoutSaving } from '../src/game/storage.ts';
import { seedWorld } from '../src/game/rng.ts';
import { grudgeRolesNear, type HostileShip } from '../src/game/hostility.ts';
import { grudgeVerdict, recordVerdict } from '../src/game/law.ts';
import { CLEAN, OFFENDER, FUGITIVE, STATION_TRUCE } from '../src/constants/law.ts';
import { PLAYER_INTEREST_RANGE } from '../src/constants/player-interest.ts';
import { WITCHPOINT_RADII } from '../src/constants/planet.ts';
import type { NpcRole } from '../src/game/ship-roles.ts';
import type { NpcShip } from '../src/game/npc.ts';
import { check, consoleWatcher, dismissBriefing, eq } from './harness.ts';

// --- 1. which roles the record fails to explain ------------------------------

console.log('\nthe roles a record cannot account for');
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

  const here = new THREE.Vector3();
  const NO_TRUCE = Infinity;
  const cross = { provokedByPlayer: true };
  const roles = (
    fleet: readonly HostileShip[], status: number, toStation = NO_TRUCE,
  ): readonly string[] => grudgeRolesNear(fleet, here, status, toStation);

  // The case the item is named for: her record brings hunters, and the ship on
  // her is a policeman she shot at.
  eq('an Offender is told about the police Viper she grazed',
    roles([ship('police', 100, cross)], OFFENDER).join(), 'police');
  eq('...and about a bounty hunter when she is Clean',
    roles([ship('hunter', 100, cross)], CLEAN).join(), 'hunter');
  eq('...and about both, in one sentence, when both are on her',
    roles([ship('police', 100, cross), ship('hunter', 200, cross)], CLEAN).join(),
    'police,hunter');

  // A FUGITIVE HEARS NOTHING, and that is the design rather than a gap. Her
  // record already brings both roles, so the line beside this one is true.
  eq('a Fugitive is told nothing — her record explains both',
    roles([ship('police', 100, cross), ship('hunter', 200, cross)], FUGITIVE).length, 0);

  // Everything `isHostileToPlayer` already refuses, refused here too. The rule
  // has one home, and this proves the sweep spends it rather than the flag.
  eq('a Viper she never shot at is not a grudge',
    roles([ship('police', 100)], OFFENDER).length, 0);
  eq('...nor is a dead one',
    roles([ship('police', 100, { ...cross, alive: false })], OFFENDER).length, 0);
  eq('...nor is a bought-off one',
    roles([ship('police', 100, { ...cross, satisfied: true })], OFFENDER).length, 0);
  eq('...nor is one too far away to be in the fight',
    roles([ship('police', PLAYER_INTEREST_RANGE + 10, cross)], OFFENDER).length, 0);
  eq('...and a pirate is nobody\'s grudge, because it needed no reason',
    roles([ship('pirate', 100, cross)], OFFENDER).length, 0);

  // A GRUDGE IS NEVER COVERED BY THE TRUCE, and it cannot be. The truce is
  // bypassed by the same flag that puts a ship in this set (docs/TODO/158), so
  // the two can never disagree. Held at the port and outside it, because a
  // reader would otherwise expect the station to be a refuge from one.
  eq('a hunter she shot at is on her at the port',
    roles([ship('hunter', 100, cross)], CLEAN, 0).join(), 'hunter');
  eq('...and outside the truce, where nothing covered it anyway',
    roles([ship('hunter', 100, cross)], CLEAN, STATION_TRUCE + 1).join(), 'hunter');
  eq('...while the hunter she never shot at is covered inside it',
    roles([ship('hunter', 100)], CLEAN, STATION_TRUCE - 1).length, 0);

  // The words, off the roles above.
  eq('the line names the ship and says why it is there',
    grudgeVerdict(['police']),
    'POLICE YOU SHOT AT ARE STILL AFTER YOU — THIS IS PERSONAL');
  eq('...and it joins two roles the way the record line does',
    grudgeVerdict(['police', 'hunter']),
    'POLICE AND BOUNTY HUNTERS YOU SHOT AT ARE STILL AFTER YOU — THIS IS PERSONAL');
  check('...and an empty sky says nothing at all', grudgeVerdict([]) === null);
}

// --- 2. ...and a pilot reads it ---------------------------------------------

console.log('\nthe console says who is on her, beside where she stands');
{
  /**
   * A commander in flight at the witchpoint with an empty sky.
   *
   * OUT THERE ON PURPOSE. Inside `DEFENCE_RANGE` the station's fleet launches,
   * and every Viper it launches is provoked as well. That is a real case and it
   * is Q4 of docs/TODO/175 M1, but it puts a second voice in the console and
   * these claims are about one line.
   */
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
    g.state.player.position.copy(g.state.world.station.position).normalize()
      .multiplyScalar(g.state.world.planetRadius * WITCHPOINT_RADII);
    return { g, fly };
  }

  /** A ship in front of the nose, its matrix current so a ray can find it. */
  const target = (g: Game, role: NpcRole, d = 600): NpcShip => {
    const ship = g.spawnNpc(role, g.state.player.position.clone()
      .add(new THREE.Vector3(0, 0, -1).applyQuaternion(g.state.player.quaternion)
        .multiplyScalar(d)), 9);
    ship.object.updateMatrixWorld(true);
    return ship;
  };

  /** Long enough for three queued lines to reach a console one at a time. */
  const SETTLE = 60 * 20;

  {
    // ONE GRAZE DOES BOTH THINGS AT ONCE: it provokes the Viper, and it takes
    // her to Offender. So the record line and the line that corrects it are
    // said in the same burst, which is exactly when a pilot is confused.
    const { g, fly } = flying(35_000_175);
    const cop = target(g, 'police');
    g.fireLaser();
    const said = fly(SETTLE);
    check(`the Viper knows it was her (${said.join(' / ')})`,
      cop.state.provokedByPlayer);
    eq('...and the record moved to Offender', g.state.commander.legalStatus, OFFENDER);

    const record = said.indexOf(recordVerdict(OFFENDER));
    const grudge = said.indexOf(grudgeVerdict(['police']) ?? '');
    check('the record line was said', record >= 0);
    check('...and the line that corrects it was said too', grudge >= 0);
    check('...after it, because it corrects the line above', grudge > record);

    // THE CLAIM THE ITEM EXISTS FOR. The two lines name two different ships,
    // and the second one names the ship that is actually shooting.
    check('the record names BOUNTY HUNTERS and the sky names POLICE',
      said[record]?.includes('BOUNTY HUNTERS') === true
      && said[grudge]?.startsWith('POLICE ') === true);
  }

  {
    // The control. A trader takes her to Offender the same way, and no law ship
    // is on her. Without this, a line said on EVERY record move would pass.
    const { g, fly } = flying(35_000_176);
    target(g, 'trader');
    g.fireLaser();
    const said = fly(SETTLE);
    eq('a trader graze moves the record the same way', g.state.commander.legalStatus, OFFENDER);
    check(`...and the sky line is not said (${said.join(' / ')})`,
      !said.some((t) => t.includes('STILL AFTER YOU')));
  }
}

// --- 3. the line it must not become ------------------------------------------

console.log('\nthe record verdict is untouched');
{
  // M2's design is that this is a SECOND line. `recordVerdict` stays the one
  // home of what a moved RECORD says, assembled from `lawTakesInterest` so it
  // cannot promise a fight the rules refuse. Pinned at all three rungs, because
  // a widening would show up at exactly one of them first.
  eq('Clean says the status and nothing more',
    recordVerdict(CLEAN), 'LEGAL STATUS: CLEAN');
  eq('Offender brings the bounty hunters',
    recordVerdict(OFFENDER), 'LEGAL STATUS: OFFENDER — BOUNTY HUNTERS WILL ATTACK YOU');
  eq('Fugitive brings both',
    recordVerdict(FUGITIVE),
    'LEGAL STATUS: FUGITIVE — POLICE AND BOUNTY HUNTERS WILL ATTACK YOU');
  check('...and not one of the three mentions a ship you shot at',
    ![CLEAN, OFFENDER, FUGITIVE].some((s) => recordVerdict(s).includes('SHOT AT')));
}
