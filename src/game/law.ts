// The law: what a scan finds, what a record costs, and what an attack does to
// your standing.
//
// The contraband set had FOUR homes — ILLEGAL_GOODS in commander.ts, a
// CONTRABAND Set in contracts.ts, and the bare literals `idx === 3 || idx === 6
// || idx === 10` in both screens/trade.ts and test/campaign.ts. Four copies of
// three magic numbers, kept in step by hope. This file consolidated them, and
// the numbers themselves are constants/law.ts now. Everything about your
// standing with the Galactic Government is still decided here, and nowhere
// else.

import { COMMODITIES } from '../galaxy/galaxy.ts';
import {
  BRIBE_FLOOR, BRIBE_REFUSED, BRIBE_SHARE, CLEAN, CONTRABAND, FUGITIVE,
  FUGITIVE_FINE, KILLS_PER_RUNG, LAW_ROLE_NAMES, LEGAL_NAMES, OFFENDER, OFFENDER_FINE,
  PATROL_BRIBE_FINES, SCAN_RANGE, SCAN_WARN_RANGE, STATION_TRUCE,
} from '../constants/law.ts';
import { DISREPUTE_BRIBE, DISREPUTE_MAX } from '../constants/character.ts';
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
 * Clearing your legal status at a station: what a commander is left with after
 * paying the fine, or `null` when there is nothing to clear.
 *
 * The station does not fine you at the door any more (station.ts). This is the
 * optional half. The charge is `fineFor`, capped at what you can pay, so a
 * broke commander is not trapped as a Fugitive. The cost is the credits, and
 * not the impossibility. The caller applies the result and sets the status
 * Clean.
 *
 * It is the FAST way and no longer the only one. `recordWorkedOff` below takes
 * a record down a rung at a time for pirate kills, and needs no station
 * (docs/TODO/160). This clears the whole record in one act, and costs money.
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
 * One home for the two ranges, spent twice. `world-step.ts` reads it every
 * frame, to decide between the scan and the telegraph before it. The bribe
 * (game.ts) reads it to decide whether there is an inspection to buy off.
 *
 * Written out in both places, the offer would be free to disagree with the
 * warning that prompts it. You would read POLICE PATROL CLOSING, press the key,
 * and be told there is nobody there.
 */
export function patrolReach(distance: number): 'scan' | 'warn' | 'none' {
  if (distance < SCAN_RANGE) return 'scan';
  return distance < SCAN_WARN_RANGE ? 'warn' : 'none';
}

/**
 * What a policeman wants to not read your hold, in tenths of a credit.
 *
 * Priced off what you are PROTECTING: the evidence, at what the market pays for
 * it. That is `VALUE_PER_TONNE`, the same rule the jettison toll and the
 * pirate's assessment price a hold by. It is the sum a third party who looks
 * away does too. `BRIBE_SHARE` is his cut of it, and `BRIBE_FLOOR` is what the
 * risk costs him regardless.
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
 * Priced off your STANDING rather than your hold. What a policeman wants to
 * look away from a Fugitive is not a function of what is in the bay. A Fugitive
 * with an empty hold is the commander who most needs the offer to exist. The
 * rung's fine is the law's own statement of what the rung is worth.
 * `PATROL_BRIBE_FINES` says how much worse than the fine this is.
 *
 * `fineFor` is not reused. It caps at what you can pay. That is right for a
 * fine you cannot escape, and wrong for a price you can fail to meet.
 *
 * A Clean commander pays the Offender's rate. To provoke the law is the only
 * way to be shot at by it with a clean record. The deed he ignores is the same
 * deed either way.
 */
export function patrolPrice(legalStatus: number): number {
  return PATROL_BRIBE_FINES * (legalStatus >= FUGITIVE ? FUGITIVE_FINE : OFFENDER_FINE);
}

/**
 * How likely this commander is to be refused and reported, from their
 * Character.
 *
 * A ramp rather than a rung. It is `BRIBE_REFUSED` at Honest, and it falls to
 * nothing at the ladder's own ceiling. So every point of disrepute is worth
 * something, rather than four thresholds mattering and the rest being
 * decoration.
 *
 * `DISREPUTE_MAX` is the scale, for the reason `hermitFavour` uses the hermit's
 * own refusal point. A credential is measured against the thing it is a
 * credential for, and this one is "how completely is your reputation made".
 */
export function refusalChance(disrepute: number): number {
  return BRIBE_REFUSED * (1 - Math.min(1, Math.max(0, disrepute) / DISREPUTE_MAX));
}

/** What an offer of `price` does. Exactly one of three things. */
export type BribeAnswer =
  /** you cannot cover it: nothing said, nothing spent */
  | { readonly outcome: 'short'; readonly price: number; readonly short: number }
  /** he will not take it, and you asked in front of him */
  | { readonly outcome: 'refused'; readonly price: number; readonly disrepute: number }
  | {
    readonly outcome: 'paid'; readonly price: number;
    readonly creditsLeft: number; readonly disrepute: number;
  };

/**
 * Offer it: what a commander is left with, what they are short, or what it
 * costs to be turned down.
 *
 * The same shape as `recordCleared` above, and for the same reason: the rule
 * works out the arithmetic, and the caller writes it down (invariant 10).
 *
 * What it will not do is half-work. An offer you cannot cover buys nothing,
 * spends nothing, and is never made. That is why the shortfall is worth
 * printing, and why it does not consume the roll.
 *
 * `roll` is a draw the CALLER takes off the world's seeded stream (invariant
 * 11) — this file has no randomness of its own, so the same seed replays the
 * same refusals.
 *
 * **It always costs your reputation, refusal included.** `DISREPUTE_BRIBE` is
 * applied here rather than left to the caller. So no future half of this
 * feature can quietly ship the version where money makes consequences go away.
 * A refusal costs it too, because the deed is the asking.
 *
 * **The RECORD is untouched either way, and that is a different ladder.** Two
 * rules bring a record down, and neither of them is here. `recordCleared` above
 * is the fine at a station. `recordWorkedOff` below is five pirate kills a rung
 * (docs/TODO/160).
 */
export function bribeOffered(
  price: number, credits: number, disrepute: number, roll: number,
): BribeAnswer {
  if (credits < price) return { outcome: 'short', price, short: price - credits };
  const paid = afterDeed(disrepute, DISREPUTE_BRIBE);
  if (roll < refusalChance(disrepute)) return { outcome: 'refused', price, disrepute: paid };
  return { outcome: 'paid', price, creditsLeft: credits - price, disrepute: paid };
}

/**
 * A pirate kill, against a record. It gives what the commander now holds and
 * what is left on the ledger, or `null` when the kill pays down nothing.
 *
 * The SECOND way a record comes down, beside `recordCleared` above. That one is
 * a fine paid at a station by choice. This one is police work, and it needs no
 * station (docs/TODO/160, GitHub #32).
 *
 * **A Clean commander banks nothing.** There is no record to work off, and a
 * bank of credit earned before a crime is not atonement. So the answer is
 * `null`, and the ledger stays where it is.
 *
 * **The record moves and the REPUTATION does not.** Disrepute is no business of this
 * function, and no caller should make it one. Otherwise a commander could
 * murder a trader, shoot five pirates, and end Clean and Honest at a profit.
 * docs/TODO/156 drew the same line from the other side.
 *
 * The rule does the arithmetic and the caller writes it down (invariant 10),
 * which is the shape `recordCleared` and `bribeOffered` already have.
 */
export function recordWorkedOff(
  legalStatus: number, atonement: number,
): { legalStatus: number; atonement: number } | null {
  if (legalStatus <= CLEAN) return null;
  const paid = atonement + 1;
  if (paid < KILLS_PER_RUNG) return { legalStatus, atonement: paid };
  return { legalStatus: legalStatus - 1, atonement: 0 };
}

/**
 * Does a ship of this role come after a commander at this legal status, on the
 * record alone?
 *
 * The other half of the ladder `offenceFor` climbs, and the only home of it.
 * `npc.ts`'s `isHostileToPlayer` spends this to decide who attacks. The console
 * spends it to say what a record just cost you. Written out in both places, the
 * message would be free to lie about the rule.
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
 * Does the station's truce cover a ship of this role right now?
 *
 * A **truce** is the promise that the lawless leave the commander alone near
 * the port (`STATION_TRUCE`, constants/law.ts). `npc.ts`'s `isHostileToPlayer`
 * is its only reader. That is what makes the ship, the HUD blip, the combat
 * computer and the bribe key give one answer (docs/TODO/158).
 *
 * **The police are NOT covered.** They are the station's own, and a Fugitive
 * who parks on the doorstep must still be hunted. The alternative makes the
 * station the one place a Fugitive is safe from the law.
 *
 * **A Thargoid is not covered.** It does not read the Galactic Government's
 * mail.
 *
 * @param playerToStation how far the COMMANDER is from the station, not the
 * ship. That is what the report asks for. It is one measurement a frame rather
 * than one for every hull. It also stops a hunter who sits just outside the
 * line and shoots across it.
 */
export function truceHolds(role: string, playerToStation: number): boolean {
  if (role !== 'pirate' && role !== 'hunter') return false;
  return playerToStation < STATION_TRUCE;
}

/**
 * A record, in the one line the console has: the status you hold and who that
 * brings after you.
 *
 * It exists because of a flight report. A smuggler was scanned, read CONTRABAND
 * DETECTED, and then watched the Viper that scanned him go back on patrol.
 * Nothing was wrong. The consequence was simply invisible. So the world says
 * what it did, instead of a shrug.
 *
 * **It is what a moved record says, everywhere.** It was written out at the two
 * call sites that wanted it: the scan and the survivor sale. Meanwhile
 * `raiseLegal` said a bare LEGAL STATUS line that `callStationDefence` erased in
 * the same frame, so a murder announced nothing at all. `raiseLegal` (game.ts)
 * queues this and only this now (docs/TODO/130).
 *
 * It is assembled from `lawTakesInterest` rather than written out. That is what
 * stops it from promising a fight the rules will not deliver, and what keeps it
 * true if the ladder is ever re-cut. A Clean commander is told nothing beyond
 * the status, because nobody is coming.
 */
export function recordVerdict(legalStatus: number): string {
  const status = `LEGAL STATUS: ${(LEGAL_NAMES[legalStatus] ?? '?').toUpperCase()}`;
  const hunting = LAW_ROLE_NAMES
    .filter(([role]) => lawTakesInterest(role, legalStatus))
    .map(([, called]) => called);
  return hunting.length ? `${status} — ${hunting.join(' AND ')} WILL ATTACK YOU` : status;
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
