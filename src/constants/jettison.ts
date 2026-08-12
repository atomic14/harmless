// How to buy your way out of a fight: what a pirate asks for, and what a tonne is
// worth to everyone who asks. game/jettison.ts spends these. It dumps the most
// valuable thing first, and it accumulates the toll across an encounter. Pirates
// came for cargo, not for you. Give them enough, and the opportunists break off.

/**
 * A pirate wants this share of your arrival cargo value. An organised gang wants
 * considerably more than an opportunist who happened to pass.
 */
export const OPPORTUNIST_SHARE = 0.12;
export const GANG_SHARE = 0.3;

/** ...but never less than this, so a near-empty hold is not a free pass. */
export const OPPORTUNIST_FLOOR = 400;
export const GANG_FLOOR = 1500;

/**
 * How far BEYOND your own scoop reach a jettisoned tonne is pushed, in world
 * units. It is a MARGIN, not a distance, so the drop is always
 * `SCOOP_RANGE + this`. It cannot fall back inside a reach that grows.
 *
 * Jettison exists to buy pirates off: dump enough, and the opportunists break off
 * to collect it. That works only if the cargo LEAVES. It landed 20 units from the
 * nose, against a 45-unit scoop reach. A commander with fuel scoops fitted
 * therefore picked his own tonne straight back up on the very next frame. The
 * bribe was undone before a pirate could see it, and the console read
 * `SCOOPED 1t FOOD` a frame after `JETTISONED 1t FOOD`.
 *
 * It is big enough that a ship at any speed is clear of it. It is small enough
 * that the canister is still the one you dropped: turn round, and you can pick it
 * up again. That is correct. What must not happen is a pick-up that you never
 * decided on.
 *
 * It shares the value 25 with `COMMANDER_HULL_RADIUS` and `MISSILE_LIFE`, and the
 * three must stay free to move apart. One is how big your ship is. One is how
 * long a warhead flies. This is how far past your reach a dumped tonne lands.
 * That the margin is currently about one hull's width is a coincidence worth
 * nothing. A wider hull must not push your jettisoned cargo further away.
 *
 * @rule jettison.clearance
 */
export const JETTISON_CLEARANCE = 25;

/**
 * What the market values a tonne at: this, times its 1984 base price, in tenths
 * of a credit. `basePrice` is the source's byte encoding. x0.4 gives credits, so
 * x4 gives tenths.
 *
 * It is ONE HOME for a rule that two functions share. The toll (`dumpCargo`) and
 * the assessment (`markOf` in game/threat.ts) must agree on what a hold is worth.
 * Otherwise a bribe sized off one answers an appetite sized off the other. Both
 * import this. `test/economy.test.ts` solves the multiplier back out of `markOf`
 * and compares.
 */
export const VALUE_PER_TONNE = 4;
