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
// a radius for every bearing round from the slot normal (`dockPathRadius`), and
// then straight down the axis:
//
//   the STAND-OFF, a fixed funnel that holds the gate distance from `TURN_IN`
//   round to astern and dives inside it. Fixed is the point: a path that is
//   re-rooted on the ship every frame has no restoring force, and a follower
//   aimed a lookahead along a curve always flies INSIDE it — half a lookahead of
//   radius per radian of bearing, which puts a ship that starts 900 out into the
//   hull before it is halfway round (measured: 353 scrapes in one sweep, all of
//   them from 900). Against a funnel that does not move, the same follower
//   settles a BOUNDED distance inside instead.
//
//   the DESCENT, `range * (bearing left / bearing at the ship)`, which is the
//   ship's own way in: a spiral through where it actually is, so a ship a long
//   way out comes in on a curve rather than diving at the funnel and turning
//   hard when it arrives. The path is the larger of these two, and they cross
//   where they are equal, so there is no join to be continuous at.
//
//   the RUN IN, straight down the axis from `RUN_IN_WIDTHS` to the slot. A ship
//   should be POINTING down the slot before it is in the slot, and a funnel that
//   dives all the way to the letterbox arrives across it: 13.6 degrees off the
//   axis in a median approach before this leg existed, 3.4 after. The funnel's
//   square root is what makes the join between them invisible — its slope goes
//   to infinity as the bearing runs out, so the curve is already travelling down
//   the axis when it meets it.
//
// The follower is the plan's M3: put the ship on the path, and aim one
// `DC_PATH_LOOKAHEAD` along from there. Where it is on the path is BLENDED
// rather than chosen — the path's own start out where it is coming round, the
// nearest point of it once it is lined up — and the reasoning for that, which is
// two measured failures, is at the call.
//
// M4 in docs/TODO/136 is where traffic would live: a path is the structure that
// makes avoidance cheap, because it can be replanned round an obstacle instead of
// fought for frame by frame. Nothing here forecloses it — the plane is already a
// parameter of the curve. It is NOT built.

import * as THREE from 'three';

import {
  GATE_HALF_WIDTHS, LINED_UP_LATERAL, RUN_IN_WIDTHS, TURN_IN,
} from '../constants/docking.ts';
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
 * @param runIn    where the funnel meets the axis and the straight run begins
 *
 * Exported for the tests, which is where the shape is pinned: a curve is worth
 * asserting about directly, and every claim the module makes about clearing the
 * hull and threading the channel is a claim about this function.
 */
export function dockPathRadius(
  share: number, bearing: number, range: number, gateDist: number, runIn: number,
): number {
  // The SQUARE ROOT is the funnel's shape, and what it buys is the JOIN: its
  // slope goes to infinity as the bearing runs out, so the curve is travelling
  // straight down the slot axis by the time it meets it, and the run in is the
  // same curve continuing rather than a leg spliced on at an angle. A power of 1
  // — a straight line to the mouth — arrives across the axis instead, and the
  // ship goes through the letterbox still turning into it.
  const standoff = runIn
    + (gateDist - runIn) * Math.min(1, Math.sqrt(share * bearing / TURN_IN));
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
  const lookCap = dockZ * DC_PATH_LOOKAHEAD;
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

  // --- walk the curve, and follow it ----------------------------------------
  //
  // Sample it, find the nearest point on it to the ship, and aim a lookahead
  // along from there. The projection is the part that cannot be skipped: the
  // ship is ON the path only while its own descent is what the path is made of,
  // and the moment the funnel or the run in takes over it is off to one side —
  // inside the stand-off coming round the back, or short of the join on final
  // approach. Taking the path's point at the ship's own BEARING instead is the
  // cheap version, and it fails at exactly one place and badly: on the run in,
  // where every point of the path has the same bearing, so the cheap projection
  // lands at the far end of the leg and the aim a lookahead past THAT is astern
  // of the ship. Measured, that is the plan reversing through 180 degrees as the
  // ship crosses the join, and the approach flying out and starting again.
  // Where the curve gives way to the straight run, and it FOLLOWS a ship that is
  // already on that run — the one leg a ship can be PAST. Held at its own radius
  // the whole path sits behind such a ship, and the aim, one lookahead along it,
  // lands astern: the plan reverses through 180 degrees as the ship crosses the
  // join. It follows by the same corridor membership the projection blends on,
  // so the two move together and neither has a threshold in it.
  const inCorridor = along > 0 ? Math.max(0, Math.min(1,
    (LINED_UP_LATERAL * 3 - off) / (LINED_UP_LATERAL * 2))) : 0;
  const runIn = dockZ * RUN_IN_WIDTHS
    + (Math.min(along, dockZ * RUN_IN_WIDTHS) - dockZ * RUN_IN_WIDTHS) * inCorridor;
  fill(bearing, range, gateDist, runIn);
  // WHERE ON THE PATH THE SHIP IS, and the answer is blended rather than chosen.
  // Coming round, it is at the path's own START by construction — the curve is
  // sampled from its own bearing, and where that start sits OUTSIDE the ship is
  // the whole of the stand-off: the aim is out on the funnel, and the heading to
  // it leads the ship out and round. Lined up, that is wrong by as much as the
  // ship has cut inside the funnel on the way in — 130 units, measured — and
  // what it wants is the nearest point of the path it is actually flying.
  //
  // Neither can simply replace the other. A NEAREST-POINT projection is what the
  // textbook says and it swaps for a ship deep inside the funnel, which is near
  // two parts of it at once: the aim slid a quarter of the way round the station
  // between two frames, and the plan moved 21 degrees. Switching between them on
  // the run latch instead moves the aim 149 units in the frame it switches — 12
  // degrees, on every approach. So the nearest point is spent only as far as the
  // ship has EARNED it by being lined up, which is nothing at all out where the
  // projection is unstable and all of it where the path passes through the ship.
  const ahead = project(along, off) * inCorridor;
  out.toGo = _total - ahead;
  aimAlong(ahead + dockZ * DC_PATH_LOOKAHEAD);
  out.aim.copy(station.position).addScaledVector(_n, _aimX).addScaledVector(_e, _aimY);
  return out;
}

/** Where the walk put the aim, in the plane: along the normal, and off it. */
let _aimX = 0;
let _aimY = 0;

/**
 * The sampled path, in the plane: along the slot normal, and off the axis.
 *
 * `STEPS + 2` points — one per sample of the curve, plus the station's own
 * centre, which is where the straight run in ends. Preallocated because this
 * runs every frame for every ship on approach.
 */
const _px = new Float64Array(STEPS + 2);
const _py = new Float64Array(STEPS + 2);
/** How long the whole path is, set by the last projection. */
let _total = 0;

/**
 * Sample the curve from the ship's bearing down to the slot axis, and then down
 * the axis to the station's centre.
 *
 * Sampled in equal FRACTIONS of the bearing still to come rather than at a fixed
 * angle, so every sample moves continuously as the ship does and nothing in the
 * aim steps as one is crossed. The last leg is one segment, a straight line
 * having no sag to sample away.
 */
function fill(bearing: number, range: number, gateDist: number, runIn: number): void {
  const step = bearing / STEPS;
  const cs = Math.cos(step);
  const sn = Math.sin(step);
  let cosPhi = Math.cos(bearing);
  let sinPhi = Math.sin(bearing);
  for (let i = 0; i <= STEPS; i++) {
    if (i > 0) {
      const nextCos = cosPhi * cs + sinPhi * sn;
      sinPhi = sinPhi * cs - cosPhi * sn;
      cosPhi = nextCos;
    }
    const radius = dockPathRadius((STEPS - i) / STEPS, bearing, range, gateDist, runIn);
    _px[i] = radius * cosPhi;
    _py[i] = radius * sinPhi;
  }
  _px[STEPS + 1] = 0;
  _py[STEPS + 1] = 0;
}

/**
 * Put the ship on the path, and return how far there is left to fly from there.
 *
 * COMING ROUND, the ship is at the path's own start by construction: the curve
 * is sampled from the ship's own bearing, and its first point is the ship
 * whenever the ship's own descent is what the path is made of. When it is not —
 * inside the stand-off, coming round the back — that first point is where the
 * ship OUGHT to be at its bearing, and the difference is the whole of the
 * stand-off: the aim is out on the funnel, and the heading to it leads the ship
 * out and round.
 *
 * ON THE RUN, it is the nearest point of the straight leg, because there the
 * ship is somewhere ALONG a leg rather than at the start of one.
 *
 * A NEAREST-POINT projection over the whole path was written first, which is the
 * textbook follower and is wrong for this curve. A ship inside the funnel is
 * near two parts of it at once — the piece at its own bearing and the piece
 * further round — and the nearest of those SWAPS as it moves: measured, the aim
 * slid a quarter of the way round the station between two frames and the
 * commanded heading moved 21 degrees, which is the defect this whole item exists
 * to have removed. A bearing cannot swap, because a ship has one of them.
 */
function project(along: number, off: number): number {
  let best = Infinity;
  let at = 0;
  let travelled = 0;
  _total = 0;
  for (let i = 0; i <= STEPS; i++) {
    const dx = _px[i + 1] - _px[i];
    const dy = _py[i + 1] - _py[i];
    const len = Math.hypot(dx, dy);
    const t = len > 1e-6
      ? Math.max(0, Math.min(1,
        ((along - _px[i]) * dx + (off - _py[i]) * dy) / len / len)) : 0;
    const dist = Math.hypot(_px[i] + dx * t - along, _py[i] + dy * t - off);
    if (dist < best) { best = dist; at = travelled + len * t; }
    travelled += len;
  }
  _total = travelled;
  return at;
}

/**
 * Walk `look` along the path from where the projection landed, and leave the
 * point there in `_aimX`/`_aimY` — or the station's centre, if the path runs out
 * first, which is where every approach has pointed once it is lined up since
 * there was an approach at all.
 */
function aimAlong(look: number): void {
  let px = _px[0];
  let py = _py[0];
  let travelled = 0;
  for (let i = 1; i <= STEPS + 1; i++) {
    const dx = _px[i] - px;
    const dy = _py[i] - py;
    const seg = Math.hypot(dx, dy);
    if (travelled + seg >= look) {
      const t = seg > 1e-9 ? (look - travelled) / seg : 0;
      _aimX = px + dx * t;
      _aimY = py + dy * t;
      return;
    }
    travelled += seg;
    px = _px[i];
    py = _py[i];
  }
  _aimX = 0;
  _aimY = 0;
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
