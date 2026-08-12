// Can the commander still make the delivery? The chart's answer, in words.
//
// A bulletin board sells a job with a deadline in days. The chart then draws
// the destination and prices the journey. Nothing joined the two, so the pilot
// did the subtraction from memory, on a screen that held both halves
// (docs/TODO/140 M4).
//
// WORDS AND A COLOUR, AND NOTHING ELSE. This module holds no route search and
// paints nothing. The painter measures the journey and hands the number in.
// The colour is here with the words because they say one thing: the red is what
// TOO FAR looks like.
//
// IT TAKES THE COMMANDER, NOT A DAY. `ChartOverlays.day` is the LIVING galaxy's
// day, and both painters hold one. The galaxy catches up by at most 60 days a
// load, so a deadline measured from it is right for months of play and then
// silently wrong on an old save. A commander parameter makes that mistake
// impossible to write.
//
// ON TIME MEANS `daysAway <= daysLeft`, and game/contracts.ts is the authority:
// settlement calls a delivery late when `c.day > k.deadlineDay`. Arrival ON the
// deadline day therefore pays. A pilot who stands on the destination on the
// last day is not late, and the verdict must not say they are.

import type { CommanderData, Contract } from './commander.ts';
import { dayWord } from './commander.ts';

/**
 * Every system this commander owes a delivery to.
 *
 * The charts draw a marker on each one. Two jobs to one destination give one
 * system index, which is what a set is for.
 */
export function contractDestinations(c: CommanderData): ReadonlySet<number> {
  return new Set(c.contracts.map((k) => k.destination));
}

/** What the chart says about a contract destination under the cursor. */
export interface ContractVerdict {
  /** The words for the info line. Upper case, with ` · ` between the parts. */
  text: string;
  /** The deadline cannot be met. The painter draws the line red. */
  late: boolean;
}

/**
 * The verdict for the system under the cursor, or null when no contract sends
 * this commander there.
 *
 * `daysAway` is the journey the painter measured. Three values mean three
 * different things:
 *
 * - a number of days — the journey the chart prices on the same line;
 * - `0` — you stand on the destination, so there is no journey left;
 * - `null` — no chain of full-tank jumps reaches it. Galaxy 7 and galaxy 8 both
 *   hold such a destination, so this is an answer about the map.
 *
 * The tightest deadline wins when two jobs share one destination. That is the
 * one which decides when the commander must leave. The rest are counted and not
 * priced, because the line carries one number for time.
 */
export function contractVerdict(
  c: CommanderData,
  systemIndex: number,
  daysAway: number | null,
): ContractVerdict | null {
  const owed = c.contracts.filter((k: Contract) => k.destination === systemIndex);
  if (owed.length === 0) return null;

  const deadline = Math.min(...owed.map((k) => k.deadlineDay));
  const daysLeft = deadline - c.day;
  // The marker covers every job at this system. A line about one of them, with
  // no sign of the other, would be a lie by omission.
  const more = owed.length > 1 ? ` · +${owed.length - 1} MORE` : '';

  // Already lost. The next landing anywhere expires it (game/contracts.ts), so
  // the distance is no longer a fact the pilot can use.
  if (daysLeft < 0) return { text: `OVERDUE BY ${dayWord(-daysLeft)}${more}`, late: true };

  const due = daysLeft === 0 ? 'DUE TODAY' : `DUE IN ${dayWord(daysLeft)}`;
  if (daysAway === null) return { text: `${due} · NO ROUTE${more}`, late: true };
  // Standing on the destination on the last day still pays. See the note above.
  if (daysAway === 0) return { text: `${due} · YOU ARE HERE${more}`, late: false };

  const late = daysAway > daysLeft;
  // The words as well as the colour. A pilot who cannot separate amber from red
  // must still get the verdict, and the chart already has four other colours on
  // it. The same argument governs the price tells in ui/screens.ts.
  return {
    text: `${due} · ${dayWord(daysAway)} AWAY${late ? ' · TOO FAR' : ''}${more}`,
    late,
  };
}
