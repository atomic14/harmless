// The commander's own trigger and her own shields.
//
// `game/combat-player.ts` assembles two calls out of a `GameState`:
// `firePlayerLaser` pulls the trigger, and `damagePlayer` spends a hit on the
// face that took it. Both were private methods of `game.ts`, built out of
// `this`, so nothing but a Game could fire the player's gun.
//
// WHAT THIS FILE ASSERTS IS BEHAVIOUR, AND THAT IS docs/TODO/177. These claims
// lived in `test/world-step.test.ts` until then, beside four more that compared
// `firePlayerLaser` against the same seven arguments written out by hand. That
// comparison had one real party and one copy: `combat-player.ts` is the only
// caller of `Combat.fire` and `Combat.hitPlayer` in `src/`. It could never
// report that anything was wrong, so it went.
//
// THE VIEW IS THE ARGUMENT WORTH HOLDING. It is read off the state rather than
// assumed to be the nose, so a rear-view shot hits what is BEHIND the ship. It
// is also the one thing a wrong assembly loses first, which is why it carries
// its own control: with no rear mount fitted, nothing leaves the rail at all.
//
// WHAT IS NOT HERE. `test/combat.test.ts` owns resolving a hit end to end.
// `test/fire-resolution.test.ts` owns the one resolver that the game and the
// trainer share, plus the pure `hitFromAhead` predicate under it. Neither of
// them drives `damagePlayer` onto the commander's own shields, and this does.

import * as THREE from 'three';
import { Combat } from '../src/game/combat.ts';
import type { CombatEvent } from '../src/game/combat-events.ts';
import { firePlayerLaser, damagePlayer } from '../src/game/combat-player.ts';
import { playerPoolPoints } from '../src/game/damage-units.ts';
import { freshState } from '../src/game/state.ts';
import { newCommander } from '../src/game/commander.ts';
import { seedWorld } from '../src/game/rng.ts';
import { check } from './harness.ts';

/** the same state twice: a pirate parked dead ahead, tough enough to live */
const dueller = () => {
  seedWorld(60_606);
  const state = freshState(newCommander());
  state.world.build(state.systems[state.commander.systemIndex]);
  state.player.position.set(0, 0, 0);
  state.player.quaternion.identity();          // nose along -Z
  const npc = state.world.spawn('pirate', new THREE.Vector3(0, 0, -400), 1);
  npc.state.energy = 90;                             // takes the hit, survives it
  // a ship spawned this frame has no world matrix yet, and the raycast
  // reads matrixWorld — without this the shot is tested against the origin
  npc.object.updateMatrixWorld(true);
  return {
    state, npc,
    combat: new Combat(state.world),
    scratch: {
      a: new THREE.Vector3(), b: new THREE.Vector3(),
      q: new THREE.Quaternion(), ray: new THREE.Raycaster(),
    },
  };
};

/** an event list as comparable text: kinds, and the numbers inside them */
const digest = (events: readonly CombatEvent[]) => JSON.stringify(events.map((e) =>
  e.kind === 'message' ? [e.kind, e.text, e.seconds]
    : e.kind === 'offence' ? [e.kind, e.level]
      : e.kind === 'wrecked' ? [e.kind, e.npc.role]
        : e.kind === 'beam' ? [e.kind, e.at ? e.at.toArray() : null]
          : e.kind === 'died' ? [e.kind, e.reason] : [e.kind]));

// --- the trigger reads the view it is looking through -----------------------

console.log('\nthe commander\'s trigger, over a state');
{
  // The control the three claims below need. A shot down the nose lands, so a
  // later claim about a shot that lands astern is not two empty lists agreeing.
  const ahead = dueller();
  const straight = digest(firePlayerLaser(ahead.state, ahead.combat, ahead.scratch));
  check('a shot down the nose reaches the ship in front of it',
    straight.includes('"offence"') && ahead.npc.state.energy < 90);

  // The view is read from the state, not assumed to be the nose: a rear-view
  // shot hits what is BEHIND you, and that is the one argument of the seven
  // that was easiest to lose in the move.
  const rear = dueller();
  rear.npc.object.position.set(0, 0, 400);
  rear.npc.object.updateMatrixWorld(true);
  rear.state.session.view = 1;                   // looking aft
  rear.state.commander.equipment.rearLaser = true;
  const aft = digest(firePlayerLaser(rear.state, rear.combat, rear.scratch));
  check('a rear-view shot still hits what is behind you',
    aft.includes('"offence"') && rear.npc.state.energy < 90);

  // ...and without the mount there is nothing to fire, which is the other
  // half of the view reaching the gun
  const noMount = dueller();
  noMount.npc.object.position.set(0, 0, 400);
  noMount.npc.object.updateMatrixWorld(true);
  noMount.state.session.view = 1;
  check('...and with no rear mount fitted, nothing happens at all',
    firePlayerLaser(noMount.state, noMount.combat, noMount.scratch).length === 0
      && noMount.npc.state.energy === 90);
}

// --- ...and the damage lands on the face that took it ------------------------

console.log('which of the commander\'s shields takes a hit');
{
  // Which shield takes a hit is the one thing `hitPlayer` resolves out of the
  // player's transform, so it is the bit an assembly could most easily lose.
  //
  // `test/fire-resolution.test.ts` holds the same rule one layer down, as the
  // pure `hitFromAhead` predicate and as the consequence on the TRAINER's
  // target. This is the commander's own bank, through `damagePlayer`.
  const fromAhead = dueller();
  const shieldWas = fromAhead.state.sys.foreShield;
  damagePlayer(fromAhead.state, fromAhead.combat, playerPoolPoints(128),
    new THREE.Vector3(0, 0, -400), fromAhead.scratch);
  check('a hit from ahead lands on the fore shield',
    fromAhead.state.sys.foreShield < shieldWas
      && fromAhead.state.sys.aftShield === shieldWas);

  const fromAft = dueller();
  damagePlayer(fromAft.state, fromAft.combat, playerPoolPoints(128),
    new THREE.Vector3(0, 0, 400), fromAft.scratch);
  check('a hit from astern lands on the aft shield',
    fromAft.state.sys.aftShield < shieldWas
      && fromAft.state.sys.foreShield === shieldWas);
}
