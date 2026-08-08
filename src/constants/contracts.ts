// The station bulletin board: how much work you may hold, and how far away a
// job may send you.
//
// The board itself — pay, deadlines, settlement — is game/contracts.ts, whose
// reward formula stays there, pinned in aggregate by `npm run campaign`.

import { MAX_FUEL } from './commander.ts';

/** The most work you may hold at once. Single home for a threshold game.ts and
 *  the balance harness both read, so they play the same-sized board. */
export const MAX_CONTRACTS = 3;

/**
 * How far away, in tenths of a light year, a contract may send you: exactly as
 * far as a full tank reaches. Reads the tank so the two cannot drift, and
 * `test/contracts.test.ts` holds the offer generator to this bound both sides.
 */
export const CONTRACT_RANGE = MAX_FUEL;
