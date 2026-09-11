// How the ship flies the course that the pilot picked (docs/TODO/205 M3).
//
// `courses.ts` decides what is on the list. This file flies one course for one
// frame. It DECIDES and reports a `CourseStep`, as the two computers in
// `autopilot.ts` do. The demand in it is a `FlightDemand`, the same thing a
// pair of hands makes, and `PlayerShip.update` flies it.
//
// It APPLIES nothing. The switches are `flight-instruments.ts`'s: the torus
// drive, the hand-over to the docking computer, and the end of a course. A
// step asks for them, and the instruments throw them. It draws nothing from
// the seeded stream, so it has no order to preserve.
//
// THE STEERING IS THE CO-PILOT'S. `bankToTurn` in `pitch-roll-steer.ts` points
// the nose with pitch and roll alone, at the commander's own caps and ramp.
// The ship has no yaw axis, so there is no other way to point it.
//
// THE STEER MEMORY IS NOT SAVED. It holds which vertical a bank takes, and a
// restore that starts it fresh costs one bank at most. The scripted co-pilot
// makes the same bargain.
//
// THREE SHAPES OF COURSE fly today:
//
//   - the station course points at the station and runs the torus. Inside the
//     docking computer's range it hands the ship over;
//   - an ARRIVAL flies to a standoff from a target and stops there. The
//     derelict, the hermit and the star are arrivals. The star course then
//     holds until the tank is full;
//   - the jump course flies straight while the countdown runs.
//
// EVERY LINE GOES ROUND THE PLANET. A line that dips below the clearance
// altitude aims at a point beside the planet instead, until the line clears.
// The arrival at the witchpoint already sits on the station's side of the
// planet. A launch, the star and a rock far out have no such promise.

import * as THREE from 'three';
import { rampFlightRate, type FlightDemand } from '../player.ts';
import { bankToTurn, freshSteerMemory, type SteerMemory } from './pitch-roll-steer.ts';
import type { CourseKind } from './courses.ts';
import { PLAYER_FLIGHT } from '../constants/player-flight.ts';
import { DOCK_COMPUTER_RANGE } from '../constants/docking-computer.ts';
import {
  COURSE_ARRIVE_BRAKE, COURSE_ARRIVE_TOLERANCE, COURSE_DERELICT_STANDOFF,
  COURSE_HERMIT_SPEED, COURSE_HERMIT_STANDOFF, COURSE_PLANET_CLEARANCE,
  COURSE_SKIM_DISTANCE, COURSE_TORUS_CONE, COURSE_TORUS_DROP,
} from '../constants/course.ts';

/** What the course pilot reads for one frame. A flat view, so a test needs no world. */
export interface CourseView {
  readonly course: CourseKind;
  readonly position: THREE.Vector3;
  readonly quaternion: THREE.Quaternion;
  readonly pitchRate: number;
  readonly rollRate: number;
  readonly speed: number;
  readonly stationPos: THREE.Vector3;
  readonly planetPos: THREE.Vector3;
  readonly planetRadius: number;
  readonly sunPos: THREE.Vector3;
  /** the live generation ship, or null for none */
  readonly derelictPos: THREE.Vector3 | null;
  /** how fast the generation ship drifts, because the course matches it */
  readonly derelictSpeed: number;
  /** the live rock hermit, or null for none */
  readonly hermitPos: THREE.Vector3 | null;
  /** the tank holds all it can */
  readonly tankFull: boolean;
  /** the docking computer already has the ship */
  readonly dcEngaged: boolean;
}

/** What the course pilot asks for this frame. */
export interface CourseStep {
  /** what it wants flown, or null where something else flies the ship */
  readonly demand: FlightDemand | null;
  /** whether it wants the torus drive on. The mass lock still decides */
  readonly torus: boolean;
  /** hand the ship to the docking computer now */
  readonly handOver: boolean;
  /** the course is finished, and it leaves the ship */
  readonly done: boolean;
}

const IDLE: CourseStep = { demand: null, torus: false, handOver: false, done: false };

/**
 * One arrival: where it goes, how far out it stops, and how fast it arrives.
 *
 * A target that moves sets the arrival speed to its own. The generation ship
 * drifts at 25 u/s. A course that asked for a stop beside it trailed it at
 * about 19 u/s for ever, and never counted as arrived (docs/TODO/205 M3).
 */
interface Arrival {
  readonly target: THREE.Vector3;
  readonly standoff: number;
  readonly speed: number;
}

export class CoursePilot {
  private mem: SteerMemory = freshSteerMemory();
  private readonly dir = new THREE.Vector3();
  private readonly fwd = new THREE.Vector3();
  private readonly aim = new THREE.Vector3();

  /** Forget the bank, for a new course. */
  reset(): void { this.mem = freshSteerMemory(); }

  step(v: CourseView, dt: number): CourseStep {
    switch (v.course) {
      case 'station': return this.toStation(v, dt);
      case 'jump': return { demand: straight(v, dt), torus: false, handOver: false, done: false };
      case 'derelict':
        return v.derelictPos === null ? ended()
          : this.arrive(v, {
            target: v.derelictPos, standoff: COURSE_DERELICT_STANDOFF, speed: v.derelictSpeed,
          }, dt);
      case 'hermit':
        return v.hermitPos === null ? ended()
          : this.arrive(v, { target: v.hermitPos, standoff: COURSE_HERMIT_STANDOFF, speed: COURSE_HERMIT_SPEED }, dt);
      case 'skim': {
        if (v.tankFull) return ended();
        const s = this.arrive(v, { target: v.sunPos, standoff: COURSE_SKIM_DISTANCE, speed: 0 }, dt);
        // An arrival at the star is not the end. The ship holds there, and the
        // scoops work, until the tank is full.
        return { ...s, done: false };
      }
      default: return IDLE;
    }
  }

  /**
   * Point at the station, and run the torus while the nose is on it. Inside
   * the docking computer's range, hand over. The docking computer then flies
   * the approach and the slot, and this course asks for nothing more.
   */
  private toStation(v: CourseView, dt: number): CourseStep {
    if (v.dcEngaged) return IDLE;
    if (v.position.distanceTo(v.stationPos) <= DOCK_COMPUTER_RANGE) {
      return { demand: null, torus: false, handOver: true, done: false };
    }
    const aim = clearOfPlanet(v.position, v.stationPos, v.planetPos, v.planetRadius, this.aim);
    return { ...this.pointAt(v, aim, 1, dt), handOver: false, done: false };
  }

  /**
   * Fly to a standoff from a target, and stop there.
   *
   * The speed follows the distance that is left. It is the speed from which
   * `COURSE_ARRIVE_BRAKE` of the ship's thrust stops the ship at the standoff,
   * plus the speed the arrival asks for. The torus runs until
   * `COURSE_TORUS_DROP` is left, and only while the nose is on the line.
   */
  private arrive(v: CourseView, a: Arrival, dt: number): CourseStep {
    const left = v.position.distanceTo(a.target) - a.standoff;
    if (Math.abs(left) <= COURSE_ARRIVE_TOLERANCE && v.speed <= a.speed + PLAYER_FLIGHT.accel * dt) {
      return { demand: hold(v, dt), torus: false, handOver: false, done: true };
    }
    const wanted = Math.min(PLAYER_FLIGHT.maxSpeed,
      a.speed + Math.sqrt(2 * COURSE_ARRIVE_BRAKE * PLAYER_FLIGHT.accel * Math.max(0, left)));
    const band = PLAYER_FLIGHT.accel * dt;
    const throttle = v.speed < wanted - band ? 1 : v.speed > wanted + band ? -1 : 0;
    const aim = clearOfPlanet(v.position, a.target, v.planetPos, v.planetRadius, this.aim);
    const p = this.pointAt(v, aim, throttle, dt);
    return { ...p, torus: p.torus && left > COURSE_TORUS_DROP, handOver: false, done: false };
  }

  /** Bank and pull the nose onto a point, with this throttle. */
  private pointAt(
    v: CourseView, point: THREE.Vector3, throttle: number, dt: number,
  ): { demand: FlightDemand; torus: boolean } {
    this.dir.subVectors(point, v.position);
    const stick = bankToTurn(v.quaternion, this.dir, this.mem);
    this.fwd.set(0, 0, -1).applyQuaternion(v.quaternion);
    return {
      demand: {
        pitchRate: rampFlightRate(
          v.pitchRate, stick.pitch * PLAYER_FLIGHT.maxPitch, stick.pitch !== 0, dt),
        rollRate: rampFlightRate(
          v.rollRate, stick.roll * PLAYER_FLIGHT.maxRoll, stick.roll !== 0, dt),
        throttle,
        fire: false,
      },
      torus: this.fwd.angleTo(this.dir) < COURSE_TORUS_CONE,
    };
  }
}

/** The course has nothing left to do: its target is gone, or its work is done. */
function ended(): CourseStep {
  return { demand: null, torus: false, handOver: false, done: true };
}

/** Level the sticks and open the throttle: the ship flies on as it points. */
function straight(v: CourseView, dt: number): FlightDemand {
  return {
    pitchRate: rampFlightRate(v.pitchRate, 0, false, dt),
    rollRate: rampFlightRate(v.rollRate, 0, false, dt),
    throttle: 1,
    fire: false,
  };
}

/** Level the sticks and brake to a stop. */
function hold(v: CourseView, dt: number): FlightDemand {
  return { ...straight(v, dt), throttle: v.speed > PLAYER_FLIGHT.accel * dt ? -1 : 0 };
}

const seg = new THREE.Vector3();
const off = new THREE.Vector3();

/**
 * Where to aim, so that the line to the target clears the planet.
 *
 * It finds the nearest point of the line to the planet's centre. That point
 * can be below `COURSE_PLANET_CLEARANCE`. Then it aims beside the planet, on
 * the same side as the line, and half as high again. The line from there
 * clears the planet, and the ship then turns onto the target.
 *
 * A target that is itself the nearest point needs no detour. docs/TODO/205 M3
 * found a hermit low over the planet. The line to it always counted as
 * blocked, and the ship circled the detour point for ever.
 *
 * @returns `out`, holding the point to aim at.
 */
export function clearOfPlanet(
  from: THREE.Vector3, to: THREE.Vector3, planet: THREE.Vector3, radius: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  seg.subVectors(to, from);
  const len2 = seg.lengthSq();
  const t = len2 > 0 ? Math.max(0, Math.min(1, off.subVectors(planet, from).dot(seg) / len2)) : 0;
  // The nearest point is the target itself: the planet is not between. A
  // target low over the planet is still reached, because the last of the
  // line runs down to it rather than through the planet.
  if (t >= 1) return out.copy(to);
  off.copy(from).addScaledVector(seg, t).sub(planet);
  const clear = radius + COURSE_PLANET_CLEARANCE;
  if (off.length() >= clear) return out.copy(to);
  // A line through the centre has no side. Any direction square to it will do.
  if (off.lengthSq() < 1e-6) {
    off.set(seg.y, -seg.x, 0);
    if (off.lengthSq() < 1e-6) off.set(0, seg.z, -seg.y);
  }
  return out.copy(planet).addScaledVector(off.normalize(), radius + COURSE_PLANET_CLEARANCE * 1.5);
}
