// The combat computer you can buy: what it will engage, the envelope it flies
// your ship in, and how it pursues. The autopilot itself is
// `game/combat-computer.ts` (the trained brain) and `game/scripted-co-pilot.ts`
// (the shipped pursuit dogfighter).
//
// There are two groups. The engage range, the cruise envelope and the turn caps
// are the TRAINED co-pilot's. The caps are `TURN` times a roster row. The
// `STEER_*` and `PURSUIT_*` block is the SCRIPTED co-pilot's. That block is feel,
// not fit, and no brain flies through it.

import { TURN } from './hull-motion.ts';

/** How far out it will look for something to fight. */
export const THREAT_RANGE = 6500;

/**
 * The autopilot cruises rather than sprints. 100 is what shipped, and what the
 * defence trials were flown at. It stays a literal: the trader Cobra's real
 * acceleration is 101.2, and to close the 1.2% is a behaviour change.
 */
export const CC_MAX_SPEED = 220;
export const CC_ACCEL = 100;

/**
 * The turn caps. They match the trader Cobra that the defence brain was trained
 * in. Fly the policy on a more agile ship, and it oversteers. `0.5` is that
 * hull's `turnRate` (`SPECS.trader`), and the multipliers are `TURN`, so these
 * cannot drift from the hull they name. Only the row's own 0.5 is written out.
 *
 * `test/combat-model.test.ts` holds them against the roster row BY DESIGN ID. It
 * does not hold them against `0.5 * TURN.pitch`, which would pass while the row
 * moved under it. A cap that moves invalidates every brain fitted at it.
 */
export const CC_MAX_PITCH = 0.5 * TURN.pitch;
export const CC_MAX_ROLL = 0.5 * TURN.roll;

/**
 * The heading error, in radians, at which the SCRIPTED co-pilot asks for full
 * pitch or roll. Below it, the ask is proportional. It is a feel setting for
 * bank-to-turn steering (`game/pitch-roll-steer.ts`). 0.35 rad is about 20
 * degrees. It saturates soon enough that acquisition is not sluggish. It stays
 * proportional in the last degrees, so the nose settles rather than dithers.
 *
 * It has its own rule id. It shares the value 0.35 with `ROLL_FADE_ANGLE` below,
 * which is in the same UNITS — radians off the nose — and is still a separate
 * rule. One is where the ask saturates; the other is where the roll's authority
 * ramps in. It also shares the value with a lane alpha, a spawn chance, a share
 * of receptions and the docking follower's lookahead.
 *
 * @rule combat.steerSaturation
 */
export const STEER_SATURATION = 0.35;

/**
 * The off-nose angle, in radians, at which the co-pilot asks for full PITCH when
 * the target is dead ahead. It is much tighter than `STEER_SATURATION`. A shared
 * band left the pitch too weak to haul the nose onto a near target, or onto one
 * that weaves. At 0.08 — about 4.5 degrees — the nose is hauled on hard.
 *
 * It applies only when the target is AHEAD (`localZ > 0`). It blends back to
 * `STEER_SATURATION` as the target moves abeam or behind. A hard pitch before the
 * bank has brought a far-behind target into the pitch plane would loop the nose
 * the wrong way.
 */
export const STEER_PITCH_SATURATION = 0.08;

/**
 * The off-nose angle, in radians, over which the co-pilot's ROLL authority ramps
 * in. Beside it is `ROLL_FADE_FLOOR`, the fraction it never drops below. See
 * `pitch-roll-steer.ts`.
 *
 * The roll is a bank-to-turn: it rolls the target onto the vertical plane. That
 * bearing is large even for a target a few degrees off the nose, so an ungated
 * roll asks full authority for a tiny error, and overshoots. A fade of the roll
 * by the off-nose angle scales the effort to the actual error. The floor keeps
 * enough authority to still arrive within a gun cone, rather than dead centre.
 *
 * It has its own rule id, for the reason that `STEER_SATURATION` above states.
 * The two are the same units, in the same feel setting's neighbourhood, and a
 * move to one must not silently move the other.
 *
 * @rule combat.rollFadeAngle
 */
export const ROLL_FADE_ANGLE = 0.35;
export const ROLL_FADE_FLOOR = 0.5;

// --- the scripted co-pilot as a PURSUIT DOGFIGHTER --------------------------
//
// It does not fly the pirates' slash-and-fly-through run. It gets on the
// opponent's six and shoots, and it throttles back to hold the track. These are
// the numbers of that pursuit. They are feel settings, not fitted. See
// `game/scripted-co-pilot.ts`.

/**
 * The range that the co-pilot tries to hold behind its target. It is inside
 * `LASER_RANGE` (3500), for a generous cone, and outside `BREAK_OFF_RANGE` (220),
 * so that station-keeping is not a ram. Beyond it, the ship closes. Inside it,
 * the ship drops back.
 */
export const PURSUIT_RANGE = 500;

/**
 * How fast the co-pilot wants to fly per unit of range error, in speed units per
 * world unit. At 1.0 it matches the target's own speed near `PURSUIT_RANGE`,
 * which is what holds station on the six.
 */
export const PURSUIT_CLOSE_GAIN = 1.0;

/**
 * The slowest the co-pilot throttles back to on a hard turn, as a fraction of the
 * speed it would otherwise want. Unlike a pirate's `MIN_CRUISE_FRACTION`, this
 * may come near a stop. The commander's ship is meant to be able to, and a
 * turret-prone fighter is not.
 *
 * It has its own rule id. 0.15 is also a gunnery hit floor and a price-divergence
 * threshold, and how hard the co-pilot brakes follows neither.
 *
 * @rule copilot.turnFloor
 */
export const PURSUIT_TURN_FLOOR = 0.15;

/**
 * The speed deadband, in world units, inside which the co-pilot coasts.
 * `FlightDemand.throttle` is only a sign. Without this, it would flip between
 * accelerate and brake every frame at its held speed.
 */
export const PURSUIT_SPEED_DEADBAND = 6;

/**
 * A pursuit chaser this close breaks off. It veers aside to pass, rather than ram
 * (`game/pursuit.ts`). It is above hull contact, with room to turn, and below
 * `PURSUIT_RANGE`, so a chase that holds station never trips it.
 */
export const PURSUIT_BREAK_RANGE = 260;

/**
 * ...and it resumes the chase once the range opens back past this. The gap from
 * `PURSUIT_BREAK_RANGE` is hysteresis, so the chaser does not flip between a
 * break and a chase at the boundary.
 */
export const PURSUIT_CLEAR_RANGE = 560;

/**
 * How far to the side of the target a chaser aims on a break. It is enough to
 * clear the hull at the speed it passes. It is a feel setting.
 */
export const PURSUIT_BREAK_CLEARANCE = 320;

/**
 * A pursuit PIRATE switches flight models on where it sits in the commander's
 * arc. These two cones are the switch, and they are the pirate's alone: the
 * co-pilot that flies YOUR ship only ever pursues. A ship that only held the six
 * was a sitting duck once it was ahead of the guns. So a pursuit pirate holds the
 * six only while ASTERN, and it flies the slashing attack run once the
 * commander's nose swings toward it.
 *
 * `faced` is the angle between the commander's nose and the direction to the
 * pirate. About 0 is pointed at it, and about pi is dead astern. There are two
 * cones, not one, so a commander who weaves across the boundary does not flip the
 * model every frame:
 *
 *   - within `PURSUIT_SLASH_CONE` of the nose  -> switch to the attack run
 *   - beyond `PURSUIT_HOLD_CONE` off the nose  -> switch back to holding the six
 *   - between the two                          -> keep whatever it was doing
 *
 * About 75 and about 105 degrees straddle the front/rear split, with a
 * hysteresis band of about 30 degrees.
 */
export const PURSUIT_SLASH_CONE = 1.3;
export const PURSUIT_HOLD_CONE = 1.85;

/**
 * The nose-to-target angle, in radians, within which the co-pilot counts itself
 * ENGAGED and will not switch targets. It vetoes `ThreatLock`'s distance-based
 * switch (`game/threat-lock.ts`). 0.6 rad, about 34 degrees, is generous on
 * purpose. "Engaged" means on the attack, not pinpoint on the crosshair. It is
 * feel, not fit.
 */
export const ENGAGED_CONE = 0.6;

/**
 * How many world units of range weigh as much as one radian of off-nose turn,
 * when the co-pilot ranks targets by how easy they are to lock
 * (`game/scripted-co-pilot.ts`). It fights the easiest target to get guns on, so
 * it favours the least turn, with distance in the balance. At 800, alignment wins
 * among comparable ranges. But it will NOT chase a far dead-ahead ship over a
 * close one: a fixation on a distant near-boresight target feeds the approach
 * roll-spin. It is feel, not fit, and it was chosen on the wave harness.
 *
 * It has its own rule id. It shares the value 800 with `AMBLE_NEAR`
 * (constants/amble.ts), which is a distance from a station. This one is an
 * exchange rate between world units and radians, and it must stay free to be
 * re-fitted on the wave harness without moving where a Viper loiters.
 *
 * @rule copilot.targetDistWeight
 */
export const TARGET_DIST_WEIGHT = 800;
