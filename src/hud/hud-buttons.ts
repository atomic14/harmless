// A strip of buttons over the flight view (docs/TODO/205 M5).
//
// The course list in flight is a row of buttons, and not a screen. Under a
// screen the flight world stops. So a list that must stay up while the ship
// flies cannot be one. docs/TODO/204 found the same shape for its flight menu.
//
// Each button carries the code it sends in `data-key`, as a menu row does.
// The shell turns a click into that keystroke, and the Game answers it. So a
// button is one more way to press a key, and it decides nothing.
//
// A PAINTER, like the rest of the HUD. It rebuilds its markup only when the
// buttons change, because it runs every frame. A tap that lands between two
// identical frames must still find its button in place.

/** One button: the code it sends, and what it says. */
export interface HudButton {
  readonly code: string;
  readonly label: string;
  /** why the button cannot do its work now. A pick of it refuses, and says so */
  readonly note?: string;
  /** the button is on: a course the ship flies now */
  readonly lit?: boolean;
  /** a second, quieter line: what a press does */
  readonly hint?: string;
  /**
   * The button holds its code down while it is held, as the laser button
   * does, rather than sending it once (`engine/hold-buttons.ts`).
   */
  readonly hold?: boolean;
}

/** Plain text only: a label is words, so the markup cannot carry any. */
const text = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export class ButtonStrip {
  private readonly el: HTMLElement;
  /** what the strip shows now, so a steady strip is not rebuilt */
  private shown = '';

  constructor(el: HTMLElement) {
    this.el = el;
  }

  paint(buttons: readonly HudButton[]): void {
    const html = buttons.map((b) =>
      `<div ${b.hold ? 'data-hold' : 'data-key'}="${text(b.code)}"`
      + ` class="hud-button${b.note ? ' dim' : ''}${b.lit ? ' lit' : ''}">`
      + `${text(b.label)}${b.note ? `<span class="note">${text(b.note)}</span>` : ''}`
      + `${b.hint ? `<span class="hint">${text(b.hint)}</span>` : ''}</div>`).join('');
    if (html === this.shown) return;
    this.shown = html;
    this.el.innerHTML = html;
  }
}
