// Render one screen painter under Node, and read back the HTML it wrote.
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
// the same synchronous block, in a `finally`, and `capture` takes the painter
// rather than handing the stub out — there is no way to hold one open.
//
// This is not a DOM. It answers `getElementById` and owns a `body`, because
// that is all `show()` touches. If a screen ever needs more, add the smallest
// thing that screen needs.

import { inertElement } from '../src/engine/inert-dom.ts';

/**
 * Run `paint` with a recording `document` installed, and return what landed in
 * `#screen`.
 *
 * `paint` must be synchronous — the global is gone by the time this returns.
 */
export function capture(paint: () => void): string {
  const screen = inertElement();
  const g = globalThis as { document?: unknown };
  const had = 'document' in g;
  const before = g.document;
  g.document = {
    getElementById: (id: string) => (id === 'screen' ? screen : inertElement()),
    createElement: () => inertElement(),
    body: inertElement(),
  };
  try {
    paint();
  } finally {
    if (had) g.document = before;
    else delete g.document;
  }
  return screen.innerHTML;
}
