// The docking computer's HAND: what the autopilot does with the stick.
//
// The plan says where to point (`docking.ts`); this says how to fly it. They
// are separate for the reason the constants are (constants/docking.ts is the
// letterbox, constants/docking-computer.ts is the hand that threads it): the
// approach was never the problem. The player's docking computer flew a correct
// plan by writing `player.quaternion` through a shortest-arc slerp, which pivots
// about an axis no stick can produce, wrote neither of the rates the HUD reads,
// and obeyed a turn limit of its own rather than the hull's (docs/TODO/126).
//
// NPC traders do not come through here. They dock with `steerToward`, which
// builds an orientation from `lookAt` — an NPC has yaw and can afford to.
//
// One function, three items deep: docs/TODO/126 gave it a stick, docs/TODO/134
// took away the roll it asked for when the turn's axis is meaningless, and
// docs/TODO/137 damped the ring around every bank it holds.

import * as THREE from 'three';

import { LINED_UP_LATERAL, SLOT_HALF_ACROSS, ROLL_TOLERANCE } from '../constants/docking.ts';
import {
  DC_SLOT_MARGIN, DC_TURN_FADE_ANGLE, DC_ROLL_LEAD,
} from '../constants/docking-computer.ts';
import type { DockPlan } from './docking.ts';
import {
  pitchOnto, rollErrorTo, steerStick, type StickCommand,
} from './pitch-roll-steer.ts';

const _wings = new THREE.Vector3();
const _nose = new THREE.Vector3();
const _turn = new THREE.Vector3();

/**
 * The pitch and roll a pilot would ask for this frame to fly `plan`.
 *
 * Sticks in −1..1, exactly what a hand at the keyboard produces: the caller
 * ramps them into rates against whatever envelope it is flying, so the
 * autopilot's turning reaches the HUD needles like anybody else's.
 *
 * ONE stick, TWO jobs, and the whole difficulty of the thing. A ship with no
 * yaw axis turns by ROLLING the target into its pitch plane and pulling — and
 * the letterbox demands that same roll be something else entirely, the wings
 * lined up with the slot's long axis. They cannot both be satisfied while the
 * nose is off the heading.
 *
 * The reconciliation is the slot's own tolerance. `ROLL_TOLERANCE` is how far
 * from lined up a ship may be and still fit, so the roll the TURN wants is
 * simply clamped into a window that wide around the roll the SLOT wants: bank
 * as hard as the turn asks, right up to the edge of what the letterbox will
 * take, and no further. Far out the window opens to a half turn — nothing about
 * a slot matters from there — and it closes as the ship comes onto the axis,
 * which is `plan.lateral` crossing from `LINED_UP_LATERAL` to the channel's own
 * half-width. One control law with one equilibrium, rather than two rival ones
 * mixed: mixing them was measured rolling at a steady 1 rad/s all the way into
 * the hull, because a fixed blend of two laws that disagree never reaches zero.
 *
 * The wings want the slot's long axis, and `plan.up` is the station's local X —
 * the same hint the old `lookAt` orientation was built from, so the attitude
 * being flown to is unchanged and only the way of reaching it is new.
 *
 * TWO THINGS WERE MISSING FROM THAT, and they are #23 — the autopilot rolling
 * hard over and back every 0.45s while flying a heading it was already dead on
 * (docs/TODO/134):
 *
 * 1. **The turn's claim fades as the nose arrives** (`DC_TURN_FADE_ANGLE`). The
 *    window says how far the turn may drag the roll; this says whether it has
 *    anything to ask for at all. The axis it measures against is `nose x
 *    heading`, which is degenerate exactly when the controller succeeds.
 * 2. **The slot does not ask until the approach commits.** The window opening to
 *    a half turn far out is not the same as the slot having no opinion out
 *    there, and it needs to have none: a letterbox on a turning hull 1,500 units
 *    away is a target that never stops moving, so tracking it means rolling
 *    forever, and a ship that is always rolling sweeps its own pitch plane round
 *    underneath `pitchOnto` until the nose hunts as well.
 *
 * Measured over `npm run dock-probe`, the two together take the median approach
 * from 17 roll reversals to 8 and the worst from 29 to 15, while docking 320/320
 * as before. Either one alone is worse than both: the fade by itself only
 * replaces chasing a degenerate axis with chasing a distant slot (median 14),
 * and the commit gate by itself leaves the degeneracy where it was.
 *
 * A THIRD THING WAS MISSING, and it is docs/TODO/137: all of the above decides
 * WHICH bank to hold, and none of it could hold one. A proportional ask behind
 * the rate ramp is a second-order loop with nothing damping it, so the ship
 * overshot every bank it was given and hunted round it — through ±40 degrees on
 * the run in, at about a reversal a second, whatever the approach. The lead term
 * on the roll (`DC_ROLL_LEAD`) is what settles it, and settling it is what made
 * `DC_SLOT_MARGIN` mean anything: the bank the turn is allowed to spend is now
 * the bank the wings actually arrive at the letterbox with, so the two constants
 * were chosen together.
 *
 * @param rollRate the roll rate the ship is already flying, rad/s — the loop is
 *   closed on the ship's own motion and cannot be if it does not know it.
 */
export function dockingSticks(
  quat: THREE.Quaternion, plan: DockPlan, rollRate: number,
): StickCommand {
  _nose.set(0, 0, -1).applyQuaternion(quat);
  // Where the ship's +X has to end up to fit through: perpendicular to the slot
  // normal and to the up-hint, which is what `lookAt(heading, up)` used to build.
  _wings.copy(plan.up).cross(_turn.copy(plan.heading).negate());
  // ...and where it would have to be for the TURN: perpendicular to the error,
  // so the heading falls into the ship's pitch plane and can be pulled onto.
  _turn.crossVectors(_nose, plan.heading);

  const slotErr = rollErrorTo(quat, _wings);
  const turnErr = rollErrorTo(quat, _turn);
  // How much of the letterbox's tolerance the turn may spend. Not all of it:
  // with the roll damped this is what the wings ARRIVE with, so it is spent on
  // the last correction and nothing else (docs/TODO/137, `DC_SLOT_MARGIN`).
  const onAxis = Math.max(0, Math.min(1,
    (LINED_UP_LATERAL - plan.lateral) / (LINED_UP_LATERAL - SLOT_HALF_ACROSS)));
  const budget = Math.PI / 2 + (ROLL_TOLERANCE * DC_SLOT_MARGIN - Math.PI / 2) * onAxis;
  // The attitude the SLOT asks for — but only once the approach has COMMITTED to
  // the letterbox. A slot 1,500 units away on a turning hull has no opinion
  // worth flying: rolling to track it out there is a roll that never stops, and
  // a ship that is always rolling sweeps its own pitch plane round underneath
  // `pitchOnto`, so the nose starts hunting too (measured: pitch reversals
  // tripled). The run phase is exactly the "I am going in" decision, it latches,
  // and it leaves the length of the corridor to settle the wings in.
  const base = plan.phase === 'run' ? slotErr : 0;
  const wanted = Math.min(Math.max(turnErr, base - budget), base + budget);

  // ...and how much of a claim the turn has on the axis at all, which is the
  // fix in docs/TODO/134. `_turn` is `nose x heading`: its length is the sine of
  // the off-nose angle, so it VANISHES exactly when the controller succeeds, and
  // a vanishing vector still has a direction — numerical residue, which the ship
  // then chased at full stick for seconds at a time while dead on the heading.
  //
  // The claim is faded rather than switched, and it is faded in the OFFSET from
  // the attitude being held, not between two absolute angles: `wanted - base` is
  // how far the turn drags the roll off that, already bounded by the budget
  // above, and both angles are folded to a quarter turn either way
  // (`rollErrorTo`), so interpolating them directly would cross the fold and
  // command a roll neither law asked for.
  //
  // This keeps the property the third attempt in docs/TODO/126 paid for — one
  // law, one equilibrium. The blend that failed there mixed two disagreeing laws
  // at a FIXED ratio, so neither error could ever reach zero; a fade governed by
  // the off-nose angle has a fixed point at each end instead: off the heading it
  // is the turn's roll clamped by the letterbox, exactly as before, and on the
  // heading there is no turn to make and the roll is the slot's alone.
  const theta = Math.acos(Math.max(-1, Math.min(1, _nose.dot(plan.heading))));
  const turnClaim = Math.min(1, theta / DC_TURN_FADE_ANGLE);

  const asked = base + (wanted - base) * turnClaim;

  return {
    // Ungated: `pitchOnto` measures the error in the plane the ship is ACTUALLY
    // in, so pulling always shortens it. `bankToTurn`'s gate is right for a
    // controller that owns the roll axis, and this one does not.
    pitch: pitchOnto(quat, plan.heading),
    // THE ROLL IS ASKED FOR WHERE IT WILL BE, not where it is: the error a lead
    // time from now at the rate already being flown (docs/TODO/137). Everything
    // above decides WHICH bank; this is what lets the ship hold one. A
    // proportional ask behind a rate ramp is a second-order loop with no damping
    // term, and it ringed around every bank it was given — see `DC_ROLL_LEAD`,
    // which is the whole of the argument and the measurement.
    roll: steerStick(asked - rollRate * DC_ROLL_LEAD),
  };
}
