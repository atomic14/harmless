// THE ENGAGEMENT: who the co-pilot holds, and what happens at a handover.
//
// Split from `scripted-co-pilot.test.ts` on 2026-09-12, when that file passed
// the 400-line ceiling. Three files now divide the co-pilot's tests by the
// question each one asks:
//
//   - `scripted-co-pilot.test.ts` — what it ASKS FOR: the trigger, the E.C.M.,
//     the standoff, the lead and the throttle;
//   - `co-pilot-tracking.test.ts` — where the nose GOES, over time;
//   - this file — WHO it holds, and what survives when the ship changes hands.
//
// Both subjects here come from the review of 2026-09-12
// (`docs/COMBAT-COMPUTER-REVIEW.md`), and neither is visible in a demand read
// one frame at a time.

import * as THREE from 'three';
import { ScriptedCoPilot } from '../src/game/scripted-co-pilot.ts';
import { freshState } from '../src/game/state.ts';
import { newCommander } from '../src/game/commander.ts';
import { seedWorld } from '../src/game/rng.ts';
import { check, eq } from './harness.ts';

// --- ONE HANDOVER CONTRACT ------------------------------------------------
//
// The review of 2026-09-12 found three ways a resumed co-pilot flew differently
// from a fresh one at the same geometry. The contract that answers all three:
//
//   1. THE RATES ARE THE SHIP'S. The co-pilot keeps no copy of its last ask. It
//      ramps from `player.pitchRate` and `player.rollRate`, which
//      `PlayerShip.update` writes from the demand it flew. So a manual override
//      and a restored save both leave the ramp reading the truth.
//   2. THE ENGAGEMENT MEMORY GOES ON `reset`. The lock, the bank side and the
//      under-fire timer are all the engagement's, and none of them is worth
//      inheriting.
//   3. NOTHING HERE NEEDS SAVING. What survives a save is the ship's own rates,
//      which `persistence.ts` already carries.
console.log('\nthe co-pilot hands the ship over on one contract');
{
  seedWorld(4246);
  const state = freshState(newCommander());
  state.world.build(state.systems[state.commander.systemIndex]);
  state.world.clearNpcs();
  state.player.position.set(0, 0, 0);
  state.player.quaternion.identity();
  state.player.speed = 200;
  const legal = state.commander.legalStatus;
  // off to one side, so there is a real bank to make
  const pirate = state.world.spawn('pirate', new THREE.Vector3(900, 120, -1400), 1);
  pirate.state.speed = 0;

  /** One step of a co-pilot at the fixture's geometry. */
  const ask = (cp: ScriptedCoPilot) => {
    const s = cp.step(1 / 60, state.player, state.world.npcs, legal, false, null);
    if (s.kind !== 'fly') throw new Error('should be flying a live threat');
    return s.demand;
  };

  // A controller that flew for a while, then had the ship taken off it.
  const used = new ScriptedCoPilot();
  for (let i = 0; i < 90; i++) ask(used);
  const handedBack = used.step(1 / 60, state.player, state.world.npcs, legal, true, null);
  check('touching the controls hands the ship back', handedBack.kind === 'disengage');

  // The pilot flies it somewhere, and the ship stops turning.
  state.player.pitchRate = 0;
  state.player.rollRate = 0;
  const resumed = ask(used);
  const fresh = ask(new ScriptedCoPilot());
  eq('a resumed co-pilot asks for the same roll a fresh one does',
    resumed.rollRate, fresh.rollRate);
  eq('...and the same pitch', resumed.pitchRate, fresh.pitchRate);

  // ...AND A RESET ONE TOO, which `steerMem.side` used to break.
  //
  // The geometry has to be one where the memory actually decides. A target
  // BELOW commits the bank to the bottom. A target LEVEL to one side then has
  // the same roll either way round, so the flip margin holds whichever side is
  // committed, and a stale one shows.
  const wrongWay = new ScriptedCoPilot();
  pirate.object.position.set(0, -900, -1400);
  for (let i = 0; i < 60; i++) ask(wrongWay);
  pirate.object.position.set(900, 0, -1400);
  state.player.pitchRate = 0;
  state.player.rollRate = 0;
  check('a co-pilot that kept flying banks the way it committed to',
    ask(wrongWay).rollRate * ask(new ScriptedCoPilot()).rollRate < 0,
    'the fixture is only a test of reset() while these disagree');
  state.player.pitchRate = 0;
  state.player.rollRate = 0;
  wrongWay.reset();
  eq('...and a reset one banks the way a fresh one does',
    ask(wrongWay).rollRate, ask(new ScriptedCoPilot()).rollRate);

  // THE RAMP READS THE SHIP. A ship already rolling continues from that rate,
  // rather than from a zero the co-pilot kept to itself.
  state.player.rollRate = -1.2;
  const carried = ask(new ScriptedCoPilot()).rollRate;
  state.player.rollRate = 0;
  const fromRest = ask(new ScriptedCoPilot()).rollRate;
  check('a ship already rolling carries that rate into the ramp',
    carried < fromRest - 0.5, `${carried.toFixed(3)} against ${fromRest.toFixed(3)}`);
}

// --- THE COMMITMENT HAS TO BE GOING SOMEWHERE ------------------------------
//
// The review of 2026-09-12 built this geometry. A held target 3,000 units away
// and 23 degrees off the nose, and a second hostile 500 units dead ahead. The
// cone alone called the far one an attack in progress and vetoed the switch, so
// ten seconds later the easy shot was still refused. `ENGAGED_PATIENCE` is the
// answer, and `npm run combat-aim` cannot see it: over 72 real fights a sweep of
// that constant from 1 second to 999 moved nothing at all.
console.log('\nthe co-pilot lets go of a kill that is going nowhere');
{
  seedWorld(4247);
  const state = freshState(newCommander());
  state.world.build(state.systems[state.commander.systemIndex]);
  state.world.clearNpcs();
  state.player.position.set(0, 0, 0);
  state.player.quaternion.identity();
  state.player.speed = 0;
  const legal = state.commander.legalStatus;

  // 23 degrees off the nose, far out. Inside `ENGAGED_CONE`, and no shot.
  const far = state.world.spawn('pirate',
    new THREE.Vector3(Math.sin(0.4) * 3000, 0, -Math.cos(0.4) * 3000), 1);
  far.state.speed = 0;
  const cp = new ScriptedCoPilot();
  // The geometry is held still, so only the SELECTION rule can move. The ship
  // flies nothing, because the question is which ship the co-pilot holds.
  for (let i = 0; i < 120; i++) {
    cp.step(1 / 60, state.player, state.world.npcs, legal, false, null);
  }
  const near = state.world.spawn('pirate', new THREE.Vector3(0, 0, -500), 2);
  near.state.speed = 0;

  // Long enough to pass `ENGAGED_PATIENCE` with no shot on the far one.
  let fires = false;
  for (let i = 0; i < 60 * 6; i++) {
    const s = cp.step(1 / 60, state.player, state.world.npcs, legal, false, null);
    if (s.kind === 'fly' && s.demand.fire) fires = true;
  }
  check('a target it cannot shoot stops blocking the easy one', fires);

  // THE CONTROL: a commitment that IS going somewhere still holds. The near
  // ship is on the gun, so the far one must not steal it back.
  const steady = new ScriptedCoPilot();
  let held = 0;
  for (let i = 0; i < 60 * 6; i++) {
    const s = steady.step(1 / 60, state.player, state.world.npcs, legal, false, null);
    if (s.kind === 'fly' && s.demand.fire) held += 1;
  }
  check('...and one that is landing shots keeps the lock', held > 60 * 3,
    `${(held / 60).toFixed(1)}s of trigger over 6s`);
}
