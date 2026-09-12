// The computer lines up every pilot's ship in a fight (docs/TODO/206 M2).
//
// Chris's words of 2026-09-11: timing and tactics are the pilot's. The pilot
// owns the laser, the missiles, the E.C.M. and the choice of target. The
// computer only aims. The bought combat computer takes control of everything
// but the missiles. These fly a real headless Game.

import * as THREE from 'three';
import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { withoutSaving } from '../src/game/storage.ts';
import { seedWorld } from '../src/game/rng.ts';
import { pickTarget } from '../src/game/targets.ts';
import type { NpcShip } from '../src/game/npc.ts';
import { check, dismissBriefing, eq } from './harness.ts';

console.log('\nthe computer lines up every pilot');

/** A commander in open space far from the station, with an empty sky. */
function open(seed: number): Game {
  const g = withoutSaving(() => {
    seedWorld(seed);
    const game = new Game(() => headlessShell());
    dismissBriefing(game);
    game.launch();
    return game;
  }).value;
  withoutSaving(() => { for (let f = 0, at = 0; f < 400; f++) g.step(1 / 60, at += 1 / 60); });
  g.state.world.clearNpcs();
  // Well clear of the station's truce, where pirates attack.
  g.state.player.position.add(new THREE.Vector3(0, 40_000, 0));
  return g;
}

function run(g: Game, frames: number): void {
  withoutSaving(() => { for (let f = 0; f < frames; f++) g.step(1 / 60, 20 + f / 60); });
}

/** How far off the nose a ship sits, in radians. */
function offNose(g: Game, ship: NpcShip): number {
  const nose = new THREE.Vector3(0, 0, -1).applyQuaternion(g.state.player.quaternion);
  return nose.angleTo(ship.object.position.clone().sub(g.state.player.position));
}

/** A ship placed off to one side of the commander. */
function beside(g: Game, role: 'pirate' | 'trader', x: number, seed: number): NpcShip {
  const pos = g.state.player.position.clone()
    .add(new THREE.Vector3(x, 0, -1800).applyQuaternion(g.state.player.quaternion));
  return g.state.world.spawn(role, pos, seed);
}

{
  const g = open(20_260_924);
  const pirate = beside(g, 'pirate', 1400, 1);
  pirate.state.speed = 0;
  const before = offNose(g, pirate);
  let hottest = 0;
  withoutSaving(() => {
    for (let f = 0; f < 150; f++) {
      g.step(1 / 60, 20 + f / 60);
      hottest = Math.max(hottest, g.state.sys.laserTemp);
    }
  });
  check('a fight starts, and the computer takes the stick of a ship with no combat computer',
    g.state.session.ccEngaged);
  check('...and turns the nose onto the threat', offNose(g, pirate) < before * 0.5,
    `${before.toFixed(2)} to ${offNose(g, pirate).toFixed(2)} rad`);
  eq('...and never fires: the trigger is the pilot\'s', hottest, 0);
}

{
  const g = open(20_260_925);
  g.state.commander.equipment.combatComputer = true;
  const pirate = beside(g, 'pirate', 900, 2);
  pirate.state.speed = 0;
  let hottest = 0;
  withoutSaving(() => {
    for (let f = 0; f < 240; f++) {
      g.step(1 / 60, 20 + f / 60);
      hottest = Math.max(hottest, g.state.sys.laserTemp);
    }
  });
  check('the bought combat computer also pulls the trigger', hottest > 0,
    `laser heat peaked at ${hottest.toFixed(3)}; pirate alive ${pirate.state.alive}`);
}

{
  const g = open(20_260_926);
  const pirate = beside(g, 'pirate', -1400, 3);
  const trader = beside(g, 'trader', 1400, 4);
  pirate.state.speed = 0;
  trader.state.speed = 0;
  pickTarget(g.state.world.npcs, trader);
  run(g, 180);
  check('with a target picked, the computer lines up on it rather than on the threat',
    offNose(g, trader) < offNose(g, pirate),
    `trader ${offNose(g, trader).toFixed(2)}, pirate ${offNose(g, pirate).toFixed(2)} rad`);
}

{
  const g = open(20_260_927);
  const pirate = beside(g, 'pirate', 1400, 5);
  pirate.state.speed = 0;
  run(g, 30);
  g.input.press('ArrowUp');
  run(g, 1);
  g.input.release('ArrowUp');
  check('a flight key takes the controls', !g.state.session.ccEngaged && g.state.session.handFlown);
  run(g, 60);
  check('...and the computer does not take them back by itself', !g.state.session.ccEngaged);
  g.state.session.handFlown = false;
  run(g, 1);
  check('a pick hands the stick back, and the aim starts again', g.state.session.ccEngaged);
}

// A FIGHT DROPS THE COURSE (Chris, 2026-09-12: *"it should also be disengaged
// by combat or other events"*, and *"anything that breaks the journey should
// let you reconsider what you are doing - at the moment you are stuck on a
// course"*).
//
// The aim already won the stick, because `flight.ts` asks the co-pilot before
// the course. So the course flew nothing while it waited, the button said the
// ship was heading somewhere, and the course took the ship back the moment the
// last pirate died. Now the fight ends it, and the list comes back.
{
  const g = open(20_260_928);
  g.state.session.course = 'station';
  const pirate = beside(g, 'pirate', 1400, 6);
  run(g, 30);
  check('a fight on a course: the aim flies, and the course is dropped',
    g.state.session.ccEngaged && g.state.session.course === null);
  pirate.state.alive = false;
  run(g, 5);
  check('...and a clear area leaves the pilot to choose again, not back on it',
    !g.state.session.ccEngaged && g.state.session.course === null);

  // ...and a course picked while the fight runs goes the same way. The stick is
  // already the computer's, so an edge test on the fight starting would miss it.
  g.state.session.course = 'station';
  beside(g, 'pirate', 1400, 6);
  run(g, 30);
  check('a course picked mid-fight is dropped too', g.state.session.course === null);
}

// --- WHAT AUTHORIZES THE COMPUTER'S SHOT ------------------------------------
//
// Two findings of the review of 2026-09-12 (`docs/COMBAT-COMPUTER-REVIEW.md`).
// Each one made the commander an Offender in its own reproduction, for a ship
// the computer never aimed at.
//
// The commander is fitted with a combat computer, because that is the fitting
// that gives the trigger away. Without it the aim is free and the trigger stays
// the pilot's, so neither fault can arise.
console.log('\nthe computer holds its shot unless the shot is its own');
{
  // THE VIEW. `autoEngage` turns the front view on when it takes the stick. A
  // pilot may look astern afterwards, and the trigger then fired the REAR
  // laser at whatever was behind.
  const g = open(20_260_930);
  g.state.commander.equipment.combatComputer = true;
  const pirate = beside(g, 'pirate', 200, 11);
  pirate.state.speed = 0;
  // a trader parked behind, where the rear laser points
  const behind = g.state.player.position.clone()
    .add(new THREE.Vector3(0, 0, 900).applyQuaternion(g.state.player.quaternion));
  const trader = g.state.world.spawn('trader', behind, 12);
  trader.state.speed = 0;
  g.state.commander.equipment.rearLaser = true;

  run(g, 120);
  check('the computer has the stick, with a pirate ahead', g.state.session.ccEngaged);
  g.state.session.view = 1;      // look astern, as a command key does
  const before = g.state.sys.laserTemp;
  run(g, 60);
  eq('looking astern, the computer fires nothing at all',
    g.state.sys.laserTemp <= before, true);
  check('...so the trader behind is not provoked', !trader.state.provokedByPlayer);
  eq('...and the commander is still clean', g.state.commander.legalStatus, 0);
}

{
  // THE LINE. A trader between the commander and the pirate took the shot.
  const g = open(20_260_931);
  g.state.commander.equipment.combatComputer = true;
  const ahead = (d: number) => g.state.player.position.clone()
    .add(new THREE.Vector3(0, 0, -d).applyQuaternion(g.state.player.quaternion));
  const pirate = g.state.world.spawn('pirate', ahead(2400), 13);
  pirate.state.speed = 0;
  run(g, 180);   // let the nose come onto it

  // Both are put ON the nose, so the shot is one the computer really wants and
  // the trader is squarely in the beam. Drifting geometry made an earlier
  // version of this test pass for the wrong reason: the pirate slid a hair
  // outside the gun cone, so nothing fired either way.
  const park = (n: typeof pirate, d: number): void => {
    n.object.position.copy(ahead(d));
    n.object.updateMatrixWorld(true);
  };
  park(pirate, 900);
  const trader = g.state.world.spawn('trader', ahead(450), 14);
  trader.state.speed = 0;
  park(trader, 450);
  run(g, 30);
  check('with a trader in the way, the computer holds its fire',
    g.state.sys.laserTemp === 0,
    `laser temp ${g.state.sys.laserTemp.toFixed(3)}`);
  check('...so the trader is not provoked', !trader.state.provokedByPlayer);
  eq('...and the commander is still clean', g.state.commander.legalStatus, 0);

  // THE CONTROL: with the way clear, the same geometry does fire. Without it,
  // the two checks above would pass on a computer that never shoots at all.
  trader.state.alive = false;
  park(pirate, 900);
  run(g, 30);
  check('...and with the way clear, the same shot is taken',
    g.state.sys.laserTemp > 0, `laser temp ${g.state.sys.laserTemp.toFixed(3)}`);

  // ...and the pilot's OWN pick is hers to shoot at, whatever it is.
  const picked = g.state.world.spawn('trader', ahead(450), 15);
  picked.state.speed = 0;
  park(picked, 450);
  pickTarget(g.state.world.npcs, picked);
  run(g, 60);
  check('a trader the PILOT picked is shot at', picked.state.provokedByPlayer,
    `provoked ${picked.state.provokedByPlayer}`);
}

// --- IT ENGAGES ONCE, NOT EVERY FRAME --------------------------------------
//
// Chris, 2026-09-12: *"why does it go on for so long? Several long seconds?"*
// He was describing the sound a fight makes. It was not the sound.
//
// `autoEngage` asked the CONDITION LIGHT whether there was a fight, and that
// looks `PLAYER_INTEREST_RANGE` out. The co-pilot only looks `THREAT_RANGE`. A
// pirate between the two engaged the computer, and the co-pilot refused it in
// the SAME frame. So the flag reads false at the end of every frame while the
// cue plays 60 times a second and the console holds AREA CLEAR throughout.
//
// That is why this measures the console rather than `ccEngaged`. The flag never
// survives a frame, so a fixture that sampled it saw nothing at all. The first
// version of this test did, and passed on the bug.
console.log('\nthe computer engages once, not once a frame');
{
  const engagements = (distance: number): { engaged: number; clear: number } => {
    const g = open(20_260_932);
    const at = g.state.player.position.clone()
      .add(new THREE.Vector3(0, 0, -distance).applyQuaternion(g.state.player.quaternion));
    const pirate = g.state.world.spawn('pirate', at, 21);
    pirate.state.provoked = true;
    pirate.state.provokedByPlayer = true;
    pirate.state.speed = 0;
    let engaged = 0;
    let clear = 0;
    withoutSaving(() => {
      for (let f = 0; f < 300; f++) {
        g.step(1 / 60, 20 + f / 60);
        pirate.object.position.copy(at);   // hold it still, so only the RULES move
        if (g.state.session.ccEngaged) engaged += 1;
        if (g.state.session.messageText === 'AREA CLEAR') clear += 1;
      }
    });
    return { engaged, clear };
  };

  const close = engagements(4000);
  check('a pirate inside the co-pilot\'s reach engages the computer', close.engaged === 300,
    `${close.engaged} of 300 frames`);
  check('...and it never gives the ship back', close.clear === 0,
    `${close.clear} frames of AREA CLEAR`);

  // The band that broke it: past what the co-pilot will fly at, inside what the
  // condition light calls a fight.
  const band = engagements(7500);
  check('a pirate the co-pilot will not fly at engages nothing', band.engaged === 0,
    `${band.engaged} of 300 frames`);
  check('...and the console is not told AREA CLEAR on every frame of the flight',
    band.clear === 0, `${band.clear} frames of AREA CLEAR`);
}
