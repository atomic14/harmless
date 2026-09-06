// Everything this commander is under orders to do, as one list.
//
// A STANDING ORDER is an obligation that outlives the moment it is announced.
// The game has two kinds: a signed contract, and a live mission. Until
// docs/TODO/144 they shared one line under the station header, and the
// contract won it. So a commander who took any job before the Navy briefed her
// was never told where the Constrictor was (GitHub #27).
//
// The two kinds were never comparable before, because nothing had ever asked
// them the same question. This is that question, asked once, so that the menu
// line, the MISSIONS screen and the charts cannot hold three answers.
//
// This module is where docs/INVARIANTS.md invariant 16 lives:
//
//   - a standing order has a screen;
//   - a console line never holds the only copy of one;
//   - a surface that carries orders never drops one kind for another.
//
// IT RESTATES NO RULE. A contract's words come from `describeContract`
// (contract-offers.ts) and a mission's from its skeleton, through
// `orderLine` (missions/queries.ts). Both stay the one home of their own
// prose. This file joins them and sorts them, and that is all it does.

import type { CommanderData } from './commander.ts';
import type { Contract } from './contract-record.ts';
import { dayWord } from './commander.ts';
import type { StarSystem } from '../galaxy/galaxy.ts';
import { describeContract } from './contract-offers.ts';
import {
  contractDestinations, contractVerdict, type ContractVerdict,
} from './contract-eta.ts';
import { missionWarning } from './mission-bridge.ts';
import type { LiveMission } from '../missions/model.ts';
import {
  legReward, missionDestinations, missionName, orderLine,
} from '../missions/queries.ts';

/** One live mission's current leg, named as an order. */
export interface MissionOrder {
  readonly kind: 'mission';
  /** the order in words, upper case, WITHOUT the warning */
  readonly line: string;
  /** the leg's world, or null when any station will do */
  readonly destination: number | null;
  /** what the leg pays when it goes right, in tenths of a credit */
  readonly reward: number;
  /** what her gun is worth against the target, or '' when it will do */
  readonly warning: string;
  /** the mission this leg belongs to */
  readonly live: LiveMission;
}

/** One signed job off a bulletin board. */
export interface ContractOrder {
  readonly kind: 'contract';
  readonly line: string;
  readonly destination: number;
  /** days to the deadline. Negative means overdue; settlement decides. */
  readonly daysLeft: number;
  readonly reward: number;
  /**
   * The job this describes.
   *
   * A screen needs two facts that no summary needs: whether the run is
   * illicit, and how far along a bounty is. The contract itself beats a field
   * for each. This order IS a view of that job. The alternative is a second
   * place that decides what "illicit" means.
   */
  readonly job: Contract;
}

/**
 * One obligation, ready for a row or for a summary.
 *
 * A UNION rather than one shape with nullable fields, and that is
 * load-bearing. A contract always has a deadline, and a mission leg carries
 * its own deadline day or none. Written as one shape, the summary below would
 * need a branch for a case that cannot happen. That is the defensive dead
 * code docs/TODO/142 found and deleted elsewhere.
 */
export type StandingOrder = MissionOrder | ContractOrder;

/**
 * Every standing order this commander holds, most urgent kind first.
 *
 * A mission sorts above the contracts, and the reason is not taste. A board
 * re-offers work every day. A patron briefs a commander one time. The
 * contracts then sort by deadline, so the row that decides when she must leave
 * is the row at the top of them.
 */
export function standingOrders(
  c: CommanderData, systems: StarSystem[],
): StandingOrder[] {
  const out: StandingOrder[] = [];

  for (const live of c.missions.live) {
    out.push({
      kind: 'mission',
      line: orderLine(live, systems),
      destination: live.target,
      reward: legReward(live),
      warning: missionWarning(c, live),
      live,
    });
  }

  const byDeadline = [...c.contracts].sort((a, b) => a.deadlineDay - b.deadlineDay);
  for (const k of byDeadline) {
    out.push({
      kind: 'contract',
      line: describeContract(k, systems).toUpperCase(),
      destination: k.destination,
      daysLeft: k.deadlineDay - c.day,
      reward: k.reward,
      job: k,
    });
  }
  return out;
}

/**
 * Every system a standing order sends this commander to.
 *
 * The charts draw a diamond on each one. docs/TODO/140 M4 built that marker
 * for the contracts, and the set left the Navy target out. That absence is the
 * half of GitHub #27 that bites in FLIGHT. The chart is where a pilot picks a
 * destination, and the Constrictor's system looked like any other world.
 *
 * A SET, because two jobs to one world are one diamond. The Navy can send her
 * to a world she already owes a delivery to.
 */
export function orderDestinations(c: CommanderData): ReadonlySet<number> {
  const marks = new Set(contractDestinations(c));
  for (const world of missionDestinations(c.missions)) marks.add(world);
  return marks;
}

/**
 * What the chart says about the system under the cursor, or null when nothing
 * sends her there.
 *
 * A CONTRACT ANSWERS FIRST where one system carries both, and that is not
 * arbitrary. A contract has a deadline and the Navy mission does not. So the
 * contract is the line that tells her when she must leave.
 *
 * `daysAway` is the journey the painter measured. It has the same three
 * meanings that `contractVerdict` gives it:
 *
 *   - a number of days;
 *   - `0`, for a commander who stands on the world;
 *   - `null`, for no chain of full-tank jumps that reaches it.
 */
export function orderVerdict(
  c: CommanderData, systemIndex: number, daysAway: number | null,
  systems: readonly StarSystem[],
): ContractVerdict | null {
  const owed = contractVerdict(c, systemIndex, daysAway);
  if (owed) return owed;
  const live = c.missions.live.find((l) => l.target === systemIndex);
  if (!live) return null;
  const name = missionName(live, systems);

  // No deadline, so nothing here can be late. `NO ROUTE` is red all the same:
  // it is not a deadline she will miss, it is a world she cannot reach.
  if (daysAway === null) return { text: `${name} · NO ROUTE`, late: true };
  if (daysAway === 0) return { text: `${name} · YOU ARE HERE`, late: false };
  return { text: `${name} · ${dayWord(daysAway)} AWAY`, late: false };
}

/**
 * The one amber line under the station header.
 *
 * ONE ENTRY PER KIND, and every kind it holds is named. That is the whole
 * defect #27 reported: the line used to print the first contract and stop, so
 * two jobs hid the Navy mission completely. A count covers the contracts it
 * does not print. Nothing covers a kind. A kind that is only counted is a kind
 * the commander cannot act on.
 *
 * It carries orders and never warnings. The gun warning is long enough to push
 * the order off the screen on its own. The MISSIONS screen is one keystroke
 * away, which is what invariant 16 asks of an announcement.
 *
 * ONE LINE PER ENTRY, and the menu draws each on its own row. It was one joined
 * string until Chris read it and said the width is not scarce: *"we don't need
 * to keep it one line"* (2026-08-13). A joined line still WRAPPED at that
 * width — it broke wherever the column ran out, which was usually mid-order.
 *
 * Empty when she is under no orders at all. The menu then draws nothing.
 */
export function ordersSummary(orders: readonly StandingOrder[]): string[] {
  const lines: string[] = [];

  // EVERY MISSION GETS ITS LINE. There are at most three (`MISSION_LIVE_CAP`),
  // and a mission is briefed one time. A count would hide the one order the
  // commander cannot read again anywhere but the MISSIONS screen.
  for (const m of orders) {
    if (m.kind !== 'mission') continue;
    lines.push(m.line);
    // THE WARNING IS BACK, and the one-line budget is why it ever left.
    // docs/TODO/144 M1 cut it, because it is long enough to push the order off
    // the row on its own. That was a length argument, and length is no longer
    // the constraint. It is the one thing on this menu that a commander must
    // not learn forty light years from here (`huntWarning`).
    if (m.warning) lines.push(m.warning);
  }

  const contracts = orders.filter((o): o is ContractOrder => o.kind === 'contract');
  const head = contracts[0];
  if (head) {
    const more = contracts.length - 1;
    lines.push(`${head.line} — ${dayWord(head.daysLeft)}`
      + (more > 0 ? ` (+${more} MORE)` : ''));
  }
  return lines;
}
