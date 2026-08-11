// Flying a ship into the station slot — the one piece of piloting that needs
// roll control, and therefore the one thing neither the scripted NPC steering
// nor the player's docking computer could previously do.
//
// Shared deliberately. Traders putting in at the station and the player's
// docking computer are the same problem: get onto the slot axis, match the
// slot's rotation, and run in. Solving it twice would mean two things to get
// wrong, and the hard part — roll — is identical for both.
//
// Why roll is the crux: `NpcShip.steerToward` builds orientation from
// `lookAt(dir, WORLD_UP)`, so roll is whatever falls out of pointing at a
// target. The station's slot is a letterbox on a hull spinning at
// `STATION_SPIN`, so a ship that cannot choose its roll cannot fit through it.
// The fix is to take the up-hint from the STATION rather than the world, which
// matches the slot's rotation for free as it turns.
//
// The letterbox itself — which way up it stands, how wide the channel is, and
// the roll tolerance — is constants/docking.ts, with the released slot
// measurements beside the values. `test/world.test.ts` and
// `test/docking.test.ts` pin the geometry.
//
// WHERE the ship is sent is `dock-path.ts` and is a curve; what is here is the
// plan read off it — the heading, the speed, the roll handover and who counts as
// docked. That split is docs/TODO/136: the approach used to be two rival aims
// with a threshold between them, and the threshold is what reversed.

import * as THREE from 'three';

import {
  GATE_HALF_WIDTHS, LINED_UP_LATERAL, HULL_BOX_MARGIN,
  SLOT_HALF_ACROSS, SLOT_HALF_ALONG, SLOT_DEPTH, ROLL_TOLERANCE,
} from '../constants/docking.ts';
import {
  DC_SLOT_MARGIN, DC_TURN_FADE_ANGLE,
} from '../constants/docking-computer.ts';
import { slotNormal } from '../world/slot.ts';
import { dockPath, makeDockPath } from './dock-path.ts';
import {
  pitchOnto, rollErrorTo, steerStick, type StickCommand,
} from './pitch-roll-steer.ts';

export type DockPhase =
  /** still coming round — the path is doing the flying */
  | 'gate'
  /** on the last leg: down the axis, rolled with the slot */
  | 'run';

export interface DockPlan {
  /** unit vector the ship should be pointing along */
  heading: THREE.Vector3;
  /** up-hint for the orientation — the station's own up, so roll matches the slot */
  up: THREE.Vector3;
  /** speed to fly at */
  speed: number;
  phase: DockPhase;
  /** inside the slot far enough to count as docked */
  arrived: boolean;
  /** distance off the slot axis, for HUD and tests */
  lateral: number;
  /**
   * The plane this ship is coming round in, held across frames — see
   * `dock-path.ts`, which reads and writes it. Saved state like the phase: a
   * ship reloaded mid-approach carries on the way round it was already going.
   */
  swing: THREE.Vector3;
}

const _rel = new THREE.Vector3();
const _slotN = new THREE.Vector3();
/** the path is scratch, not state: everything held across frames is in DockPlan */
const _path = makeDockPath();

/**
 * One frame of a docking approach.
 *
 * @param pos       the ship's position
 * @param station   the station object (its quaternion carries the slot's roll)
 * @param dockZ     station half-width — the slot sits on the local -Z face
 * @param maxSpeed  the ship's top speed
 * @param out       reused plan object, so this allocates nothing per frame
 */
export function planDocking(
  pos: THREE.Vector3,
  station: THREE.Object3D,
  dockZ: number,
  maxSpeed: number,
  out: DockPlan,
): DockPlan {
  // the slot faces along the station's local -Z, pointing outwards
  slotNormal(station, _slotN);
  _rel.copy(pos).sub(station.position);
  const along = _rel.dot(_slotN);
  // perpendicular distance from the axis
  const lateral = _rel.addScaledVector(_slotN, -along).length();
  out.lateral = lateral;
  // The station's local X, not its Y: `lookAt(heading, up)` puts the ship's
  // RIGHT perpendicular to the up-hint, and the wings have to lie along the
  // slot's LONG axis, which is the station's local Y (see the header). Handing
  // it the Y put every trader through the letterbox side-on.
  out.up.set(1, 0, 0).applyQuaternion(station.quaternion);

  const gateDist = dockZ * GATE_HALF_WIDTHS;

  // WHERE THE APPROACH GOES is `dock-path.ts`, and the whole of the answer here
  // is a point one lookahead along it. There is no branch left: the stand-off,
  // the way round the hull and the run in are one curve, and the aim moves along
  // it continuously however sharply it turns. What used to be here — two rival
  // aims and a threshold with no hysteresis between them — reversed the
  // commanded heading through a half turn on 223 of 504 approaches, every one of
  // them from behind the station (docs/TODO/136).
  const path = dockPath(pos, station, dockZ, out.swing, _path);
  // A zero-length heading is not reachable — the aim runs no deeper than the
  // station's centre and `arrived` has fired by the slot mouth — but a plan that
  // yields NaN steers every axis at once, so the last heading stands instead.
  if (path.aim.distanceToSquared(pos) > 1e-6) {
    out.heading.copy(path.aim).sub(pos).normalize();
  }

  // Speed is part of the manoeuvre and not a detail: three of the four rewrites
  // in docs/TODO/136 hurt because the ship arrived somewhere too fast to turn.
  // It is eased over the gate distance BEFORE the mouth rather than switched at
  // it, so the roll has the length of the corridor to settle in, and the run's
  // own speed is unchanged.
  //
  // A SECOND RULE WAS TRIED HERE AND MEASURED AWAY: capping the speed by how
  // sharply the path bends, so that the nose's lag behind a turning demand stays
  // inside `DC_TURN_FADE_ANGLE` and the roll is never handed a nearly-degenerate
  // axis to hunt around. It reads well and it costs more than it buys — the ring
  // it was aimed at is roughly one reversal a second whatever the speed, so
  // slowing down simply buys more seconds of it: over the 504-approach sweep the
  // median approach took 15.6s and 16 roll reversals unlimited, 18.0s and 17 at
  // 0.20 rad/s, 23.9s and 20 at 0.12, and 34.3s and 25 at 0.08. What actually
  // fixed the scraping that motivated it was the LOOKAHEAD — see
  // `DC_PATH_LOOKAHEAD`, where the same sweep put the cliff.
  const settled = Math.min(110, maxSpeed * 0.7);
  const cruise = Math.max(settled, maxSpeed * 0.55);
  const eased = Math.max(0, Math.min(1, (path.toGo - gateDist) / gateDist));
  out.speed = Math.max(25, settled + (cruise - settled) * eased);

  // The phase no longer decides anything about WHERE the ship is going: the
  // path does, from end to end, and that is the point of it. What is left is the
  // question `dockingSticks` asks — is this ship on the last leg, and has the
  // slot's own roll started to matter — plus the flag NPC traders carry.
  //
  // Commit only when actually on the axis. Skipping the lateral test is the
  // obvious mistake: a ship that reaches the gate 150 units off-axis and then
  // flies straight carries that error into the hull instead of the slot. And it
  // LATCHES: as the ship runs in, `along` shrinks past any outside-the-hull
  // guard, so re-testing every frame would drop the roll handover just as the
  // letterbox needs it.
  const committed = out.phase === 'run' && along > 0 && lateral < LINED_UP_LATERAL * 2;
  const linedUp = committed ||
    (lateral < LINED_UP_LATERAL && along > dockZ && along < gateDist * 1.5);
  out.phase = linedUp ? 'run' : 'gate';

  // Inside the slot mouth and still on the axis — and IN FRONT of the station,
  // which was missing. `along` is signed, so a ship behind the hull satisfied
  // `along < dockZ` trivially; a trader that drifted within `LINED_UP_LATERAL`
  // of the axis LINE on the far side counted itself docked and despawned
  // through the back of the station (game/npc.ts reads this). Found by the
  // wrong-side sweep in docs/TODO/136.
  out.arrived = along > 0 && along < dockZ && lateral < LINED_UP_LATERAL;
  return out;
}

/** A fresh plan object to hand to planDocking each frame. */
export function makeDockPlan(): DockPlan {
  return {
    heading: new THREE.Vector3(0, 0, -1),
    up: new THREE.Vector3(0, 1, 0),
    speed: 0,
    phase: 'gate',
    arrived: false,
    lateral: 0,
    swing: new THREE.Vector3(),
  };
}


// --- flying the plan --------------------------------------------------------
//
// The plan says where to point; this says what to do with the stick. They are
// separate because the approach was never the problem: the player's docking
// computer flew a correct plan by writing `player.quaternion` through a
// shortest-arc slerp, which pivots about an axis no stick can produce, wrote
// neither of the rates the HUD reads, and obeyed a turn limit of its own rather
// than the hull's (docs/TODO/126).
//
// NPC traders do not come through here. They dock with `steerToward`, which
// builds an orientation from `lookAt` — an NPC has yaw and can afford to.

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
 */
export function dockingSticks(quat: THREE.Quaternion, plan: DockPlan): StickCommand {
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
  // arriving at the very edge of what fits leaves nothing for the last second
  // of drift, and the slot is still turning while you come in.
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

  return {
    // Ungated: `pitchOnto` measures the error in the plane the ship is ACTUALLY
    // in, so pulling always shortens it. `bankToTurn`'s gate is right for a
    // controller that owns the roll axis, and this one does not.
    pitch: pitchOnto(quat, plan.heading),
    roll: steerStick(base + (wanted - base) * turnClaim),
  };
}


// --- who is actually docked ------------------------------------------------
//
// This lived twice: `arrived` above, which NPC traders dock on and which has
// NO roll test at all, and a re-implementation in game.ts checkStation() with
// a bounding box, a slot channel and a roll test. So an NPC could thread a
// letterbox the player could not, and only the NPC's half was testable.
//
// One rule, one home. The consequence — bounce, damage, message, or actually
// docking — stays with the Game, because that is what it costs.

/**
 * Is a point in the slot channel? `x` and `y` are station-LOCAL.
 *
 * Exported because the HUD's alignment aid asks the same question and used to
 * answer it with its own copy of the numbers (`hud/hud-model.ts`), which is the
 * rule-with-two-homes this project is organised against — and which would have
 * silently kept the old horizontal channel through this change.
 */
export function inSlotChannel(localX: number, localY: number): boolean {
  return Math.abs(localX) < SLOT_HALF_ACROSS && Math.abs(localY) < SLOT_HALF_ALONG;
}

/**
 * Are the wings lined up with the slot's long axis?
 *
 * `right` is the ship's own +X in the STATION's frame. The slot runs along the
 * station's local Y, so alignment is measured against Y and the tolerance is
 * the angle away from it. Both magnitudes are absolute: a ship upside down in
 * the slot still fits through it.
 */
export function rollAlignedWithSlot(rightX: number, rightY: number): boolean {
  return slotRollOffset(rightX, rightY) < ROLL_TOLERANCE;
}

/** How far off the slot's long axis the wings are, in radians. */
export function slotRollOffset(rightX: number, rightY: number): number {
  return Math.atan2(Math.abs(rightX), Math.abs(rightY));
}

export type DockingOutcome =
  /** nothing near enough to matter */
  | 'clear'
  /** through the slot, lined up — you are down */
  | 'docked'
  /** in the channel but rolled wrong */
  | 'slotMiss'
  /** flew into the hull */
  | 'hull';

/**
 * Where a ship is relative to the slot.
 *
 * @param scratch a Vector3 and a Quaternion to work in; this runs every frame.
 */
export function dockingOutcome(
  pos: THREE.Vector3,
  quat: THREE.Quaternion,
  station: THREE.Object3D,
  dockZ: number,
  scratch: { v: THREE.Vector3; q: THREE.Quaternion; r: THREE.Vector3 },
): DockingOutcome {
  const box = dockZ + HULL_BOX_MARGIN;
  const local = scratch.v.copy(pos);
  station.worldToLocal(local);
  // deliberately cheap: an axis-aligned cube
  if (Math.abs(local.x) > box || Math.abs(local.y) > box || Math.abs(local.z) > box) {
    return 'clear';
  }
  const inSlot = local.z < -(dockZ - SLOT_DEPTH) && inSlotChannel(local.x, local.y);
  if (!inSlot) return 'hull';

  scratch.q.copy(station.quaternion).invert().multiply(quat);
  const right = scratch.r.set(1, 0, 0).applyQuaternion(scratch.q);
  return rollAlignedWithSlot(right.x, right.y) ? 'docked' : 'slotMiss';
}
