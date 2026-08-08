// The commander's three pools: capacities the console draws and damage/regen read.
// game/systems.ts owns what HAPPENS to them; recharge.ts owns how fast they refill.

/** Released capacity of every flyable hull's energy bank and each shield. */
export const MAX_ENERGY = 255;
export const MAX_SHIELD = 255;

/** How many banks the console reads the energy pool as — four, as the original did. */
export const ENERGY_BANKS = 4;

/**
 * One bank, in points: the single home for the division, so the gauge, the
 * ENERGY LOW warning, the shield cut-off and the E.C.M. price all move together
 * with `ENERGY_BANKS` rather than drifting from an unnamed `MAX_ENERGY / 4`.
 */
export const ENERGY_BANK_POINTS = Math.round(MAX_ENERGY / ENERGY_BANKS);

/**
 * Down to the last bank: shields stop recovering, the step flashes ENERGY LOW,
 * the gauge's last segment goes red. A point count, not a fraction. The shared
 * comparison is `energyLow` in systems.ts, where its inclusivity is argued.
 */
export const LOW_ENERGY = ENERGY_BANK_POINTS;
