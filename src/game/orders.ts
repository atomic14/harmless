// Everything this commander is under orders to do, as one list.
//
// A STANDING ORDER is an obligation that outlives the moment it is announced.
// The game has two kinds: a signed contract, and the Navy mission. Until
// docs/TODO/144 they shared one line under the station header, and the contract
// won it — so a commander who took any job before the Navy briefed her was
// never told where the Constrictor was (GitHub #27).
//
// The two kinds were never comparable before, because nothing had ever asked
// them the same question. This is that question, asked once, so that the menu
// line, the MISSIONS screen and the charts cannot hold three answers.
//
// This module is where docs/INVARIANTS.md invariant 16 lives: a standing order
// has a screen, a console line never holds the only copy of one, and a surface
// that carries orders never drops one kind for another.
//
// IT RESTATES NO RULE. A contract's words come from `describeContract`
// (contract-offers.ts) and the mission's from `missionOrderLine`
// (missions.ts). Both stay the one home of their own prose. This file joins
// them and sorts them, and that is all it does.

import type { CommanderData, Contract } from './commander.ts';
import { dayWord } from './commander.ts';
import type { StarSystem } from '../galaxy/galaxy.ts';
import { describeContract } from './contract-offers.ts';
import {
  contractDestinations, contractVerdict, type ContractVerdict,
} from './contract-eta.ts';
import { missionDestination, missionLeg } from './missions.ts';

/** The Navy leg, named as an order. `MissionLeg` (missions.ts) is its source. */
export interface NavyOrder {
  readonly kind: 'navy';
  /** the order in words, upper case, WITHOUT the warning */
  readonly line: string;
  readonly destination: number;
  /** what the leg pays on completion, in tenths of a credit */
  readonly reward: number;
  /** what her gun is worth against the target, or '' when it will do */
  readonly warning: string;
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
   * A screen needs two facts no summary does: whether the run is illicit, and
   * how far along a bounty is. Carrying the contract beats inventing a field
   * for each — this order IS a view of that job, and the alternative is a
   * second place that decides what "illicit" means.
   */
  readonly job: Contract;
}

/**
 * One obligation, ready for a row or for a summary.
 *
 * A UNION rather than one shape with nullable fields, and that is load-bearing:
 * a contract always has a deadline and the Navy mission never has one. Written
 * as `daysLeft: number | null` the summary below would need a branch for a case
 * that cannot happen, which is the defensive dead code docs/TODO/142 found and
 * deleted elsewhere.
 */
export type StandingOrder = NavyOrder | ContractOrder;

/**
 * Every standing order this commander holds, most urgent kind first.
 *
 * The Navy mission sorts above the contracts, and the reason is not taste: a
 * board re-offers work every day, and the Navy briefs a commander one time.
 * The contracts then sort by deadline, so the row that decides when she must
 * leave is the row at the top of them.
 */
export function standingOrders(
  c: CommanderData, systems: StarSystem[],
): StandingOrder[] {
  const out: StandingOrder[] = [];

  const leg = missionLeg(c, systems);
  if (leg) out.push({ kind: 'navy', ...leg });

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
 * The charts draw a diamond on each one (docs/TODO/140 M4 built the marker for
 * the contracts). The Navy target had been missing from it, which is the half
 * of GitHub #27 that bites in FLIGHT: the chart is where a pilot picks a
 * destination, and the Constrictor's system looked like any other world.
 *
 * A SET, because two jobs to one world are one diamond, and the Navy can send
 * her to a world she already owes a delivery to.
 */
export function orderDestinations(c: CommanderData): ReadonlySet<number> {
  const marks = new Set(contractDestinations(c));
  const navy = missionDestination(c);
  if (navy !== null) marks.add(navy);
  return marks;
}

/**
 * What the chart says about the system under the cursor, or null when nothing
 * sends her there.
 *
 * A CONTRACT ANSWERS FIRST where one system carries both, and that is not
 * arbitrary: a contract has a deadline and the Navy mission does not, so the
 * contract is the line that tells her when she must leave.
 *
 * `daysAway` is the journey the painter measured, with the same three meanings
 * `contractVerdict` gives it — a number of days, `0` for standing on it, and
 * `null` for no chain of full-tank jumps that reaches it.
 */
export function orderVerdict(
  c: CommanderData, systemIndex: number, daysAway: number | null,
): ContractVerdict | null {
  const owed = contractVerdict(c, systemIndex, daysAway);
  if (owed) return owed;
  if (missionDestination(c) !== systemIndex) return null;

  // No deadline, so nothing here can be late. `NO ROUTE` is red all the same:
  // it is not a deadline she will miss, it is a world she cannot reach.
  if (daysAway === null) return { text: 'NAVY MISSION · NO ROUTE', late: true };
  if (daysAway === 0) return { text: 'NAVY MISSION · YOU ARE HERE', late: false };
  return { text: `NAVY MISSION · ${dayWord(daysAway)} AWAY`, late: false };
}

/**
 * The one amber line under the station header.
 *
 * ONE ENTRY PER KIND, and every kind it holds is named. That is the whole
 * defect #27 reported: the line used to print the first contract and stop, so
 * two jobs hid the Navy mission completely. A count covers the contracts it
 * does not print; nothing covers a kind, because a kind that is merely counted
 * is a kind the commander cannot act on.
 *
 * It carries orders and never warnings. The gun warning is long enough to push
 * the order off the screen on its own, and the MISSIONS screen is one keystroke
 * away — which is what invariant 16 asks of an announcement.
 *
 * '' when she is under no orders at all. The menu then draws nothing.
 */
export function ordersSummary(orders: readonly StandingOrder[]): string {
  const parts: string[] = [];

  const navy = orders.find((o): o is NavyOrder => o.kind === 'navy');
  if (navy) parts.push(navy.line);

  const contracts = orders.filter((o): o is ContractOrder => o.kind === 'contract');
  const head = contracts[0];
  if (head) {
    const more = contracts.length - 1;
    parts.push(`${head.line} — ${dayWord(head.daysLeft)}`
      + (more > 0 ? ` (+${more} MORE)` : ''));
  }
  return parts.join(' · ');
}
