// How busy a system is the moment you arrive in it.
//
// Counts and chances only: how many traders are on their runs, how many rocks
// drift about, whether a bounty hunter is working the system today. WHERE any
// of them ends up is `spawn-placement.ts`; what turns up LATER is `encounters.ts`.
// The rule that spends these is `planPopulation` in game/population.ts. Police
// are not here: patrol counts are a ladder inside `policeFor`.

/**
 * Never fewer than this many traders, whatever the living galaxy says — a
 * system with nobody in it reads as broken rather than as quiet.
 */
export const MIN_TRADERS = 1;

/**
 * ...and never more than this many, however many convoys are due. A property of
 * what a system HOLDS, so it lives here and not in `encounters.ts`;
 * `test/constants.test.ts` fails if any file in `src/` declares the name again.
 * (`MAX_THARGONS` in `encounters.ts` is also 4 and is a different rule.)
 */
export const MAX_TRADERS = 4;

/**
 * Chance a bounty hunter is working the system when you arrive. Higher than the
 * launch figure because arriving is when the system gets to react to you.
 */
export const HUNTER_CHANCE_ARRIVAL = 0.35;

/**
 * ...and the lower chance when you launch from its station instead — the safe
 * half of the pair, since nobody organised anything for a ship parked in the bay.
 *
 * Its own rule id since docs/TODO/96: it shares the value 0.2 with
 * `HERMIT_FAVOUR` (constants/hermit-market.ts), a probability beside a price
 * discount, and the two must stay free to move apart.
 *
 * @rule population.hunterChanceLaunch
 */
export const HUNTER_CHANCE_LAUNCH = 0.2;

/**
 * Chance a rock hermit is hiding out among the asteroids — a hollowed-out rock
 * that trades ore and asks no questions. A homage to Oolite, not the 1984 game.
 */
export const HERMIT_CHANCE = 0.3;

/**
 * Chance a generation ship is crossing, on arrival only. Rare on purpose: it is
 * scenery with a story, and meeting one twice would make a centuries-long
 * voyage look like traffic.
 */
export const GENERATION_SHIP_CHANCE = 0.08;

/**
 * The fewest rocks a system holds. Every system has some: they are what a mining
 * laser is for, and a sky with nothing but ships reads as a level, not as space.
 */
export const ASTEROIDS_MIN = 2;

/**
 * ...and how many more it may have, drawn flat: `ASTEROIDS_MIN` plus 0, 1 or 2.
 * A SPAN, not a maximum, because that is the shape of the draw
 * (`Math.floor(rng() * ASTEROIDS_VARIATION)`). The most a system holds is four.
 */
export const ASTEROIDS_VARIATION = 3;
