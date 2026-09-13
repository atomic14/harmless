// The pilot flies the last stretch into the slot (docs/TODO/207).
//
// Chris picked Match the spin from the four concepts on 2026-09-11. The
// computer holds the ship on the slot axis. The pilot matches the station's
// spin with the roll strip or the roll keys, and the speed with the throttle.
// The slot takes the ship only if both are right.

import * as THREE from 'three';
import { gunButtonsFor } from '../src/game/cockpit-buttons.ts';
import { attachStripControl } from '../src/engine/strip-control.ts';
import { flightDemand } from '../src/engine/flight-controls.ts';
import { keymap } from '../src/engine/keymap.ts';
import { dockingOutcome } from '../src/game/docking.ts';
import { SLOT_SPEED_LIMIT } from '../src/constants/docking.ts';
import { PLAYER_FLIGHT } from '../src/constants/player-flight.ts';
import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { withoutSaving } from '../src/game/storage.ts';
import { seedWorld } from '../src/game/rng.ts';
import { RAILS_CONE, RAILS_STOPPED, SLOT_HALF_ACROSS } from '../src/constants/docking.ts';
import { slotNormal } from '../src/world/slot.ts';
import { keyCodeIfBound } from '../src/ui/key-help.ts';
import { check, dismissBriefing, eq } from './harness.ts';

console.log('\nthe last stretch into the slot');

// --- the two controls, and nothing else --------------------------------------
{
  const trial = gunButtonsFor({
    fireKey: 'KeyA', missiles: 3, armed: false, locked: false, armKey: 'KeyT',
    launchKey: 'KeyM', disarmKey: 'KeyU', ecmKey: 'KeyE', targets: null, missileInbound: false, dockKey: null,
    trial: true, rails: true, accelKey: 'Space', decelKey: 'KeyX', rollStripCode: 'roll',
  });
  eq('the stretch shows a strip and two held buttons, and no guns',
    trial.map((b) => b.label).join(), 'DRAG TO ROLL,THRUST,BRAKE');
  // ...and before the rails take it, the pilot has nothing to do yet
  // (docs/TODO/212). A strip that did nothing would be a lie.
  const lining = gunButtonsFor({
    fireKey: 'KeyA', missiles: 3, armed: false, locked: false, armKey: 'KeyT',
    launchKey: 'KeyM', disarmKey: 'KeyU', ecmKey: 'KeyE', targets: null, missileInbound: false, dockKey: null,
    trial: true, rails: false, accelKey: 'Space', decelKey: 'KeyX', rollStripCode: 'roll',
  });
  eq('while the computer lines up, the pilot sees one word and no controls',
    lining.map((b) => b.label).join(), 'LINING UP');
  check('the strip is dragged, not pressed', trial[0]?.strip === true);
  check('...and the throttle buttons are held', trial[1]?.hold === true && trial[2]?.hold === true);
}

// --- the strip reports how far from its middle a finger is -------------------
{
  const listeners: Record<string, (e: unknown) => void> = {};
  const doc = { addEventListener: (t: string, fn: (e: unknown) => void) => { listeners[t] = fn; } };
  const input = { rollStick: null as number | null };
  attachStripControl(input, doc as unknown as Document);
  const knob = { offsetWidth: 34, style: { transform: '' } };
  const strip = {
    getBoundingClientRect: () => ({ left: 100, width: 200 }),
    querySelector: () => knob,
  };
  const at = (x: number) => ({ target: { closest: () => strip }, pointerId: 1, clientX: x, preventDefault: () => {} });
  listeners.pointerdown(at(200));
  eq('a finger in the middle asks for no roll', input.rollStick, 0);
  listeners.pointermove(at(300));
  eq('...at the right end, for all of it', input.rollStick, 1);
  listeners.pointermove(at(150));
  eq('...and half way to the left, for half', input.rollStick, -0.5);
  check('...and the knob follows it', knob.style.transform !== '');
  listeners.pointerup({ pointerId: 1 });
  eq('a finger that lifts lets the roll go', input.rollStick, null);
}

// --- the strip rolls the ship, and a key still beats it ----------------------
{
  const controls = {
    down: new Set<string>(),
    mouseFlight: false, mouseX: 0, mouseY: 0, mouseFire: false,
    rollStick: 0.5 as number | null,
    held(...codes: string[]): boolean { return codes.some((c) => this.down.has(c)); },
  };
  const rates = { rollRate: 0, pitchRate: 0, speed: 0 };
  const strip = flightDemand(controls, keymap(), rates, 1 / 60);
  check('the strip rolls the ship', strip.rollRate < 0);
  controls.down.add(keymap().rollLeft[0]);
  const key = flightDemand(controls, keymap(), rates, 1 / 60);
  check('...and a roll key beats it', key.rollRate > 0);
}

// --- the slot takes the ship only under the speed limit ----------------------
{
  // A bare station at the origin, as test/world.test.ts measures the slot in:
  // in the channel, with the wings across the slot's long axis.
  const station = new THREE.Object3D();
  station.updateMatrixWorld(true);
  const DOCK_Z = 160;
  const scratch = { v: new THREE.Vector3(), q: new THREE.Quaternion(), r: new THREE.Vector3() };
  const quarter = new THREE.Quaternion()
    .setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
  const inSlot = new THREE.Vector3(0, 0, -(DOCK_Z - 20));
  const outcome = (speed: number) =>
    dockingOutcome(inSlot, quarter, station, DOCK_Z, speed, scratch);
  eq('slow enough, the slot takes the ship', outcome(SLOT_SPEED_LIMIT - 1), 'docked');
  eq('...and one unit over, it does not', outcome(SLOT_SPEED_LIMIT + 1), 'tooFast');
  check('the limit is well under the ship\'s top speed, so it is a real choice',
    SLOT_SPEED_LIMIT < PLAYER_FLIGHT.maxSpeed / 2);
}

// --- THE MINI GAME: THE COMPUTER LINES UP, THE RAILS HOLD THE LINE ----------
//
// Chris flew 207's stretch on a phone (2026-09-12): *"The docking does not
// seem to work at all... lining up is not actually very accurate until the
// last few moments. So we aren't actually flying straight and rolling can send
// you off away from the slot."* He asked for the shape this pins: *"we
// actually get lined up by the computer and then hand off to a 'mini' docking
// game. Something that is completely on rails."*
//
// The whole game, flown headless: the course, the computer's lining up, and
// then the rails with a pilot's hand on the strip.
console.log('\nthe docking mini game');
{
  /** A commander at the witchpoint with the station course picked. */
  const arrive = (seed: number): Game => {
    const g = withoutSaving(() => {
      seedWorld(seed);
      const game = new Game(() => headlessShell());
      dismissBriefing(game);
      game.launch();
      game.arriveInSystem();
      return game;
    }).value;
    g.state.world.clearNpcs();
    g.state.session.course = 'station';
    return g;
  };

  /**
   * Fly to the rails, then hold the strip as a pilot does.
   *
   * @param match whether the pilot matches the slot. A pilot who does nothing
   * is the control: the slot is only there to meet about two turns in five.
   */
  const fly = (g: Game, match: boolean, hands = true): {
    rails: boolean; docked: boolean; lateral: number; handedOver: number;
    scrapes: number;
  } => {
    const dt = 1 / 60;
    const q = new THREE.Quaternion();
    const right = new THREE.Vector3();
    const thrust = keymap().accel[0] ?? '';
    const brake = keymap().decel[0] ?? '';
    let rails = false;
    let lateral = Infinity;
    let handedOver = -1;
    let scrapes = 0;
    let wasRails = false;
    withoutSaving(() => {
      for (let f = 0, at = 0; f < 200 / dt; f++) {
        const st = g.state.world.station;
        if (g.state.session.dockRails) {
          if (!rails) handedOver = g.state.player.speed;
          rails = true;
          const local = g.state.player.position.clone();
          st.worldToLocal(local);
          lateral = Math.min(lateral, Math.hypot(local.x, local.y));
          // The ship is stopped when the rails take it, so the pilot thrusts
          // the whole way in, and holds the speed the slot will take.
          if (!hands) {
            // the control: no hand on anything
          } else if (g.state.player.speed < SLOT_SPEED_LIMIT * 0.6) {
            g.input.press(thrust); g.input.release(brake);
          } else {
            g.input.release(thrust); g.input.press(brake);
          }
          if (match) {
            q.copy(st.quaternion).invert().multiply(g.state.player.quaternion);
            right.set(1, 0, 0).applyQuaternion(q);
            // The slot fits either way up, so the error wraps at a quarter
            // turn rather than a half.
            const err = Math.atan2(right.x, right.y);
            g.input.rollStick = Math.max(-1, Math.min(1,
              Math.atan2(Math.sin(2 * err), Math.cos(2 * err)) / 2 * 4));
          }
        }
        const held = g.state.session.dockRails;
        g.step(dt, at += dt);
        // The rails let go on a scrape, and only on a scrape, while in flight.
        if (wasRails && !g.state.session.dockRails && g.mode === 'flight') scrapes += 1;
        wasRails = held;
        if (g.mode !== 'flight') break;
      }
    });
    return { rails, docked: g.mode === 'docked', lateral, handedOver, scrapes };
  };

  const run = fly(arrive(20_260_951), true);
  check('the rails take the ship', run.rails);
  check('...with the ship stopped, so the pilot flies the whole run in',
    run.handedOver <= RAILS_STOPPED, `${run.handedOver.toFixed(1)} units a second`);
  check('...and a pilot who thrusts in and matches the slot docks', run.docked);
  check('...having been held on the line, inside the channel',
    run.lateral < SLOT_HALF_ACROSS, `${run.lateral.toFixed(0)} units off the axis`);

  check('...first time, with no scrape at all', run.scrapes === 0);

  // THE SPIN IS THE GAME, and it was not (Chris, 2026-09-12: *"I think we're
  // still too easy on the docking"*). A probe of 20 approaches found that a
  // pilot who never touched the roll docked every time, after one scrape. The
  // slot took a roll 37 degrees out, which is 41% of every angle it presents.
  // `ROLL_TOLERANCE` is now 0.24, and a bought computer keeps the old 0.65.
  const lazy = fly(arrive(20_260_951), false);
  check('a pilot who thrusts in but ignores the spin is bounced off',
    lazy.scrapes > 0, `${lazy.scrapes} scrape(s)`);

  // The control: hands off entirely. The ship stops on the axis and stays
  // there, so nobody docks by accident (docs/TODO/212). Chris asked for that
  // on 2026-09-12: the pilot must thrust in.
  const idle = fly(arrive(20_260_951), false, false);
  check('a pilot who touches nothing waits there, and never docks', !idle.docked);
}

// --- THE HAND-OVER WAITS FOR THE NOSE, AND THE TURN IS EASED ---------------
//
// Chris, 2026-09-12: *"When docking - we get 'The computer is lining up...' and
// it starts doing it's job, but we jump to the on rails version before it's
// actually lined up."*
//
// Two faults, one report. `railsReached` asked where the ship was and never
// which way it pointed, so the rails took it 69.7 degrees off the slot axis.
// `holdOnRails` then turned it straight inside ONE frame, although the comment
// on that file claimed both of its corrections were eased. Only the position
// was.
//
// The computer cannot make that last turn itself, and `SessionState.dockHold`
// says why. So the rails make it, eased, while the pilot still reads LINING UP.
console.log('\nthe computer finishes the line-up before the pilot gets the slot');
{
  const g = withoutSaving(() => {
    seedWorld(20_260_951);
    const game = new Game(() => headlessShell());
    dismissBriefing(game);
    game.launch();
    game.arriveInSystem();
    return game;
  }).value;
  g.state.world.clearNpcs();
  g.state.session.course = 'station';

  const dt = 1 / 60;
  const out = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const noseOff = (): number => {
    slotNormal(g.state.world.station, out).multiplyScalar(-1);
    return g.state.player.getForward(fwd).angleTo(out);
  };

  let atHandover = -1;
  let worstJump = 0;
  let noseAtStop = -1;
  let stoppedFrames = 0;
  withoutSaving(() => {
    let last = noseOff();
    for (let f = 0, at = 0; f < 120 / dt; f++) {
      const wasRails = g.state.session.dockRails;
      g.step(dt, at += dt);
      const now = noseOff();
      // the biggest one-frame turn of the nose, over the whole approach
      if (Math.abs(now - last) > worstJump) worstJump = Math.abs(now - last);
      last = now;
      // the computer's last stretch: stopped, and the pilot has nothing yet
      if (!g.state.session.dockRails && g.state.player.speed <= RAILS_STOPPED) {
        if (noseAtStop < 0) noseAtStop = now;
        stoppedFrames += 1;
      }
      if (!wasRails && g.state.session.dockRails) { atHandover = now; break; }
      if (g.mode !== 'flight') break;
    }
  });

  check('the pilot is given the slot only once the nose is on the axis',
    atHandover >= 0 && atHandover < RAILS_CONE,
    atHandover < 0 ? 'it never handed over at all'
      : `${(atHandover * 180 / Math.PI).toFixed(1)} degrees off, against a cone of `
        + `${(RAILS_CONE * 180 / Math.PI).toFixed(1)}`);
  // The old code turned the ship 69.7 degrees in the hand-over frame.
  check('...and no single frame turns the nose more than 3 degrees',
    worstJump < 3 * Math.PI / 180,
    `worst one-frame turn ${(worstJump * 180 / Math.PI).toFixed(1)} degrees`);
  // The computer flies this turn. It does not teleport it, and it does not
  // hand the ship over half way round.
  check('...and the computer flew it there itself, from a stop',
    stoppedFrames > 0 && noseAtStop > RAILS_CONE,
    `${stoppedFrames} frames of LINING UP, from `
    + `${(noseAtStop * 180 / Math.PI).toFixed(1)} degrees off`);
}

// --- THE DOCKING COMPUTER IS A BUTTON, NOT AN AUTOMATIC --------------------
//
// Chris, 2026-09-12: *"I have a docking computer - but instead of it being
// activated I still get the lining and only once that is done does the computer
// activate. I think we should have an options when in range 'Docking Computer'
// and if you click it activates. Otherwise we have the lining up and manual
// docking."*
//
// The course used to ask who flies the slot BEFORE the line-up, and a fitted
// computer never saw one. Then it asked AFTER, and a commander who had paid for
// the fitting still had to sit through a line-up they did not want. Now the
// question is theirs, and it is open for the whole of the stretch.
console.log('\nthe docking computer is offered, and it takes the ship when asked');
{
  const dockKey = keyCodeIfBound('flight', 'toggleDockingComputer') ?? '';
  // THE BUTTON IS THERE THROUGHOUT, from the first frame of the line-up to the
  // last of the mini game. A commander who fumbles the slot can still hand it
  // over.
  const source = (rails: boolean, fitted: boolean) => ({
    fireKey: 'KeyA', missiles: 0, armed: false, locked: false, armKey: 'KeyT',
    launchKey: 'KeyM', disarmKey: 'KeyU', ecmKey: null, targets: null, missileInbound: false,
    dockKey: fitted ? dockKey : null,
    trial: true, rails, accelKey: 'Space', decelKey: 'KeyX', rollStripCode: 'roll',
  });
  check('while the computer lines up, a fitted one is offered',
    gunButtonsFor(source(false, true)).some((b) => b.label === 'DOCKING COMPUTER'));
  check('...and during the pilot\'s own run in, too',
    gunButtonsFor(source(true, true)).some((b) => b.label === 'DOCKING COMPUTER'));
  check('a commander with none is offered nothing',
    !gunButtonsFor(source(false, false)).some((b) => b.label === 'DOCKING COMPUTER')
    && !gunButtonsFor(source(true, false)).some((b) => b.label === 'DOCKING COMPUTER'));

  /** Fly the approach, pressing the button when `ask` says to. */
  const fly = (ask: boolean): { sawTrial: boolean; docked: boolean; engaged: boolean } => {
    const g = withoutSaving(() => {
      seedWorld(20_260_951);
      const game = new Game(() => headlessShell());
      dismissBriefing(game);
      game.launch();
      game.arriveInSystem();
      return game;
    }).value;
    g.state.commander.equipment.dockingComputer = true;
    g.state.world.clearNpcs();
    g.state.session.course = 'station';
    const dt = 1 / 60;
    let sawTrial = false;
    let pressed = false;
    let engaged = false;
    withoutSaving(() => {
      for (let f = 0, at = 0; f < 300 / dt; f++) {
        if (g.state.session.dockTrial) sawTrial = true;
        if (ask && !pressed && g.state.session.dockTrial) {
          g.input.injectPress(dockKey);
          pressed = true;
        }
        g.step(dt, at += dt);
        if (g.state.session.dcEngaged) engaged = true;
        if (g.mode !== 'flight') break;
      }
    });
    return { sawTrial, docked: g.mode === 'docked', engaged };
  };

  const asked = fly(true);
  check('a fitted computer still goes through the line-up first', asked.sawTrial);
  check('...and pressing it hands the ship over', asked.engaged);
  check('...and it flies the ship in from there', asked.docked);

  // NOBODY PRESSES IT, and the line-up and the mini game are what they get.
  // They fly nothing here, so the slot is never taken.
  const alone = fly(false);
  check('a pilot who does not press it keeps the ship', !alone.engaged);
  check('...and the line-up hands them the slot instead', !alone.docked);
}
