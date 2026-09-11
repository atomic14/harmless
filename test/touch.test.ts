// Flying by touch, with no browser (docs/TODO/204 M2).
//
// The tracker is pure: a finger's down, move and up, by pointer id, and the
// stick, the trigger and the wanted speed it writes. The overlay's listeners
// are the platform half, and Chrome drives those.

import { TouchTracker, sliderFraction, stickFromDrag, type TouchTarget } from '../src/engine/touch.ts';
import { TOUCH_STICK_TRAVEL } from '../src/constants/touch.ts';
import { Input } from '../src/engine/input.ts';
import { flightDemand, throttleToward, type FlightControls } from '../src/engine/flight-controls.ts';
import { keymap } from '../src/engine/keymap.ts';
import { PLAYER_FLIGHT } from '../src/constants/player-flight.ts';
import { check, eq } from './harness.ts';

/** A target that records what the tracker writes, and the keys it holds. */
function target(): TouchTarget & { held: Set<string> } {
  const held = new Set<string>();
  return {
    mouseFlight: false, mouseX: 0, mouseY: 0, stickHeld: false, wantedSpeed: null, held,
    press: (code) => { held.add(code); },
    release: (code) => { held.delete(code); },
  };
}
const FIRE = 'KeyA';
const tracker = (t: TouchTarget) => new TouchTracker(t, () => FIRE, () => ({ top: 100, height: 200 }));

console.log('\nthe stick is the finger\'s offset from where it landed');
{
  eq('half the travel is half deflection', stickFromDrag(100, 100, 100 + TOUCH_STICK_TRAVEL / 2, 100).x, 0.5);
  eq('...and it clamps at one', stickFromDrag(100, 100, 100 + TOUCH_STICK_TRAVEL * 3, 100).x, 1);
  eq('the raw drag reads down as positive; the tracker turns it over for the nose', stickFromDrag(0, 0, 0, TOUCH_STICK_TRAVEL).y, 1);
  eq('the slider is one at its top', sliderFraction(100, 100, 200), 1);
  eq('...zero at its bottom', sliderFraction(300, 100, 200), 0);
  eq('...and clamps past either end', sliderFraction(500, 100, 200), 0);
}

console.log('\na finger on the view steers, holds, and lets the stick decay when it lifts');
{
  const t = target();
  const k = tracker(t);
  k.down(1, 'view', 200, 300);
  check('a landed finger takes the stick and holds it', t.mouseFlight && t.stickHeld && t.mouseX === 0 && t.mouseY === 0);
  k.move(1, 200 + TOUCH_STICK_TRAVEL / 2, 300 - TOUCH_STICK_TRAVEL / 4);
  eq('a drag right is half a stick right', t.mouseX, 0.5);
  eq('...and a drag up raises the nose a quarter, because a finger points where it wants to go', t.mouseY, 0.25);
  k.down(2, 'view', 50, 50);
  k.move(2, 150, 50);
  eq('a second finger on the view does not take the stick', t.mouseX, 0.5);
  k.up(1);
  check('the lifted finger leaves the stick to decay', !t.stickHeld && t.mouseX === 0.5);
}

console.log('\nFIRE holds the trigger while another finger steers');
{
  const t = target();
  const k = tracker(t);
  k.down(1, 'view', 200, 300);
  k.down(2, 'fire', 350, 600);
  check('the fire finger holds the layout\'s fire key', t.held.has(FIRE));
  k.move(1, 200 + TOUCH_STICK_TRAVEL / 2, 300);
  eq('...while the first finger still steers', t.mouseX, 0.5);
  k.up(2);
  check('lifting the fire finger releases the key and leaves the stick', !t.held.has(FIRE) && t.stickHeld && t.mouseX === 0.5);
}

console.log('\nthe throttle slider sets the wanted speed');
{
  const t = target();
  const k = tracker(t);
  k.down(3, 'throttle', 30, 150);
  eq('a touch a quarter of the way down asks for three quarters of top speed', t.wantedSpeed, 0.75);
  k.move(3, 30, 300);
  eq('...and a slide to the bottom asks for a stop', t.wantedSpeed, 0);
  k.up(3);
  eq('the wanted speed holds after the finger lifts', t.wantedSpeed, 0);
}

console.log('\nthe input holds the stick for a finger, and decays it for a mouse');
{
  const i = new Input();
  i.mouseFlight = true;
  i.mouseX = 1;
  i.stickHeld = true;
  i.decayMouse(1);
  eq('a held stick does not decay', i.mouseX, 1);
  i.stickHeld = false;
  i.decayMouse(0.5);
  check('...and a released one does', i.mouseX < 1);
}

console.log('\na wanted speed drives the throttle, and a key overrides it (docs/TODO/204 M1)');
{
  // The hands, as the block above shapes them, with a slider on the side.
  const at = (speed: number, wanted: number | null, ...keys: string[]) => {
    const down = new Set(keys);
    const h: FlightControls = {
      held: (...codes) => codes.some((c) => down.has(c)),
      mouseFlight: false, mouseX: 0, mouseY: 0, mouseFire: false, wantedSpeed: wanted,
    };
    return flightDemand(h, keymap(), { rollRate: 0, pitchRate: 0, speed }, 1 / 60).throttle;
  };
  const max = PLAYER_FLIGHT.maxSpeed;
  const band = PLAYER_FLIGHT.throttleBand;
  eq('below the wanted speed the throttle opens', at(100, 0.5), 1);
  eq('above it the throttle brakes', at(300, 0.5), -1);
  eq('at it the ship coasts', at(max * 0.5, 0.5), 0);
  eq('...and inside the band, so it does not hunt', at(max * 0.5 - band + 1, 0.5), 0);
  eq('...but just outside the band it moves', at(max * 0.5 - band - 1, 0.5), 1);
  eq('with no wanted speed and no key, the ship coasts as it always did', at(100, null), 0);
  eq('a held speed key overrides the slider', at(100, 0.5, 'Slash'), -1);
  eq('...and so does the other one', at(300, 0.5, 'Space'), 1);
  eq('a caller with no speed gets no throttle from the slider', throttleToward(0.5, undefined), 0);
}
