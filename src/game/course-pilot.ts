// How the ship flies the course that the pilot picked (docs/TODO/205 M3).
//
// `courses.ts` decides what is on the list. This file flies one course for one
// frame. It DECIDES and reports a `CourseStep`, as the two computers in
// `autopilot.ts` do. The demand in it is a `FlightDemand`, the same thing a
// pair of hands makes, and `PlayerShip.update` flies it.
//
// It APPLIES nothing. The switches are `flight-instruments.ts`'s: the torus
// drive, and the hand-over to the docking computer. A step asks for them, and
// the instruments throw them. It draws nothing from the seeded stream, so it
// has no order to preserve.
//
// THE STEERING IS THE CO-PILOT'S. `bankToTurn` in `pitch-roll-steer.ts` points
// the nose with pitch and roll alone, at the commander's own caps and ramp.
// The ship has no yaw axis, so there is no other way to point it.
//
// THE STEER MEMORY IS NOT SAVED. It holds which vertical a bank takes, and a
// restore that starts it fresh costs one bank at most. The scripted co-pilot
// makes the same bargain.
//
// Two courses fly today. The station course points at the station and runs
// the torus until the mass lock. It then hands the ship to the docking
// computer, at the range where that computer takes a job. The jump course
// flies straight while the countdown runs. The rest wait for their
// milestones, and a course with no flight yet returns no demand.

import * as THREE from 'three';
import { rampFlightRate, type FlightDemand } from '../player.ts';
import { bankToTurn, freshSteerMemory, type SteerMemory } from './pitch-roll-steer.ts';
import type { CourseKind } from './courses.ts';
import { PLAYER_FLIGHT } from '../constants/player-flight.ts';
import { DOCK_COMPUTER_RANGE } from '../constants/docking-computer.ts';
import { COURSE_TORUS_CONE } from '../constants/course.ts';

/** What the course pilot reads for one frame. A flat view, so a test needs no world. */
export interface CourseView {
  readonly course: CourseKind;
  readonly position: THREE.Vector3;
  readonly quaternion: THREE.Quaternion;
  readonly pitchRate: number;
  readonly rollRate: number;
  readonly stationPos: THREE.Vector3;
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
}

const IDLE: CourseStep = { demand: null, torus: false, handOver: false };

export class CoursePilot {
  private mem: SteerMemory = freshSteerMemory();
  private readonly dir = new THREE.Vector3();
  private readonly fwd = new THREE.Vector3();

  /** Forget the bank, for a new course. */
  reset(): void { this.mem = freshSteerMemory(); }

  step(v: CourseView, dt: number): CourseStep {
    if (v.course === 'station') return this.toStation(v, dt);
    if (v.course === 'jump') return { demand: straight(v, dt), torus: false, handOver: false };
    return IDLE;
  }

  /**
   * Point at the station, and run the torus while the nose is on it. Inside
   * the docking computer's range, hand over. The docking computer then flies
   * the approach and the slot, and this course asks for nothing more.
   */
  private toStation(v: CourseView, dt: number): CourseStep {
    if (v.dcEngaged) return IDLE;
    this.dir.subVectors(v.stationPos, v.position);
    if (this.dir.length() <= DOCK_COMPUTER_RANGE) {
      return { demand: null, torus: false, handOver: true };
    }
    const stick = bankToTurn(v.quaternion, this.dir, this.mem);
    this.fwd.set(0, 0, -1).applyQuaternion(v.quaternion);
    const offNose = this.fwd.angleTo(this.dir);
    return {
      demand: {
        pitchRate: rampFlightRate(
          v.pitchRate, stick.pitch * PLAYER_FLIGHT.maxPitch, stick.pitch !== 0, dt),
        rollRate: rampFlightRate(
          v.rollRate, stick.roll * PLAYER_FLIGHT.maxRoll, stick.roll !== 0, dt),
        throttle: 1,
        fire: false,
      },
      torus: offNose < COURSE_TORUS_CONE,
      handOver: false,
    };
  }
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
