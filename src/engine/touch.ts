// Flying by touch: drag anywhere on the view to steer, hold FIRE, and slide
// the throttle (docs/TODO/204 M2).
//
// TWO HALVES. `TouchTracker` is pure. It takes a finger's down, move and up,
// with a pointer id and a place. It writes the stick, the trigger and the
// wanted speed into a small target that `Input` satisfies. A test drives it
// with plain numbers. `attachTouch` is the platform half. It binds the
// browser's pointer events on the overlay to the tracker. It is the only
// code here that reads the DOM. `Input` calls it when the page has the overlay.
//
// THE STICK IS THE MOUSE STICK. A finger's offset from where it landed is the
// same -1..1 pair the mouse fills, and `flightDemand` reads nothing new. Two
// things differ. A held finger holds its deflection, where a still mouse
// decays: `stickHeld` tells `Input.decayMouse` to wait. And a lifted finger
// decays to centre through the same decay, so the ship settles.
//
// A FINGER IS TRACKED BY ITS POINTER ID. One steers while another holds FIRE,
// and lifting either one leaves the other where it is.

import { TOUCH_STICK_TRAVEL } from '../constants/touch.ts';
import { keymap } from './keymap.ts';

/** What the tracker writes into: the parts of `Input` a finger can move. */
export interface TouchTarget {
  mouseFlight: boolean;
  mouseX: number;
  mouseY: number;
  stickHeld: boolean;
  wantedSpeed: number | null;
  press(code: string): void;
  release(code: string): void;
}

/** Where a finger landed: the view, the FIRE button, the throttle slider, or a command button. */
export type TouchPlace = 'view' | 'fire' | 'throttle' | 'command';

/** The stick a drag asks for: the offset from where the finger landed, clamped to -1..1. */
export function stickFromDrag(x0: number, y0: number, x: number, y: number, travel = TOUCH_STICK_TRAVEL): { x: number; y: number } {
  const clamp = (v: number): number => Math.max(-1, Math.min(1, v));
  return { x: clamp((x - x0) / travel), y: clamp((y - y0) / travel) };
}

/** The speed a slider asks for: 1 at its top, 0 at its bottom, as a fraction of top speed. */
export function sliderFraction(y: number, top: number, height: number): number {
  if (height <= 0) return 0;
  return Math.max(0, Math.min(1, 1 - (y - top) / height));
}

export class TouchTracker {
  private steer: { id: number; x0: number; y0: number } | null = null;
  private fire: number | null = null;
  private throttle: number | null = null;
  private readonly target: TouchTarget;
  /** the fire key of the active layout, read at each press so a layout switch is honoured */
  private readonly fireKey: () => string;
  /** the slider's box, read at each touch so a resize is honoured */
  private readonly slider: () => { top: number; height: number };

  constructor(
    target: TouchTarget,
    fireKey: () => string = () => keymap().fire[0],
    slider: () => { top: number; height: number } = () => ({ top: 0, height: 1 }),
  ) {
    this.target = target;
    this.fireKey = fireKey;
    this.slider = slider;
  }

  down(id: number, place: TouchPlace, x: number, y: number): void {
    if (place === 'fire') {
      if (this.fire === null) { this.fire = id; this.target.press(this.fireKey()); }
      return;
    }
    if (place === 'throttle') {
      this.throttle = id;
      this.setThrottle(y);
      return;
    }
    if (place === 'command') return;   // a tap, and the click seam answers it
    if (this.steer !== null) return;   // one finger steers; a second on the view is ignored
    this.steer = { id, x0: x, y0: y };
    this.target.mouseFlight = true;
    this.target.stickHeld = true;
    this.target.mouseX = 0;
    this.target.mouseY = 0;
  }

  move(id: number, x: number, y: number): void {
    if (this.steer?.id === id) {
      const s = stickFromDrag(this.steer.x0, this.steer.y0, x, y);
      this.target.mouseX = s.x;
      this.target.mouseY = s.y;
    } else if (this.throttle === id) {
      this.setThrottle(y);
    }
  }

  up(id: number): void {
    if (this.steer?.id === id) {
      this.steer = null;
      this.target.stickHeld = false;   // the stick decays to centre from here
    } else if (this.fire === id) {
      this.fire = null;
      this.target.release(this.fireKey());
    } else if (this.throttle === id) {
      this.throttle = null;
    }
  }

  private setThrottle(y: number): void {
    const box = this.slider();
    this.target.wantedSpeed = sliderFraction(y, box.top, box.height);
  }
}

/**
 * Bind the overlay's pointer events to a tracker. The overlay is `#touch`,
 * the button `#touch-fire` and the slider `#touch-throttle`. A page without
 * them, or a headless run, attaches nothing.
 *
 * @returns the tracker, so a caller can read the slider back
 */
export function attachTouch(target: TouchTarget, doc: Document): TouchTracker | null {
  const view = doc.getElementById('touch');
  const fire = doc.getElementById('touch-fire');
  const throttle = doc.getElementById('touch-throttle');
  const commands = doc.getElementById('touch-commands');
  const menu = doc.getElementById('touch-menu');
  if (!view || !fire || !throttle) return null;
  // The flight menu (docs/TODO/204 M4). MENU shows it. A row on it presses
  // its key through the click seam, and hides it. The escape pod row opens
  // the confirmation inside it first. All of that is show and hide. The keys
  // travel the same path a station row's do.
  if (menu) {
    const show = (on: boolean): void => {
      menu.classList.toggle('hidden', !on);
      if (!on) for (const ask of menu.querySelectorAll<HTMLElement>('.touch-ask')) ask.classList.remove('open');
    };
    commands?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('[data-menu]')) show(menu.classList.contains('hidden'));
    });
    menu.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-ask],[data-key]');
      if (!el) return;
      if (el.dataset.ask !== undefined) {
        for (const ask of menu.querySelectorAll<HTMLElement>('.touch-ask')) {
          ask.classList.toggle('open', ask.dataset.asks === el.dataset.ask);
        }
        if (el.dataset.ask === '') show(false);
        return;
      }
      show(false);   // the key is on its way through the seam
    });
  }
  const tracker = new TouchTracker(target, undefined, () => {
    const r = throttle.getBoundingClientRect();
    return { top: r.top, height: r.height };
  });
  const within = (box: HTMLElement | null, el: EventTarget | null): boolean =>
    box !== null && (el === box || (el instanceof Node && box.contains(el)));
  const placeOf = (el: EventTarget | null): TouchPlace =>
    within(fire, el) ? 'fire'
      : within(throttle, el) ? 'throttle'
        : within(commands, el) || within(menu, el) ? 'command'
          : 'view';
  view.addEventListener('pointerdown', (e) => {
    const place = placeOf(e.target);
    if (place === 'command') return;   // let the click through to the seam
    e.preventDefault();
    // The first touch on the view asks for the whole screen (docs/TODO/204
    // M5). A phone's browser bars take a fifth of it otherwise. The browser
    // may refuse, and a refusal costs nothing.
    if (!doc.fullscreenElement && doc.documentElement.requestFullscreen) {
      doc.documentElement.requestFullscreen().catch(() => { /* refused */ });
    }
    tracker.down(e.pointerId, place, e.clientX, e.clientY);
    if (place === 'throttle') throttle.style.setProperty('--throttle', String(target.wantedSpeed ?? 0));
    // capture, so a drag that leaves the overlay still steers; a synthetic
    // pointer has no capture to give, and that is not an error
    try { view.setPointerCapture(e.pointerId); } catch { /* no such pointer */ }
  });
  view.addEventListener('pointermove', (e) => {
    tracker.move(e.pointerId, e.clientX, e.clientY);
    if (target.wantedSpeed !== null) throttle.style.setProperty('--throttle', String(target.wantedSpeed));
  });
  for (const type of ['pointerup', 'pointercancel'] as const) {
    view.addEventListener(type, (e) => tracker.up(e.pointerId));
  }
  return tracker;
}
