// Render one screen painter under Node. Read back the HTML it wrote, or the
// canvas calls it made.
//
// WHY THIS EXISTS. `src/ui/screens.ts` paints into `#screen` and is inert with
// no document (engine/inert-dom.ts), so under `npm test` every screen painter
// runs and writes nowhere. That is correct for a painter nothing reads back —
// and it also meant no test could ever assert that a screen SAYS something.
// docs/TODO/140 needed exactly that: the day is on the COMMANDER screen and on
// the docked menu, or it is not.
//
// THE ONE RULE. `test/run.ts` imports every test file into one Node process, and
// four modules branch on `typeof document === 'undefined'`. A leaked stub would
// change what every later file is testing. So the global is set and restored in
// the same synchronous block, in a `finally`. `withDocument` below is the one
// place that does it. Every capture takes the painter and hands no stub out, so
// nothing can hold one open.
//
// This is not a DOM and not a canvas. It answers `getElementById` and owns a
// `body`, because that is all `show()` touches, and it records canvas calls
// without drawing them. If a screen ever needs more, add the smallest thing
// that screen needs.

import { inertElement } from '../src/engine/inert-dom.ts';

/**
 * Install a recording `document`, run `paint`, and put back what was there.
 *
 * THE ONE PLACE that touches the global, so the rule at the top of this file
 * has one home. Every capture below goes through it.
 */
function withDocument(byId: (id: string) => HTMLElement, paint: () => void): void {
  const g = globalThis as { document?: unknown };
  const had = 'document' in g;
  const before = g.document;
  g.document = {
    getElementById: byId,
    createElement: () => inertElement(),
    body: inertElement(),
  };
  try {
    paint();
  } finally {
    if (had) g.document = before;
    else delete g.document;
  }
}

/**
 * Run `paint` with a recording `document` installed, and return what landed in
 * `#screen`.
 *
 * `paint` must be synchronous — the global is gone by the time this returns.
 */
export function capture(paint: () => void): string {
  return captureById(paint).get('screen') ?? '';
}

/**
 * Run `paint` with a recording `document` installed. Return what landed on
 * every element that `paint` asked for by id.
 *
 * The charts need this and `capture` does not. A chart paints a canvas under
 * one id and its info line under another id, and the info line carries the
 * words. Each id gets one sink, and every later ask gets that same sink. So a
 * painter that reads its own element back sees the same object. The short-range
 * chart reads `dataset.system` in this way.
 *
 * The value is the element's `innerHTML`. It is the element's `textContent`
 * when the painter wrote plain text instead. Both charts' info lines use both.
 */
export function captureById(paint: () => void): Map<string, string> {
  const seen = new Map<string, HTMLElement>();
  const byId = (id: string): HTMLElement => {
    const found = seen.get(id);
    if (found) return found;
    const made = inertElement();
    seen.set(id, made);
    return made;
  };
  withDocument(byId, paint);
  return new Map([...seen].map(([id, el]) => [id, el.innerHTML || el.textContent || '']));
}

/** One call a painter made on a canvas, with the colours in force at the time. */
export interface CanvasOp {
  /** The context method: `moveTo`, `arc`, `stroke`, `fillRect`, and the rest. */
  readonly method: string;
  readonly args: readonly unknown[];
  readonly strokeStyle: string;
  readonly fillStyle: string;
}

/**
 * Run `paint` with a recording `document`, and return every canvas call it made,
 * keyed by the id of the canvas it drew on.
 *
 * WHY A SECOND HELPER. `captureById` reads the words a screen wrote. A chart
 * also DRAWS, and `inert-dom.ts` gives it a context whose every method returns
 * undefined — correct for a painter nothing reads back, and it left the marks on
 * the charts untestable. A marker drawn nowhere and a marker never drawn look
 * the same from the info line (docs/TODO/140 M4).
 *
 * The colours are recorded per call rather than as a list of their own. A stroke
 * says what it is by its colour, and the colour is set on the context one line
 * before the shape.
 *
 * `width` and `height` are given because the sink canvas has none, and both
 * chart painters scale every coordinate by them. At 0 the whole chart lands on
 * one point and no test could tell two systems apart.
 *
 * This is not a canvas. It records calls and draws nothing, so a test can assert
 * WHAT was asked for and never how it looks.
 */
export function captureCanvas(
  paint: () => void,
  width: number,
  height: number,
): Map<string, CanvasOp[]> {
  const ops = new Map<string, CanvasOp[]>();
  const seen = new Map<string, HTMLElement>();
  const byId = (id: string): HTMLElement => {
    const found = seen.get(id);
    if (found) return found;
    const log: CanvasOp[] = [];
    ops.set(id, log);
    const made = recordingCanvas(width, height, log);
    seen.set(id, made);
    return made;
  };
  withDocument(byId, paint);
  return ops;
}

/** An element whose 2D context appends every call to `log`. */
function recordingCanvas(width: number, height: number, log: CanvasOp[]): HTMLElement {
  const el = inertElement() as unknown as Record<string, unknown>;
  el.width = width;
  el.height = height;
  const paints = { strokeStyle: '', fillStyle: '' };
  const isPaint = (prop: string): prop is keyof typeof paints => prop in paints;
  const ctx = new Proxy({}, {
    get: (_t, prop) => {
      const name = String(prop);
      if (name === 'canvas') return el;
      if (isPaint(name)) return paints[name];
      return (...args: unknown[]) => {
        log.push({ method: name, args, ...paints });
      };
    },
    set: (_t, prop, value) => {
      const name = String(prop);
      if (isPaint(name)) paints[name] = String(value);
      return true;
    },
  });
  el.getContext = () => ctx;
  return el as unknown as HTMLElement;
}
