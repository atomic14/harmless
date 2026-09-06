// A job from a station's bulletin board, as data: the shape a contract has.
//
// It was the middle of commander.ts, which is about the SHAPE of a commander.
// A contract is a thing a commander holds, and it has a shape of its own. The
// split came when docs/TODO/190 M1 pushed commander.ts over the size ceiling.
// The union and the reason for it moved together, word for word.
//
// The rules that spend a contract stay where they were. `contract-offers.ts`
// owns the board, `contracts.ts` owns settlement, and `contract-eta.ts` owns
// what the charts say. This file holds no rule. It holds the record they read.

/**
 * What every job on a station's bulletin board carries.
 *
 * `Contract` below adds the fields one KIND of job uses. This half is the part
 * that has one meaning for all five (docs/TODO/185 M1).
 */
interface ContractBase {
  destination: number; // system index
  /** tonnes on a cargo or smuggling run, kills on a bounty, heads on a passenger job */
  qty: number;
  reward: number; // tenths of a credit
  deadlineDay: number;
}

/**
 * A job from a station's bulletin board. Available from your first landing, so
 * a new commander always has something to chase (the original made you earn the
 * first mission with 16 kills).
 *
 * **A KIND DECLARES ONLY THE FIELDS IT USES** (docs/TODO/185 M1). It was one
 * flat record of seven fields until then, and three of the seven changed
 * meaning with the tag or meant nothing at all. `commodity` said "cargo and
 * smuggling runs only" in a comment, and the compiler cannot read a comment. A
 * courier job carried one, because the type demanded a number, and nothing ever
 * read it.
 *
 * THE HOUSE ALREADY USES THIS SHAPE. `CombatEvent`, `ContractEvent` and the
 * trainer's `TraderControl` are each a union on `kind`.
 *
 * **`qty` IS STILL ONE NAME FOR THREE THINGS**, and it is on the base because
 * every kind carries it. docs/TODO/185 M2 asks whether the name should split.
 * That question is about the SAVE, because a field name is written into the
 * saved JSON.
 *
 * **A SAVE WRITTEN BEFORE THE UNION STILL LOADS**, and no saved byte moved.
 * `test/contract-union.test.ts` holds that claim, and it states why.
 */
export type Contract =
  /** Freight, and the contraband run that loads exactly like it. */
  | (ContractBase & { kind: 'cargo' | 'smuggle'; commodity: number })
  /** Kills, counted by `combat-wreck.ts` as they happen. */
  | (ContractBase & { kind: 'bounty'; progress: number })
  /** Sealed data. It carries nothing, so it reclaims nothing. */
  | (ContractBase & { kind: 'courier' })
  /** Heads. The berths compete with freight for the same bays. */
  | (ContractBase & { kind: 'passenger' });

/**
 * The two kinds that load a consignment, and the only two that name goods.
 *
 * Three rules in `game/contracts.ts` read a `commodity`, and each one is
 * reachable only for these two. The alias is what lets each say so in its own
 * signature, rather than test the tag again (docs/TODO/185 M1).
 */
export type ConsignmentContract = Extract<Contract, { commodity: number }>;
