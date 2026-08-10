// Buying your way out of a fight.
//
// Pirates came for cargo, not for you. Give them enough of it and the
// opportunists break off to go collect, which turns "I can't win this fight"
// from a death into a decision — the most interesting thing you can do with a
// full hold and failing shields.
//
// Two rules, and they were braided together inside a 65-line method of
// game.ts: WHAT you dump (the most valuable thing first, because that is what
// buys peace) and WHETHER it is enough (an appetite that scales with what you
// arrived carrying, so a fat trader is asked for more than a poor one).
//
// ...and then a third, because there is a second reason to empty a hold in a
// hurry and it wants the opposite tonne. A police warning asks for the
// EVIDENCE, which on the 1984 price table is usually not the good stuff — see
// `dumpContraband`. One ordering, two eligible sets, and each rule stated
// where somebody changing it will read it.
//
// All pure. The Game spawns the canisters and says the lines.

import { COMMODITIES } from '../galaxy/galaxy.ts';
import { CONTRABAND } from '../constants/law.ts';
import {
  GANG_FLOOR, GANG_SHARE, OPPORTUNIST_FLOOR, OPPORTUNIST_SHARE, VALUE_PER_TONNE,
} from '../constants/jettison.ts';

export interface Dumped {
  /** commodity indices, one entry per tonne, most valuable first */
  tonnes: number[];
  /** total worth in tenths of a credit */
  value: number;
  /** the last thing dumped, for the message */
  lastName: string;
}

/**
 * Take `tonnes` off the hold, most valuable first, out of `eligible` when it is
 * given and out of the whole hold when it is not. Mutates `cargo`.
 *
 * The ordering is one mechanism; WHAT it may reach is the difference between
 * the two rules below, and each of them says its own out loud.
 */
function dumpBest(cargo: number[], tonnes: number, eligible?: readonly number[]): Dumped {
  const out: Dumped = { tonnes: [], value: 0, lastName: '' };
  for (let t = 0; t < tonnes; t++) {
    let best = -1;
    let bestPrice = 0;
    for (const i of eligible ?? cargo.keys()) {
      if ((cargo[i] ?? 0) <= 0) continue;
      if (COMMODITIES[i].basePrice > bestPrice) {
        bestPrice = COMMODITIES[i].basePrice;
        best = i;
      }
    }
    if (best < 0) break;
    cargo[best] -= 1;
    out.tonnes.push(best);
    out.value += bestPrice * VALUE_PER_TONNE;
    out.lastName = COMMODITIES[best].name.toUpperCase();
  }
  return out;
}

/**
 * Take `tonnes` off the hold, most valuable first. Mutates `cargo`.
 *
 * Most-valuable-first is the rule that makes jettisoning a real choice: it
 * costs you the good stuff, so it is never free to try. Pirate appetites are
 * priced against that (`constants/jettison.ts`), which is why it is a rule and
 * not a convenience.
 */
export function dumpCargo(cargo: number[], tonnes: number): Dumped {
  return dumpBest(cargo, tonnes);
}

/**
 * Take `tonnes` of ILLEGAL cargo off the hold, most valuable contraband first.
 * Mutates `cargo`.
 *
 * A separate rule rather than a flag on `dumpCargo`, because the two orderings
 * answer different questions. The pirate's is "what buys peace", and against
 * the 1984 price table it reaches Narcotics (the most valuable commodity in the
 * game) at once — but Firearms are 7th of 17 and Slaves are 14th, so a smuggler
 * running slaves under a hold of furs and platinum had to throw nearly the
 * whole cargo overboard to reach the evidence. The warning said dump and the
 * dump key threw the profit away while the crime stayed aboard.
 *
 * This reaches the evidence, and only the evidence, from `CONTRABAND` — the set
 * that already has exactly one home. The value still counts toward a bribe:
 * contraband thrown at a pirate buys peace exactly as anything else does.
 */
export function dumpContraband(cargo: number[], tonnes: number): Dumped {
  return dumpBest(cargo, tonnes, CONTRABAND);
}

/** What it takes to buy off one pirate. */
export function appetiteOf(organised: boolean, arrivalCargoValue: number): number {
  return Math.max(
    organised ? GANG_FLOOR : OPPORTUNIST_FLOOR,
    arrivalCargoValue * (organised ? GANG_SHARE : OPPORTUNIST_SHARE));
}

export interface Bribe {
  /** how many broke off this time */
  bought: number;
  /** the smallest extra amount that would buy off one more, or null */
  stillWant: number | null;
}

/**
 * Who is satisfied now? Sets `satisfied` on the ones who are.
 *
 * @param jettisonedValue everything dumped this encounter, not just this dump
 * — the toll accumulates, so a second handful can finish what the first started.
 */
export function offerBribe(
  pirates: readonly {
    state: { alive: boolean; organised: boolean; satisfied: boolean };
  }[],
  jettisonedValue: number,
  arrivalCargoValue: number,
): Bribe {
  let bought = 0;
  let stillWant = Infinity;
  for (const npc of pirates) {
    if (!npc.state.alive || npc.state.satisfied) continue;
    const appetite = appetiteOf(npc.state.organised, arrivalCargoValue);
    if (jettisonedValue >= appetite) {
      npc.state.satisfied = true;
      bought += 1;
    } else {
      stillWant = Math.min(stillWant, appetite - jettisonedValue);
    }
  }
  return { bought, stillWant: Number.isFinite(stillWant) ? stillWant : null };
}
