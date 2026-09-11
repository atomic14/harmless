// The instruments a pilot switches on, and what they do to the ship.
//
// A child of `flight.ts`, split from it by docs/TODO/155 M2, alongside
// `flight-weapons.ts`. The flight half reached 648 lines over three subjects.
// `tools/sizes.mjs` calls its 400-line ceiling a detector rather than
// a rule, and this is what it detected.
//
// ONE RESPONSIBILITY: the instruments a pilot switches on. Five of them:
//
//   - the two computers that fly the ship for her;
//   - the drive that crosses the system;
//   - the mouse she flies with;
//   - the view she flies by.
//
// Every one is a switch that changes who or what is at the controls. Not one of
// them decides anything about the world.
//
// `autopilot.ts` owns what a computer does with the stick. `world-step.ts` owns
// what a mass lock IS. This file holds the switch, and says what happened.

import { sfx } from '../audio.ts';
import { Autopilot, type AutopilotEvent } from './autopilot.ts';
import { massLocked } from './world-step.ts';
import { boundKey } from '../ui/key-help.ts';
import { defenceBrain } from './brains.ts';
import { defenceBrainNameFor } from './brain-names.ts';
import type { FlightDemand } from '../player.ts';
import type { CombatComputer } from './combat-computer.ts';
import type { Ordnance } from './ordnance.ts';
import type { Input } from '../engine/input.ts';
import type { SoundEvent } from './sounds.ts';
import type { GameState } from './state.ts';

/**
 * What the instruments have to reach back for.
 *
 * Two, and both are the console. An instrument says what it did, and nothing
 * else. The sounds are events rather than calls, and that is what keeps
 * `autopilot.ts` clear of `audio.ts`, and so safe under node.
 */
export interface InstrumentHost {
  showMessage(text: string, seconds: number): void;
  /** a message event, said or queued as it asks */
  sayEvent(e: { text: string; seconds: number; queued?: boolean }): void;
  /** the one place a SoundEvent becomes a noise (sounds.ts) */
  playSound(e: SoundEvent): void;
}

/** What a co-pilot asks for this frame, and whether it answered a warhead. */
export interface CoPilotDemand {
  demand: FlightDemand | null;
  ecm: boolean;
}

export class Instruments {
  private readonly state: GameState;
  /** the keyboard and the mouse, because two of these switches are input */
  private readonly input: Input;
  /** the racks, because a co-pilot steers away from a warhead it can see */
  private readonly ordnance: Ordnance;

  /**
   * The two computers that fly the ship for you — see autopilot.ts.
   *
   * It sits beside `combatComputer` rather than holds it. The SNAPSHOT needs
   * the policy's mid-thought state (persistence.ts), and the autopilot is what
   * engages it. So the computer is lent from two files up, and this holds the
   * seat.
   */
  private readonly autopilot: Autopilot;
  private readonly host: InstrumentHost;

  constructor(
    state: GameState, input: Input, ordnance: Ordnance,
    combatComputer: CombatComputer, host: InstrumentHost,
  ) {
    this.state = state;
    this.input = input;
    this.ordnance = ordnance;
    this.host = host;
    this.autopilot = new Autopilot(state, combatComputer);
  }

  /**
   * WHICH co-pilot, and what it asks for.
   *
   * Under the shipped 'attack-run' name it is the scripted PURE-PURSUIT
   * co-pilot. Otherwise it is the trained defence seat, which is dormant:
   * defenceBrain() is null, and the seat disengages.
   *
   * Both return a FlightDemand. The scripted one banks to turn, through the
   * commander's own envelope (scripted-co-pilot.ts). The trained one flies at
   * its fitted CC_* caps. So the Game flies either the same way, and the HUD
   * reads both.
   */
  coPilot(dt: number, handsOn: boolean): CoPilotDemand {
    const auto = defenceBrainNameFor(this.state.brains) === 'attack-run'
      ? this.autopilot.combatSteer(dt, handsOn, this.ordnance.hostileMissilePos)
      : this.autopilot.combatDemand(
        dt, handsOn, defenceBrain(this.state.brains), this.ordnance.hostileMissilePos);
    this.applyAutopilot(auto.events);
    return { demand: auto.demand ?? null, ecm: auto.ecm };
  }

  /** A hit worth a break: the co-pilot keeps its own record
   *  (scripted-co-pilot.ts). */
  noteUnderFire(): void { this.autopilot.noteUnderFire(); }

  /**
   * Whether the drive is held down. `massLocked` (world-step.ts) says what
   * counts as close enough, and this is only the switch's question
   * (docs/TODO/153).
   *
   * @internal — driven by src/game/flight.ts, and by the Game above it.
   */
  massLocked(): boolean { return massLocked(this.state); }

  dockingComputer(): void {
    this.applyAutopilot(this.autopilot.toggleDocking());
  }

  /**
   * @internal — the parent's command table calls it. docs/TODO/151 M1 recorded
   * that nothing outside `game.ts` reached this, and that was the argument to
   * make it private. The split answers it instead: the member and the table now
   * live in different files.
   */
  toggleCombatComputer(): void {
    this.applyAutopilot(this.autopilot.toggleCombat());
  }

  toggleMouseFlight(): void {
    if (this.input.mouseFlight) {
      this.input.releaseMouseFlight();
      this.host.showMessage('MOUSE FLIGHT OFF', 2);
    } else {
      this.input.requestMouseFlight();
      // ESC is the browser's own way out of a pointer lock, and no table owns
      // it. The other one is this command's own key, read from the table.
      this.host.showMessage(
        `MOUSE FLIGHT — ESC OR ${boundKey('flight', 'toggleMouseFlight')} TO RELEASE`, 4);
    }
  }

  toggleTorus(): void {
    if (this.massLocked()) {
      this.host.showMessage('MASS LOCKED', 2);
      sfx.refused();
      return;
    }
    this.state.session.torusEngaged = !this.state.session.torusEngaged;
    // The drive opens the throttle as it engages. Nobody engages a jump drive
    // in order to crawl. A hand held on the accelerator afterwards was busywork
    // with one sensible answer.
    if (this.state.session.torusEngaged) this.state.player.speed = this.state.player.maxSpeed;
    this.host.showMessage(
      this.state.session.torusEngaged ? 'TORUS DRIVE ENGAGED' : 'TORUS DRIVE OFF', 2);
    if (this.state.session.torusEngaged) sfx.torusEngaged();
  }

  setView(v: number): void {
    if (this.state.session.view === v) return;
    this.state.session.view = v;
    sfx.viewChanged();
  }

  /**
   * The autopilots decide; this file says it and plays it. Same shape as
   * applyStep and applyStation — and the sounds are events here because that
   * is what keeps autopilot.ts clear of audio.ts, and therefore node-safe.
   */
  private applyAutopilot(events: readonly AutopilotEvent[]): void {
    for (const e of events) {
      if (e.kind === 'message') this.host.sayEvent(e);
      else this.host.playSound(e);
    }
  }
}
