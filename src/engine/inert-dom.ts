import { HEADLESS_WIDTH, HEADLESS_HEIGHT } from '../constants/camera.ts';

// A DOM element that accepts every write and performs none of them.
//
// The painters — hud.ts, tunnel.ts — cache elements in field initializers. So a
// single `document.getElementById` in any of them made the whole `Game`
// unconstructible under node. That is why the largest file in the project had
// zero test coverage. The orchestrator did not need a browser. Three of its
// fields did.
//
// The bargain is the same one game/storage.ts makes with localStorage, and the
// one world/corona-texture.ts makes with canvas. The code that knows about the
// platform is the code that copes with an absent platform.
//
// Nothing a painter does has to SUCCEED for the game to be correct. The HUD is
// a dumb painter (docs/INVARIANTS.md invariant 15), and nothing reads it back.
// It only has to not throw.
//
// This is emphatically not a DOM implementation. If a rule ever depends on what
// one of these returns, that rule is in the wrong file.

/** The `style` members that are functions, so the sink returns one. */
const STYLE_METHODS = new Set(['setProperty', 'removeProperty', 'getPropertyValue']);

/** An element-shaped sink. Reads give empty values; writes go nowhere. */
export function inertElement(): HTMLElement {
  const el = {
    textContent: '',
    innerHTML: '',
    width: 0,
    height: 0,
    // Reads give '', and writes go nowhere. `style.setProperty()` is a WRITE
    // that happens to be a call: the energy gauge sets a custom property. So
    // the three CSSStyleDeclaration methods have to be callable sinks, rather
    // than the empty string.
    style: new Proxy({}, {
      get: (_t, prop) => (STYLE_METHODS.has(prop as string) ? () => '' : ''),
      set: () => true,
    }),
    classList: {
      add: () => {}, remove: () => {}, toggle: () => false, contains: () => false,
    },
    // Same bargain as `style`. A real element always has a `dataset`. The
    // short-range chart reads one key of it and deletes it, to decide whether
    // to repaint its portrait. Reads give undefined here, so the sink always
    // says "the cursor moved". The painter then always repaints — nowhere.
    dataset: new Proxy({}, {
      get: () => undefined,
      set: () => true,
      deleteProperty: () => true,
    }),
    setAttribute: () => {},
    appendChild: () => {},
    addEventListener: () => {},
    querySelectorAll: () => [],
    querySelector: () => null,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
    /** a 2D context whose every method is a no-op, for the two canvases */
    getContext: () => new Proxy({}, {
      get: (_t, prop) => (prop === 'canvas' ? el : () => undefined),
      set: () => true,
    }),
  };
  return el as unknown as HTMLElement;
}

/** `getElementById`, or an inert stand-in when there is no document. */
export function elementById(id: string): HTMLElement {
  if (typeof document === 'undefined') return inertElement();
  return document.getElementById(id) ?? inertElement();
}

/**
 * Replace an element's children with `count` fresh ones of `tag`, and hand
 * them back. With no document, hand back that many sinks.
 *
 * It is for a gauge whose SHAPE is a rule rather than a layout. The energy
 * gauge is drawn in as many segments as the pool reads as banks (systems.ts's
 * `ENERGY_BANKS`). So the markup cannot be the place that says four. The count
 * written into play.html would be the same number in two files, kept in step
 * by hope.
 */
export function fillWith(parent: HTMLElement, tag: string, count: number): HTMLElement[] {
  if (typeof document === 'undefined') {
    return Array.from({ length: count }, () => inertElement());
  }
  parent.innerHTML = '';
  return Array.from({ length: count }, () => {
    const child = document.createElement(tag);
    // `parent` may itself be a sink, from an id absent in a real document. Its
    // appendChild returns nothing. So the child is what we hand back, and never
    // what appendChild gives us.
    parent.appendChild(child);
    return child;
  });
}

/**
 * The viewport, or a sensible pretend one with no window.
 *
 * The tunnel sizes its canvas to the window every frame it runs. That was the
 * last thing between a headless Game and a LAUNCH.
 *
 * The headless test found it, and the compiler did not. A DOM global is
 * ambient, so `window.innerWidth` type-checks perfectly in a file that can
 * never run.
 */
export function viewport(): { width: number; height: number } {
  if (typeof window === 'undefined') return { width: HEADLESS_WIDTH, height: HEADLESS_HEIGHT };
  return { width: window.innerWidth, height: window.innerHeight };
}
