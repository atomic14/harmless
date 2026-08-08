// Choosing a tactic: how wide a pass has to be aimed to clear, how hurt a ship
// has to be before it rethinks, how likely each choice is, and how long it holds
// one before it may change again.
//
// `tactics.ts` is the vocabulary. The gates, roll and trigger that spend these
// are `game/tactic-choice.ts`. `RAM_MIN_SPEED` is a fraction of the commander's
// top speed, imported so that speed keeps one home.

import { PLAYER_FLIGHT } from './player-flight.ts';

/**
 * How much wider than contact a pass has to be AIMED to actually clear, as a
 * multiple of the two hulls' radii. A ship misses by how far its path diverged
 * by arrival, not by the distance aimed at: measured over 60 episodes, an intent
 * of 110 delivered a floor of ~0.64 of intent, so 1.6x contact is the requirement.
 * Rarely binds; `RAM_MIN_SPEED` is the gate with teeth.
 */
export const PASS_CLEARANCE = 1.6;

/**
 * The slowest hull that may be offered a ram, as a fraction of the commander's
 * top speed. The question is whether a hull can force contact on a commander who
 * is FIGHTING rather than fleeing; 0.7 excludes half the roster (Monitor at 152,
 * Python at 160). A ship that cannot arrive should never get a tactic whose whole
 * content is arriving.
 */
export const RAM_MIN_SPEED = PLAYER_FLIGHT.maxSpeed * 0.7;

/**
 * How hurt a ship has to be before being hit makes it rethink. Not "took a hit":
 * every ship in a firefight is hit within seconds, so damage AND a hull going
 * the wrong way is the signal.
 */
export const TACTIC_HURT_HEALTH = 0.6;

/** ...and how hurt before a ram is on the table, and nothing else new is. */
export const TACTIC_LAST_STAND_HEALTH = 0.25;

/**
 * How likely each tactic is, per reason. Relative, renormalised over whatever
 * the hull is offered. `run` at half of every spawn keeps half the sky flying
 * the measured behaviour; `ram` is zero everywhere but the last stand, on top of
 * the health gate in `tacticsFor`.
 *
 * No `Record<TacticReason, Record<TacticId, number>>` annotation: `TacticReason`
 * belongs to the switch that produces one and this directory may not import.
 * `as const` plus `chooseTactic`'s two lookups is the exhaustiveness check — a
 * fifth reason or tactic with no row is a compile error at the index.
 */
export const TACTIC_WEIGHTS = {
  spawn: { run: 50, slash: 25, knife: 25, ram: 0 },
  sleeper: { run: 40, slash: 30, knife: 30, ram: 0 },
  hurt: { run: 20, slash: 40, knife: 40, ram: 0 },
  lastStand: { run: 15, slash: 40, knife: 0, ram: 45 },
} as const;

/**
 * The least time a ship keeps a tactic before it may take another. Bracketed
 * both sides: longer than one pass so a tactic is seen in a record; shorter than
 * one full cycle (7.2s median merge-to-merge) so a hammered ship can rethink.
 */
export const TACTIC_MIN_DWELL = 5;

/**
 * How long a ship goes without getting a shot away before it concludes that
 * whatever it is doing is not working. The anti-degeneracy trigger; 12 seconds
 * is comfortably past a whole attack run (7.2s median, 9.98 at the ninetieth).
 */
export const TACTIC_SLEEPER_SECONDS = 12;
