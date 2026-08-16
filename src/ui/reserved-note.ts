// A note that holds its own height whether it is there or not.
//
// Split out of `ui/screens.ts` by docs/TODO/149. It has its own file for the
// reason `portrait.ts` has one: two otherwise unrelated readers. The combat
// trainer's setup panel paints its help and brain notes through it. The
// test-mode screen paints its one warning through it.
//
// THE RESERVE IS THE POINT. A note that appears and disappears moves everything
// under it. So the caller passes the WIDEST text the slot can ever hold, and the
// markup keeps that much room either way. A panel whose rows jump as you arrow
// down them is a panel you cannot read.

/**
 * A block of notes that always occupies the height of its worst case.
 *
 * `reserve` is painted first and made invisible. `live` sits on top of it in
 * the same grid cell. The taller of the two sets the height. So a new warning
 * does not push the rows above it up by a line while the cursor sits on one of
 * them.
 *
 * The wrap is included for free, and that is why this is a ghost rather than a
 * line count.
 */
export const reservedNotes = (
  live: readonly string[], reserve: readonly string[], tone: string,
): string => {
  const lines = (xs: readonly string[]): string =>
    xs.map((t) => `<div class="keyline ${tone}">${t}</div>`).join('');
  return `<div class="reserved">
      <div class="hold" aria-hidden="true">${lines(reserve)}</div>
      <div>${lines(live)}</div>
    </div>`;
};
