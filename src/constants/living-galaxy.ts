// The living galaxy's clocks: how fast the other 255 systems forget.
//
// Level 1 of the two-level simulation (galaxy/living.ts) stores only DELTAS off
// the 1984 baseline — price pressure, danger, gossip — and these are the rates
// they decay back at, per day. The step arithmetic that spends them lives in
// `LivingGalaxy.advance`.

/** How fast price pressure decays back toward the 1984 baseline, per day. */
export const PRESSURE_DECAY = 0.12;

/**
 * How fast talk about the player dies down, per day. Faster than `DANGER_DECAY`:
 * a system's reputation for piracy should outlast one convoy, but nobody
 * remembers one trader's cargo for a month.
 *
 * Its own rule id because it shares the value 0.06 with the per-tonne heat a
 * landed smuggling run deposits (constants/contracts.ts) — a rate per DAY
 * beside a quantity per TONNE. The coincidence currently reads as "a tonne of
 * illicit freight is forgotten in a day", which is a pleasant accident and not
 * a rule: either may move without the other.
 *
 * @rule living.heatDecay
 */
export const HEAT_DECAY = 0.06;

/**
 * How fast a system's reputation for piracy fades, per day — slowly, so
 * hotspots can build up along lawless routes. The base rate: `advance` scales it
 * by government, so a corporate state recovers up to four times as fast.
 */
export const DANGER_DECAY = 0.015;
