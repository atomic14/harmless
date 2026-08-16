// What a commander does while she flies.
//
// The other half of the orchestrator. docs/TODO/155 M2 split it from
// `docked.ts`, on Chris's rule of 2026-08-14: *"It makes sense to split docked
// from flight - they are very different things."* `game.ts` keeps the mode
// machine, the frame skeleton and the routing. This holds everything that only
// happens with the ship in the sky.
//
// ONE RESPONSIBILITY: what a commander does while she flies. That is one slice
// of time advanced, and who is at the controls for it. It is also what the guns
// and the racks spend, and what the hull takes. The exercise belongs here too,
// because it is ordinary flight with a different step behind it.
//
// THIS HALF IS WHERE THE MACHINE LIVES, and the constructor says so honestly.
// The world step, the guns, the autopilots, the instrumentation and the
// simulator are ITS fields, because nothing outside flight uses them. Six
// things it SPENDS come in as collaborators, because the station spends them
// too. They are the racks, the keyboard, the cockpit, the law, the record and
// the combat computer.
//
// SEVENTEEN HOST METHODS IS THE WIDEST INTERFACE IN THE TREE, and that is the
// shape of a half rather than a fault. Every one of them is the parent's own
// job: the mode machine, the console, or a way OUT of flight. A step that ends
// in a dock, an arrival or a death reports that end. The orchestrator then
// decides what the game becomes. This half never reaches into the docked half,
// and that separation is the whole point of the split.
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
 * What a flight has to reach back to the Game for.
 *
 * The widest host in the tree, and every entry is one of three things: the mode
 * machine, the console, or a WAY OUT OF FLIGHT.
 *
 * THE WAYS OUT MATTER MOST. A step can end in a dock, a completed jump, a tow
 * or a death. Not one of them is flight's to carry out. The dock belongs to the
 * other half, and the parent stands between the two, so that neither reaches
 * into the other. This half reports; the orchestrator decides what the game
 * becomes.
 */
export interface FlightHost {
  /** the mode WITH an open screen counted — a HUD needs the cockpit clear */
  mode(): string;
  /** the base state, with any screen over it ignored */
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
  /** an exercise ended and left records worth a read */
  showReport(reports: readonly CombatSimReport[]): void;
}

export class Flight {
  private readonly state: GameState;
  /** the keyboard and the mouse, read once a frame */
  private readonly input: Input;
  /** what the cockpit shows — where the beams meet, and the key prompts */
  private readonly cockpit: CockpitView;
  /** the record, because an exercise's best wave is written straight down */
  private readonly saves: Persistence;

  // --- this half's own machine, because nothing outside flight uses it -----

  /**
   * The world, advanced by one slice — see world-step.ts.
   *
   * It owns the five phases of flight. It knows nothing about a HUD, a keyboard
   * or a renderer. It takes a demand, moves everything, and reports what it
   * did. `stepHost()` below is the whole of what it may ask of us.
   */
  private readonly worldStep: WorldStep;
  /**
   * The combat training simulator — see combat-sim.ts.
   *
   * It is owned the way `station`, `ordnance` and `persistence` are. It is
   * deliberately NOT a field on `GameState`. A state field must appear in the
   * save, and a test enforces that. An exercise must not survive a reload:
   * close the tab mid-exercise, and you wake at the station with the career
   * intact.
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
   * It is a child rather than a section, because this file reached 648 lines.
   * `tools/sizes.mjs` is right about what that means. The racks, the guns and
   * the damage are one subject, and the slice of time is another.
   */
  private readonly weapons: Weapons;

  /**
   * The instruments a pilot switches on — see flight-instruments.ts.
   *
   * The second child, and the same reason as the first. The two computers, the
   * torus drive, the mouse and the view are one subject. A slice of time is
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
   * It is exposed rather than delegated through. The parent's command table is
   * deliberately the whole surface that drives the game. A pass-through per key
   * would be nine lines that say nothing. The table addresses the file that
   * owns the act: `flight_.weapons.armMissile()`.
   */
  get racks(): Weapons { return this.weapons; }

  /** The switches, for the same reason the racks are exposed. */
  get switches(): Instruments { return this.instruments; }

  /** Is a training exercise active? Four things outside flight ask. */
  inSimulator(): boolean { return this.simulator.active; }

  /** The exercise's own strip, for the cockpit to paint. */
  get strip(): CombatSim['strip'] { return this.simulator.strip; }

  /**
   * What the world step may ask of the Game — the consequences that reach
   * outside the sky, and nothing else it can get at.
   *
   * It is an object literal rather than `implements StepHost`, on purpose. The
   * methods behind it stay private, so this list IS the surface. To add to it
   * is a decision rather than an accident.
   *
   * FIVE OF THE THIRTEEN LEAVE FLIGHT, and this half relays all five rather
   * than does them. A dock, a completed jump, a tow, a death and the hermit's
   * market are the parent's to carry out.
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
      // The one number a run leaves behind. The RULE is commander.ts's: it only
      // ever grows, and it says whether it moved. So this applies the rule and
      // saves the result, which is all an orchestrator does. It writes straight
      // to storage rather than to the next autosave. A pilot who reads their
      // best wave off the panel, and then closes the tab, earned it.
      recordFurthestWave: (wave) => {
        if (recordFurthestWave(this.state.commander, wave)) this.saves.checkpoint();
      },
      // The exercise tore down and the career is back. Hold the records. Put
      // the report on screen. The order is not incidental. The teardown
      // restores the mode first, and `enterMode` clears the stack. A screen
      // pushed afterwards therefore sits on the station menu it came from.
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
    // behind it (combat-sim.ts). Its teardown is DEFERRED. `settle()` puts the
    // career back HERE, after the step returns. A restore from inside
    // `stepNpcs` would rebuild the scene while the step still walked it.
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
   * `npcFired` and `playerDealt` are deliberately dropped here. Both are for a
   * caller that measures (combat-sim.ts), and it already read them out of the
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
   * Who flies the ship, and what they want.
   *
   * ONE producer per frame: the hands at the keyboard, or the combat computer
   * when it is engaged and still holds the ship. The trigger is the union of
   * the two. A fitted combat computer flies the ship. It does not take your gun
   * off you.
   */
  private pilotDemand(dt: number): FlightDemand {
    const hands = flightDemand(this.input, keymap(), this.state.player, dt);
    // the virtual stick self-centres; the producer is pure, so the mutation
    // is ours to do, immediately after the read
    if (this.input.mouseFlight) this.input.decayMouse(dt);
    if (!this.state.session.ccEngaged) return hands;
    // WHICH co-pilot is the brain selection's answer. Under the shipped
    // 'attack-run' name it is the scripted PURE-PURSUIT co-pilot. Otherwise it
    // is the trained defence seat, which is dormant: defenceBrain() is null and
    // the seat disengages. Both return a FlightDemand. The scripted one
    // banks-to-turn through the commander's own envelope (scripted-co-pilot.ts).
    // The trained one flies at its fitted CC_* caps. So the Game flies either
    // the same way, and the HUD reads both.
    const auto = this.instruments.coPilot(dt, this.handsOn());
    // A co-pilot that can answer a warhead — the same button, the same price
    // and the same messages as the player's own E.C.M. key (docs/TODO/72). It
    // is applied here rather than inside the autopilot, because the spend from
    // the bank is a consequence, and consequences are the orchestrator's.
    if (auto.ecm) this.weapons.triggerEcm();
    return auto.demand
      ? { ...auto.demand, fire: auto.demand.fire || hands.fire }
      : hands;
  }

  /**
   * Is the human on the controls? Both autopilots let go the moment she is —
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
   * It reads the keys off the binding table (`boundKey`) rather than typed
   * text. This is prose that quotes a key, which is invariant 9's rule, and the
   * briefing already works this way. It is built per call rather than hoisted.
   * That is two lookups on a frame with nothing else to do. A module-level
   * constant would be a second home for a caption `command-help.ts` owns.
   *
   * @internal — driven by src/game/game.ts, which draws the paused line.
   */
  pausedHint(): string {
    return `PAUSED — ${boundKey('flight', 'togglePause')} TO RESUME`
      + ` · ${boundKey('flight', 'quitFlight')} TO QUIT THE FLIGHT`;
  }

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
}
