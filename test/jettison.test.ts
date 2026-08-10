// A tonne over the side stays over the side.
//
// Reported from a real flight: pressing Y printed `JETTISONED 1t FOOD` and then
// `SCOOPED 1t FOOD` a frame later, so the hold never changed. Jettison exists to
// buy off pirates — dump enough and the opportunists break off to collect it —
// and that only works if the cargo LEAVES.
//
// The cause was placement, not the scoop: `cargo.spawn` puts a canister 20 units
// from the point it is given, `SCOOP_RANGE` is 45, and a commander with fuel
// scoops fitted therefore collected his own tonne on the very next frame. It
// wanted fuel scoops to reproduce, which is why it survived to a play session:
// nothing in the suite had dumped cargo from a ship that could pick it up.
//
// `test/combat.test.ts` owns the pure half — what `dumpCargo` chooses and what a
// pirate's appetite is. This is the half that needs a world.

import * as THREE from 'three';
import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { withoutSaving } from '../src/game/storage.ts';
import { seedWorld } from '../src/game/rng.ts';
import { SCOOP_RANGE } from '../src/constants/scoop.ts';
import { JETTISON_CLEARANCE } from '../src/constants/jettison.ts';
import { check, dismissBriefing, eq } from './harness.ts';

/** A commander in flight, with fuel scoops fitted and a hold worth dumping. */
function flying(seed: number): { g: Game; step: () => void } {
  const g = withoutSaving(() => {
    seedWorld(seed);
    const game = new Game(() => headlessShell());
    dismissBriefing(game);
    game.launch();
    return game;
  }).value;
  let at = 0;
  const step = (): void => { g.step(1 / 60, at += 1 / 60); };
  // past the launch tunnel, which routes input as pausedOnly while it plays
  for (let f = 0; f < 400; f++) step();
  // THE CONDITION THE BUG NEEDED. Without scoops a canister you fly into breaks
  // on the hull instead, which is why no existing test saw this.
  g.state.commander.equipment.scoops = true;
  g.state.commander.cargo = g.state.commander.cargo.map(() => 0);
  g.state.commander.cargo[0] = 5;
  return { g, step };
}

console.log('\njettisoned cargo leaves, and stays left');
{
  const { g, step } = flying(20_260_814);
  const held = () => g.state.commander.cargo[0];

  eq('five tonnes aboard', held(), 5);
  g.jettisonCargo(1);
  eq('...one goes over the side', held(), 4);
  eq('...and is in the sky', g.state.world.cargo.items.length, 1);

  const canister = g.state.world.cargo.items[0];
  const away = canister.object.position.distanceTo(g.state.player.position);
  check(`it lands beyond your own scoop reach (${away.toFixed(1)} > ${SCOOP_RANGE})`,
    away > SCOOP_RANGE);
  eq('...by the margin the rule states, and not a number of its own',
    Math.round(away), SCOOP_RANGE + JETTISON_CLEARANCE);

  // BEHIND, not in a random direction: a random bearing puts it in front of you
  // about as often as not, and flying forward through it scoops it back.
  const nose = g.state.player.getForward(new THREE.Vector3());
  const toCanister = canister.object.position.clone().sub(g.state.player.position).normalize();
  check(`...behind the nose (dot ${nose.dot(toCanister).toFixed(2)})`,
    nose.dot(toCanister) < -0.9);

  // THE REPRODUCTION. One frame was all it took.
  step();
  eq('a frame later it is still out there', g.state.world.cargo.items.length, 1);
  eq('...and the hold is still short a tonne', held(), 4);
  check('...and the console does not claim you scooped it',
    !g.state.session.messageText.includes('SCOOPED'));

  // ...and it is still gone a second later, so this is not a one-frame trick.
  for (let f = 0; f < 60; f++) step();
  eq('a second later, still dumped', held(), 4);
}

console.log('\n...and five tonnes at once go too');
{
  const { g, step } = flying(20_260_815);
  g.jettisonCargo(5);
  eq('the hold is empty', g.state.commander.cargo[0], 0);
  eq('...and five canisters are adrift', g.state.world.cargo.items.length, 5);
  const near = g.state.world.cargo.items
    .filter((c) => c.object.position.distanceTo(g.state.player.position) <= SCOOP_RANGE);
  check(`none of them is within reach (${near.length} were)`, near.length === 0);
  step();
  eq('...so none is collected', g.state.commander.cargo[0], 0);
}

// --- what must NOT have changed ----------------------------------------------

console.log('\na wreck still spills its hold where it died');
{
  const { g } = flying(20_260_816);
  const at = g.state.player.position.clone().addScaledVector(
    g.state.player.getForward(new THREE.Vector3()), 500);
  // `cargo.spawn` is the OTHER caller — a destroyed ship's hold, scattered round
  // the wreck. Twenty units from the wreck is right there, and the jettison fix
  // must not have moved it.
  g.state.world.cargo.spawn(at, 3, [0]);
  const spread = g.state.world.cargo.items
    .map((c) => c.object.position.distanceTo(at));
  check(`three canisters, all close to the wreck (${spread.map((d) => d.toFixed(0)).join(', ')})`,
    spread.length === 3 && spread.every((d) => d < SCOOP_RANGE + JETTISON_CLEARANCE));
}

console.log('\nyou can still go back for what you dropped');
{
  // The property the fix must not break. Dumping puts the tonne out of reach;
  // it does not make it untouchable. Turn round, fly into it, and it is yours —
  // what must not happen is collecting it without having decided to.
  const { g, step } = flying(20_260_817);
  g.jettisonCargo(1);
  eq('one tonne adrift', g.state.world.cargo.items.length, 1);

  // The pilot goes back for it: put the ship on the canister.
  g.state.player.position.copy(g.state.world.cargo.items[0].object.position);
  step();
  eq('flying into it scoops it', g.state.world.cargo.items.length, 0);
  eq('...and the tonne is back aboard', g.state.commander.cargo[0], 5);
}
