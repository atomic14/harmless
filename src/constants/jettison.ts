// Buying your way out of a fight: what a pirate asks for, and what a tonne is
// worth to everyone doing the asking. Spent by game/jettison.ts (dump the most
// valuable thing first, accumulate the toll across an encounter). Pirates came
// for cargo, not for you: give them enough and the opportunists break off.

/**
 * A pirate wants this share of your arrival cargo value — an organised gang
 * considerably more than an opportunist who happened to be passing.
 */
export const OPPORTUNIST_SHARE = 0.12;
export const GANG_SHARE = 0.3;

/** ...but never less than this, so a near-empty hold is not a free pass. */
export const OPPORTUNIST_FLOOR = 400;
export const GANG_FLOOR = 1500;

/**
 * How far BEYOND your own scoop reach a jettisoned tonne is pushed, in world
 * units — and it is a MARGIN, not a distance, so the drop is always
 * `SCOOP_RANGE + this` and cannot fall back inside a reach that grows.
 *
 * Jettison exists to buy off pirates: dump enough and the opportunists break
 * off to collect it. That only works if the cargo LEAVES. It landed 20 units
 * from the nose against a 45-unit scoop reach, so a commander with fuel scoops
 * fitted picked his own tonne straight back up on the very next frame — the
 * bribe undone before a pirate could see it, and the console reading
 * `SCOOPED 1t FOOD` a frame after `JETTISONED 1t FOOD`.
 *
 * Big enough that a ship at any speed is clear of it, small enough that the
 * canister is still the one you dropped: turn round and you can pick it up
 * again, which is correct — what must not happen is picking it up without
 * having decided to.
 *
 * It shares the value 25 with `COMMANDER_HULL_RADIUS` and `MISSILE_LIFE`, and
 * the three must stay free to move apart: one is how big your ship is, one is
 * how long a warhead flies, and this is how far past your reach a dumped tonne
 * lands. That the margin is currently about one hull's width is a coincidence
 * worth nothing — widening the hull must not push your jettisoned cargo
 * further away.
 *
 * @rule jettison.clearance
 */
export const JETTISON_CLEARANCE = 25;

/**
 * What the market values a tonne at: this times its 1984 base price, in tenths
 * of a credit (basePrice is the source's byte encoding; x0.4 gives credits, so
 * x4 gives tenths).
 *
 * ONE HOME for a rule two functions share: the toll (`dumpCargo`) and the
 * assessment (`markOf` in game/threat.ts) must agree on what a hold is worth, or
 * a bribe sized off one answers an appetite sized off another. Both import this;
 * `test/economy.test.ts` solves the multiplier back out of `markOf` and compares.
 */
export const VALUE_PER_TONNE = 4;
