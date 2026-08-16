// The escape capsule as a TARGET: who was inside it, and when it can be shot.
//
// Two defects, reported together as GitHub #28. A capsule launches at the wreck,
// which is the one place the gun is certainly already pointed, so the burst that
// killed the ship killed the pilot in the same second — and every capsule was a
// Fugitive-grade offence whoever was inside, so shooting a raider's pod
// outranked shooting the raider.
//
// The two fixes are in different files on purpose, and this is where they are
// held together:
//
//   WHEN — `POD_LAUNCH_GRACE` (constants/wreck.ts), counted down by `cargo.ts`
//   and SPENT by `shot.ts`, which skips a graced object in both of its passes.
//
//   WHO  — `Canister.occupant`, carried out of `Combat.wreck` because the ship
//   is despawned in the same frame, and read by `Combat.podKilled` through
//   `offenceFor` — the same rule that prices destroying the hull.
//
// test/record-line.test.ts owns the ORDER of the three console lines a lawful
// capsule earns. It clears the grace by hand to get there, and says so. This
// file owns the grace itself and the price.

import * as THREE from 'three';
import { Game } from '../src/game/game.ts';
import { World } from '../src/game/world.ts';
import { Combat } from '../src/game/combat.ts';
import { CargoField } from '../src/game/cargo.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { withoutSaving } from '../src/game/storage.ts';
import { random, seedWorld } from '../src/game/rng.ts';
import { characterRung } from '../src/game/character.ts';
import { offenceFor } from '../src/game/law.ts';
import { CLEAN, FUGITIVE } from '../src/constants/law.ts';
import { DISREPUTE_MURDER } from '../src/constants/character.ts';
import { POD_LAUNCH_GRACE } from '../src/constants/wreck.ts';
import type { CanisterSnapshot } from '../src/game/snapshot.ts';
import { check, dismissBriefing, eq } from './harness.ts';

/** Frames of the fixed step, which runs at 60 Hz. */
const FRAMES = (seconds: number): number => Math.ceil(seconds * 60);

/**
 * A commander at rest in an empty sky, past the launch tunnel.
 *
 * The same rig as test/record-line.test.ts, and for the same reason: a fight in
 * the same seconds would put its own capsules and its own lines in the way.
 */
function flying(seed: number): { g: Game; fly: (steps: number) => void } {
  const g = withoutSaving(() => {
    seedWorld(seed);
    const game = new Game(() => headlessShell());
    dismissBriefing(game);
    return game;
  }).value;
  g.launch();
  let at = 0;
  const fly = (steps: number): void => {
    for (let f = 0; f < steps; f++) g.step(1 / 60, at += 1 / 60);
  };
  fly(400);                                  // past the launch tunnel
  g.state.world.clearNpcs();
  g.state.player.speed = 0;
  return { g, fly };
}

/** A point `d` ahead of the nose, wherever the nose happens to point. */
const ahead = (g: Game, d: number): THREE.Vector3 => g.state.player.position.clone()
  .add(new THREE.Vector3(0, 0, -1).applyQuaternion(g.state.player.quaternion)
    .multiplyScalar(d));

/**
 * Put a capsule in the crosshair and hold it there.
 *
 * The drift is zeroed, which is the whole point of the fixture: a real capsule
 * leaves the line of fire on its own, and a test that let it do so would pass
 * for the wrong reason. Held still, the ONLY thing that can save it is the
 * grace.
 */
function pinned(g: Game, occupant: string, d = 400) {
  g.state.world.cargo.spawnCapsule(ahead(g, d), occupant);
  const pod = g.state.world.cargo.items[g.state.world.cargo.items.length - 1];
  pod.velocity.set(0, 0, 0);
  pod.object.updateMatrixWorld(true);
  return pod;
}

console.log('\nan escape capsule cannot be shot the instant it launches');
{
  const { g, fly } = flying(20_280_001);
  const pod = pinned(g, 'trader');
  eq('a fresh capsule launches with the full grace', pod.grace, POD_LAUNCH_GRACE);

  g.fireLaser();
  check('the shot that killed the ship cannot kill the pilot',
    g.state.world.cargo.items.includes(pod));
  eq('...and the record did not move', g.state.commander.legalStatus, CLEAN);
  eq('...nor the name', g.state.commander.disrepute ?? 0, 0);

  // THE CONTROL, and it is what makes the check above mean anything: the same
  // shot at the same still capsule lands the moment the grace is spent. One
  // frame past the span, because 90 subtractions of 1/60 leave a float residue
  // rather than a clean zero, and `grace > 0` reads that residue as grace.
  fly(FRAMES(POD_LAUNCH_GRACE) + 1);
  eq('the grace runs down on the world clock', pod.grace, 0);
  pod.object.updateMatrixWorld(true);
  g.fireLaser();
  check('...and then the capsule is a target like any other',
    !g.state.world.cargo.items.includes(pod));
}

console.log('...and the grace covers a HELD trigger, not just one shot');
{
  // A beam laser fires 10 times a second. The defect was never a single shot;
  // it was the burst that was already going when the ship broke up.
  const { g, fly } = flying(20_280_002);
  g.state.commander.equipment.laser = 'beam';
  const pod = pinned(g, 'pirate');
  let shots = 0;
  for (let i = 0; i < FRAMES(POD_LAUNCH_GRACE); i++) {
    const cool = g.state.sys.laserCooldown;
    g.fireLaser();
    if (g.state.sys.laserCooldown > cool) shots += 1;
    fly(1);
    pod.object.updateMatrixWorld(true);
  }
  check(`the trigger really was held (${shots} shots left the gun)`, shots > 10);
  check('...and every one of them passed through the capsule',
    g.state.world.cargo.items.includes(pod));
}

console.log('\nwhat a destroyed capsule costs is decided by who was inside');
{
  // The law asks the capsule the question it asks the hull. `offenceFor` is the
  // one home of it, so these two cases are the same rule read twice.
  eq('the rule says a pirate is nobody\'s business', offenceFor('pirate', true), CLEAN);
  eq('...and a trader is a murder', offenceFor('trader', true), FUGITIVE);

  const shot = (occupant: string): Game => {
    const { g } = flying(20_280_003);
    const pod = pinned(g, occupant);
    pod.grace = 0;
    pod.object.updateMatrixWorld(true);
    g.fireLaser();
    check(`the ${occupant}'s capsule broke up`,
      !g.state.world.cargo.items.includes(pod));
    return g;
  };

  {
    const c = shot('pirate').state.commander;
    eq('shooting a raider\'s capsule is not a crime', c.legalStatus, CLEAN);
    // THE OTHER HALF OF THE ANSWER. It is not a crime and it is still a deed:
    // the man in the pod cannot shoot back. Two ladders, moving apart.
    eq('...and it costs the name a murder', c.disrepute ?? 0, DISREPUTE_MURDER);
    eq(`...which is two rungs (${characterRung(DISREPUTE_MURDER)})`,
      characterRung(c.disrepute ?? 0), 'Dodgy');
  }
  {
    const c = shot('trader').state.commander;
    eq('shooting a lawful pilot\'s capsule is still a Fugitive offence',
      c.legalStatus, FUGITIVE);
    eq('...and costs the same name', c.disrepute ?? 0, DISREPUTE_MURDER);
  }
}

console.log('\nthe capsule remembers the ship it came out of');
{
  // The role has to be COPIED at the wreck: `Combat.wreck` despawns the ship in
  // the frame that launches the capsule, so nothing downstream could look it
  // up. Flown over seeded kills, through the real wreck path.
  //
  // HOW OFTEN a pilot punches out is not asked here. That is ESCAPE_CHANCE's
  // claim and test/combat.test.ts measures it over 400 kills for each role. This
  // asks only what the capsule is STAMPED with when one does.
  seedWorld(20_280_004);
  const world = new World();
  const combat = new Combat(world);
  const seen = new Map<string, number>();
  for (const role of ['pirate', 'trader', 'hunter'] as const) {
    for (let i = 0; i < 200; i++) {
      world.cargo.clear();
      combat.wreck(world.spawn(role, new THREE.Vector3(0, 0, -500), 0));
      for (const item of world.cargo.items) {
        if (item.kind !== 'capsule') continue;
        seen.set(item.occupant, (seen.get(item.occupant) ?? 0) + 1);
      }
    }
  }
  const tally = [...seen].map(([k, n]) => `${k} ${n}`).join(', ');
  check(`every role that bails out stamps its own capsule (${tally})`,
    (seen.get('pirate') ?? 0) > 0 && (seen.get('trader') ?? 0) > 0
    && (seen.get('hunter') ?? 0) > 0);
  eq('...and no capsule ever came out naming anybody else', seen.size, 3);

  // THE CONSEQUENCE, which is the point of the stamp: two of those three are a
  // Fugitive offence to shoot and one is not. Read through the same rule the
  // hull is read through, so the two cannot part company.
  eq('a raider\'s capsule is nobody\'s business', offenceFor('pirate', true), CLEAN);
  eq('...a trader\'s is a murder', offenceFor('trader', true), FUGITIVE);
  eq('...and so is a bounty hunter\'s', offenceFor('hunter', true), FUGITIVE);
}

console.log('\nboth facts survive a save');
{
  // A snapshot written in the second after a kill has to bring the capsule back
  // still safe and still naming its pilot. Guessing either would decide a
  // commander's record for them, which is why SNAPSHOT_VERSION was bumped
  // rather than a default added.
  seedWorld(20_280_005);
  const field = new CargoField(new THREE.Object3D());
  field.spawnCapsule(new THREE.Vector3(), 'pirate');
  field.spawn(new THREE.Vector3(500, 0, 0), 1, [0]);
  field.update(POD_LAUNCH_GRACE / 3, new THREE.Vector3(0, 0, 9999));
  const partial = field.items[0].grace;
  check(`the capsule is part way through its grace (${partial.toFixed(2)}s)`,
    partial > 0 && partial < POD_LAUNCH_GRACE);

  const wire = JSON.stringify(field.capture());
  const back = new CargoField(new THREE.Object3D());
  back.restoreAll(JSON.parse(wire) as CanisterSnapshot[]);
  eq('the capsule comes back naming the same pilot', back.items[0].occupant, 'pirate');
  eq('...on the exact fraction of grace it was left with', back.items[0].grace, partial);
  eq('...and a canister still names nobody', back.items[1].occupant, '');
  eq('...and never had a grace to spend', back.items[1].grace, 0);
}

console.log('\nthe grace does not reach past the shot');
{
  // Scooping is NOT gated on it. A capsule you fly to is a capsule you chose,
  // and a rescue that failed for a second and a half would read as a bug.
  seedWorld(20_280_006);
  const field = new CargoField(new THREE.Object3D());
  field.spawnCapsule(new THREE.Vector3(), 'trader');
  const reached = field.update(0, new THREE.Vector3());
  eq('a capsule can be scooped the instant it launches', reached.length, 1);
  eq('...and it leaves the field when it is', field.items.length, 0);

  // ...and neither does it survive a hit that IS registered. The grace decides
  // whether the shot finds it (shot.ts); what a hit is worth is the oracle's,
  // and nothing here softened it.
  field.spawnCapsule(new THREE.Vector3(), 'trader');
  const pod = field.items[0];
  check('a graced capsule that IS hit still breaks up on the pack\'s own bank',
    field.takeLaserHit(pod, pod.energy));
  check('the stream is untouched', typeof random() === 'number');
}
