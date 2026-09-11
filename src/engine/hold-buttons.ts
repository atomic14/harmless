// A button that holds a key down while a finger or the mouse holds it
// (docs/TODO/206 M3).
//
// The laser fires while its button is held, as it fires while its key is
// held. A click cannot say that, because a click is one moment. So a
// `data-hold` button presses its code on pointer down and releases it on
// pointer up, through `Input.press` and `Input.release`. The game then reads a
// held key, and it cannot tell a finger from the key.
//
// PLATFORM, like the rest of `Input`'s listeners, and nothing when the page
// has no document. Each pointer is tracked by its id, so a second finger that
// lifts does not let go of the first finger's button.

/** The two calls a held button makes on the input. */
export interface HoldTarget {
  press(code: string): void;
  release(code: string): void;
}

export function attachHoldButtons(input: HoldTarget, doc: Document): void {
  const held = new Map<number, string>();
  doc.addEventListener('pointerdown', (e) => {
    const el = (e.target as HTMLElement | null)?.closest?.('[data-hold]') as HTMLElement | null;
    const code = el?.dataset.hold;
    if (!code) return;
    e.preventDefault();
    held.set(e.pointerId, code);
    input.press(code);
  });
  const letGo = (e: PointerEvent): void => {
    const code = held.get(e.pointerId);
    if (code === undefined) return;
    held.delete(e.pointerId);
    input.release(code);
  };
  doc.addEventListener('pointerup', letGo);
  doc.addEventListener('pointercancel', letGo);
}
