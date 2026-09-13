// A value between two arrows, on a row a finger can step.
//
// The test mode and the trainer's setup each hold a list of rows. The left
// and right arrow keys change the value on the selected row. A phone has no
// arrow key. So each row carries the two as buttons, and each button
// carries the row's own index beside its key. `ScreenHost.click` selects the
// row first, and then sends the key (docs/TODO/216 M3). One home, because
// the two screens are built the same way and a third list would copy it.

/** The value cell's contents: a left arrow, the value, a right arrow. */
export const rowArrows = (row: number, value: string): string =>
  `<button data-row="${row}" data-key="ArrowLeft">&larr;</button>`
  + ` ${value} `
  + `<button data-row="${row}" data-key="ArrowRight">&rarr;</button>`;
