// A strip you drag with a finger or the mouse (docs/TODO/207 M2).
//
// The last stretch of a docking asks for one thing a button cannot give: how
// MUCH roll, held steady. So a `data-strip` element reads the pointer's
// distance from its own middle, and reports it as a stick between -1 and 1.
// The ship then rolls at that share of its rate, exactly as an arrow key
// rolls it at the whole rate.
//
// PLATFORM, like the held buttons next door, and nothing when the page has no
// document. The strip moves its own knob. The painter rebuilds the markup only
// when the words change, and the knob moves every frame a thumb does.

/** What a strip reports to. */
export interface StripTarget {
  /** the stick, -1 to 1, or null when nothing holds the strip */
  rollStick: number | null;
}

export function attachStripControl(input: StripTarget, doc: Document): void {
  let held: { id: number; el: HTMLElement } | null = null;

  const move = (el: HTMLElement, clientX: number): void => {
    const box = el.getBoundingClientRect();
    const half = box.width / 2;
    const off = Math.max(-1, Math.min(1, (clientX - (box.left + half)) / half));
    input.rollStick = off;
    const knob = el.querySelector<HTMLElement>('.knob');
    if (knob) knob.style.transform = `translateX(${off * (half - knob.offsetWidth / 2)}px)`;
  };

  doc.addEventListener('pointerdown', (e) => {
    const el = (e.target as HTMLElement | null)?.closest?.('[data-strip]') as HTMLElement | null;
    if (!el) return;
    e.preventDefault();
    held = { id: e.pointerId, el };
    move(el, e.clientX);
  });
  doc.addEventListener('pointermove', (e) => {
    if (held && e.pointerId === held.id) move(held.el, e.clientX);
  });
  const letGo = (e: PointerEvent): void => {
    if (!held || e.pointerId !== held.id) return;
    const knob = held.el.querySelector<HTMLElement>('.knob');
    if (knob) knob.style.transform = 'translateX(0)';
    held = null;
    input.rollStick = null;
  };
  doc.addEventListener('pointerup', letGo);
  doc.addEventListener('pointercancel', letGo);
}
