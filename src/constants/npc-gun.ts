// The NPC's gun, as numbers: its reach, the gate it fires through, its cadence
// and the dice that decide whether a shot connects.
//
// A SEPARATE FILE FROM `player-gun.ts`, because they are separate rules: the
// player's gun is a ray through a cone with an assist, this one is a gate, a
// coin and a range curve. The one shared number is derived here, not restated.
// These are balance levers for the game and the trainer at once — training
// flies `npcTriggerPull`, so there is one gun and one home for it.

import { LASER_RANGE } from './player-gun.ts';

/**
 * How far an NPC can shoot: the player's reach, derived from `LASER_RANGE`
 * rather than restated as a second 3500. A shorter NPC gun would be a
 * deliberate handicap, chosen here against the reach this derives from.
 */
export const NPC_LASER_RANGE = LASER_RANGE;

/**
 * Time between an NPC's shots — a deliberate handicap, and NOT what limits an
 * NPC's damage: a pirate is only inside the firing gate for about 5% of a
 * fight, so it is waiting to be aimed, not waiting on the cooldown.
 */
export const NPC_COOLDOWN_LO = 0.9;
export const NPC_COOLDOWN_SPREAD = 0.8;

/** How near the nose a target must be before an NPC pulls the trigger. */
export const NPC_FIRE_GATE = 0.25;

/** Thargoids reload faster than anything else in the galaxy. */
export const THARGOID_FIRE_RATE = 0.7;

/** Hit chance falls off with range, clamped at both ends. */
export const NPC_HIT_BASE = 0.9;
/**
 * The slope of the falloff, a DENOMINATOR not a reach. Coupled deliberately to
 * `NPC_LASER_RANGE` so a retuned reach moves the aim curve with it; byte-
 * identical today because both are 3,500. `0.9 - d/3500` meets `NPC_HIT_FLOOR`
 * at d = 2,625, so the curve is already flat over the last 25% of the reach.
 */
export const NPC_HIT_FALLOFF = NPC_LASER_RANGE;
export const NPC_HIT_CAP = 0.85;
/**
 * The far end of that curve: however long the shot, this fraction of it still
 * connects, so distance thins a fight without ending it.
 *
 * Its own rule id: 0.15 is also the co-pilot's turn-rate floor and a
 * price-divergence threshold, and neither should move with a gun's reach.
 *
 * @rule npc.hitFloor
 */
export const NPC_HIT_FLOOR = 0.15;

/**
 * Whether one ship's shot at another connects: a coin flip. What a crossfire
 * hit is WORTH is `npcCrossfireDamage` in npc-energy.ts; whether it lands stays
 * a die roll, as the player-facing gun's does.
 */
export const NPC_VS_NPC_HIT = 0.5;
