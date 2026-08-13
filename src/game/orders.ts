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
// IT RESTATES NO RULE. A contract's words come from `describeContract`
// (contract-offers.ts) and the mission's from `missionOrderLine`
// (missions.ts). Both stay the one home of their own prose. This file joins
// them and sorts them, and that is all it does.

import type { CommanderData } from './commander.ts';
import { dayWord } from './commander.ts';
import type { StarSystem } from '../galaxy/galaxy.ts';
import { describeContract } from './contract-offers.ts';
import { missionLeg } from './missions.ts';

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
    });
  }
  return out;
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
