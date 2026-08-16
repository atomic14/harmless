// Ordnance, as numbers: the warhead, the E.C.M. and the energy bomb — every value
// that is not the laser's.
//
// Both halves of a missile are here. The code splits the decision
// (`game/missile-launch.ts`) from the simulation (`game/ordnance.ts`), because
// they are different KINDS of thing. But the numbers are one weapon's envelope.
// The E.C.M. and the bomb are here because they are what answers a warhead.

import { ENERGY_BANK_POINTS } from './pools.ts';

// --- a warhead in flight -----------------------------------------------------

/** Missile flight speed, world units per second. */
export const MISSILE_SPEED = 700;
/** How long a missile lives before it gives up and detonates. */
export const MISSILE_LIFE = 25;
/**
 * A hostile missile lives longer, because it has further to come.
 *
 * It has its own rule id. It shares 30 with an ambush cone in degrees, and with
 * the trade a galaxy is given before a career starts
 * (constants/living-galaxy.ts). Seconds of flight follow neither.
 *
 * @rule ordnance.hostileMissileLife
 */
export const HOSTILE_MISSILE_LIFE = 30;
/** Turn rate while it homes, radians per second. */
export const MISSILE_TURN = 2.5;
/** Close enough to detonate. */
export const MISSILE_HIT_RANGE = 50;

/** Lock cone: how near the crosshair a ship must be to be locked. */
export const LOCK_CONE = 0.09;
/** ...and how far away it may be. */
export const LOCK_RANGE = 5500;

// --- when one leaves the rail ------------------------------------------------

/** The far edge of the seeker's envelope. Beyond this, a missile is thrown away. */
export const MISSILE_MAX_RANGE = 3200;
/**
 * The hull fraction below which a ship stops saving its missiles for later. A
 * missile it never launches is worth nothing.
 *
 * It has its own rule id. It shares 0.4 with unrelated fractions elsewhere: a
 * refuel price, a collision's retained speed, a danger threshold. It answers
 * only to how desperate a damaged ship should get.
 *
 * @rule ordnance.missileLastStandHull
 */
export const MISSILE_LAST_STAND_HULL = 0.4;
/**
 * ...and it launches on a bearing rather than on a firing line. A missile homes,
 * so the only aim required is that it leaves the nose. Compare NPC_FIRE_GATE.
 */
export const MISSILE_LAST_STAND_GATE = Math.PI / 2;
/**
 * Desperation widens the envelope INWARD, but not all the way. Inside this, the
 * missile arrives before the player can reach the E.C.M. or turn, and a weapon
 * you cannot dodge is not a fight.
 */
export const MISSILE_LAST_STAND_MIN_RANGE = 250;
/** Gap between launches, so a Python does not empty both rails in one frame. */
export const MISSILE_RELOAD = 2;

/**
 * How many passes a ship makes before it accepts that this is not going its way.
 * Missiles are for emergencies. Two committed passes with the target still there
 * is that discovery.
 */
export const MISSILE_COMMIT_PASSES = 2;

// --- what answers one --------------------------------------------------------

/** A target with an E.C.M. fries an incoming missile inside this. */
export const ECM_RANGE = 2800;
/** ...at this chance per second. */
export const ECM_RATE = 0.45;
/**
 * A shot of the E.C.M. costs one bank of energy. It is read off the pools rather
 * than restated. So the gauge, the ENERGY LOW warning, the shield cut-off and
 * this cost all move together with `ENERGY_BANKS`.
 */
export const ECM_ENERGY_COST = ENERGY_BANK_POINTS;

/** The energy bomb reaches this far. */
export const ENERGY_BOMB_RANGE = 8000;
