// The law, as numbers: what is illegal, what a record costs at the dock, and
// how far the Galactic Government can see.
//
// The rules that spend these — the scan, the fine, the offence ladder — are
// game/law.ts, which is the one place your standing with the law is decided.

/** The three legal statuses, in the order the number encodes them. The names
 *  are what the screens print; the constants below are what rules compare against. */
export const LEGAL_NAMES = ['Clean', 'Offender', 'Fugitive'] as const;

export const CLEAN = 0;
export const OFFENDER = 1;
export const FUGITIVE = 2;

/**
 * Commodity indices the Galactic Government defines as illegal: slaves,
 * narcotics and firearms. The single home for the definition. Indices into the
 * same 1984 table as `commodities.ts`; none of the classes overlap.
 */
export const CONTRABAND: readonly number[] = [3, 6, 10];

/**
 * The fine for docking with a record, capped at what you can actually pay.
 * Tenths of a credit (invariant 8), so these are 25 Cr and 75 Cr.
 */
export const OFFENDER_FINE = 250;
export const FUGITIVE_FINE = 750;

/**
 * Misbehave within this range of the station slot and Vipers launch. Same
 * number as `PLAYER_INTEREST_RANGE` but a different rule: this is measured from
 * the STATION and decides whether the law shows up, not who engages you.
 */
export const DEFENCE_RANGE = 9000;

/** How close a police ship must be to scan your hold. */
export const SCAN_RANGE = 2600;
