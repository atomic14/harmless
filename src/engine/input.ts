import { CARRY_LIMIT } from '../constants/world-clock.ts';

// Keyboard state with frame-oriented semantics:
//  - held(codes): live keydown state — every continuous control, the trigger
//    included, so nothing in here can queue a shot
//  - pressed(code): consumes ONE tap; pressedCount/drainPresses consume all
//  - endFrame(): the Game calls this at the end of every fixed step
//
// A TAP THAT ARRIVED IN A BUSY FRAME IS NOT LOST: `endFrame()` CARRIES a
// backlog into the next frame (a throttled tab handing a second of keystrokes
// to one slow frame must not lose taps), under two limits:
//
//   INTEREST. Only a key something CONSUMED this frame keeps anything, so no
//   key turns up in a frame that was not already asking for it — a command
//   cannot outlive the state that made it valid. Pinned by `npm test` (a P
//   pressed at the station must not pause the game a step after launch).
//
//   COUNT. At most CARRY_LIMIT taps of a key survive a frame boundary. A key
//   merely HELD banks nothing: auto-repeat is dropped at the listener. A
//   backlog always shrinks — a key only qualifies for a carry by having a tap
//   taken off it.
//
// This cannot queue a SHOT: the trigger, throttle and both turn axes are
// `held()`, which reads live key state and has no memory.
//
// ONE limit for every key, deliberately — no separate bound for commands and
// navigation. This file cannot tell them apart (M is the market docked and a
// missile in flight; Enter picks a menu row and respawns you), so a per-role
// bound would be a second copy of controls.ts's tables. The interest rule
// covers what a role split was wanted for, at no copy.

/**
 * How many unread taps of one key survive a frame boundary.
 * — see constants/world-clock.ts, where it lives beside the catch-up budget
 * it was chosen against.
 */

export class Input {
  private readonly down = new Set<string>();
  /**
   * Taps waiting to be read, oldest first, each carrying its own shift.
   * This frame's arrivals, plus whatever carried.
   *
   * `null` is a REAL keydown: the live modifier state answers for it, exactly
   * as it always has. `true`/`false` is an injected tap, which knows its own
   * shift because a click has no keyboard behind it (docs/TODO/146).
   *
   * A queue rather than a count, and that is the whole design. The shift cannot
   * be a flag on the frame: `commandsFor` tests every binding in one pass, so a
   * frame-wide "shift is down" would let a plain Y satisfy ⇧Y and one click on
   * a menu row would arm every shifted key in the table.
   */
  private readonly tapped = new Map<string, (boolean | null)[]>();
  /** codes something consumed this frame — the only ones whose backlog lives. */
  private readonly read = new Set<string>();

  /**
   * Mouse flight (pointer lock). The pointer's accumulated offset from
   * centre acts like a self-centring joystick: -1..1 on each axis, decaying
   * when the mouse is still so the ship settles rather than drifting.
   */
  mouseFlight = false;
  mouseX = 0;
  mouseY = 0;
  mouseFire = false;
  private readonly canvas: HTMLElement | null;

  constructor() {
    // No DOM, no listeners — the key STATE above is portable, only the wiring
    // is not, and a headless Game drives that state directly. Same bargain as
    // game/storage.ts with localStorage: the file that knows about the platform
    // copes with it being absent.
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      this.canvas = null;
      return;
    }
    this.canvas = document.getElementById('scene');
    document.addEventListener('pointerlockchange', () => {
      this.mouseFlight = document.pointerLockElement === this.canvas;
      if (!this.mouseFlight) {
        this.mouseX = 0;
        this.mouseY = 0;
        this.mouseFire = false;
      }
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.mouseFlight) return;
      // ~450px of travel = full deflection
      this.mouseX = Math.max(-1, Math.min(1, this.mouseX + e.movementX / 450));
      this.mouseY = Math.max(-1, Math.min(1, this.mouseY + e.movementY / 450));
    });
    document.addEventListener('mousedown', (e) => {
      if (this.mouseFlight && e.button === 0) this.mouseFire = true;
    });
    document.addEventListener('mouseup', (e) => {
      if (this.mouseFlight && e.button === 0) this.mouseFire = false;
    });
    window.addEventListener('keydown', (e) => {
      // auto-repeat is not a tap — also what makes the endFrame() carry safe
      // against a stalled loop: a key HELD across a stall arrives as one tap.
      if (e.repeat) return;
      // '?' gets its own virtual code so shift+/ works even when the shift
      // keydown itself isn't observable (e.g. synthetic events)
      const code = e.code === 'Slash' && e.shiftKey ? 'Question' : e.code;
      this.down.add(code);
      this.queue(code).push(null);        // a real key: `held` answers for it
      if (e.code === 'Space' || e.code === 'Tab' || e.code === 'Slash') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
      if (e.code === 'Slash') this.down.delete('Question');
    });
    window.addEventListener('blur', () => this.down.clear());
  }

  /**
   * Queue a press as though the key had been struck — lets clickable UI reuse
   * the keyboard handlers (including virtual codes like 'VirtBuyMax' that no
   * physical key produces). Arrives THIS frame and is dropped at the end of it
   * unless something read that key, exactly as a keystroke is.
   */
  injectPress(code: string, shift = false): void {
    this.queue(code).push(shift);
  }

  /** The queue for a code, created empty on first use. */
  private queue(code: string): (boolean | null)[] {
    const q = this.tapped.get(code);
    if (q) return q;
    const made: (boolean | null)[] = [];
    this.tapped.set(code, made);
    return made;
  }

  /**
   * Was the NEXT tap of this code an injected shifted one?
   *
   * `null` when it was a real keydown, or when there is no tap: both mean "ask
   * `held`", which is what every physical press has always been answered by.
   *
   * IT PEEKS. `controls.ts` tests the modifier before it consumes the tap — see
   * `fires` — so this must not take the tap it is reporting on.
   */
  tapShift(code: string): boolean | null {
    const q = this.tapped.get(code);
    return q && q.length ? q[0] : null;
  }

  held(...codes: string[]): boolean {
    return codes.some((c) => this.down.has(c));
  }

  /** True once per physical key press; consumed on read. */
  pressed(code: string): boolean {
    const q = this.tapped.get(code);
    if (!q || !q.length) return false;
    q.shift();
    // somebody is draining this key, which is what earns its backlog a carry
    this.read.add(code);
    return true;
  }

  /** Number of presses since last read; consumed on read. */
  pressedCount(code: string): number {
    const n = this.tapped.get(code)?.length ?? 0;
    this.tapped.delete(code);
    return n;
  }

  /** All pressed key codes this frame (oldest first); consumed on read. */
  drainPresses(): string[] {
    const codes: string[] = [];
    for (const [code, q] of this.tapped) {
      for (let i = 0; i < q.length; i++) codes.push(code);
    }
    this.tapped.clear();
    return codes;
  }

  /** Ask the browser for pointer lock (must be inside a user gesture). */
  requestMouseFlight(): void {
    this.canvas?.requestPointerLock();
  }

  releaseMouseFlight(): void {
    if (this.mouseFlight) document.exitPointerLock();
  }

  /** Self-centring: without input the virtual stick eases back to neutral. */
  decayMouse(dt: number): void {
    const k = Math.max(0, 1 - dt * 1.5);
    this.mouseX *= k;
    this.mouseY *= k;
  }

  /**
   * Close the frame: keep the backlog of a key somebody is reading, drop
   * everything else. A key read this frame keeps up to CARRY_LIMIT of what is
   * left; a key that was not keeps nothing. See the header for both limits.
   */
  endFrame(): void {
    for (const [code, q] of [...this.tapped]) {
      // The carry keeps the OLDEST taps, so a carried one keeps the shift it
      // arrived with. Dropping from the front would hand the next frame a tap
      // wearing another one's modifier.
      if (this.read.has(code) && q.length > 0) this.tapped.set(code, q.slice(0, CARRY_LIMIT));
      else this.tapped.delete(code);
    }
    this.read.clear();
  }
}
