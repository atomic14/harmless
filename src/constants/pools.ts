// The commander's three pools: the capacities that the console draws, and that
// damage and regeneration read. game/systems.ts owns what HAPPENS to them.
// recharge.ts owns how fast they refill.

/** Released capacity of every flyable hull's energy bank and each shield. */
export const MAX_ENERGY = 255;
export const MAX_SHIELD = 255;

/** How many banks the console reads the energy pool as. Four, as the original. */
export const ENERGY_BANKS = 4;

/**
 * One bank, in points. It is the single home for the division. The gauge, the
 * ENERGY LOW warning, the shield cut-off and the E.C.M. price therefore all move
 * together with `ENERGY_BANKS`. They cannot drift from an unnamed
 * `MAX_ENERGY / 4`.
 */
export const ENERGY_BANK_POINTS = Math.round(MAX_ENERGY / ENERGY_BANKS);

/**
 * Down to the last bank. The shields stop recovery, the step flashes ENERGY LOW,
 * and the gauge's last segment goes red. It is a point count, not a fraction.
 * The shared comparison is `energyLow` in systems.ts, which argues its
 * inclusivity.
 */
export const LOW_ENERGY = ENERGY_BANK_POINTS;
