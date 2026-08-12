// How busy a system is the moment you arrive in it.
//
// Counts and chances only: how many traders are on their runs, how many rocks
// drift about, and whether a bounty hunter works the system today. WHERE any of
// them ends up is `spawn-placement.ts`. What turns up LATER is `encounters.ts`.
// The rule that spends these is `planPopulation` in game/population.ts. The
// police are not here: the patrol counts are a ladder inside `policeFor`.

/**
 * Never fewer than this many traders, whatever the living galaxy says. A system
 * with nobody in it reads as broken, rather than as quiet.
 */
export const MIN_TRADERS = 1;

/**
 * ...and never more than this many, however many convoys are due. It is a
 * property of what a system HOLDS, so it lives here and not in `encounters.ts`.
 * `test/constants.test.ts` fails if any file in `src/` declares the name again.
 * `MAX_THARGONS` in `encounters.ts` is also 4, and it is a different rule.
 */
export const MAX_TRADERS = 4;

/**
 * The chance that a bounty hunter works the system when you arrive. It is higher
 * than the launch figure, because an arrival is when the system gets to react to
 * you.
 *
 * It has its own rule id. It shares the value 0.35 with two steering angles, a
 * lane alpha, a share of receptions and the docking follower's lookahead. Six
 * unrelated 0.35s, and this is the only one that is a chance.
 *
 * @rule population.hunterChanceArrival
 */
export const HUNTER_CHANCE_ARRIVAL = 0.35;

/**
 * ...and the lower chance when you launch from its station instead. It is the
 * safe half of the pair, because nobody organised anything for a ship parked in
 * the bay.
 *
 * It has its own rule id since docs/TODO/96. It shares the value 0.2 with
 * `HERMIT_FAVOUR` (constants/hermit-market.ts) — a probability beside a price
 * discount — and the two must stay free to move apart.
 *
 * @rule population.hunterChanceLaunch
 */
export const HUNTER_CHANCE_LAUNCH = 0.2;

/**
 * The chance that a rock hermit hides out among the asteroids: a hollowed-out
 * rock that trades ore and asks no questions. It is a homage to Oolite, not to
 * the 1984 game.
 */
export const HERMIT_CHANCE = 0.3;

/**
 * The chance that a generation ship crosses, on arrival only. It is rare on
 * purpose. It is scenery with a story, and to meet one twice would make a
 * centuries-long voyage look like traffic.
 */
export const GENERATION_SHIP_CHANCE = 0.08;

/**
 * The fewest rocks a system holds. Every system has some. They are what a mining
 * laser is for, and a sky with nothing but ships reads as a level rather than as
 * space.
 */
export const ASTEROIDS_MIN = 2;

/**
 * ...and how many more it may have, drawn flat: `ASTEROIDS_MIN` plus 0, 1 or 2.
 * It is a SPAN, not a maximum, because that is the shape of the draw
 * (`Math.floor(rng() * ASTEROIDS_VARIATION)`). The most a system holds is four.
 */
export const ASTEROIDS_VARIATION = 3;
