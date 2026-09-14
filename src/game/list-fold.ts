// Which of the two lists over the flight view is open: the courses, the
// targets, or neither (docs/TODO/215 M2).
//
// Each list folds to one header, closed by default. A tap on a header opens
// its row, and a tap that opens one row folds the other. So the two lists
// share ONE flag, and neither can be open behind the other. The Game owns
// it and hands it to both `course-actions.ts` and `target-actions.ts`.
//
// It is what the buttons show, so no save carries it, as the target list's
// own flag never did.

export type FlightList = 'courses' | 'targets';

export class ListFold {
  private open: FlightList | null = null;

  isOpen(which: FlightList): boolean {
    return this.open === which;
  }

  /** Open `which`, or fold it when it is the one open. The other folds either way. */
  toggle(which: FlightList): void {
    this.open = this.open === which ? null : which;
  }

  /** A pick was made, or a screen opened: nothing stays open. */
  fold(): void {
    this.open = null;
  }
}
