// How to choose a tactic: how wide a pass has to be aimed to clear, how hurt a
// ship has to be before it rethinks, how likely each choice is, and how long it
// holds one before it may change again.
//
// `tactics.ts` is the vocabulary. The gates, the roll and the trigger that spend
// these are `game/tactic-choice.ts`. `RAM_MIN_SPEED` is a fraction of the
// commander's top speed. It is imported, so that speed keeps one home.

import { PLAYER_FLIGHT } from './player-flight.ts';

/**
 * How much wider than contact a pass has to be AIMED to actually clear, as a
 * multiple of the two hulls' radii. A ship misses by how far its path diverged by
 * arrival, not by the distance aimed at. Measured over 60 episodes, an intent of
 * 110 delivered a floor of about 0.64 of intent, so 1.6x contact is the
 * requirement. It rarely binds. `RAM_MIN_SPEED` is the gate with teeth.
 */
export const PASS_CLEARANCE = 1.6;

/**
 * The slowest hull that may be offered a ram, as a fraction of the commander's
 * top speed. The question is whether a hull can force contact on a commander who
 * FIGHTS rather than flees. 0.7 excludes half the roster: the Monitor at 152, and
 * the Python at 160. A ship that cannot arrive should never get a tactic whose
 * whole content is an arrival.
 */
export const RAM_MIN_SPEED = PLAYER_FLIGHT.maxSpeed * 0.7;

/**
 * How hurt a ship has to be before a hit makes it rethink. It is not "took a
 * hit": every ship in a firefight is hit within seconds. Damage AND a hull that
 * goes the wrong way is the signal.
 */
export const TACTIC_HURT_HEALTH = 0.6;

/** ...and how hurt before a ram is on the table, and nothing else new is. */
export const TACTIC_LAST_STAND_HEALTH = 0.25;

/**
 * How likely each tactic is, per reason. The weights are relative, and they are
 * renormalised over whatever the hull is offered. `run` at half of every spawn
 * keeps half the sky on the measured behaviour. `ram` is zero everywhere except
 * the last stand, on top of the health gate in `tacticsFor`.
 *
 * There is no `Record<TacticReason, Record<TacticId, number>>` annotation.
 * `TacticReason` belongs to the switch that produces one, and this directory may
 * not import it. `as const`, plus `chooseTactic`'s two lookups, is the
 * exhaustiveness check: a fifth reason or tactic with no row is a compile error
 * at the index.
 */
export const TACTIC_WEIGHTS = {
  spawn: { run: 50, slash: 25, knife: 25, ram: 0 },
  sleeper: { run: 40, slash: 30, knife: 30, ram: 0 },
  hurt: { run: 20, slash: 40, knife: 40, ram: 0 },
  lastStand: { run: 15, slash: 40, knife: 0, ram: 45 },
} as const;

/**
 * The least time a ship keeps a tactic before it may take another. It is
 * bracketed on both sides. It is longer than one pass, so a tactic is seen in a
 * record. It is shorter than one full cycle — the median merge-to-merge is 7.2s —
 * so a hammered ship can rethink.
 */
export const TACTIC_MIN_DWELL = 5;

/**
 * How long a ship goes without a shot away before it concludes that whatever it
 * does is not working. It is the anti-degeneracy trigger. 12 seconds is
 * comfortably past a whole attack run, which is 7.2s at the median and 9.98 at
 * the ninetieth.
 */
export const TACTIC_SLEEPER_SECONDS = 12;
