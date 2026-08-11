// How the chart overlays are DRAWN and READ — the two numbers that decide how
// faint a quiet trade lane gets and how much of a lane's cargo the detail line
// spells out.
//
// The thresholds that decide WHICH lanes and systems are flagged at all are
// rules of the living galaxy and live in ./living-galaxy.ts. These two are
// legibility: they would move if the canvas grew, and nothing in the simulation
// reads either.

/**
 * The alpha the quietest drawn trade lane keeps, with the busiest at 1.
 *
 * A floor rather than a plain ratio: without one the tail of the network fades
 * to nothing and the fade has silently become a second, invisible threshold on
 * top of `BUSY_LANE_CONVOYS`. At 0.35 a one-load lane is clearly there and
 * clearly quieter than an artery carrying five times as much.
 *
 * Its own rule id: it shares the value 0.35 with two steering angles, a spawn
 * chance, a share of receptions and the docking follower's lookahead. Six
 * unrelated 0.35s, and this is the only one that is an alpha.
 *
 * @rule chart.laneFadeFloor
 */
export const LANE_FADE_FLOOR = 0.35;

/**
 * How many of a lane's commodities the detail line names before it counts the
 * rest ("+2").
 *
 * Three fits beside the systems, the convoy count, the tonnage and the arrival
 * on one keyline at the width both charts are drawn at; the list is ordered
 * heaviest-first, so what gets dropped is the shipment nobody would have asked
 * about.
 */
export const LANE_CARGO_NAMED = 3;
