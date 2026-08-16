// The living galaxy's clocks: how fast the other 255 systems forget.
//
// Level 1 of the two-level simulation (galaxy/living.ts) stores only DELTAS off
// the 1984 baseline: the price pressure, the danger and the gossip. These are the
// rates that they decay back at, per day. The step arithmetic that spends them
// lives in `LivingGalaxy.advance`.

/** How fast price pressure decays back toward the 1984 baseline, per day. */
export const PRESSURE_DECAY = 0.12;

/**
 * How fast talk about the player dies down, per day. It is faster than
 * `DANGER_DECAY`. A system's reputation for piracy should outlast one convoy, but
 * nobody remembers one trader's cargo for a month.
 *
 * It has its own rule id, because it shares the value 0.06 with the per-tonne
 * heat that a landed smuggling run deposits (constants/contracts.ts). That is a
 * rate per DAY beside a quantity per TONNE. The coincidence currently reads as "a
 * tonne of illicit freight is forgotten in a day". That is a pleasant accident
 * and not a rule: either may move without the other.
 *
 * @rule living.heatDecay
 */
export const HEAT_DECAY = 0.06;

/**
 * How fast a system's reputation for piracy fades, per day. It is slow, so
 * hotspots can build up along lawless routes. It is the base rate: `advance`
 * scales it by government, so a corporate state recovers up to four times as
 * fast.
 */
export const DANGER_DECAY = 0.015;

/**
 * The danger above which a system's piracy problem is public knowledge. It is the
 * one threshold that two surfaces read, so they can never disagree. Those two are
 * the system data screen's "Merchants report heavy pirate activity" headline
 * (`galaxy/living.ts`), and the red ring that both charts draw
 * (`galaxy/danger-overlay.ts`). Move it, and both move together.
 *
 * 0.4 is roughly two convoy losses in an anarchy that have not yet decayed. It is
 * high enough that the flagged set stays a sparse handful of the 256 dots. It is
 * low enough that a route the player would actually notice getting worse crosses
 * it. A new commander's Lave sits well under it.
 *
 * It has its own rule id. It shares 0.4 with several unrelated fractions — a
 * missile last-stand hull fraction, a docking speed retention — and none of them
 * should follow it anywhere.
 *
 * @rule living.dangerVisible
 */
export const DANGER_VISIBLE = 0.4;

/**
 * How many days of trade a galaxy has behind it before its first commander
 * launches. It is the history that the other 255 systems made while nobody
 * watched.
 *
 * Measured across 8 seeds on galaxy 1 (docs/TODO/117), with a fresh galaxy warmed
 * by N days. The trade network is FULLY FORMED by about 30 days: 38 busy lanes
 * drawn, 3.6 systems over `DANGER_VISIBLE`, and prices about 9% off baseline. It
 * does not grow after that. 120 days and a year both draw the same 38 lanes. What
 * keeps growing is the accumulated danger. It buys the player nothing they can
 * use, and it costs the one thing that matters. At 60 days, one seed in eight
 * puts LAVE itself at 0.37, against the 0.4 ring threshold. A fresh save that
 * flags the home world as pirate-infested is a bad first impression. At 30
 * days the worst Lave across those seeds is 0.11.
 *
 * It is not free. A warmed galaxy is deltas that have to be written down. What
 * that costs the shelf is `MAX_NAMED_SAVES`'s rule, which argues from it.
 *
 * It has its own rule id. It shares the value 30 with a flight time in seconds
 * (`HOSTILE_MISSILE_LIFE`) and a spread in degrees (`AMBUSH_CONE_DEG`). Days of
 * trade follow neither, and both of those name a rule of their own, so the three
 * can move apart.
 *
 * @rule living.prewarmDays
 */
export const PREWARM_DAYS = 30;

/**
 * How many convoys a lane needs in flight at once before the charts draw it. It
 * is "more than one load on it right now": counted rather than ranked.
 *
 * There are about 240 convoys in flight across about 175 distinct lanes at any
 * moment. That was measured on galaxy 1, at seeds 999 and 4242, over 23, 120
 * and 365 days.
 * To draw all of them is a hairball on a 780x400 canvas. This lands on about
 * 40-47 lanes at every one of those samples, which is a trade NETWORK rather than
 * a scribble. A top-N cut would draw the same number of lines. But nobody could
 * state it in words, and it would keep a dead route drawn on a quiet day.
 *
 * It is read with `>=`, unlike the two thresholds either side of it, which are
 * strict. This is a count of things, not a level that something exceeds.
 *
 * @rule living.busyLaneConvoys
 */
export const BUSY_LANE_CONVOYS = 2;

/**
 * How far a price must drift from the 1984 baseline before the charts mark the
 * system: 15%, against the +-25% clamp that `priceMultiplier` applies.
 *
 * Nearly every system has SOME drift — 243 to 251 of 256 at the samples above. So
 * the useful question is not "has it moved", but "has it moved enough to be worth
 * a jump". 15% flags 12-17 systems. 12% flags 31-39, which is a dot in seven, and
 * tells the player nothing they can act on.
 *
 * It has its own rule id. It shares 0.15 with a gunnery floor and a turn-rate
 * floor, and a price is neither of those.
 *
 * @rule living.priceDivergenceVisible
 */
export const PRICE_DIVERGENCE_VISIBLE = 0.15;
