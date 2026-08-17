// The law, as numbers: what is illegal, what a record costs at the dock, and how
// far the Galactic Government can see.
//
// The rules that spend these are game/law.ts: the scan, the fine and the offence
// ladder. That file is the one place where your standing with the law is decided.

/** The three legal statuses, in the order the number encodes them. The names are
 *  what the screens print. The constants below are what rules compare against. */
export const LEGAL_NAMES = ['Clean', 'Offender', 'Fugitive'] as const;

/**
 * The two roles that come for a commander on the record alone, and what the
 * console calls each of them.
 *
 * It sits beside `LEGAL_NAMES` because it is the same kind of thing: the words a
 * screen prints for something that a rule decides. WHICH of them a given status
 * brings down on you is `game/law.ts`'s `lawTakesInterest`. Nothing here should
 * be read as a statement of that. This is only the vocabulary.
 */
export const LAW_ROLE_NAMES: readonly (readonly [string, string])[] = [
  ['police', 'POLICE'],
  ['hunter', 'BOUNTY HUNTERS'],
];

/**
 * What the console says when the commander's own laser first lands on a ship
 * the law protects, one line per role.
 *
 * It sits beside `LAW_ROLE_NAMES` for the same reason that one is here. It is
 * the vocabulary, and never the rule. `game/law.ts`'s `harmVerdict` decides
 * WHEN a line is said, and it asks `offenceFor` which roles are covered. Read
 * nothing here as a statement of that set.
 *
 * Each line names the ship and then its answer. That is Chris's standard of
 * 2026-08-16: a player who reads a string once must know what it meant. The two
 * law roles come for you, and the clause is the one the bribe refusal already
 * says (game/law-actions.ts). A trader runs instead, so the third line promises
 * no fight that `isHostileToPlayer` will not deliver.
 */
export const HARM_LINES: readonly (readonly [string, string])[] = [
  ['police', 'POLICE SHIP HIT — AND NOW HE IS COMING FOR YOU'],
  ['hunter', 'BOUNTY HUNTER HIT — AND NOW HE IS COMING FOR YOU'],
  ['trader', 'TRADER HIT — AND THAT IS AN OFFENCE'],
];

export const CLEAN = 0;

/**
 * The middle rung of the legal ladder, and the one a stray shot reaches.
 *
 * It has its own rule id. It is a RUNG of a three-value ladder, and the ten
 * other constants at 1 are counts, gains, distances and spans of seconds. The
 * ladder's own two neighbours carry no id, because neither of them collides.
 *
 * @rule law.offender
 */
export const OFFENDER = 1;
export const FUGITIVE = 2;

/**
 * How close to the station the commander must be for the truce to hold.
 *
 * A **truce** is the promise that a pirate and a bounty hunter leave the
 * commander alone near the port. The station's Vipers start a fight that
 * neither can finish, and this keeps the one place where a player can catch
 * their breath.
 *
 * TWO rules spend it, which is why it lives with the law rather than with the
 * spawner that used to own it as `AMBUSH_STANDOFF`. `game/law.ts`'s
 * `truceHolds` decides who may engage. `game/encounters.ts` refuses to warp a
 * pirate wave in inside the same range. A wave that arrived there would be
 * bound by the truce the moment it existed.
 *
 * It is well outside the station's mass lock (5,000, `torus.ts`), so the quiet
 * zone is bigger than the mass-lock zone. It is the same number as `npc.ts`'s
 * 7,000 give-up range for NPC-on-NPC hunts, which is a different rule.
 *
 * The token heuristic reads the name and offers the amble as its home. The
 * amble is a READER of this, not its owner: `constants/amble.ts` uses it as a
 * floor because a truced role can do nothing inside it. What the number states
 * is who may engage the commander, and that is the law's.
 *
 * @domain law
 */
export const STATION_TRUCE = 7000;

/**
 * The commodity indices that the Galactic Government defines as illegal: slaves,
 * narcotics and firearms. It is the single home for the definition. They are
 * indices into the same 1984 table as `commodities.ts`, and none of the classes
 * overlap.
 */
export const CONTRABAND: readonly number[] = [3, 6, 10];

/**
 * The fine for a dock with a record, capped at what you can actually pay. They
 * are in tenths of a credit (invariant 8), so these are 25 Cr and 75 Cr.
 */
export const OFFENDER_FINE = 250;
export const FUGITIVE_FINE = 750;

/**
 * Pirate kills that take a legal record down one rung.
 *
 * The second way a record comes down, and the first that needs no station
 * (`recordWorkedOff`, game/law.ts, docs/TODO/160). Ten of them take a Fugitive
 * to Clean.
 *
 * **The arithmetic that chooses five.** A pirate's bounty runs 4 to 22 credits
 * across the roster (game/ship-specs.ts), and most of the band sits near 10.
 * So five kills earn about 50 credits. One rung costs 25 credits as an
 * Offender and 75 as a Fugitive. So the fight route pays for itself and then
 * some, at a cost of five fights and a survival. The fine is the fast way and
 * needs a station. The fight is the slow way and needs none.
 *
 * **Pirates only, and a Thargon is why.** `THARGON_REDEPLOY` is 5 seconds
 * (constants/encounters.ts), and a live mothership replaces its drones on that
 * clock. A count of drones would make a record free.
 *
 * It has its own rule id. It shares the value 5 with a ratio, a rate and three
 * durations. It is a count of KILLS against one rung of the legal ladder.
 *
 * The token heuristic reads "kills" and offers the rating domain. The rating
 * ladder counts kills for a RATING — Harmless to Elite. This counts them
 * against a legal record. The two ladders are unrelated, and `rating.ts` must
 * stay free to re-cut its own rungs and leave this one alone.
 *
 * @rule law.killsPerRung
 * @domain law
 */
export const KILLS_PER_RUNG = 5;

/**
 * Misbehave within this range of the station slot, and the Vipers launch. It is
 * the same number as `PLAYER_INTEREST_RANGE`, and a different rule. This one is
 * measured from the STATION, and it decides whether the law shows up, not who
 * engages you.
 */
export const DEFENCE_RANGE = 9000;

/** How close a police ship must be to scan your hold. */
export const SCAN_RANGE = 2600;

/**
 * A police ship this close is about to be able to read your hold, and the console
 * says so while it stays there.
 *
 * There are two constraints, and the second one is worth a pin:
 *
 *  - it is ABOVE `SCAN_RANGE`, so the warning is a band that the scan sits
 *    inside, rather than a second name for it;
 *  - it is at or below `SCANNER_RANGE` (6,000, constants/console.ts), so you are
 *    never warned about a ship you cannot see. The blip is on the scanner, which
 *    is what makes "which one?" a question with an answer.
 *
 * The width of the band is 1,800. That is the distance the player's Cobra covers
 * in about four and a half seconds, at its 400 u/s top speed (`PLAYER_FLIGHT`).
 * That is long enough to read a line and decide. The worst case that is not
 * deliberate is a flat-out run straight at a patrol. A cop who closes on you
 * as well shortens it, and the repeat below is what covers that.
 */
export const SCAN_WARN_RANGE = 4400;

/**
 * Seconds between repeats of that warning, while a patrol stays in the band.
 *
 * It is a repeat rather than a one-shot on entry to the band. A one-shot has to
 * know whether a ship is CLOSING, which needs a previous distance per ship that
 * the step does not keep. A repeat while a cop is in the band carries the same
 * information, keeps no record, and goes quiet by itself.
 *
 * It is in SECONDS. It shares its value with `FUGITIVE` eleven lines above, by
 * pure accident. The id says so. A legal status and a message cadence that both
 * sit at 2 in the same file are exactly the coincidence somebody tidies into a
 * bug.
 *
 * @rule law.scanWarnRepeat
 */
export const SCAN_WARN_REPEAT = 2;

/**
 * What a policeman charges to not read your hold: this share of what the
 * contraband aboard is worth at market. `VALUE_PER_TONNE`
 * (constants/jettison.ts) is the one home of what a tonne fetches.
 *
 * HALF, and the half is the whole argument. The other answer to a patrol that
 * closes is to dump the evidence, which costs you all of it. So a bribe as dear
 * as the cargo would never be worth the offer. A token bribe would delete the
 * choice from the other side. Half of what he ignores is a cut that a smuggler
 * can live with and still feel.
 *
 * It is deliberately NOT priced off `OFFENDER_FINE`. 25 Cr is what the station
 * charges for the paperwork. A man who looks away from a hold of narcotics does
 * not sell the same thing. An anchor between them would make one move the
 * other. The floor below catches a light hold, and this does not.
 *
 * It has its own rule id. Half is a popular number, and every other 0.5 in the
 * catalogue answers a different question:
 *
 *   - what a bad name is worth to a pirate;
 *   - how far a cone opens;
 *   - how far a gun leads.
 *
 * Each must stay free to move on its own, and leave this one where it is.
 *
 * @rule law.bribeShare
 */
export const BRIBE_SHARE = 0.5;

/**
 * ...but never less than this, so a light run is not a free pass. 50 Cr, in
 * tenths of a credit (invariant 8).
 *
 * It has the same shape as `OPPORTUNIST_FLOOR`, and for the same reason. The
 * reason bites harder here. Slaves are 14th of 17 on the 1984 price table, so
 * one tonne is worth 16 Cr. A share of that is not a bribe. It is a tip.
 * The floor is what the risk costs HIM, whatever you happen to carry.
 * That is also why the owner is the law, rather than the jettison domain it
 * resembles. A pirate's floor is the least he will call a payday. This is the
 * least a policeman will call a career worth a gamble.
 *
 * It has its own rule id. It shares the value 500 with `PURSUIT_RANGE`,
 * `EXTEND_RANGE_MIN` and `STATION_DEFENCE_STANDOFF`, which are distances in world
 * units.
 *
 * @rule law.bribeFloor
 */
export const BRIBE_FLOOR = 500;

/**
 * What a police ship that already shoots at you charges to break off, as a
 * multiple of the fine for the rung you are on. It is PER SHIP, so a pair costs
 * twice, exactly as a gang of pirates does.
 *
 * It is expressed from `OFFENDER_FINE` and `FUGITIVE_FINE`, because those two
 * already state what each rung is worth to the law. It is MUCH worse than them,
 * because it has to be. A bribe that undercut the fine would delete the fine.
 * To dock and pay clears the record for 75 Cr. To buy one Viper out of one
 * fight costs 300, and you are still a Fugitive when he goes.
 *
 * It is four, rather than two or ten. Two makes a run from the law cheaper than a
 * fight with it, and ten is a number that nobody in a fight has. Three hundred
 * credits is a good cargo. The escape is affordable and it hurts, which is the
 * whole design of every bribe in the game.
 *
 * It has its own rule id. It shares the value 4 with `VALUE_PER_TONNE` (what a
 * tonne fetches), with `TENTHS_PER_CHART_UNIT`, and with a dozen counts and
 * spans. This one is a multiplier on a fine.
 *
 * @rule law.patrolBribeFines
 */
export const PATROL_BRIBE_FINES = 4;

/**
 * How often an HONEST commander's offer is refused and reported. It is the top of
 * a ramp that runs down to nothing at `DISREPUTE_MAX`, weighted by Character in
 * `game/law.ts`.
 *
 * A Notorious pilot knows who to ask. An honest one asks the wrong man. This is
 * `disrepute` as a CREDENTIAL, and it is not a third idea about what a bad reputation
 * is for. docs/TODO/96 built the same shape for the rock hermit: a credential
 * up to a point.
 *
 * It is why the offer is a gamble and not a purchase. A bribe that always
 * worked would be a price list. The version of this feature that earns its
 * place is the one where a clean-handed smuggler thinks twice.
 *
 * A third, and not a half: refused more often than not, and a key nobody
 * presses.
 *
 * It has its own rule id. It shares the value 0.35 with an alpha and two
 * steering angles. Two more are worth a name, because they ARE rates that a
 * reader could take for this one:
 *
 *   - `HUNTER_CHANCE_ARRIVAL` — how often a bounty hunter is in the sky you
 *     arrive into;
 *   - `CHALLENGE_RATE` — how often a reception comes for your reputation
 *     rather than your cargo.
 *
 * Three different questions about chance, and any of them may move alone.
 *
 * @rule law.bribeRefused
 */
export const BRIBE_REFUSED = 0.35;

/**
 * How long the scan's own line holds the console, and therefore how long the
 * verdict that explains it waits behind it.
 *
 * It is ONE number, because it is one rule. The console shows a single line, so a
 * verdict pushed in the same frame would simply erase the CONTRABAND DETECTED
 * that it exists to explain. The delay is the lifetime, exactly.
 *
 * It is in seconds. The other 4s in the catalogue are tonnes, missiles and chart
 * units. None of them is this, and none of them moves with it.
 *
 * @rule law.scanLineSeconds
 */
export const SCAN_LINE_SECONDS = 4;
