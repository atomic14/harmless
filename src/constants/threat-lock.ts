// How hard a defending ship holds on to the threat it already fights.
// `ThreatLock` in game/threat-lock.ts spends these.

/**
 * A rival threat must be this much NEARER than the threat under fire before the
 * defender may switch to it. It is a sanity test: the rival actually overtook,
 * and it is not a tie. `THREAT_MIN_HOLD` does the real commitment.
 *
 * It has its own rule id, because thirteen constants share the value 2
 * (docs/TODO/188), and each is free to move alone.
 *
 * @rule threat.switchMargin
 */
export const THREAT_SWITCH_MARGIN = 2.0;

/**
 * Seconds that the defender fights a threat before it considers a rival. A
 * threat that dies or leaves is replaced at once, whatever this value is.
 *
 * It has its own rule id. It is a duration in SECONDS inside one fight, and the
 * other constants at 5 answer to counts, a ratio and a rate.
 *
 * @rule threat.minHold
 */
export const THREAT_MIN_HOLD = 5;
