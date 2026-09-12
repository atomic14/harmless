// The scripted combat computer: a pursuit dogfighter flying YOUR ship.
//
// Added 2026-08-05, after the third trained-defence wall in a row (runs
// 20-21: turret, sprayer, pacifist — docs/TRAINING-LOG.md). It first flew the
// pirates' attack run and Chris found it let go of a target close up (the pass
// phase steers nowhere), so it diverged to pure pursuit — get on the six and
// hold guns on target. What these blocks pin is the co-pilot's own contract: it
// decides and reports (the Game flies the demand and shoots), its trigger is
// the player gun's real cone, its E.C.M. answers only a warhead that exists, and
// it PURSUES a crossing target rather than losing it.

import * as THREE from 'three';
import { ScriptedCoPilot } from '../src/game/scripted-co-pilot.ts';
import { hitCone } from '../src/game/gunnery.ts';
import { LASER_RANGE } from '../src/constants/player-gun.ts';
import {
  defenceBrainNameFor, selectionForBrain, brainName, brainCharacter,
} from '../src/game/brain-names.ts';
import { defenceBrain } from '../src/game/brains.ts';
import { freshState } from '../src/game/state.ts';
import { newCommander } from '../src/game/commander.ts';
import { seedWorld } from '../src/game/rng.ts';
import { PURSUIT_RANGE } from '../src/constants/combat-computer.ts';
import { check, eq } from './harness.ts';

console.log('\nscripted combat computer');

// --- the selection can name it, and it is code rather than weights ----------
{
  eq('\'attack-run\' names the shipped defence — no flag needed',
    defenceBrainNameFor({}), 'attack-run');
  eq('..."no brains at all" still means none',
    defenceBrainNameFor({ scripted: true }), 'scripted');
  check('it loads no weights — the pilot is code',
    defenceBrain({}) === null);
  check('a selection can name it', selectionForBrain('attack-run') !== undefined);
  // The name covers TWO flights (the trader's attack run, this file's pursuit
  // co-pilot — docs/TODO/100), so the display name must not claim either
  // flight's shape and the character line must own up to both.
  check('...under a name that does not claim the co-pilot flies attack runs',
    !(brainName('attack-run') ?? 'ATTACK').includes('ATTACK'));
  check('...and a character line that names both flights',
    (brainCharacter('attack-run') ?? '').includes('ATTACK RUN')
    && (brainCharacter('attack-run') ?? '').includes('PURSUIT'));
}

// --- one seeded sky, one pirate, and the co-pilot's contract ----------------
{
  seedWorld(4242);
  const state = freshState(newCommander());
  state.world.build(state.systems[state.commander.systemIndex]);
  state.player.position.set(0, 0, 0);
  state.player.quaternion.identity();
  state.player.speed = 200;
  state.world.spawn('pirate',
    new THREE.Vector3(0, 0, -2000), 1);
  const pirate = state.world.npcs[state.world.npcs.length - 1];
  const legal = state.commander.legalStatus;

  const cp = new ScriptedCoPilot();
  const step = cp.step(1 / 60, state.player, state.world.npcs, legal, false, null);
  check('with a hostile in range it flies', step.kind === 'fly');
  if (step.kind !== 'fly') throw new Error('unreachable');
  check('...asking to turn toward it (a real pitch or roll demand)',
    step.demand.pitchRate !== 0 || step.demand.rollRate !== 0
    || step.demand.throttle !== 0);
  check('...with a throttle inside −1..1',
    step.demand.throttle >= -1 && step.demand.throttle <= 1);

  // the trigger is the player gun's own cone and range — both sides of each
  const dist = pirate.object.position.distanceTo(state.player.position);
  const cone = hitCone(pirate.radius, dist);
  check('lined up inside the cone, it asks for the trigger', step.demand.fire);
  {
    // point the nose just outside the cone: the request must stop
    const off = new ScriptedCoPilot();
    state.player.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), cone * 1.5);
    const miss = off.step(1 / 60, state.player, state.world.npcs, legal, false, null);
    check('...and just outside it, it does not',
      miss.kind === 'fly' && !miss.demand.fire);
    state.player.quaternion.identity();
  }
  {
    // the same pirate, out past the laser: lined up is not enough
    const far = new ScriptedCoPilot();
    pirate.object.position.set(0, 0, -(LASER_RANGE + 500));
    const outOfRange = far.step(1 / 60, state.player, state.world.npcs, legal, false, null);
    check('beyond the laser\'s range it holds fire',
      outOfRange.kind === 'fly' && !outOfRange.demand.fire);
    pirate.object.position.set(0, 0, -2000);
  }

  // the E.C.M. answers a warhead that exists, and only that
  {
    const quiet = new ScriptedCoPilot();
    const clear = quiet.step(1 / 60, state.player, state.world.npcs, legal, false, null);
    const loud = quiet.step(1 / 60, state.player, state.world.npcs, legal, false,
      { x: 0, y: 400, z: 0 });
    check('a clear sky gets no E.C.M.', clear.kind === 'fly' && !clear.ecm);
    check('...and a warhead in it always does', loud.kind === 'fly' && loud.ecm);

    // A WARHEAD OUTLIVES THE SHIP THAT FIRED IT. The review of 2026-09-12 found
    // the two fused: with the last hostile dead and a missile still closing,
    // the co-pilot said AREA CLEAR and asked for no E.C.M. at all. One press is
    // a complete answer, because `Ordnance` caps the sky at one warhead.
    const alone = new ScriptedCoPilot();
    const gone = alone.step(1 / 60, state.player, [], legal, false, { x: 0, y: 400, z: 0 });
    check('with the last ship dead, a warhead still gets the E.C.M.',
      gone.kind === 'disengage' && gone.ecm);
    const quietly = alone.step(1 / 60, state.player, [], legal, false, null);
    check('...and an empty sky with no warhead asks for nothing',
      quietly.kind === 'disengage' && !quietly.ecm);
    // A pilot who takes the stick keeps her own E.C.M. key.
    const taken = alone.step(1 / 60, state.player, [], legal, true, { x: 0, y: 400, z: 0 });
    check('...and a manual override asks for none either',
      taken.kind === 'disengage' && taken.reason === 'MANUAL OVERRIDE' && !taken.ecm);
  }

  // hands and an empty sky both give the ship back, in the co-pilot's words
  {
    const hands = cp.step(1 / 60, state.player, state.world.npcs, legal, true, null);
    check('touching the controls hands back',
      hands.kind === 'disengage' && hands.reason === 'MANUAL OVERRIDE');
    const alone = new ScriptedCoPilot();
    const empty = alone.step(1 / 60, state.player, [], legal, false, null);
    check('an empty sky disengages',
      empty.kind === 'disengage' && empty.reason.includes('AREA CLEAR'));
  }

  // --- it fights the EASIEST target to lock, not merely the nearest ----------
  // Chris asked for this, and it also keeps the co-pilot off the far-dead-ahead
  // targets that feed the approach roll-spin. A ship dead ahead but farther is
  // preferred over one close but abeam — you get guns on it for less turn.
  {
    // player looking down −Z
    state.player.position.set(0, 0, 0);
    state.player.quaternion.identity();
    while (state.world.npcs.length) state.world.npcs.pop();
    // A: close but 90 degrees off to the side (hard to lock)
    state.world.spawn('pirate', new THREE.Vector3(500, 0, 0), 1);
    // B: farther but dead ahead (easy to lock)
    state.world.spawn('pirate', new THREE.Vector3(0, 0, -1200), 1);
    const abeam = state.world.npcs[0];
    const ahead = state.world.npcs[1];
    const picker = new ScriptedCoPilot();
    picker.step(1 / 60, state.player, state.world.npcs, legal, false, null);
    const held = (picker as unknown as { lock: { held: unknown } }).lock.held;
    check('the aligned target is chosen over the closer abeam one',
      held === ahead && held !== abeam);
  }

}

// --- IT STOPS AT THE STANDOFF, AND IT STOPS DEAD (docs/TODO/211) ------------
//
// Chris, 2026-09-12: *"when targeting asteroids or the derelict. We fly
// towards - and just keep flying towards until we hit it. We should probably
// stop when we are within a certain range."*
//
// Two faults, one report. The deadband held a DRIFT as well as a speed, so a
// ship inside the standoff coasted on at up to 6 units a second. A trace of a
// picked rock closed 400 units in a minute, and went on to the hull. And the
// range was held to the target's CENTRE, which put the commander 160 units
// off the derelict's 340 unit hull.
console.log('\nthe co-pilot stops at the standoff');
{
  seedWorld(4243);
  const state = freshState(newCommander());
  state.world.build(state.systems[state.commander.systemIndex]);
  state.world.clearNpcs();
  state.player.position.set(0, 0, 0);
  state.player.quaternion.identity();
  const legal = state.commander.legalStatus;

  // A rock that sits still, inside the standoff, with the ship drifting on.
  const rock = state.world.spawn('asteroid', new THREE.Vector3(0, 0, -400), 1);
  state.player.speed = 4;
  const cp = new ScriptedCoPilot();
  const drift = cp.step(1 / 60, state.player, state.world.npcs, legal, false, null, Infinity, rock);
  check('inside the standoff, a drift is braked rather than held',
    drift.kind === 'fly' && drift.demand.throttle === -1);

  state.player.speed = 0;
  const stopped = new ScriptedCoPilot()
    .step(1 / 60, state.player, state.world.npcs, legal, false, null, Infinity, rock);
  check('...and a ship already stopped asks for nothing',
    stopped.kind === 'fly' && stopped.demand.throttle === 0);

  // Outside the standoff it still closes.
  rock.object.position.set(0, 0, -3000);
  const far = new ScriptedCoPilot()
    .step(1 / 60, state.player, state.world.npcs, legal, false, null, Infinity, rock);
  check('outside it, the ship still closes', far.kind === 'fly' && far.demand.throttle === 1);

  // The standoff clears the HULL, so a big target is not approached as a
  // small one. The rock's own radius is what the range adds.
  rock.object.position.set(0, 0, -(PURSUIT_RANGE + rock.radius - 50));
  state.player.speed = 4;
  const inside = new ScriptedCoPilot()
    .step(1 / 60, state.player, state.world.npcs, legal, false, null, Infinity, rock);
  check('a target 50 units inside the hull standoff is too close',
    inside.kind === 'fly' && inside.demand.throttle === -1);
  rock.object.position.set(0, 0, -(PURSUIT_RANGE + rock.radius + 200));
  const outside = new ScriptedCoPilot()
    .step(1 / 60, state.player, state.world.npcs, legal, false, null, Infinity, rock);
  check('...and 200 units outside it is not', outside.kind === 'fly'
    && outside.demand.throttle === 1);
}

// --- IT LEADS THE NOSE, AND IT MATCHES THE RADIAL SPEED --------------------
//
// Chris, 2026-09-12: *"it can struggle to lock onto fast moving ships that are
// circling us"*, and *"I also see it oscillating quite a bit when chasing
// weaving ships"*.
//
// Two rules answer it, and they only work together. The aim leads the target by
// the swing the nose has LEFT (`PURSUIT_LEAD_GAIN`). The throttle matches how
// fast the target RECEDES rather than how fast it flies.
//
// A probe of the control law over 40 scripted targets measured the pair, at real
// pirate speeds and a real pirate radius. The pursuit before them held a target
// inside the gun cone 27.5% of the time. The radial throttle alone scored 31.2%,
// the lead alone scored 41.7%, and the two together scored 46.7%. A FIXED lead
// scored 24.2%, which is worse than no lead: it parks the nose ahead of a target
// the throttle just let it catch. See `PURSUIT_LEAD_GAIN` for the whole table.
console.log('\nthe co-pilot leads the nose and matches the radial speed');
{
  seedWorld(4244);
  const state = freshState(newCommander());
  state.world.build(state.systems[state.commander.systemIndex]);
  state.world.clearNpcs();
  state.player.position.set(0, 0, 0);
  state.player.quaternion.identity();
  const legal = state.commander.legalStatus;
  const UP = new THREE.Vector3(0, 1, 0);
  const look = new THREE.Matrix4();
  const ahead = new THREE.Vector3();
  /** Point a ship's nose along `dir`, which is what `velocityOf` reads. */
  const face = (npc: { object: { position: THREE.Vector3; quaternion: THREE.Quaternion } },
    dir: THREE.Vector3): void => {
    look.lookAt(npc.object.position, ahead.copy(npc.object.position).add(dir), UP);
    npc.object.quaternion.setFromRotationMatrix(look);
  };

  // THE THROTTLE READS THE RECEDING SPEED. Both targets sit dead ahead at the
  // standoff and fly at 300. One crosses, so it holds its range and the
  // commander must hold station. One runs, so the commander must chase.
  const mark = state.world.spawn('pirate', new THREE.Vector3(0, 0, -600), 1);
  mark.object.position.set(0, 0, -(PURSUIT_RANGE + mark.radius));
  mark.state.speed = 300;
  state.player.speed = 0;

  face(mark, new THREE.Vector3(1, 0, 0));
  const crossing = new ScriptedCoPilot()
    .step(1 / 60, state.player, state.world.npcs, legal, false, null, Infinity, mark);
  check('a target that only crosses holds its range, so the ship asks for no thrust',
    crossing.kind === 'fly' && crossing.demand.throttle === 0);

  face(mark, new THREE.Vector3(0, 0, -1));
  const running = new ScriptedCoPilot()
    .step(1 / 60, state.player, state.world.npcs, legal, false, null, Infinity, mark);
  check('...and one that runs at the same speed is chased',
    running.kind === 'fly' && running.demand.throttle === 1);

  // THE LEAD IS FOR THE NOSE, AND THE GUN CONE IS WHERE IT SHOWS. Inside the
  // cone the steering asks for nothing, because a target that already fills the
  // gun needs no bank (`pitch-roll-steer.ts`). A target that CROSSES is about to
  // leave that cone, and the lead is what keeps the ship turning with it.
  //
  // This is also why the lead must shrink. A target inside the cone and NOT
  // moving is aimed AT, so the co-pilot still goes quiet on it. A fixed lead
  // would hold a turn against a target that is already on the gun.
  while (state.world.npcs.length > 1) state.world.npcs.pop();
  const near = state.world.spawn('pirate', new THREE.Vector3(0, 0, -800), 1);
  const turnFor = (speed: number): number => {
    // just inside the gun cone, which the unled pursuit treats as arrived
    const off = hitCone(near.radius, 800) * 0.8;
    near.object.position.set(Math.sin(off) * 800, 0, -Math.cos(off) * 800);
    near.state.speed = speed;
    face(near, new THREE.Vector3(1, 0, 0));
    state.player.quaternion.identity();
    state.player.speed = 0;
    const s = new ScriptedCoPilot()
      .step(1 / 60, state.player, state.world.npcs, legal, false, null, Infinity, near);
    if (s.kind !== 'fly') throw new Error('should be flying a live threat');
    return Math.hypot(s.demand.pitchRate, s.demand.rollRate);
  };
  eq('a still target inside the gun cone asks for no turn at all', turnFor(0), 0);
  check('...but one that crosses at 300 keeps the ship turning with it',
    turnFor(300) > 0);
}

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
