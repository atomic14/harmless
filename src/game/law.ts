// The law: what a scan finds, what a record costs, and what an attack does to
// your standing.
//
// The contraband set had FOUR homes — ILLEGAL_GOODS in commander.ts, a
// CONTRABAND Set in contracts.ts, and the bare literals `idx === 3 || idx === 6
// || idx === 10` in both screens/trade.ts and test/campaign.ts. Four copies of
// three magic numbers, kept in step by hope. This file consolidated them, and
// the numbers themselves are constants/law.ts now; everything about your
// standing with the Galactic Government is still decided here and nowhere else.

import {
  CLEAN, CONTRABAND, FUGITIVE, FUGITIVE_FINE, LAW_ROLE_NAMES, LEGAL_NAMES,
  OFFENDER, OFFENDER_FINE,
} from '../constants/law.ts';

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
