// How hard a defending ship holds on to the threat it is already fighting.
// Spent by `ThreatLock` in game/threat-lock.ts.

/**
 * A rival threat must be this much NEARER than the one being fought before the
 * defender may switch to it — a sanity test ("actually overtaken, not a tie");
 * `THREAT_MIN_HOLD` does the real committing.
 */
export const THREAT_SWITCH_MARGIN = 2.0;

/**
 * Seconds a threat is fought before the defender will consider a rival. A
 * threat that dies or leaves is replaced at once regardless.
 */
export const THREAT_MIN_HOLD = 5;
