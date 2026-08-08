// Trumbles, as numbers: how fast they breed, how much they eat, and what
// drives them out. Elite's joke about buying something adorable at a station.
// Spent by `stepTrumbles` in game/trumbles.ts; the shelf price is
// `EQUIPMENT_CATALOGUE`'s trumble row.

/**
 * Cabin heat that drives them out — inside a sun-skim's working band (cabin
 * settles at 0.36 at scooping range, death is `CABIN_TEMP_FATAL` = 0.99 in
 * sun.ts), so the cure costs a deliberate dip into the hot zone, not the ship.
 */
export const TRUMBLE_PURGE_TEMP = 0.55;

/**
 * Seconds between broods — also the fresh session's countdown: `freshSession`
 * in game/state.ts starts `trumbleTimer` at exactly one interval.
 */
export const BREED_INTERVAL = 20;

/** They multiply by this, plus one, every brood. */
export const BREED_RATE = 1.6;

/** No more than this many, or the hold report becomes a novel. */
export const MAX_TRUMBLES = 999;

/** One tonne eaten per this many trumbles, per brood. */
export const APPETITE_DIVISOR = 8;

/**
 * Below this many, they are not worth mentioning — the console stays quiet so
 * the infestation is discovered rather than announced.
 */
export const NOTICEABLE = 4;
