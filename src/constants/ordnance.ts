// Ordnance, as numbers: the warhead, the E.C.M. and the energy bomb — every
// value that is not the laser's.
//
// Both halves of a missile are here: the code splits the decision
// (`game/missile-launch.ts`) from the simulation (`game/ordnance.ts`) because
// they are different KINDS of thing, but the numbers are one weapon's envelope.
// The E.C.M. and the bomb are here because they are what a warhead is answered
// with.

import { ENERGY_BANK_POINTS } from './pools.ts';

// --- a warhead in flight -----------------------------------------------------

/** Missile flight speed, world units per second. */
export const MISSILE_SPEED = 700;
/** How long a missile lives before it gives up and detonates. */
export const MISSILE_LIFE = 25;
/** A hostile missile lives longer — it has further to come. */
export const HOSTILE_MISSILE_LIFE = 30;
/** Turn rate while homing, radians per second. */
export const MISSILE_TURN = 2.5;
/** Close enough to detonate. */
export const MISSILE_HIT_RANGE = 50;

/** Lock cone: how near the crosshair a ship must be to be locked. */
export const LOCK_CONE = 0.09;
/** ...and how far away it may be. */
export const LOCK_RANGE = 5500;

// --- when one leaves the rail ------------------------------------------------

/** The far edge of the seeker's envelope — beyond this a missile is thrown away. */
export const MISSILE_MAX_RANGE = 3200;
/**
 * Hull fraction below which a ship stops saving its missiles for later: a
 * missile it never launches is worth nothing.
 *
 * Its own rule id: it shares 0.4 with unrelated fractions elsewhere (a refuel
 * price, a collision's retained speed, a danger threshold) and answers only to
 * how desperate a damaged ship should get.
 *
 * @rule ordnance.missileLastStandHull
 */
export const MISSILE_LAST_STAND_HULL = 0.4;
/**
 * ...and it launches on a bearing rather than a firing line. A missile homes, so
 * the only aim required is that it leaves the nose. Compare NPC_FIRE_GATE.
 */
export const MISSILE_LAST_STAND_GATE = Math.PI / 2;
/**
 * Desperation widens the envelope INWARD, but not all the way: inside this the
 * missile arrives before the player can reach the E.C.M. or turn, and an
 * undodgeable weapon is not a fight.
 */
export const MISSILE_LAST_STAND_MIN_RANGE = 250;
/** Gap between launches, so a Python does not empty both rails in one frame. */
export const MISSILE_RELOAD = 2;

/**
 * How many passes a ship makes before it accepts this is not going its way.
 * Missiles are for emergencies; two committed passes with the target still there
 * is that discovery.
 */
export const MISSILE_COMMIT_PASSES = 2;

// --- what answers one --------------------------------------------------------

/** An E.C.M.-equipped target fries incoming missiles inside this. */
export const ECM_RANGE = 2800;
/** ...at this chance per second. */
export const ECM_RATE = 0.45;
/**
 * Firing the E.C.M. costs one bank of energy, read off the pools rather than
 * restated so the gauge, the ENERGY LOW warning, the shield cut-off and this
 * cost all move together with `ENERGY_BANKS`.
 */
export const ECM_ENERGY_COST = ENERGY_BANK_POINTS;

/** The energy bomb reaches this far. */
export const ENERGY_BOMB_RANGE = 8000;
