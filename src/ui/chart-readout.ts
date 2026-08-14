// What the chart says about the star under the cursor.
//
// Split out of `ui/screens.ts` by docs/TODO/149. Two questions, and they are one
// subject because the second is always asked about the answer to the first:
// WHICH star is under the cursor (`nearestSystem`), and what it would cost to
// go there (`journey`, and the two terms that word it).
//
// ONE MEASUREMENT, HANDED TO BOTH TERMS. The info line says the journey twice —
// once as what it costs, once as how far away a deadline is — and two
// measurements would let one line contradict itself. `journey` is called once
// per repaint and the number is passed in, which is why `daysTerm` and
// `contractTerm` take a `Journey` rather than a galaxy.
//
// The words and the verdict are `game/orders.ts` and `galaxy/route.ts`. This is
// the markup around them.

import { type StarSystem } from '../galaxy/galaxy.ts';
import { distanceSqToPoint, oneJumpDays } from '../galaxy/navigation.ts';
import { routeEstimate } from '../galaxy/route.ts';
import { type CommanderData, dayWord } from '../game/commander.ts';
import { orderVerdict } from '../game/orders.ts';
import { overlayLegend, type ChartOverlay } from '../game/chart-overlay.ts';

/**
 * Nearest system to a chart coordinate, within `radius` chart units
 * (measured with the half-weight-y metric the charts are drawn in).
 */
export function nearestSystem(
  systems: StarSystem[],
  x: number,
  y: number,
  radius = 12,
): StarSystem | null {
  let best: StarSystem | null = null;
  let bestD = radius * radius;
  for (const s of systems) {
    const d = distanceSqToPoint(s, x, y);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}
/** What the journey under the cursor costs, when the chart can price it. */
interface Journey {
  /** Days for the whole journey. 0 for the system you stand in. */
  days: number;
  /** Jumps it takes. 0 for the system you stand in. */
  jumps: number;
  /** More than one jump, so the number is a plan and not a certainty. */
  estimate: boolean;
}
/**
 * How far away the system under the cursor is, in days — or null when no chain
 * of full-tank jumps reaches it.
 *
 * ONE HOME for that question, because two screens ask it in two ways. The days
 * term below spells the number. The contract verdict compares it against a
 * deadline. Two measurements would let one line say a journey takes 6 days and
 * the next term call the same journey too far by one.
 *
 * `oneJumpDays` comes first, so a jump the pilot can make NOW is priced as a
 * certainty. `routeEstimate` answers for everything beyond the tank.
 */
export function journey(
  systems: StarSystem[],
  current: StarSystem,
  near: StarSystem,
  fuelTenths: number,
): Journey | null {
  if (near.index === current.index) return { days: 0, jumps: 0, estimate: false };
  const one = oneJumpDays(current, near, fuelTenths);
  if (one !== null) return { days: one, jumps: 1, estimate: false };
  const route = routeEstimate(systems, current, near);
  if (route === null) return null;
  return { days: route.days, jumps: route.jumps, estimate: true };
}
/**
 * ` &middot; 3 DAYS` for the jump under the cursor, or nothing — on both charts.
 *
 * A jump costs three things: fuel, money and days. Both info lines gave the
 * first two and never gave the third (docs/TODO/140 M2). A pilot who owes a
 * contract needs the third one.
 *
 * Beyond the tank the term becomes ` &middot; EST 7 DAYS, 2 JUMPS`
 * (docs/TODO/140 M3). The word EST is the difference between the two answers
 * and it is not decoration: one jump either happens or mis-jumps, and a route
 * of several jumps is a plan the pilot has not made yet.
 *
 * Two systems get no term at all. The system you stand in costs nothing to
 * reach. A system no chain of full-tank jumps reaches has no cost to state.
 *
 * `oneJumpDays` and `routeEstimate` own the two rules. This function owns the
 * words only, so the two charts cannot word the same cost differently.
 *
 * The days term sits beside the distance. Both are costs of the journey. The
 * economy and the government are not.
 */
export function daysTerm(trip: Journey | null): string {
  if (trip === null || trip.days === 0) return '';
  if (!trip.estimate) return ` &middot; ${dayWord(trip.days)}`;
  return ` &middot; EST ${dayWord(trip.days)},`
    + ` ${trip.jumps} JUMP${trip.jumps === 1 ? '' : 'S'}`;
}
/**
 * ` &middot; DUE IN 6 DAYS &middot; 3 DAYS AWAY` for a system a standing order
 * sends this commander to, or nothing — on both charts.
 *
 * The board sold the job and the chart draws the world. The pilot held the
 * subtraction between them (docs/TODO/140 M4). docs/TODO/144 added the Navy
 * mission to the same line, because the chart is where a pilot decides where to
 * go and the Constrictor's system looked like any other world.
 *
 * `game/orders.ts` owns the words and the verdict. This function owns the
 * markup only, so the two charts cannot word one commitment differently. It
 * takes the whole commander for the reason `contract-eta.ts` states: the
 * deadline is the commander's day, and the galaxy's day is also in scope here.
 *
 * Amber, because that is the colour of a thing you asked for, and it is the
 * colour of the marker on the chart beside it. Red when the deadline cannot be
 * met. The words say TOO FAR as well, so the colour is never the only signal.
 */
export function contractTerm(c: CommanderData, near: StarSystem, trip: Journey | null): string {
  const verdict = orderVerdict(c, near.index, trip === null ? null : trip.days);
  if (verdict === null) return '';
  const tint = verdict.late ? 'var(--hud-red)' : 'var(--hud-amber)';
  return ` &middot; <span class="due" style="color:${tint}">${verdict.text}</span>`;
}

/**
 * The chart keys and what the overlays mean. ONE home, used by both charts:
 * they were two hand-written copies and the second was always the one that
 * fell behind. Chart keys are the screen's own and exempt from the binding
 * tables (see the note at the top of this file), so this line is where they
 * live.
 */
export const chartKeyline = (mode: ChartOverlay): string =>
  'CLICK A SYSTEM TO TARGET IT &middot; ARROWS MOVE &middot; ENTER TARGET'
  + ' &middot; D DATA ON SYSTEM &middot; M MARKET &middot; F FIND &middot; ESC EXIT'
  + ` &middot; ${overlayLegend(mode)} &middot; RED RING: PIRATE ACTIVITY`
  // Both marks that are always on are named here. A mark with no legend is a
  // mystery, and the diamond is the ninth thing on this canvas.
  + ' &middot; AMBER DIAMOND: CONTRACT DUE';
