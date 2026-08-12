// How hard a defending ship holds on to the threat it already fights.
// `ThreatLock` in game/threat-lock.ts spends these.

/**
 * A rival threat must be this much NEARER than the threat under fire before the
 * defender may switch to it. It is a sanity test: the rival actually overtook,
 * and it is not a tie. `THREAT_MIN_HOLD` does the real commitment.
 */
export const THREAT_SWITCH_MARGIN = 2.0;

/**
 * Seconds that the defender fights a threat before it considers a rival. A
 * threat that dies or leaves is replaced at once, whatever this value is.
 */
export const THREAT_MIN_HOLD = 5;
