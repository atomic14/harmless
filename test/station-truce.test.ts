// The station's truce: who may engage the commander near the port, and who may
// not.
//
// GitHub #30 — *"I was attacked by a bounty hunter when I was in range of a
// space station."* The behaviour was correct under the rules that ran. A safe
// zone was written down in `AMBUSH_STANDOFF`'s own doc comment, and exactly one
// rule read it: the spawner, which refused to warp a pirate wave in near the
// station. `isHostileToPlayer` took a ship and a legal status, so it could not
// answer a question about the station at all.
//
// The constant is `STATION_TRUCE` now (constants/law.ts) and it has two
// readers. `truceHolds` (game/law.ts) is the rule; this file owns it end to
// end, because the truce is a promise made by four surfaces at once — the ship,
// the scanner blip, the bought combat computer and the bribe key — and a
// promise kept by three of them is not a promise.
//
// The amble is the other half. Every idle ship drew a waypoint 800 to 3,300
// units from the STATION, so a system's hostiles converged on the port whatever
// they were spawned at. That is the cause the issue did not report.

import * as THREE from 'three';
import { NpcShip } from '../src/game/npc.ts';
import {
  isHostileToPlayer, hostilesNear, nearestEngaging,
} from '../src/game/hostility.ts';
import type { NpcRole } from '../src/game/ship-roles.ts';
import { truceHolds } from '../src/game/law.ts';
import { CLEAN, OFFENDER, FUGITIVE, STATION_TRUCE } from '../src/constants/law.ts';
import { AMBLE_SPAN } from '../src/constants/amble.ts';
import { PLAYER_INTEREST_RANGE } from '../src/constants/player-interest.ts';
import { nearestHostile, scannerContacts } from '../src/hud/hud-model.ts';
import { SHIPPED_BRAINS } from '../src/game/brain-names.ts';
import { seedWorld } from '../src/game/rng.ts';
import { check } from './harness.ts';

/** Inside the truce, and well inside it. */
const NEAR = STATION_TRUCE / 2;
/** Outside the truce, and well outside it. */
const FAR = STATION_TRUCE * 4;

const at = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// --- the rule itself ---------------------------------------------------------

console.log('\nthe station truce: the rule');
{
  check('a pirate is covered inside the range', truceHolds('pirate', NEAR));
  check('a bounty hunter is covered inside the range', truceHolds('hunter', NEAR));
  check('...and neither is covered outside it',
    !truceHolds('pirate', FAR) && !truceHolds('hunter', FAR));
  check('the police are never covered',
    !truceHolds('police', 0) && !truceHolds('police', NEAR));
  check('a Thargoid is never covered',
    !truceHolds('thargoid', 0) && !truceHolds('thargon', 0));
  // The boundary is a single home, so it is asserted rather than assumed.
  check('the boundary is exclusive at the range itself', !truceHolds('pirate', STATION_TRUCE));
  check('...and inclusive one unit inside it', truceHolds('pirate', STATION_TRUCE - 1));
}

// --- the hostility rule, which is the one home of "does this attack me?" -----

console.log('\nthe station truce: who attacks');
{
  seedWorld(31_415);
  const ship = (role: string, over: Record<string, unknown> = {}) =>
    ({ role, state: {
      alive: true, inert: false, satisfied: false, provoked: false,
      provokedByPlayer: false, ...over,
    } }) as unknown as Parameters<typeof isHostileToPlayer>[0];

  check('a pirate leaves a commander alone inside the truce',
    !isHostileToPlayer(ship('pirate'), CLEAN, NEAR));
  check('...and comes for the same commander outside it',
    isHostileToPlayer(ship('pirate'), CLEAN, FAR));

  check('a bounty hunter leaves an OFFENDER alone inside the truce',
    !isHostileToPlayer(ship('hunter'), OFFENDER, NEAR));
  check('...and comes for the same Offender outside it — the report itself',
    isHostileToPlayer(ship('hunter'), OFFENDER, FAR));

  // The half that must NOT move. A station that hid a Fugitive from the law
  // would be the one place in the galaxy a record stopped costing anything.
  check('the police still hunt a Fugitive inside the truce',
    isHostileToPlayer(ship('police'), FUGITIVE, NEAR));
  check('a Thargoid still engages inside the truce',
    isHostileToPlayer(ship('thargoid'), CLEAN, NEAR));

  // A commander who shoots first ends it. `takeDamage` sets this flag for
  // damage from the commander, whatever the role.
  check('a hunter the commander shot at fights back inside the truce',
    isHostileToPlayer(ship('hunter', { provoked: true, provokedByPlayer: true }), CLEAN, NEAR));
  check('...and so does a pirate',
    isHostileToPlayer(ship('pirate', { provoked: true, provokedByPlayer: true }), CLEAN, NEAR));
  // ...but a ship in somebody ELSE's fight is still not in yours.
  check('a hunter fighting somebody else is still quiet inside the truce',
    !isHostileToPlayer(ship('hunter', { provoked: true }), OFFENDER, NEAR));

  // The truce is asked after `satisfied`, so a paid ship stays paid.
  check('a pirate that took its payday is quiet either side of the line',
    !isHostileToPlayer(ship('pirate', { satisfied: true }), CLEAN, NEAR)
    && !isHostileToPlayer(ship('pirate', { satisfied: true }), CLEAN, FAR));
}

// --- the ship's own decision loop --------------------------------------------

console.log('\nthe station truce: the ship flies it');
{
  seedWorld(20_260_815);
  const station = new THREE.Object3D();
  const player = (pos: THREE.Vector3) =>
    ({ position: pos, quaternion: new THREE.Quaternion(), speed: 0 }) as never;
  const view = (fleet: readonly NpcShip[], playerToStation: number) => ({
    station, dockZ: 160, fleet, playerLegal: OFFENDER, brains: SHIPPED_BRAINS,
    missileInbound: false, playerToStation,
  });

  /** Fly one hunter at a still commander for `frames`, and report what it did. */
  const flyHunter = (playerToStation: number, frames = 900) => {
    const npc = new NpcShip('hunter', at(0, 0, 1200), 7);
    const home = at(0, 0, 0);
    let shots = 0;
    for (let i = 0; i < frames; i++) {
      if (npc.update(1 / 60, player(home), view([npc], playerToStation))) shots += 1;
    }
    return { shots, range: npc.object.position.distanceTo(home) };
  };

  const quiet = flyHunter(NEAR);
  check('a bounty hunter inside the truce fires nothing at an Offender',
    quiet.shots === 0, `${quiet.shots} shots`);
  // THE CONTROL. The same hull, the same seed, the same separation — one number
  // different. Without it the assertion above is satisfied by a hunter that
  // could not shoot anybody.
  const fight = flyHunter(FAR);
  check('...and the same hunter outside it opens fire',
    fight.shots > 0, `${fight.shots} shots`);
}

// --- the surfaces that must agree with the ship ------------------------------

console.log('\nthe station truce: the surfaces agree');
{
  seedWorld(1966);
  const hunter = new NpcShip('hunter', at(0, 0, 1200), 3);
  const playerPos = at(0, 0, 0);

  check('the threat arrow finds nobody inside the truce',
    nearestHostile([hunter], playerPos, OFFENDER, NEAR) === null);
  check('...and finds the hunter outside it',
    nearestHostile([hunter], playerPos, OFFENDER, FAR)?.npc === hunter);

  const blip = (playerToStation: number) => scannerContacts(
    at(0, 0, 5000), [hunter], [], [], OFFENDER, playerToStation)
    .find((c) => c.kind === 'hostile');
  check('the scanner paints no hostile blip inside the truce', blip(NEAR) === undefined);
  check('...and paints one outside it', blip(FAR) !== undefined);

  check('the condition light is not red inside the truce',
    !hostilesNear([hunter], playerPos, OFFENDER, NEAR));
  check('...and is red outside it', hostilesNear([hunter], playerPos, OFFENDER, FAR));

  // The bribe key may only pay a ship that is in the fight. Inside the truce
  // there is no fight, so there is nobody to pay.
  const pirate = new NpcShip('pirate', at(0, 0, 1200), 5);
  check('the bribe key finds no pirate to pay inside the truce',
    nearestEngaging([pirate], playerPos, CLEAN, 'pirate', NEAR) === null);
  check('...and finds one outside it',
    nearestEngaging([pirate], playerPos, CLEAN, 'pirate', FAR)?.npc === pirate);
}

// --- the amble, which is why they were there at all --------------------------

console.log('\nthe station truce: an idle hostile leaves the doorstep');
{
  seedWorld(776);
  const station = new THREE.Object3D();
  const player = at(0, 0, 400_000);   // nowhere near, so nothing engages anybody
  const view = (fleet: readonly NpcShip[]) => ({
    station, dockZ: 160, fleet, playerLegal: CLEAN, brains: SHIPPED_BRAINS,
    missileInbound: false, playerToStation: 400_000,
  });

  /** Amble one ship for ten minutes, and report the closest it ever came. */
  const closest = (role: NpcRole) => {
    const npc = new NpcShip(role, at(0, 0, STATION_TRUCE), 11);
    let nearest = Infinity;
    for (let i = 0; i < 36_000; i++) {
      npc.update(1 / 60, { position: player, quaternion: new THREE.Quaternion(), speed: 0 } as never,
        view([npc]));
      nearest = Math.min(nearest, npc.object.position.distanceTo(station.position));
    }
    return nearest;
  };

  // The waypoint is the rule; where a ship happens to be between two of them is
  // flight. So the assertion is on the WAYPOINT, and the flown distance is
  // reported beside it.
  const waypointOf = (role: NpcRole) => {
    const npc = new NpcShip(role, at(0, 0, STATION_TRUCE), 13);
    let nearest = Infinity;
    for (let i = 0; i < 36_000; i++) {
      npc.update(1 / 60, { position: player, quaternion: new THREE.Quaternion(), speed: 0 } as never,
        view([npc]));
      nearest = Math.min(nearest, npc.state.waypoint.distanceTo(station.position));
    }
    return nearest;
  };

  const pirateWaypoint = waypointOf('pirate');
  check('no pirate waypoint falls inside the truce',
    pirateWaypoint >= STATION_TRUCE, `nearest ${Math.round(pirateWaypoint)}`);
  const hunterWaypoint = waypointOf('hunter');
  check('...and no bounty hunter waypoint does either',
    hunterWaypoint >= STATION_TRUCE, `nearest ${Math.round(hunterWaypoint)}`);
  check('...and none is pushed out of the commander\'s reach either',
    pirateWaypoint <= STATION_TRUCE + AMBLE_SPAN
    && STATION_TRUCE + AMBLE_SPAN <= PLAYER_INTEREST_RANGE + AMBLE_SPAN);

  // The police keep the doorstep. They are the station's own, and their amble
  // is what makes a Viper read as station traffic.
  const policeWaypoint = waypointOf('police');
  check('a police waypoint still sits on the doorstep',
    policeWaypoint < STATION_TRUCE, `nearest ${Math.round(policeWaypoint)}`);

  // ...and the ships really fly to those waypoints rather than the rule being
  // decorative: an ambling pirate is measured, and reported.
  const flown = closest('pirate');
  check('an ambling pirate never reaches the slot',
    flown > 0, `closest approach ${Math.round(flown)}`);
}
