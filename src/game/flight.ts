// What a commander does while she is flying.
//
// The other half of the orchestrator, split from `docked.ts` by docs/TODO/155
// M2 on Chris's rule of 2026-08-14: *"It makes sense to split docked from
// flight - they are very different things."* `game.ts` keeps the mode machine,
// the frame skeleton and the routing; this holds everything that only happens
// with the ship in the sky.
//
// ONE RESPONSIBILITY: what a commander does while she is flying. One slice of
// time advanced, who is at the controls for it, what the guns and the racks
// spend, what the hull takes, and the exercise that is ordinary flight with a
// different step behind it.
//
// THIS HALF IS WHERE THE MACHINE LIVES, and the constructor says so honestly:
// the world step, the guns, the autopilots, the instrumentation and the
// simulator are ITS fields, because nothing outside flight uses them. Six
// things it SPENDS come in as collaborators, because the station spends them
// too — the racks, the keyboard, the cockpit, the law, the record and the
// combat computer.
//
// SEVENTEEN HOST METHODS IS THE WIDEST INTERFACE IN THE TREE, and that is the
// shape of a half rather than a fault. Every one of them is the parent's own
// job: the mode machine, the console, or a way OUT of flight. A step that ends
// in a dock, an arrival or a death reports it and lets the orchestrator decide
// what the game becomes — this half never reaches into the docked half, and
// that is the whole point of splitting them.
//
// IT IS PLATFORM. The shell's bomb flash and the report screen are the reason,
// and it costs the port nothing: every line was already inside `game.ts`.

import * as THREE from 'three';
import { Weapons, type WeaponsHost } from './flight-weapons.ts';
import type { Ordnance } from './ordnance.ts';
import { Instruments, type InstrumentHost } from './flight-instruments.ts';
import { WorldStep, type StepEvent, type StepHost } from './world-step.ts';
import { CombatSim, type ExerciseFit, type SimHost } from './combat-sim.ts';
import type { CombatSimReport } from './combat-sim-report.ts';
import type { ExerciseSpec } from './combat-sim-scenarios.ts';
import { flightDemand } from '../engine/flight-controls.ts';
import { keymap, manualFlightKeys } from '../engine/keymap.ts';
import { boundKey } from '../ui/key-help.ts';
import { TORUS_MULTIPLIER } from '../constants/torus.ts';
import { recordFurthestWave } from './commander.ts';
import type { FlightDemand } from '../player.ts';
import type { CombatComputer } from './combat-computer.ts';
import type { CockpitView } from './cockpit-view.ts';
import type { LawActions } from './law-actions.ts';
import type { Persistence } from './persistence.ts';
import type { Input } from '../engine/input.ts';
import type { SoundEvent } from './sounds.ts';
import type { GameState } from './state.ts';

/**
 * What flying has to reach back to the Game for.
 *
 * The widest host in the tree, and every entry is one of three things: the mode
 * machine, the console, or a WAY OUT OF FLIGHT.
 *
 * THE WAYS OUT ARE THE INTERESTING HALF. A step can end in a dock, a completed
 * jump, a tow or a death, and not one of them is flight's to carry out — the
 * dock belongs to the other half, and the parent is what stands between the two
 * so that neither reaches into the other. This half reports; the orchestrator
 * decides what the game becomes.
 */
export interface FlightHost {
  /** the mode INCLUDING an open screen — a HUD needs the cockpit clear */
  mode(): string;
  /** the base state, ignoring any screen over it */
  baseMode(): string;
  /** an exercise takes the ship: clear the stack and make flight the base */
  enterFlightMode(): void;
  showMessage(text: string, seconds: number): void;
  /** a message event, said or queued as it asks — see game.ts's `sayEvent` */
  sayEvent(e: { text: string; seconds: number; queued?: boolean }): void;
  /** the one place a SoundEvent becomes a noise (sounds.ts) */
  playSound(e: SoundEvent): void;
  /** a shot at a trader is the law's business, not the gun's */
  raiseLegal(level: number): void;
  // --- the four ways out of flight ---------------------------------------
  die(reason: string): void;
  dock(): void;
  completeHyperspace(): void;
  completeRescue(): void;
  /** a station's act, reached in flight — docs/TODO/155 M3 owns where it lives */
  openHermitTrade(): void;
  // --- the machine the parent holds ---------------------------------------
  autoSave(): void;
  flashDamage(): void;
  flashBomb(): void;
  /** the streaks are SEEN and never simulated, so the parent draws them */
  updateDust(velocity: THREE.Vector3): void;
  /** an exercise has finished and left records worth reading */
  showReport(reports: readonly CombatSimReport[]): void;
}

export class Flight {
  private readonly state: GameState;
  /** the keyboard and the mouse, read once a frame */
  private readonly input: Input;
  /** what the cockpit shows — the beams' meeting point, and the key prompts */
  private readonly cockpit: CockpitView;
  /** the record, because an exercise's best wave is written straight down */
  private readonly saves: Persistence;

  // --- this half's own machine, because nothing outside flight uses it -----

  /**
   * The world advancing by one slice — see world-step.ts.
   *
   * It owns the five phases of flight and knows nothing about a HUD, a
   * keyboard or a renderer: it takes a demand, moves everything, and reports
   * what it did. `stepHost()` below is the whole of what it may ask of us.
   */
  private readonly worldStep: WorldStep;
  /**
   * The combat training simulator — see combat-sim.ts.
   *
   * Owned the way `station`, `ordnance` and `persistence` are, and deliberately
   * NOT a field on `GameState`: a state field is obliged to appear in the save
   * (a test enforces it), and an exercise must not survive a reload — close the
   * tab mid-exercise and you wake up at the station with the career intact.
   *
   * An exercise is not a screen. It is ordinary flight with a different
   * `StepHost` behind it, and `update` below picks which step to run.
   */
  private readonly simulator: CombatSim;
  /** scratch, so the dust does not allocate a velocity a frame */
  private readonly scratch = new THREE.Vector3();

  /**
   * What the ship spends and what it takes — see flight-weapons.ts.
   *
   * A child rather than a section, because this file reached 648 lines and
   * `tools/sizes.mjs` is right about what that means: the racks, the guns and
   * the damage are one subject and the slice of time is another.
   */
  private readonly weapons: Weapons;

  /**
   * The instruments a pilot switches on — see flight-instruments.ts.
   *
   * The second child, and the same reason as the first: the two computers, the
   * torus drive, the mouse and the view are one subject, and a slice of time is
   * another.
   */
  private readonly instruments: Instruments;

  private readonly host: FlightHost;

  constructor(
    state: GameState, ordnance: Ordnance, input: Input, cockpit: CockpitView,
    law: LawActions, saves: Persistence, combatComputer: CombatComputer,
    host: FlightHost,
  ) {
    this.state = state;
    this.input = input;
    this.cockpit = cockpit;
    this.saves = saves;
    this.host = host;
    this.weapons = new Weapons(state, ordnance, cockpit, law, () => this.simulator, {
      showMessage: (text, seconds) => host.showMessage(text, seconds),
      sayEvent: (e) => host.sayEvent(e),
      playSound: (e) => host.playSound(e),
      raiseLegal: (level) => host.raiseLegal(level),
      die: (reason) => host.die(reason),
      flashDamage: () => host.flashDamage(),
      flashBomb: () => host.flashBomb(),
      noteUnderFire: () => this.instruments.noteUnderFire(),
    } satisfies WeaponsHost);
    this.instruments = new Instruments(state, input, ordnance, combatComputer, {
      showMessage: (text, seconds) => host.showMessage(text, seconds),
      sayEvent: (e) => host.sayEvent(e),
      playSound: (e) => host.playSound(e),
    } satisfies InstrumentHost);
    this.worldStep = new WorldStep(state, ordnance, this.stepHost());
    this.simulator = new CombatSim(state, ordnance, this.weapons.gun, saves, this.simHost());
  }

  /**
   * What the ship spends and what it takes.
   *
   * Exposed rather than delegated through, because the parent's command table
   * is deliberately the whole driving surface and a pass-through per key would
   * be nine lines saying nothing. The table addresses the file that owns the
   * act: `flight_.weapons.armMissile()`.
   */
  get racks(): Weapons { return this.weapons; }

  /** The switches, for the same reason the racks are exposed. */
  get switches(): Instruments { return this.instruments; }

  /** Is a training exercise running? Asked by four things outside flight. */
  inSimulator(): boolean { return this.simulator.active; }

  /** The exercise's own strip, for the cockpit to paint. */
  get strip(): CombatSim['strip'] { return this.simulator.strip; }

  /**
   * What the world step may ask of the Game — the consequences that reach
   * outside the sky, and nothing else it can get at.
   *
   * An object literal rather than `implements StepHost` on purpose: the
   * methods behind it stay private, so this list IS the surface, and adding to
   * it is a decision rather than an accident.
   *
   * FIVE OF THE THIRTEEN LEAVE FLIGHT, and they are all relayed rather than
   * done: a dock, a completed jump, a tow, a death and the hermit's market are
   * the parent's to carry out.
   */
  private stepHost(): StepHost {
    return {
      inFlight: () => this.host.mode() === 'flight',
      applyPlayerDamage: (amount, from, source) =>
        this.weapons.applyPlayerDamage(amount, from, source),
      destroyNpc: (npc) => this.weapons.destroyNpc(npc),
      wreckNpc: (npc) => this.weapons.wreckNpc(npc),
      fireLaser: () => this.weapons.fireLaser(),
      raiseLegal: (level) => this.host.raiseLegal(level),
      die: (reason) => this.host.die(reason),
      dock: () => this.host.dock(),
      completeHyperspace: () => this.host.completeHyperspace(),
      completeRescue: () => this.host.completeRescue(),
      openHermitTrade: () => this.host.openHermitTrade(),
      autoSave: () => this.host.autoSave(),
    };
  }

  /**
   * What an exercise may ask of the Game. The rebuild and the mode machine are
   * not here: `Persistence` already owns both, and the exercise holds it.
   */
  private simHost(): SimHost {
    return {
      enterFlight: () => this.host.enterFlightMode(),
      message: (text, seconds) => this.host.showMessage(text, seconds),
      sound: (event) => this.host.playSound(event),
      flashDamage: () => this.host.flashDamage(),
      aimBeams: (at) => this.cockpit.aimBeams(at),
      // The one number a run leaves behind. The RULE is commander.ts's — only
      // ever grows, and it says whether it moved — so this applies it and saves
      // it, which is all an orchestrator does. Written straight to storage
      // rather than left for the next autosave, because a pilot who reads their
      // best wave off the panel and closes the tab has earned it.
      recordFurthestWave: (wave) => {
        if (recordFurthestWave(this.state.commander, wave)) this.saves.checkpoint();
      },
      // The exercise has torn down and the career is back: hold the records and
      // put the report on screen. Ordering is not incidental — teardown restores
      // the mode first (`enterMode` clears the stack), so pushing the screen
      // afterwards leaves it sitting on the station menu it was launched from.
      finished: (reports) => this.host.showReport(reports),
    };
  }

  // --- one slice of time ---------------------------------------------------

  /**
   * One frame of flight: produce a demand, advance the world, apply what it
   * reports.
   *
   * The five phases live in world-step.ts. What is left here is the two things
   * the world cannot do for itself: read the hands at the controls, and say
   * things out loud.
   *
   * @internal — driven by src/game/game.ts, whose frame runs it.
   */
  update(dt: number, elapsed: number): void {
    const demand = this.pilotDemand(dt);
    const pilot = { demand, handsOn: this.handsOn() };

    // WHICH step. An exercise is ordinary flight with a different StepHost
    // behind it (combat-sim.ts), and its teardown is DEFERRED — `settle()` puts
    // the career back HERE, after the step has returned, because restoring from
    // inside `stepNpcs` would rebuild the scene while the step was still
    // iterating over it.
    if (this.simulator.active) {
      this.applyStep(this.simulator.tick(dt, elapsed, pilot));
      this.simulator.settle();
    } else {
      this.applyStep(this.worldStep.step(dt, elapsed, pilot));
    }

    // The dust is seen, never simulated — updated out here, from wherever the
    // step left the ship. It needs our actual velocity to streak: the torus
    // drive multiplies travel by `TORUS_MULTIPLIER`. Read from the drive rather
    // than written out again, so the streaks cannot disagree with the physics.
    this.host.updateDust(
      this.state.player.getForward(this.scratch).multiplyScalar(this.state.player.speed
        * (this.state.session.torusEngaged && !this.instruments.massLocked() ? TORUS_MULTIPLIER : 1)),
    );
  }

  /**
   * The step decides; this half says it and plays it. Same shape as applyCombat,
   * and for the same reason: a phase that called the HUD — or the AudioContext
   * — could not run in a trainer.
   *
   * `npcFired` and `playerDealt` are deliberately dropped here: both are for a
   * measuring caller (combat-sim.ts), which has already read them out of the
   * same array. The cockpit hears the shot and sees the explosion either way,
   * and a career keeps no record to credit.
   */
  private applyStep(events: readonly StepEvent[]): void {
    for (const e of events) {
      if (e.kind === 'message') this.host.sayEvent(e);
      else if (e.kind !== 'npcFired' && e.kind !== 'playerDealt') this.host.playSound(e);
    }
  }

  /**
   * Who is flying, and what they want.
   *
   * ONE producer per frame: the hands at the keyboard, or the combat computer
   * when it is engaged and still willing. The trigger is the union of the two
   * — a fitted combat computer flies the ship, it does not take your gun off
   * you.
   */
  private pilotDemand(dt: number): FlightDemand {
    const hands = flightDemand(this.input, keymap(), this.state.player, dt);
    // the virtual stick self-centres; the producer is pure, so the mutation
    // is ours to do, immediately after reading it
    if (this.input.mouseFlight) this.input.decayMouse(dt);
    if (!this.state.session.ccEngaged) return hands;
    // WHICH co-pilot is the brain selection's answer: under the shipped
    // 'attack-run' name, the scripted PURE-PURSUIT co-pilot; otherwise the
    // trained defence seat (dormant — defenceBrain() is null and the seat
    // disengages). Both return a FlightDemand — the scripted one banks-to-turn
    // through the commander's own envelope (scripted-co-pilot.ts), the trained
    // one flies at its fitted CC_* caps — so the Game flies either the same
    // way and the HUD reads both.
    const auto = this.instruments.coPilot(dt, this.handsOn());
    // A co-pilot that can answer a warhead — the same button, the same price
    // and the same messages as the player's own E.C.M. key (docs/TODO/72). It
    // is applied here rather than inside the autopilot because spending the
    // bank is a consequence, and consequences are the orchestrator's.
    if (auto.ecm) this.weapons.triggerEcm();
    return auto.demand
      ? { ...auto.demand, fire: auto.demand.fire || hands.fire }
      : hands;
  }

  /**
   * Is the human touching the controls? Both autopilots let go when they are —
   * the combat computer hands the ship back, the docking computer breaks off.
   */
  private handsOn(): boolean {
    return this.input.held(...manualFlightKeys())
      || Math.abs(this.input.mouseX) > 0.15 || Math.abs(this.input.mouseY) > 0.15;
  }

  /**
   * What the paused world says, and the only place a player is told that Q is
   * available at all.
   *
   * The keys are read off the binding table (`boundKey`) rather than typed:
   * this is prose quoting a key, which is invariant 9's rule, and the briefing
   * already works this way. Built per call rather than hoisted — it is two
   * lookups on a frame that is doing nothing else, and a module-level constant
   * would be a second home for a caption `command-help.ts` owns.
   *
   * @internal — driven by src/game/game.ts, which draws the paused line.
   */
  pausedHint(): string {
    return `PAUSED — ${boundKey('flight', 'togglePause')} TO RESUME`
      + ` · ${boundKey('flight', 'quitFlight')} TO QUIT THE FLIGHT`;
  }

  // --- the racks -----------------------------------------------------------

  // --- the ship's own instruments -----------------------------------------

  // --- the training simulator ---------------------------------------------

  /**
   * Start a training exercise.
   *
   * @internal — the picker calls it through `CombatSimContext.begin`, and the
   * console harnesses call it directly.
   */
  startExercise(spec: ExerciseSpec, fit?: ExerciseFit): boolean {
    if (this.host.baseMode() === 'dead') return false;
    return this.simulator.begin(spec, fit);
  }

  /**
   * End one early, from anywhere. Returns the records it produced.
   *
   * Reached from the `simulator` binding table (Escape or Q) and from the
   * console harnesses.
   */
  endExercise(): readonly CombatSimReport[] | null { return this.simulator.quit(); }

  // --- the guns ------------------------------------------------------------

}
