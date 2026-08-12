// The NPC's gun, as numbers: its reach, the gate it fires through, its cadence,
// and the dice that decide whether a shot connects.
//
// It is A SEPARATE FILE FROM `player-gun.ts`, because they are separate rules.
// The player's gun is a ray through a cone with an assist. This one is a gate, a
// coin and a range curve. The one shared number is derived here, not restated.
// These are balance levers for the game and for the trainer at once. Training
// flies `npcTriggerPull`, so there is one gun and one home for it.

import { LASER_RANGE } from './player-gun.ts';

/**
 * How far an NPC can shoot: the player's reach. It is derived from `LASER_RANGE`
 * rather than restated as a second 3500. A shorter NPC gun would be a deliberate
 * handicap, chosen here against the reach that this derives from.
 */
export const NPC_LASER_RANGE = LASER_RANGE;

/**
 * Time between an NPC's shots. It is a deliberate handicap, and it is NOT what
 * limits an NPC's damage: the ship waits to be aimed, not on the cooldown.
 *
 * MEASURED since docs/TODO/139 M1 (`npm run aim-probe`), where it used to say
 * "about 5% of a fight" from memory. This cadence allows 46.2 shots a minute. The
 * shipped pursuit pilot gets 7.5 away one-on-one against a commander who
 * knife-fights, 15 with four in the sky, and 26 in a chase after one who runs. So
 * the clock is not the binding term in any fight the probe can stage, and the
 * handicap that this pair states is not the one that decides a fight.
 */
export const NPC_COOLDOWN_LO = 0.9;
export const NPC_COOLDOWN_SPREAD = 0.8;

/**
 * What a shot costs a gun that never waits to be aimed: the LO plus half the
 * spread, because `npcTriggerPull` draws uniformly across it.
 *
 * It is derived here rather than at either reader, because both readers compare a
 * gun with something. `gunnery.ts` turns it into the most a build can ever be
 * worth per second (`npcBestCasePerSecond`, which the roster's test holds against
 * `SHIELD_REGEN`). `train/aim-probe.ts` prints the cadence ceiling that a real
 * fight is measured against. Two readers, one number.
 */
export const NPC_MEAN_COOLDOWN = NPC_COOLDOWN_LO + NPC_COOLDOWN_SPREAD / 2;

/**
 * How near the nose a target must be before an NPC pulls the trigger.
 *
 * What it admits, measured (`npm run aim-probe`, docs/TODO/139 M1): 12% of a
 * one-on-one knife fight, 27% with four in the sky, and 55% of a chase. THE TWO
 * FIGHTS FAIL DIFFERENTLY, which is why a wider gate is not obviously the fix. In
 * the knife fight the mean bearing error is 85 degrees, which is seven times this
 * gate. In the chase the ship is lined up and out of range instead.
 */
export const NPC_FIRE_GATE = 0.25;

/** Thargoids reload faster than anything else in the galaxy. */
export const THARGOID_FIRE_RATE = 0.7;

/** Hit chance falls off with range, clamped at both ends. */
export const NPC_HIT_BASE = 0.9;
/**
 * The slope of the falloff. It is a DENOMINATOR, not a reach. It is coupled
 * deliberately to `NPC_LASER_RANGE`, so a retuned reach moves the aim curve with
 * it. The two are byte-identical today, because both are 3,500. `0.9 - d/3500`
 * meets `NPC_HIT_FLOOR` at d = 2,625, so the curve is already flat over the last
 * 25% of the reach.
 */
export const NPC_HIT_FALLOFF = NPC_LASER_RANGE;
export const NPC_HIT_CAP = 0.85;
/**
 * The far end of that curve. However long the shot, this fraction of it still
 * connects, so distance thins a fight without an end to it.
 *
 * It has its own rule id. 0.15 is also the co-pilot's turn-rate floor and a
 * price-divergence threshold, and neither should move with a gun's reach.
 *
 * @rule npc.hitFloor
 */
export const NPC_HIT_FLOOR = 0.15;

/**
 * Whether one ship's shot at another connects: a coin flip. What a crossfire hit
 * is WORTH is `npcCrossfireDamage` in npc-energy.ts. Whether it lands stays a die
 * roll, as the player-facing gun's does.
 */
export const NPC_VS_NPC_HIT = 0.5;
