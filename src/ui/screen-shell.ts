// The one way a screen reaches the page, and the seam that lets it not have one.
//
// Every render function in `ui/` ends in `show()`. It was a private helper in
// `ui/screens.ts` while that file held all 25 of them. docs/TODO/149 split them
// by subject, and this came out FIRST, so that no screen module became a hub
// the others reached through.
//
// IT IS FOUR FUNCTIONS AND ONE CLASS NAME, and the class name is the reason it
// must stay one file. `show` adds `screen-open` to the body, and `hideScreen`
// takes it away. A second copy of either would be two things that decide
// whether the cockpit console is on screen. The size gate exists for exactly
// that failure: one rule that quietly grows two homes.
//
// INERT WITH NO DOCUMENT. A headless Game runs the mode machine and the screen
// stack with no DOM at all (`engine/inert-dom.ts`). Every painter in the game
// paints under `npm test` because of these three lines, rather than because
// each painter checks.
//
// Nothing reads these writes back. So a write dropped changes no rule, and that
// is what makes the inert path honest rather than a pretence.

import { elementById, inertElement } from '../engine/inert-dom.ts';

const el = (): HTMLElement => elementById('screen');
const body = (): HTMLElement => (typeof document === 'undefined'
  ? inertElement() : document.body);

/** These four callers already handle a missing element, so null is the honest answer. */
export const maybeById = (id: string): HTMLElement | null => (typeof document === 'undefined'
  ? null : document.getElementById(id));

export function hideScreen(): void {
  body().classList.remove('screen-open');
  el().classList.add('hidden');
}

/**
 * Paint one screen over the page.
 *
 * @param wide charts put their readout beside the map rather than under it, so
 * they need more width than a table screen.
 */
export function show(html: string, wide = false): void {
  const s = el();
  s.innerHTML = html;
  s.classList.remove('hidden');
  s.classList.toggle('wide', wide);
  // Drop the cockpit console while a screen is up. Nothing on a screen needs
  // the scanner or the gauges. Otherwise the console costs the screen a third
  // of the viewport.
  body().classList.add('screen-open');
}
