// The COURSE at the controls: the one the pilot picked, and how it ends.
//
// Split from `flight-instruments.ts` on 2026-09-12, when that file passed the
// 400-line ceiling `tools/sizes.mjs` calls a detector. That file held six
// switches. The course was the one with a machine of its own. It holds a frame
// of flight, three ways to end, and the two hand-overs it throws on the way.
//
// ONE RESPONSIBILITY: who the course is, while it is flying, and what ends it.
// Three things end a course, and each is a different actor:
//
//   - the WORK is done, or the pilot takes the stick (`course`, `endCourse`);
//   - the PILOT taps the lit button (`stopCourse`);
//   - a HOSTILE SHIP turns up, and the computer takes the stick (`dropForFight`).
//
// `course-pilot.ts` decides where the ship goes. `courses.ts` decides which
// courses the situation allows. This holds the course while it flies, and it
// says what happened.
//
// It throws two switches that are NOT its own: the torus drive, and the
// hand-over to the docking computer. The drive belongs to
// `flight-instruments.ts`, so it reaches it through `CourseHost` rather than
// holding a second copy of the rule.

import { CoursePilot } from './course-pilot.ts';
import type { CourseKind } from './courses.ts';
import { MAX_FUEL } from '../constants/commander.ts';
import { hostilesNear, hostilesOnScanner } from './hostility.ts';
import { pickTarget, pickedTarget } from './targets.ts';
import { derelictReport } from './derelict.ts';
import type { StarSystem } from '../galaxy/galaxy.ts';
import { missionCourse } from './mission-course.ts';
import { SCANNER_RANGE } from '../constants/console.ts';
import { DOCK_COMPUTER_RANGE } from '../constants/docking-computer.ts';
import { COURSE_DOCK_HANDOVER } from '../constants/course.ts';
import type { FlightDemand } from '../player.ts';
import type { GameState } from './state.ts';

/**
 * What the console says when a course finishes its work. The hermit course
 * says nothing, because the hermit's own trade screen opens on arrival.
 */
const COURSE_ENDS: Partial<Record<CourseKind, string>> = {
  skim: 'FUEL TANK FULL',
  run: 'YOU GOT AWAY',
  mine: 'NO ROCKS LEFT WITHIN RANGE',
  collect: 'EVERYTHING IS ABOARD',
};

/** The console, and the drive switch that belongs to the instruments. */
export interface CourseSwitchHost {
  showMessage(text: string, seconds: number): void;
  /** a message event, said or queued as it asks */
  sayEvent(e: { text: string; seconds: number; queued?: boolean }): void;
  /** the drive's own rule — `flight-instruments.ts` holds it */
  massLocked(): boolean;
  /** ...and its switch, which a course throws on a long leg */
  toggleTorus(): void;
}

export class FlightCourse {
  private readonly state: GameState;
  private readonly coursePilot = new CoursePilot();
  private readonly host: CourseSwitchHost;

  constructor(state: GameState, host: CourseSwitchHost) {
    this.state = state;
    this.host = host;
  }

  /**
   * The course the pilot picked, flown for one frame, or null for none
   * (docs/TODO/205 M3).
   *
   * `course-pilot.ts` decides. This throws the two switches that a step asks
   * for: the torus drive, and the hand-over to the docking computer. A flight
   * key suspends the course, as it drops the two computers. The course list
   * then offers the course again (Chris, 2026-09-11: *"keep the keys"*).
   */
  course(dt: number, handsOn: boolean): FlightDemand | null {
    const s = this.state.session;
    if (s.course === null) return null;
    if (handsOn) {
      s.course = null;
      s.handFlown = true;
      this.coursePilot.reset();
      this.host.showMessage('MANUAL CONTROL — AUTOPILOT OFF', 2);
      return null;
    }
    const p = this.state.player;
    const w = this.state.world;
    // The mining course fights the rocks: it picks the next one, and the
    // computer's aim lines the ship up on it (docs/TODO/206 M6).
    if (s.course === 'mine' && !this.aimAtNextRock()) {
      this.endCourse('mine');
      return null;
    }
    // A mission's own work here, and what the ship does about it
    // (docs/TODO/208 M1). A hunt is a fight, so the ship it names is picked
    // as the target, exactly as a rock is.
    const mission = s.course !== 'mission' ? null
      : missionCourse(this.state.commander.missions, this.state.commander.systemIndex,
        w.npcs, w.cargo.items, w.station.position);
    if (mission?.how === 'fight' && mission.ship !== null
      && pickedTarget(w.npcs) !== mission.ship) {
      pickTarget(w.npcs, mission.ship);
      s.handFlown = false;
    }
    const live = (role: string) => w.npcs.find((n) => n.state.alive && n.role === role) ?? null;
    const derelict = live('generation');
    const step = this.coursePilot.step({
      course: s.course,
      position: p.position,
      quaternion: p.quaternion,
      pitchRate: p.pitchRate,
      rollRate: p.rollRate,
      speed: p.speed,
      stationPos: w.station.position,
      planetPos: w.planetPos,
      planetRadius: w.planetRadius,
      sunPos: w.sunPos,
      derelictPos: derelict?.object.position ?? null,
      derelictSpeed: derelict?.state.speed ?? 0,
      hermitPos: live('hermit')?.object.position ?? null,
      tankFull: this.state.commander.fuel >= MAX_FUEL,
      police: w.npcs
        .filter((n) => n.state.alive && n.role === 'police'
          && n.object.position.distanceTo(p.position) <= SCANNER_RANGE * 2)
        .map((n) => n.object.position),
      loot: w.cargo.items
        .map((c) => c.object.position)
        .filter((at) => at.distanceTo(p.position) <= SCANNER_RANGE)
        .sort((a, b) => a.distanceTo(p.position) - b.distanceTo(p.position)),
      threats: hostilesOnScanner(w.npcs, p.position, this.state.commander.legalStatus,
        p.position.distanceTo(w.station.position)).map((n) => n.object.position),
      dcEngaged: s.dcEngaged,
      mission: mission === null ? null
        : { at: mission.at, speed: mission.speed, how: mission.how },
      handOverRange: this.state.commander.equipment.dockingComputer
        ? DOCK_COMPUTER_RANGE : COURSE_DOCK_HANDOVER,
    }, dt);
    if (step.handOver) this.handOver();
    if (step.torus !== s.torusEngaged && (!step.torus || !this.host.massLocked())) {
      this.host.toggleTorus();
    }
    if (step.done) this.endCourse(s.course);
    return step.demand;
  }

  /**
   * The pilot tapped the lit course button, so the course stops
   * (docs/TODO/205 M5). The list shows again by itself.
   *
   * It does NOT set `handFlown`, and a flight key does. A key means the pilot
   * wants the stick. This means only that the ship goes nowhere in particular.
   */
  stopCourse(): void {
    const s = this.state.session;
    if (s.course === null) return;
    s.course = null;
    this.coursePilot.reset();
    this.host.showMessage('COURSE OFF — CHOOSE WHERE TO GO', 3);
  }

  /**
   * A hostile ship turned up, and the combat computer took the stick. The
   * course goes with it (Chris, 2026-09-12: *"it should also be disengaged by
   * combat or other events"*, and *"anything that breaks the journey should let
   * you reconsider what you are doing"*).
   *
   * `flight.ts` asks the co-pilot before the course. So the course already flew
   * nothing while it waited. It then took the ship back the moment the fight
   * ended, and the button said the ship was heading somewhere all along.
   *
   * Three things the shape of it turns on:
   *
   *   - A HOSTILE SHIP is the test, not whether the computer took the stick. A
   *     picked rock takes it too, and to drop on that would end every mine run
   *     at the first rock.
   *   - EVERY FRAME, not the frame the fight starts. A pilot can pick a course
   *     mid-fight, and an edge test would miss it.
   *   - With no co-pilot, `ccEngaged` stays false and the course flies on. The
   *     LIVE BRAINS row set to NONE leaves the course the only pilot there is.
   *
   * @internal — driven by `flight-instruments.ts`, once per fixed step.
   */
  dropForFight(): void {
    const s = this.state;
    if (!s.session.ccEngaged || s.session.course === null) return;
    if (!hostilesNear(s.world.npcs, s.player.position, s.commander.legalStatus,
      s.player.position.distanceTo(s.world.station.position))) return;
    s.session.course = null;
    this.coursePilot.reset();
    // QUEUED, not said. The torus drive drops in the same frame, on the same
    // ship being close, and a said line would take the console off that cause.
    this.host.sayEvent({ text: 'HOSTILE SHIP — COURSE OFF', seconds: 3, queued: true });
  }

  /**
   * The pilot's stretch ends when the ship leaves the docking computer's
   * range, which is the width of the whole approach. The course list then
   * offers the station again.
   *
   * @internal — driven by src/game/flight.ts, once per fixed step.
   */
  watchDockTrial(): void {
    const s = this.state.session;
    if (!s.dockTrial) return;
    const out = this.state.player.position
      .distanceTo(this.state.world.station.position) > DOCK_COMPUTER_RANGE;
    if (!out) return;
    s.dockTrial = false;
    s.dockRails = false;
    this.host.showMessage('THE STATION IS BEHIND YOU', 3);
  }

  /**
   * The station course reaches the hand-over, and the ship changes hands
   * (docs/TODO/207 M1, in the shape docs/TODO/212 gave it).
   *
   * ONE LINE-UP, WHOEVER FLIES THE SLOT (Chris, 2026-09-12: *"I think we should
   * merge both paths?"*). The computer flies the ship to the right distance and
   * turns it to face the port, and it does that for every commander. Only then
   * does it ask who takes the ship in. A fitted docking computer takes it. A
   * commander with none gets the rails and the mini game. `world-step.ts`'s
   * `dockTrialStep` is where that one question is asked.
   *
   * It used to branch HERE instead, so a fitted computer flew the whole
   * approach on its own and never showed a line-up at all.
   */
  private handOver(): void {
    const s = this.state.session;
    s.dockTrial = true;
    s.dockRails = false;
    s.course = null;
    this.coursePilot.reset();
    this.host.showMessage('THE COMPUTER IS LINING THE SHIP UP — STAND BY', 4);
  }

  /**
   * The mining course keeps a rock picked as the target, so the computer aims
   * at it and the pilot fires.
   *
   * @returns false when no rock is left within scanner range.
   */
  private aimAtNextRock(): boolean {
    const { player, world } = this.state;
    if (pickedTarget(world.npcs)?.role === 'asteroid') return true;
    const rocks = world.npcs
      .filter((n) => n.state.alive && n.role === 'asteroid'
        && n.object.position.distanceTo(player.position) <= SCANNER_RANGE)
      .sort((a, b) => a.object.position.distanceTo(player.position)
        - b.object.position.distanceTo(player.position));
    if (rocks.length === 0) return false;
    pickTarget(world.npcs, rocks[0]);
    this.state.session.handFlown = false;
    return true;
  }

  /**
   * A course finished its work. It leaves the ship, and it leaves the list
   * for the rest of the visit. The console says what the ship did.
   */
  private endCourse(kind: CourseKind): void {
    const s = this.state.session;
    s.course = null;
    if (!s.coursesDone.includes(kind)) s.coursesDone.push(kind);
    this.coursePilot.reset();
    // The derelict's own words, read off the world's seed (docs/TODO/208 M5).
    const said = kind === 'derelict'
      ? derelictReport(this.state.systems[this.state.commander.systemIndex] as StarSystem)
      : COURSE_ENDS[kind];
    if (said) this.host.showMessage(said, 6);
  }
}
