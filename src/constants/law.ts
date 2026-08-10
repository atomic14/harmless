// The law, as numbers: what is illegal, what a record costs at the dock, and
// how far the Galactic Government can see.
//
// The rules that spend these — the scan, the fine, the offence ladder — are
// game/law.ts, which is the one place your standing with the law is decided.

/** The three legal statuses, in the order the number encodes them. The names
 *  are what the screens print; the constants below are what rules compare against. */
export const LEGAL_NAMES = ['Clean', 'Offender', 'Fugitive'] as const;

/**
 * The two roles that come for a commander on the record alone, and what the
 * console calls each of them.
 *
 * Beside `LEGAL_NAMES` because it is the same kind of thing — the words a
 * screen prints for something a rule decides. WHICH of them a given status
 * brings down on you is `game/law.ts`'s `lawTakesInterest`, and nothing here
 * should be read as stating it: this is only the vocabulary.
 */
export const LAW_ROLE_NAMES: readonly (readonly [string, string])[] = [
  ['police', 'POLICE'],
  ['hunter', 'BOUNTY HUNTERS'],
];

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

/**
 * A police ship this close is about to be able to read your hold, and the
 * console says so while it stays there.
 *
 * Two constraints, and the second is the one worth pinning:
 *
 *  - it is ABOVE `SCAN_RANGE`, so the warning is a band the scan sits inside
 *    rather than a second name for it;
 *  - it is at or below `SCANNER_RANGE` (6,000, constants/console.ts), so you
 *    are never warned about a ship you cannot see. The blip is on the scanner,
 *    which is what makes "which one?" a question with an answer.
 *
 * The width of the band, 1,800, is the distance the player's Cobra covers in
 * about four and a half seconds at its 400 u/s top speed (`PLAYER_FLIGHT`) —
 * long enough to read a line and decide, flying flat out straight at a patrol,
 * which is the worst case that is not deliberate. A cop closing on you as well
 * shortens it, and the repeat below is what covers that.
 */
export const SCAN_WARN_RANGE = 4400;

/**
 * Seconds between repeats of that warning while a patrol stays in the band.
 *
 * A repeat rather than a one-shot on entering the band: a one-shot has to know
 * whether a ship is CLOSING, which needs a previous distance per ship that the
 * step does not keep. Repeating while a cop is in the band is the same
 * information without the bookkeeping, and it goes quiet by itself.
 *
 * SECONDS, and it shares its value with `FUGITIVE` eleven lines above by pure
 * accident — the id says so, because a legal status and a message cadence
 * sitting at 2 in the same file is exactly the coincidence somebody tidies into
 * a bug.
 *
 * @rule law.scanWarnRepeat
 */
export const SCAN_WARN_REPEAT = 2;

/**
 * What a policeman charges to not read your hold: this share of what the
 * contraband aboard is worth at market (`VALUE_PER_TONNE`,
 * constants/jettison.ts, which is the one home of what a tonne fetches).
 *
 * HALF, and the half is the whole argument. The other answer to a patrol
 * closing is to dump the evidence, which costs you all of it — so a bribe that
 * cost as much as the cargo would never be worth making, and one that cost a
 * token would delete the choice from the other side. Half of what he is
 * ignoring is a cut a smuggler can live with and still feel.
 *
 * Deliberately NOT priced off `OFFENDER_FINE`: 25 Cr is what the station
 * charges for the paperwork, and a man looking away from a hold of narcotics is
 * not selling the same thing. Anchoring them together would make one move the
 * other. A light hold is caught by the floor below rather than by this.
 *
 * Its own rule id: half is a popular number, and every other 0.5 in the
 * catalogue — what a bad name is worth to a pirate, how far a cone opens, how
 * far a gun leads — is an answer to a different question and must stay free to
 * move without moving this.
 *
 * @rule law.bribeShare
 */
export const BRIBE_SHARE = 0.5;

/**
 * ...but never less than this, so a light run is not a free pass. 50 Cr, in
 * tenths of a credit (invariant 8).
 *
 * The same shape as `OPPORTUNIST_FLOOR` and for the same reason, and the reason
 * bites harder here: Slaves are 14th of 17 on the 1984 price table, so a tonne
 * of them is worth 16 Cr and a share of that is not a bribe, it is a tip. The
 * floor is what the risk costs HIM, independent of what you happen to be
 * carrying — which is also why the owner is the law rather than the jettison
 * domain it resembles: a pirate's floor is the least he will call a payday, and
 * this is the least a policeman will call a career worth gambling.
 *
 * Its own rule id: it shares the value 500 with `PURSUIT_RANGE`,
 * `EXTEND_RANGE_MIN` and `STATION_DEFENCE_STANDOFF`, which are distances in
 * world units.
 *
 * @rule law.bribeFloor
 */
export const BRIBE_FLOOR = 500;

/**
 * How long the scan's own line holds the console — and so how long the verdict
 * that explains it waits behind it.
 *
 * ONE number because it is one rule: the console shows a single line, so a
 * verdict pushed in the same frame would simply erase the CONTRABAND DETECTED
 * it exists to explain. The delay is the lifetime, exactly.
 *
 * Seconds. The other 4s in the catalogue are tonnes, missiles and chart units;
 * none of them is this, and none of them moves with it.
 *
 * @rule law.scanLineSeconds
 */
export const SCAN_LINE_SECONDS = 4;
