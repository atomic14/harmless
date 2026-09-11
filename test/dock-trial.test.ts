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
import { check, eq } from './harness.ts';

console.log('\nthe last stretch into the slot');

// --- the two controls, and nothing else --------------------------------------
{
  const trial = actionButtonsFor({
    fireKey: 'KeyA', missiles: 3, armed: false, locked: false, armKey: 'KeyT',
    launchKey: 'KeyM', ecmKey: 'KeyE', targets: null, missileInbound: false,
    trial: true, accelKey: 'Space', decelKey: 'KeyX', rollStripCode: 'roll',
  });
  eq('the stretch shows a strip and two held buttons, and no guns',
    trial.map((b) => b.label).join(), 'DRAG TO ROLL,THRUST,BRAKE');
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
