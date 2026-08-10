// The law: what a scan finds, what a record costs, and what an attack does to
// your standing.
//
// The contraband set had FOUR homes — ILLEGAL_GOODS in commander.ts, a
// CONTRABAND Set in contracts.ts, and the bare literals `idx === 3 || idx === 6
// || idx === 10` in both screens/trade.ts and test/campaign.ts. Four copies of
// three magic numbers, kept in step by hope. This file consolidated them, and
// the numbers themselves are constants/law.ts now; everything about your
// standing with the Galactic Government is still decided here and nowhere else.

import { COMMODITIES } from '../galaxy/galaxy.ts';
import {
  BRIBE_FLOOR, BRIBE_SHARE, CLEAN, CONTRABAND, FUGITIVE, FUGITIVE_FINE,
  LAW_ROLE_NAMES, LEGAL_NAMES, OFFENDER, OFFENDER_FINE, PATROL_BRIBE_FINES,
  SCAN_RANGE, SCAN_WARN_RANGE,
} from '../constants/law.ts';
import { DISREPUTE_BRIBE } from '../constants/character.ts';
import { VALUE_PER_TONNE } from '../constants/jettison.ts';
import { afterDeed } from './character.ts';

/** Is this commodity illegal to carry? */
export function isContraband(commodity: number): boolean {
  return CONTRABAND.includes(commodity);
}

/** Tonnes of illegal cargo in a hold. */
export function contrabandTonnes(cargo: readonly number[]): number {
  return CONTRABAND.reduce((sum, i) => sum + (cargo[i] ?? 0), 0);
}

/** Anything at all to hide from a police scan? */
export function carryingContraband(cargo: readonly number[]): boolean {
  return contrabandTonnes(cargo) > 0;
}

/** The fine for docking with a record, capped at what you can actually pay. */
export function fineFor(legalStatus: number, credits: number): number {
  if (legalStatus <= CLEAN) return 0;
  return Math.min(credits, legalStatus >= FUGITIVE ? FUGITIVE_FINE : OFFENDER_FINE);
}

/**
 * Buying your name back at a station: what a commander is left with after
 * paying to clear a record, or `null` when there is nothing to clear.
 *
 * The station does not fine you at the door any more (station.ts) — this is the
 * optional half. The charge is `fineFor`, capped at what you can pay, so a broke
 * commander is not trapped as a Fugitive; the cost is the credits, not the
 * impossibility. The caller applies the result and sets the status Clean.
 */
export function recordCleared(
  legalStatus: number, credits: number,
): { paid: number; creditsLeft: number } | null {
  if (legalStatus <= CLEAN) return null;
  const paid = fineFor(legalStatus, credits);
  return { paid, creditsLeft: credits - paid };
}

/**
 * What the nearest police ship is close enough to DO about a dirty hold, at
 * `distance` world units.
 *
 * One home for the two ranges, spent twice: `world-step.ts` reads it every
 * frame to decide between the scan and the telegraph that precedes it, and the
 * bribe (game.ts) reads it to decide whether there is an inspection to buy off.
 * Written out in both places, the offer would be free to disagree with the
 * warning that prompts it — you would read POLICE PATROL CLOSING and press the
 * key and be told there is nobody there.
 */
export function patrolReach(distance: number): 'scan' | 'warn' | 'none' {
  if (distance < SCAN_RANGE) return 'scan';
  return distance < SCAN_WARN_RANGE ? 'warn' : 'none';
}

/**
 * What a policeman wants to not read your hold, in tenths of a credit.
 *
 * Priced off what you are PROTECTING — the evidence, at what the market pays
 * for it (`VALUE_PER_TONNE`, the same rule the jettison toll and the pirate's
 * assessment price a hold by) — because that is the sum a third party doing the
 * looking-away is doing too. `BRIBE_SHARE` is his cut of it and `BRIBE_FLOOR`
 * is what the risk costs him regardless.
 *
 * Rounded, because money is integer tenths (invariant 8).
 */
export function inspectionPrice(cargo: readonly number[]): number {
  const value = CONTRABAND.reduce(
    (sum, i) => sum + (cargo[i] ?? 0) * COMMODITIES[i].basePrice * VALUE_PER_TONNE, 0);
  return Math.max(BRIBE_FLOOR, Math.round(value * BRIBE_SHARE));
}

/**
 * What ONE police ship already hunting you wants to break off, in tenths.
 *
 * Priced off your STANDING and not your hold: what a policeman wants to look
 * away from a Fugitive is not a function of what is in the bay, and a Fugitive
 * with an empty hold is the commander who most needs the offer to exist. The
 * rung's fine is the law's own statement of what the rung is worth
 * (`PATROL_BRIBE_FINES` says how much worse than paying it this is).
 *
 * `fineFor` is not reused: it caps at what you can pay, which is right for a
 * fine you cannot escape and wrong for a price you can fail to meet. A Clean
 * commander pays the Offender's rate — the only way to be shot at by the law
 * with a clean record is to have provoked it, and the deed he is ignoring is
 * the same deed either way.
 */
export function patrolPrice(legalStatus: number): number {
  return PATROL_BRIBE_FINES * (legalStatus >= FUGITIVE ? FUGITIVE_FINE : OFFENDER_FINE);
}

/** What an offer of `price` does: taken and paid for, or short by this much. */
export type BribeAnswer =
  | { readonly bought: false; readonly price: number; readonly short: number }
  | {
    readonly bought: true; readonly price: number;
    readonly creditsLeft: number; readonly disrepute: number;
  };

/**
 * Offer it: what a commander is left with, or what they are short.
 *
 * The same shape as `recordCleared` above and for the same reason — the rule
 * works out the arithmetic and the caller writes it down (invariant 10). What
 * it will not do is half-work: an offer you cannot cover buys nothing and
 * spends nothing, which is what makes the shortfall worth printing.
 *
 * **It always costs your name.** `DISREPUTE_BRIBE` is applied here rather than
 * left to the caller, so no future half of this feature can quietly ship the
 * version where money makes consequences go away. The record is untouched:
 * buying your name back is `recordCleared` at a station, by choice, and it is
 * the only thing that clears one.
 */
export function bribeOffered(
  price: number, credits: number, disrepute: number,
): BribeAnswer {
  if (credits < price) return { bought: false, price, short: price - credits };
  return {
    bought: true,
    price,
    creditsLeft: credits - price,
    disrepute: afterDeed(disrepute, DISREPUTE_BRIBE),
  };
}

/**
 * Does a ship of this role come after a commander at this legal status, on the
 * record alone?
 *
 * The other half of the ladder `offenceFor` climbs, and the only home of it:
 * `npc.ts`'s `isHostileToPlayer` spends this to decide who attacks, and the
 * console spends it to say what a record has just cost you. Written out in
 * both places, the message would be free to lie about the rule.
 *
 * Police hunt **Fugitives**; bounty hunters take an interest in **Offenders**.
 * That split is deliberate and it is why the Viper that scans a smuggler goes
 * back to patrolling: contraband is a fine-level offence, not shoot-on-sight.
 * Provocation is not this function's business — shooting at anything makes it
 * personal, whatever your record says.
 */
export function lawTakesInterest(role: string, legalStatus: number): boolean {
  if (role === 'police') return legalStatus >= FUGITIVE;
  if (role === 'hunter') return legalStatus >= OFFENDER;
  return false;
}

/**
 * A record, in the one line the console has: the status you hold and who that
 * brings after you.
 *
 * The reason it exists is a flight report — a smuggler was scanned, read
 * CONTRABAND DETECTED, and watched the Viper that scanned him carry on
 * patrolling. Nothing was wrong; the consequence was simply invisible, because
 * `raiseLegal`'s own LEGAL STATUS line is overwritten by the scan's in the same
 * frame. So the world says what it did instead of shrugging.
 *
 * Assembled from `lawTakesInterest` rather than written out, which is what
 * stops it promising a fight the rules will not deliver — and what makes it
 * still true if the ladder is ever re-cut. A Clean commander is told nothing
 * beyond the status, because nobody is coming.
 */
export function recordVerdict(legalStatus: number): string {
  const status = `RECORD: ${(LEGAL_NAMES[legalStatus] ?? '?').toUpperCase()}`;
  const hunting = LAW_ROLE_NAMES
    .filter(([role]) => lawTakesInterest(role, legalStatus))
    .map(([, called]) => called);
  return hunting.length ? `${status} — ${hunting.join(' AND ')} WILL ENGAGE` : status;
}

/**
 * How far your standing falls for harming a given ship.
 *
 * Shooting at police, traders or bounty hunters is an offence; destroying one
 * makes you a fugitive. Pirates, thargoids and rocks are nobody's business but
 * your own — the galaxy is glad to see the back of them.
 */
export function offenceFor(role: string, destroyed: boolean): number {
  if (role !== 'police' && role !== 'trader' && role !== 'hunter') return CLEAN;
  return destroyed ? FUGITIVE : OFFENDER;
}
