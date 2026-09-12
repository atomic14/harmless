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
// makes the same bargain. The canister the collect course holds is the same
// bargain again. A restore picks the nearest, and that is the pick it makes
// from cold anyway.
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
// EVERY LINE GOES ROUND WHAT IT WOULD HIT. Three things are in the way, and
// each has its own clearance:
//
//   - the PLANET, at `COURSE_PLANET_CLEARANCE` above its surface;
//   - a SOLID in the sky — a rock hermit, an asteroid, the derelict — at
//     `COURSE_OBSTACLE_CLEARANCE` from its hull;
//   - a POLICEMAN, but only on a smuggling run, which is a different rule
//     about being seen rather than about hitting anything.
//
// A line that dips below the clearance altitude aims at a point beside the
// planet instead, until the line clears. A solid is the same trick at a smaller
// scale. It came from a flight, where the station course took the commander
// straight into the hermit she just left.
// The arrival at the witchpoint already sits on the station's side of the
// planet. A launch, the star and a rock far out have no such promise.

import * as THREE from 'three';
import { rampFlightRate, type FlightDemand } from '../player.ts';
import { bankToTurn, freshSteerMemory, type SteerMemory } from './pitch-roll-steer.ts';
import type { CourseKind } from './courses.ts';
import { PLAYER_FLIGHT } from '../constants/player-flight.ts';
import { SLOT_SPEED_LIMIT } from '../constants/docking.ts';
import {
  COURSE_AIM_DEADZONE, COURSE_ROLL_GATE, COURSE_ARRIVE_BRAKE, COURSE_ARRIVE_TOLERANCE, COURSE_DERELICT_STANDOFF,
  COURSE_COLLECT_LEAD, COURSE_HERMIT_SPEED, COURSE_HERMIT_STANDOFF,
  COURSE_COLLECT_SPEED, COURSE_ESCORT_STANDOFF, COURSE_RUN_REACH, COURSE_SKIM_DISTANCE,
  COURSE_TORUS_CONE, COURSE_TORUS_DROP, COURSE_WATCH_STANDOFF,
} from '../constants/course.ts';
import {
  clearOfObstacles, clearOfPlanet, clearOfPolice, type Obstacle,
} from './course-clearance.ts';
import type { MissionHow } from './mission-course.ts';

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
  /** where the hostile ships on the scanner are, for the run course */
  readonly threats: readonly THREE.Vector3[];
  /**
   * The solid things within scanner range that a line must not pass through:
   * a rock hermit, an asteroid and the derelict. Every course reads it.
   *
   * NOT every ship. A pirate is small and it moves, and a line bent round one
   * would be a line bent round a fight. These are the things that sit still and
   * are big enough to kill you (Chris, 2026-09-12).
   */
  readonly obstacles: readonly Obstacle[];
  /** where the police ships within scanner range are, for the smuggling course */
  readonly police: readonly THREE.Vector3[];
  /** where the cargo adrift within scanner range is, nearest first */
  readonly loot: readonly Adrift[];
  /**
   * What the mission asks for here (docs/TODO/208 M1): where its target is,
   * how fast it moves, and what the ship does about it. Null when no live leg
   * has work in this system.
   */
  readonly mission: { readonly at: THREE.Vector3; readonly speed: number; readonly how: MissionHow } | null;
  /** the docking computer already has the ship */
  readonly dcEngaged: boolean;
  /**
   * How near the station the station course hands the ship over. A fitted
   * docking computer takes the job from further out than a pilot does.
   */
  readonly handOverRange: number;
}

/** A canister the collect course can fly at, and where it is going. */
export interface Adrift {
  at: THREE.Vector3;
  /** its drift, in world units a second — the collect course leads on it */
  velocity: THREE.Vector3;
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
  /**
   * The canister the collect course is flying at, held until it is taken or it
   * leaves the scanner.
   *
   * IT USED TO TAKE THE NEAREST, EVERY FRAME. Chris, 2026-09-12: *"Collecting
   * cargo often seems to be difficult - we miss it quite a lot - especially
   * when it is moving."* The ship closed on one canister, a second became
   * nearer as it moved, and the course turned away from the first. Measured
   * over five canisters, that was 7 missed passes with the cargo at rest and 16
   * with it adrift. One canister alone was never missed at all, at any drift,
   * which is what named the fault.
   *
   * The identity is the canister's own position vector, which `flight-course.ts`
   * passes by reference. A canister that is scooped or drifts out of range
   * leaves the list, and the next pick is the nearest again.
   */
  private held: THREE.Vector3 | null = null;
  private readonly dir = new THREE.Vector3();
  private readonly fwd = new THREE.Vector3();
  private readonly aim = new THREE.Vector3();
  private readonly away = new THREE.Vector3();
  private readonly wideOf = new THREE.Vector3();
  /** the aim once it is clear of the planet AND of anything solid */
  private readonly clearAim = new THREE.Vector3();
  /** where a drifting canister will be when the ship gets there */
  private readonly lead = new THREE.Vector3();

  /** Forget the bank, for a new course. */
  reset(): void {
    this.mem = freshSteerMemory();
    this.held = null;
  }

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
      case 'run': return v.threats.length === 0 ? ended() : this.run(v, dt);
      case 'collect': {
        const next = this.holdLoot(v.loot);
        if (next === null) return ended();
        // FLY ONTO WHERE IT WILL BE. A canister drifts at up to 45 units a
        // second, and the scoop reaches 45. An aim at where it IS therefore
        // arrives a whole scoop behind it (Chris, 2026-09-12). The lead is the
        // time to cover the gap at the speed the course flies. That is the same
        // shape the co-pilot leads a ship with.
        const gap = v.position.distanceTo(next.at);
        this.lead.copy(next.at).addScaledVector(
          next.velocity, Math.min(COURSE_COLLECT_LEAD, gap / COURSE_COLLECT_SPEED));
        // The scoop takes it aboard inside `SCOOP_RANGE`, and the next one is
        // then the nearest (docs/TODO/206 M6).
        return {
          ...this.arrive(v, { target: this.lead, standoff: 0, speed: COURSE_COLLECT_SPEED }, dt),
          done: false,
        };
      }
      // A rock is fought, not flown to: `flight-instruments.ts` picks the next
      // one as the target, and the computer's aim lines the ship up on it.
      case 'mine': return IDLE;
      case 'mission': {
        const m = v.mission;
        if (m === null) return ended();
        // A hunt is a fight: `flight-instruments.ts` picks the ship, and the
        // computer's aim flies it, as it does for a rock.
        if (m.how === 'fight') return IDLE;
        // A slip is the station course on a line wide of the police
        // (docs/TODO/208 M4). It hands the ship over as that course does.
        if (m.how === 'slip') return this.toStation(v, dt, m.at);
        const standoff = m.how === 'hold' ? COURSE_WATCH_STANDOFF
          : m.how === 'escort' ? COURSE_ESCORT_STANDOFF : 0;
        const speed = m.how === 'scoop' ? COURSE_COLLECT_SPEED : m.speed;
        return { ...this.arrive(v, { target: m.at, standoff, speed }, dt), done: false };
      }
      default: return IDLE;
    }
  }

  /**
   * Run for it (docs/TODO/206 M5). It turns away from the hostile ships and
   * opens the throttle. It runs the torus once the mass lock lets go. It aims at a
   * point straight away from where the hostile ships sit on average. It ends
   * when no hostile ship is left on the scanner.
   */
  private run(v: CourseView, dt: number): CourseStep {
    this.away.set(0, 0, 0);
    for (const t of v.threats) this.away.add(this.dir.subVectors(v.position, t).normalize());
    if (this.away.lengthSq() < 1e-9) this.away.set(0, 0, -1).applyQuaternion(v.quaternion);
    const target = this.dir.copy(v.position).addScaledVector(this.away.normalize(), COURSE_RUN_REACH);
    const aim = clearOfPlanet(v.position, target, v.planetPos, v.planetRadius, this.aim);
    return { ...this.pointAt(v, aim, 1, dt), handOver: false, done: false };
  }

  /**
   * Point at the station, and run the torus while the nose is on it. Inside
   * the docking computer's range, hand over. The docking computer then flies
   * the approach and the slot, and this course asks for nothing more.
   */
  private toStation(v: CourseView, dt: number, wide?: THREE.Vector3): CourseStep {
    if (v.dcEngaged) return IDLE;
    // It ARRIVES at the hand-over, at the speed the slot will take
    // (docs/TODO/207 M1). A ship handed over at full speed has less than four
    // seconds to lose 280 units a second. That is no way to meet a pilot.
    // The hand-over is a RANGE rather than an arrival. An arrival also asks
    // for the speed to settle. A ship a few units a second over it would sail
    // past the station while it waited.
    if (v.position.distanceTo(v.stationPos) <= v.handOverRange) {
      return { demand: null, torus: false, handOver: true, done: false };
    }
    // A smuggling run keeps wide of the police on the way in (M4 of 208).
    const aim = wide === undefined ? v.stationPos
      : clearOfPolice(v.position, v.stationPos, v.police, this.wideOf);
    return this.arrive(v, {
      target: aim, standoff: aim === v.stationPos ? v.handOverRange : 0, speed: SLOT_SPEED_LIMIT,
    }, dt);
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
    // ROUND THE PLANET FIRST, then round anything solid on what is left. The
    // planet is the bigger detour, so a line bent round it is the line a rock
    // can then be in the way of.
    const wide = clearOfPlanet(v.position, a.target, v.planetPos, v.planetRadius, this.aim);
    const aim = clearOfObstacles(v.position, wide, v.obstacles, this.clearAim);
    const p = this.pointAt(v, aim, throttle, dt);
    return { ...p, torus: p.torus && left > COURSE_TORUS_DROP, handOver: false, done: false };
  }

  /**
   * Which canister to fly at: the one already held, while it is still there.
   *
   * A pilot who is nearly on a canister does not turn away because another
   * drifted closer. It is the same rule the combat co-pilot keeps for a target
   * it is lined up on, and the same fault it was fixed for.
   */
  private holdLoot(loot: readonly Adrift[]): Adrift | null {
    const still = loot.find((c) => c.at === this.held);
    if (still !== undefined) return still;
    this.held = loot[0]?.at ?? null;
    return loot[0] ?? null;
  }

  /** Bank and pull the nose onto a point, with this throttle. */
  private pointAt(
    v: CourseView, point: THREE.Vector3, throttle: number, dt: number,
  ): { demand: FlightDemand; torus: boolean } {
    this.dir.subVectors(point, v.position);
    // TWO NUMBERS KEEP THE SHIP FROM ROLLING ALL THE WAY THERE. The deadzone
    // holds the sticks still inside 1.1 degrees of the nose. The roll gate
    // holds the pitch still until the bank arrives, which is what stops the
    // nose from circling the target. See both constants.
    const stick = bankToTurn(
      v.quaternion, this.dir, this.mem, COURSE_AIM_DEADZONE, COURSE_ROLL_GATE);
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
