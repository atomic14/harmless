// The combat computer you can buy: what it will engage, the envelope it flies
// your ship in, and how it pursues. The autopilot itself is
// `game/combat-computer.ts` (the trained brain) and `game/scripted-co-pilot.ts`
// (the shipped pursuit dogfighter).
//
// Two groups. The engage range, cruise envelope and turn caps are the TRAINED
// co-pilot's (caps are `TURN` times a roster row). The `STEER_*`/`PURSUIT_*`
// block is the SCRIPTED co-pilot's — feel, not fit; no brain flies through it.

import { TURN } from './hull-motion.ts';

/** How far out it will look for something to fight. */
export const THREAT_RANGE = 6500;

/**
 * The autopilot cruises rather than sprints. 100 is what shipped and what the
 * defence trials were flown at; it stays a literal (the trader Cobra's real
 * acceleration is 101.2, and closing the 1.2% is a behaviour change).
 */
export const CC_MAX_SPEED = 220;
export const CC_ACCEL = 100;

/**
 * Turn caps, matching the trader Cobra the defence brain was trained in — fly
 * the policy on a more agile ship and it oversteers. `0.5` is that hull's
 * `turnRate` (`SPECS.trader`) and the multipliers are `TURN`, so these cannot
 * drift from the hull they name; only the row's own 0.5 is written out.
 *
 * `test/combat-model.test.ts` holds them against the roster row BY DESIGN ID
 * (not against `0.5 * TURN.pitch`, which would pass while the row moved under
 * it). A cap that moves invalidates every brain fitted at it.
 */
export const CC_MAX_PITCH = 0.5 * TURN.pitch;
export const CC_MAX_ROLL = 0.5 * TURN.roll;

/**
 * The heading error, in radians, at which the SCRIPTED co-pilot asks for full
 * pitch or roll; below it the ask is proportional. A feel setting for
 * bank-to-turn steering (`game/pitch-roll-steer.ts`). 0.35 rad (~20 degrees)
 * saturates soon enough that acquisition is not sluggish while staying
 * proportional in the last degrees so it settles rather than dithering.
 *
 * Its own rule id: it shares the value 0.35 with `ROLL_FADE_ANGLE` below — which
 * is the same UNITS, radians off the nose, and still a separate rule, one being
 * where the ask saturates and the other where the roll's authority ramps in —
 * and with a lane alpha, a spawn chance, a share of receptions and the docking
 * follower's lookahead.
 *
 * @rule combat.steerSaturation
 */
export const STEER_SATURATION = 0.35;

/**
 * The off-nose angle, in radians, at which the co-pilot asks for full PITCH when
 * the target is dead ahead. Much tighter than `STEER_SATURATION`: a shared band
 * left the pitch too weak to haul the nose onto a near/weaving target. At 0.08
 * (~4.5 degrees) the nose is hauled on hard.
 *
 * Applies only when the target is AHEAD (`localZ > 0`), blended back to
 * `STEER_SATURATION` as it moves abeam or behind — pitching hard before the bank
 * has brought a far-behind target into the pitch plane would loop the nose the
 * wrong way.
 */
export const STEER_PITCH_SATURATION = 0.08;

/**
 * The off-nose angle, in radians, over which the co-pilot's ROLL authority ramps
 * in — and `ROLL_FADE_FLOOR`, the fraction it never drops below. See
 * `pitch-roll-steer.ts`.
 *
 * The roll is a bank-to-turn: it rolls the target onto the vertical plane. That
 * bearing is large even for a target a few degrees off the nose, so ungated it
 * asks full roll for a tiny error and overshoots. Fading roll by the off-nose
 * angle scales the effort to the actual error. The floor keeps enough authority
 * to still arrive within a gun cone rather than dead centre.
 *
 * Its own rule id, for the reason `STEER_SATURATION` above states: the two are
 * the same units and the same feel setting's neighbourhood, and moving one must
 * not silently move the other.
 *
 * @rule combat.rollFadeAngle
 */
export const ROLL_FADE_ANGLE = 0.35;
export const ROLL_FADE_FLOOR = 0.5;

// --- the scripted co-pilot as a PURSUIT DOGFIGHTER --------------------------
//
// It does not fly the pirates' slash-and-fly-through run; it gets on the
// opponent's six and shoots, throttling back to hold the track. These are the
// numbers of that pursuit — feel settings, not fitted. See
// `game/scripted-co-pilot.ts`.

/**
 * The range the co-pilot tries to hold behind its target — inside `LASER_RANGE`
 * (3500) for a generous cone, outside `BREAK_OFF_RANGE` (220) so holding station
 * is not ramming. Beyond it it closes; inside it drops back.
 */
export const PURSUIT_RANGE = 500;

/**
 * How fast the co-pilot wants to fly per unit of range error, in speed units per
 * world unit. At 1.0 it matches the target's own speed near `PURSUIT_RANGE`,
 * which is what holds station on the six.
 */
export const PURSUIT_CLOSE_GAIN = 1.0;

/**
 * The slowest, as a fraction of the speed it would otherwise want, the co-pilot
 * throttles back to while turning hard. Unlike a pirate's `MIN_CRUISE_FRACTION`
 * this may near a stop: the commander's ship (unlike a turret-prone fighter) is
 * meant to be able to.
 *
 * Its own rule id: 0.15 is also a gunnery hit floor and a price-divergence
 * threshold, and how hard the co-pilot brakes follows neither.
 *
 * @rule copilot.turnFloor
 */
export const PURSUIT_TURN_FLOOR = 0.15;

/**
 * Speed deadband, in world units, inside which the co-pilot coasts.
 * `FlightDemand.throttle` is only a sign, so without this it would flip
 * accelerate/brake every frame at its held speed.
 */
export const PURSUIT_SPEED_DEADBAND = 6;

/**
 * A pursuit chaser this close breaks off — veers aside to pass rather than ram
 * (`game/pursuit.ts`). Above hull contact with room to turn, and below
 * `PURSUIT_RANGE` so a chase holding station never trips it.
 */
export const PURSUIT_BREAK_RANGE = 260;

/**
 * ...and it resumes the chase once the range opens back past this. The gap from
 * `PURSUIT_BREAK_RANGE` is hysteresis, so the chaser does not flip between
 * breaking and chasing at the boundary.
 */
export const PURSUIT_CLEAR_RANGE = 560;

/**
 * How far to the side of the target a breaking chaser aims — enough to clear the
 * hull at the speed it passes. A feel setting.
 */
export const PURSUIT_BREAK_CLEARANCE = 320;

/**
 * A pursuit PIRATE switches flight models on where it sits in the commander's
 * arc — these two cones are the switch, and the pirate's alone (the co-pilot
 * flying YOUR ship only ever pursues). A ship that only held the six was a
 * sitting duck once ahead of the guns, so a pursuit pirate holds the six only
 * while ASTERN and flies the slashing attack run once the commander's nose swings
 * toward it.
 *
 * `faced` is the angle between the commander's nose and the direction to the
 * pirate (~0 pointed at it, ~pi dead astern). Two cones, not one, so a commander
 * weaving across the boundary does not flip the model every frame:
 *
 *   - within `PURSUIT_SLASH_CONE` of the nose  -> switch to the attack run
 *   - beyond `PURSUIT_HOLD_CONE` off the nose  -> switch back to holding the six
 *   - between the two                          -> keep whatever it was doing
 *
 * ~75 and ~105 degrees straddle the front/rear split with a ~30-degree
 * hysteresis band.
 */
export const PURSUIT_SLASH_CONE = 1.3;
export const PURSUIT_HOLD_CONE = 1.85;

/**
 * The nose-to-target angle, in radians, within which the co-pilot counts itself
 * ENGAGED and will not switch targets — it vetoes `ThreatLock`'s distance-based
 * switch (`game/threat-lock.ts`). 0.6 rad (~34 degrees) is generous on purpose:
 * "engaged" means on the attack, not pinpoint on the crosshair. Feel, not fit.
 */
export const ENGAGED_CONE = 0.6;

/**
 * How many world units of range weigh as much as one radian of off-nose turn
 * when the co-pilot ranks targets by ease of locking
 * (`game/scripted-co-pilot.ts`). It fights the easiest target to get guns on,
 * favouring the least turn with distance in the balance. At 800 alignment wins
 * among comparable ranges but it will NOT chase a far dead-ahead ship over a
 * close one — fixating on a distant near-boresight target feeds the approach
 * roll-spin. Feel, not fit — chosen on the wave harness.
 */
export const TARGET_DIST_WEIGHT = 800;
