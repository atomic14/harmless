// The pilot flies the last stretch into the slot (docs/TODO/207).
//
// Chris picked Match the spin from the four concepts on 2026-09-11. The
// computer holds the ship on the slot axis. The pilot matches the station's
// spin with the roll strip or the roll keys, and the speed with the throttle.
// The slot takes the ship only if both are right.

import * as THREE from 'three';
import { actionButtonsFor } from '../src/game/cockpit-buttons.ts';
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
import { SLOT_HALF_ACROSS } from '../src/constants/docking.ts';
import { check, dismissBriefing, eq } from './harness.ts';

console.log('\nthe last stretch into the slot');

// --- the two controls, and nothing else --------------------------------------
{
  const trial = actionButtonsFor({
    fireKey: 'KeyA', missiles: 3, armed: false, locked: false, armKey: 'KeyT',
    launchKey: 'KeyM', ecmKey: 'KeyE', targets: null, missileInbound: false,
    trial: true, rails: true, accelKey: 'Space', decelKey: 'KeyX', rollStripCode: 'roll',
  });
  eq('the stretch shows a strip and two held buttons, and no guns',
    trial.map((b) => b.label).join(), 'DRAG TO ROLL,THRUST,BRAKE');
  // ...and before the rails take it, the pilot has nothing to do yet
  // (docs/TODO/212). A strip that did nothing would be a lie.
  const lining = actionButtonsFor({
    fireKey: 'KeyA', missiles: 3, armed: false, locked: false, armKey: 'KeyT',
    launchKey: 'KeyM', ecmKey: 'KeyE', targets: null, missileInbound: false,
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
  const fly = (g: Game, match: boolean): { rails: boolean; docked: boolean; lateral: number } => {
    const dt = 1 / 60;
    const q = new THREE.Quaternion();
    const right = new THREE.Vector3();
    let rails = false;
    let lateral = Infinity;
    withoutSaving(() => {
      for (let f = 0, at = 0; f < 200 / dt; f++) {
        const st = g.state.world.station;
        if (g.state.session.dockRails) {
          rails = true;
          const local = g.state.player.position.clone();
          st.worldToLocal(local);
          lateral = Math.min(lateral, Math.hypot(local.x, local.y));
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
        g.step(dt, at += dt);
        if (g.mode !== 'flight') break;
      }
    });
    return { rails, docked: g.mode === 'docked', lateral };
  };

  const run = fly(arrive(20_260_951), true);
  check('the rails take the ship', run.rails);
  check('...and a pilot who matches the slot docks', run.docked);
  check('...having been held on the line, inside the channel',
    run.lateral < SLOT_HALF_ACROSS, `${run.lateral.toFixed(0)} units off the axis`);
}
