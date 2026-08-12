// Trumbles, as numbers: how fast they breed, how much they eat, and what drives
// them out. They are Elite's joke about a purchase of something adorable at a
// station. `stepTrumbles` in game/trumbles.ts spends these. The shelf price is
// `EQUIPMENT_CATALOGUE`'s trumble row.

/**
 * The cabin heat that drives them out. It sits inside a sun-skim's working band:
 * the cabin settles at 0.36 at scoop range, and death is `CABIN_TEMP_FATAL` =
 * 0.99 in sun.ts. The cure therefore costs a deliberate dip into the hot zone.
 * It does not cost the ship.
 */
export const TRUMBLE_PURGE_TEMP = 0.55;

/**
 * Seconds between broods. It is also the fresh session's countdown:
 * `freshSession` in game/state.ts starts `trumbleTimer` at exactly one interval.
 */
export const BREED_INTERVAL = 20;

/** They multiply by this, plus one, every brood. */
export const BREED_RATE = 1.6;

/** No more than this many, or the hold report becomes a novel. */
export const MAX_TRUMBLES = 999;

/** One tonne eaten per this many trumbles, per brood. */
export const APPETITE_DIVISOR = 8;

/**
 * Below this many, they are not worth a word. The console stays quiet, so the
 * pilot discovers the infestation rather than hears it announced.
 */
export const NOTICEABLE = 4;
