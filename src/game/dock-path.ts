// Where a docking approach GOES: one curve from the ship to the slot, and the
// point on it to steer at.
//
// This exists because the approach used to answer a different question. It asked
// "which way now?" from wherever the ship happened to be, so every change of mind
// was a discontinuity in the only output it had — a commanded heading that
// reversed through 180 degrees on 223 of `npm run dock-probe`'s 504 approaches,
// all of them from behind the station, where a radial stand-off push makes no
// progress and a threshold with no hysteresis fires over and over (docs/TODO/136,
// which records the four reactive rewrites that failed to fix it).
//
// A path answers "where does this approach go?" instead, and the aim is a point a
// fixed distance ahead ALONG it. Two properties fall out that four rewrites could
// not buy: the aim can never reverse or be ill-conditioned, because it is always
// a lookahead away on a continuous curve moving forward; and clearing the hull is
// a property of the CURVE, laid outside the station in the first place, rather
// than a correction pushing against an aim that points through it.
//
// THE CURVE, in the plane that holds the ship, the station and the slot axis, as
// a radius for every bearing round from the slot normal (`dockPathRadius`):
//
//   the STAND-OFF, a fixed funnel that holds the gate distance from `TURN_IN`
//   round to astern and dives to the slot inside it. Fixed is the point: a path
//   that is re-rooted on the ship every frame has no restoring force, and a
//   follower aimed a lookahead along a curve always flies INSIDE it — half a
//   lookahead of radius per radian of bearing, which is 200 units a radian here
//   and puts a ship that starts 900 out into the hull before it is halfway round
//   (measured: 353 scrapes in one sweep, all of them from 900). Against a funnel
//   that does not move, the same follower settles a BOUNDED distance inside
//   instead — a lookahead squared over twice the radius, 100 units here — and the
//   gate distance is far enough out to spend that and still clear the hull.
//
//   the DESCENT, `range * (bearing left / bearing at the ship)`, which is the
//   ship's own way in: a spiral through where it actually is, so a ship a long
//   way out comes in on a curve rather than diving at the funnel and turning
//   hard when it arrives. Radius proportional to bearing arrives ALONG the axis
//   (lateral offset falls off as the square of the radius), so the run in is the
//   end of the same curve and not a leg spliced onto it.
//
// The path is the larger of the two, which is the descent while the ship is
// outside the funnel and the funnel once it has come down to it. They cross where
// they are equal, so there is no join to be continuous at.
//
// The follower marches the curve rather than solving it. A closed form exists for
// either piece alone and not for the pair, and the march is the honest way to
// keep the shape free: `STEPS` samples from the ship's bearing to the axis,
// accumulating length, taking the aim at one lookahead and the total as the
// distance still to fly. The samples are a fixed FRACTION of the way round rather
// than a fixed angle, so they move continuously as the ship does and nothing in
// the aim jitters as one crosses a sample.
//
// M4 in docs/TODO/136 is where traffic would live: a path is the structure that
// makes avoidance cheap, because it can be replanned round an obstacle instead of
// fought for frame by frame. Nothing here forecloses it — the plane is already a
// parameter of the curve. It is NOT built.

import * as THREE from 'three';

import { GATE_HALF_WIDTHS, TURN_IN } from '../constants/docking.ts';
import { DC_PATH_LOOKAHEAD } from '../constants/docking-computer.ts';
import { slotNormal } from '../world/slot.ts';

export interface DockPath {
  /** the point to fly at: one lookahead along the path */
  aim: THREE.Vector3;
  /** how far there is left to fly ALONG the path, from abeam the ship to the slot */
  toGo: number;
}

/** A fresh path object to hand to `dockPath` each frame. */
export function makeDockPath(): DockPath {
  return { aim: new THREE.Vector3(), toGo: 0 };
}

/**
 * How many segments the curve is marched in.
 *
 * The error a march makes is the sag of a chord against its arc, and at the
 * widest the curve is here that is `radius * (1 - cos(step/2))`: a single unit
 * out of 800 at 32 steps of a half turn, against a slot 52 units across. Twice
 * as many would be measuring the arithmetic rather than the flying.
 */
const STEPS = 32;

const _rel = new THREE.Vector3();
const _n = new THREE.Vector3();
const _e = new THREE.Vector3();
const _held = new THREE.Vector3();
const _turn = new THREE.Vector3();

/**
 * The path's radius at one point along it, in world units.
 *
 * @param share  how much of the way round is still to come, 1 at the ship and 0
 *               on the slot axis. The sample's own bearing is `share * bearing`.
 * @param bearing  the ship's bearing round from the slot normal, in radians
 * @param range    how far out the ship is
 * @param gateDist the gate distance — the radius the stand-off funnel holds
 *
 * Exported for the tests, which is where the shape is pinned: a curve is worth
 * asserting about directly, and every claim the module makes about clearing the
 * hull and threading the channel is a claim about this function.
 */
export function dockPathRadius(
  share: number, bearing: number, range: number, gateDist: number,
): number {
  // The SQUARE ROOT is the funnel's whole shape, and it is a hull-clearance rule
  // rather than a preference: it is what makes the dive steep near the axis and
  // shallow at the top. Everything inside `dockingOutcome`'s box is either the
  // slot channel or the hull, so the path has to be inside the CHANNEL by the
  // time it is inside the box — and the offset it enters at is `SLOT_HALF_ACROSS`
  // at a power of 0.71 and twice that at a power of 1, which is a straight line
  // into the hull face. A half leaves a factor of two in hand.
  // `test/docking.test.ts` holds the curve to the channel and goes red at 1.
  const standoff = gateDist * Math.min(1, Math.sqrt(share * bearing / TURN_IN));
  return Math.max(range * share, standoff);
}

/**
 * The approach path, and the point on it a follower should steer at.
 *
 * @param pos      the ship's position
 * @param station  the station (its quaternion carries the slot's direction)
 * @param dockZ    station half-width — the slot sits on the local -Z face
 * @param swing    the plane this ship is coming round in: READ AND WRITTEN
 * @param out      reused path object, so this allocates nothing per frame
 */
export function dockPath(
  pos: THREE.Vector3,
  station: THREE.Object3D,
  dockZ: number,
  swing: THREE.Vector3,
  out: DockPath,
): DockPath {
  const gateDist = dockZ * GATE_HALF_WIDTHS;
  slotNormal(station, _n);
  _rel.copy(pos).sub(station.position);
  const range = Math.max(_rel.length(), 1);
  const along = _rel.dot(_n);
  /** 0 dead in front of the letterbox, a half turn directly behind the hull */
  const bearing = Math.acos(Math.max(-1, Math.min(1, along / range)));

  // --- which way round it comes ---------------------------------------------
  //
  // The path lies in the plane through the ship, the station and the slot axis,
  // and `_e` is that plane's in-plane perpendicular to the normal, pointing at
  // the ship's side. It is exactly what a ship DIRECTLY ASTERN does not have:
  // its distance off the axis line is zero, so its own position says nothing
  // about which way round to come, and the tie is a coin toss a sideways nudge
  // can flip — the aim swinging from one side of the station to the other
  // between frames, which is the reported defect wearing a different hat.
  //
  // So the plane is HELD. `swing` is the last well-conditioned one this ship
  // flew — its own saved state — and near the axis line the plane is rotated
  // from the held one toward the ship's own by as much of the angle between them
  // as the ship has EARNED by being off the axis at all. Both ends are exact: a
  // ship a lookahead off the line flies its own plane, a ship exactly on it
  // flies the held one, and nothing in between can jump, because it is one
  // rotation about the axis rather than a choice between two answers.
  //
  // This is not the latch that failed in docs/TODO/136's second rewrite. That
  // one held an axis to ROTATE AN AIM ABOUT, so it went stale as the ship came
  // round and eventually rotated the aim onto the ship itself. This holds the
  // plane a PATH lies in, and a ship following the path stays in the plane it is
  // holding: it is refreshed by the flying and cannot go stale.
  _rel.addScaledVector(_n, -along);
  const off = _rel.length();
  if (swing.lengthSq() < 0.5) holdDefault(station, swing);
  _held.crossVectors(_n, swing);
  // the station has turned under a held plane until it lies along the axis:
  // there is no in-plane direction left in it, so start again from the default
  if (_held.lengthSq() < 1e-9) {
    holdDefault(station, swing);
    _held.crossVectors(_n, swing);
  }
  _held.normalize();
  _e.copy(_rel).multiplyScalar(off > 1e-9 ? 1 / off : 0);
  const lookCap = gateDist * DC_PATH_LOOKAHEAD;
  if (off >= lookCap) {
    // `swing` is the plane's normal: unit, both of these being unit and
    // perpendicular, so no normalise is needed and none is wanted — this runs
    // every frame of every approach.
    swing.crossVectors(_e, _n);
  } else {
    const across = _turn.crossVectors(_held, _e).dot(_n);
    const angle = Math.atan2(across, _held.dot(_e)) * (off / lookCap);
    _turn.crossVectors(_n, _held);
    _e.copy(_held).multiplyScalar(Math.cos(angle))
      .addScaledVector(_turn, Math.sin(angle));
  }

  // --- march the curve, twice -----------------------------------------------
  //
  // Once for its length, and once for the aim — because how far to look depends
  // on how far there is left. A lookahead longer than the path remaining puts
  // the aim on the END of it, the station's own centre, and a ship flying
  // straight at the centre holds its BEARING rather than closing it: it arrives
  // at the hull face carrying whatever it was off by, which is 4 scrapes an
  // approach measured over the sweep. So the follower looks the same share of
  // the way to the slot that it looks of the gate distance — one number, clamped
  // twice — and the aim stays ON the curve all the way in.
  const total = march(bearing, range, gateDist, Infinity);
  march(bearing, range, gateDist, DC_PATH_LOOKAHEAD * Math.min(gateDist, total));
  out.toGo = total;
  out.aim.copy(station.position).addScaledVector(_n, _aimX).addScaledVector(_e, _aimY);
  return out;
}

/** Where the last march put the aim, in the plane: along the normal, and off it. */
let _aimX = 0;
let _aimY = 0;

/**
 * Walk the curve from abeam the ship to the slot, and return its length.
 *
 * Abeam the ship, not the ship: the path's own point at the ship's bearing is
 * OUTSIDE the ship whenever the ship is inside the funnel, and that difference is
 * the whole of the stand-off — the aim is out on the funnel, and the heading to
 * it leads the ship out and round. Sampled in equal FRACTIONS of the bearing
 * still to come rather than at a fixed angle, so every sample moves continuously
 * with the ship and the aim cannot step as one is crossed.
 *
 * `_aimX`/`_aimY` are left at the point one `look` along, or at the station's
 * centre if the path is shorter than that.
 */
function march(bearing: number, range: number, gateDist: number, look: number): number {
  const step = bearing / STEPS;
  const cs = Math.cos(step);
  const sn = Math.sin(step);
  let cosPhi = Math.cos(bearing);
  let sinPhi = Math.sin(bearing);
  let radius = dockPathRadius(1, bearing, range, gateDist);
  let px = radius * cosPhi;
  let py = radius * sinPhi;
  let travelled = 0;
  _aimX = 0;
  _aimY = 0;
  let found = false;
  for (let i = STEPS - 1; i >= 0; i--) {
    const nextCos = cosPhi * cs + sinPhi * sn;
    sinPhi = sinPhi * cs - cosPhi * sn;
    cosPhi = nextCos;
    radius = dockPathRadius(i / STEPS, bearing, range, gateDist);
    const qx = radius * cosPhi;
    const qy = radius * sinPhi;
    const dx = qx - px;
    const dy = qy - py;
    const seg = Math.hypot(dx, dy);
    if (!found && travelled + seg >= look) {
      const t = seg > 1e-9 ? (look - travelled) / seg : 0;
      _aimX = px + dx * t;
      _aimY = py + dy * t;
      found = true;
    }
    travelled += seg;
    px = qx;
    py = qy;
  }
  return travelled;
}

/**
 * The plane to come round in when the ship's own position cannot say: the one
 * holding the station's local X, which is the slot's SHORT axis.
 *
 * Not an arbitrary pick of the tie. Turning in a plane means pitching about the
 * perpendicular to it, and the perpendicular to this one is the station's local
 * Y — the slot's LONG axis, which is exactly where the wings have to be to fit
 * through the letterbox (see `planDocking`'s up-hint). So a ship that comes
 * round the default way is rolled for the slot the whole way round, and arrives
 * with nothing left to do about it.
 */
function holdDefault(station: THREE.Object3D, swing: THREE.Vector3): void {
  swing.set(0, 1, 0).applyQuaternion(station.quaternion);
}
