// The exercise: a real fight that costs nothing.
//
// It runs the combat trainer (docs/COMBAT-SIM.md). It owns the commander swap,
// the entry snapshot, its own `StepHost`, and the round loop. Four neighbours
// own the rest: combat-sim-scenarios.ts says WHO you fight,
// combat-sim-opening.ts says WHERE, combat-sim-report.ts counts what happened,
// and spawning.ts puts the ships in the sky.
//
// It is ordinary flight with a different step behind it. The same `WorldStep`,
// the same brains, the same guns and the same seeded stream. `updateFlight`
// chooses which one to run, and it does not step at all under an open
// overlay.
//
// ## The one rule, and why it takes three layers
//
// Nothing that happens in here leaves it. Above all, it must not advance you
// toward E L I T E, which `rating()` reads from `commander.kills` and
// `commander.combatScore`. Three layers do that. The first two PREVENT, and the
// third REPAIRS:
//
//  1. The commander swap (`exerciseCommander`). A laser kill calls
//     `this.destroy(commander, …)` inside `Combat.fire()` and never passes
//     through `StepHost.destroyNpc`, so no host-only defence can see it.
//     Swapping `state.commander` for a clone covers that, the energy bomb's call
//     from `runCommand`, and everything the step writes without asking
//     (`survivors`, `cargo`, `fuel`, `missiles`).
//  2. The alternative `StepHost` (`stepHost()` below): 1 pass-through,
//     5 redirects, 6 refusals.
//  3. The entry snapshot, captured on entry and restored on exit — which also
//     puts the rng stream back, because `Persistence.restore` does that last.
//
// One exception exists. A waves run leaves `commander.furthestWave` behind, so
// a run has a result worth coming back to. It is not a rating, a kill or a
// credit, and no career rule reads it (commander.ts says so at the field). It is
// written AFTER the restore, because the restore would undo it. It is then
// reported to the orchestrator.
//
// `die()` is redirected and unreachable: `Game.die` drops the career's in-flight
// autosaves, so a simulated death reaching it would delete real ones.
//
// Session state is a module instance owned by the Game, rather than a
// `GameState` field. A `GameState` field must appear in `capture()`/`restore()`,
// and a test enforces that, so the save would carry an in-progress exercise. An
// exercise is the one thing that does NOT survive a reload. Close the tab
// mid-exercise, and you wake at the station with your career untouched.
//
// Teardown is DEFERRED: `applyPlayerDamage` runs inside `stepNpcs`/`applyOrdnance`,
// so restoring the world there would rebuild the scene mid-step. `finish()` flips
// the phase, `inFlight()` goes false so the frame unwinds, and `updateFlight`
// calls `settle()` after the step returns.

import * as THREE from 'three';

import type { CommanderData, Equipment } from './commander.ts';
import {
  Combat, BEAM_FLASH, type CombatScratch, type DamageSource,
} from './combat.ts';
import type { CombatEvent } from './combat-events.ts';
import { damagePlayer, firePlayerLaser } from './combat-player.ts';
import {
  CombatSimRecorder, aimAngle, furthestWave, makeSimLog,
  type CombatSimReport, type ContactSample, type ExerciseSetup, type FrameSample,
  type OpeningGeometry, type OpponentSetup, type PlayerLoadout, type SimLog,
  type SimOutcome,
} from './combat-sim-report.ts';
import {
  arenaCentre, describeOpening, measureOpening, openingFor, openingPlacement,
} from './combat-sim-opening.ts';
import { exerciseStrip, type ExerciseStrip } from './combat-sim-strip.ts';
import { describeFlight } from './break-off.ts';
import {
  MODES, allShips, describeOpposition, liveBrainFor, nextOpposition, roundOutcome,
  roundSeed, scenarioById, waveEscalation,
  type BrainId, type ExerciseSession, type ExerciseSpec, type Opposition,
  type SimShip, type ThreatContext,
} from './combat-sim-scenarios.ts';
import type { DealtEvent } from './damage-dealt.ts';
import type { PlayerPoolPoints } from './damage-units.ts';
import type { NpcShip } from './npc.ts';
import type { Ordnance } from './ordnance.ts';
import type { Persistence } from './persistence.ts';
import { random, seedWorld } from './rng.ts';
import { exerciseCommander, exerciseStepHost } from './combat-sim-safety.ts';
import { defenceBrainNameFor, selectionForBrain } from './brain-names.ts';
import type { WorldSnapshot } from './snapshot.ts';
import { spawnOpposition, type OppositionUnit } from './spawning-arena.ts';
import { freshSession, type GameState } from './state.ts';
import { ENTRY_THROTTLE, NO_AMBIENT_TRAFFIC } from '../constants/exercise.ts';
import { breachLoss, freshSystems } from './systems.ts';
import { type PilotInput, type StepEvent, type StepHost, WorldStep } from './world-step.ts';
import type { SoundEvent } from './sounds.ts';
import { shipDisplayName } from '../ships/registry.ts';

const ZERO = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);


/**
 * The fit-out an exercise may lend you, applied to the CLONE only.
 *
 * Fit-out, not hull: the player's hull is four constants in player.ts, and
 * `ai-training/scenario.ts` reads `PLAYER_FLIGHT` as the target every pirate
 * brain was fitted against (docs/COMBAT-SIM.md).
 */
export interface ExerciseFit {
  equipment?: Partial<Equipment>;
  /** rack size for the exercise; the career's own by default */
  missiles?: number;
}

/**
 * What an exercise needs the orchestrator to do.
 *
 * Five verbs, not "the Game", so a test implements it in five lines — the same
 * shape as `StepHost` and `PersistenceHost`. Everything the exercise does to the
 * world it does to `GameState`; the world REBUILD and the mode machine come in
 * through `Persistence`, which owns both.
 */
export interface SimHost {
  /** the ship is in the sky now: clear the overlays and hand over the cockpit */
  enterFlight(): void;
  /** something to say out loud */
  message(text: string, seconds: number): void;
  sound(event: SoundEvent): void;
  /** the damage flash — a simulated hit should look like a real one */
  flashDamage(): void;
  /** point the cockpit beams at what the shot found, or straight ahead */
  aimBeams(at: THREE.Vector3 | null): void;
  /**
   * A waves run reached this far. It is the ONE number an exercise may leave
   * behind.
   *
   * It is reported rather than written. The career keeps it, and this module
   * does not touch the career: the orchestrator applies it through
   * `commander.ts`'s `recordFurthestWave`, then saves. It is called after the
   * entry snapshot is restored, because the restore would undo it, and only
   * where a run reached a wave.
   */
  recordFurthestWave(wave: number): void;
  /** the exercise is over and the records are ready to read */
  finished(reports: readonly CombatSimReport[]): void;
}

/** Idle, in an exercise, or held until the frame unwinds and the restore runs. */
type Phase = 'idle' | 'fighting' | 'ending';

/** One opponent, and whether it left the sky. */
interface Opponent {
  /** index into the round's `ExerciseSetup.opponents`, which the report quotes */
  index: number;
  ship: NpcShip;
  down: boolean;
}

export class CombatSim {
  private readonly state: GameState;
  private readonly ordnance: Ordnance;
  private readonly combat: Combat;
  private readonly persistence: Persistence;
  private readonly host: SimHost;
  private readonly log: SimLog;

  /**
   * The exercise's own world step — the SAME class the career flies, over the
   * same state, only the host differs. There is no second simulation to keep in
   * step.
   */
  private readonly step: WorldStep;

  /** The second layer, built once — see `stepHost()`. */
  private readonly hostVerbs: StepHost = this.stepHost();

  private readonly scratch: CombatScratch = {
    a: new THREE.Vector3(), b: new THREE.Vector3(),
    q: new THREE.Quaternion(), ray: new THREE.Raycaster(),
  };
  private readonly tmp = new THREE.Vector3();
  private readonly tmpM = new THREE.Matrix4();

  private phase: Phase = 'idle';
  /** layer 3: the whole world as it was the instant before the exercise began */
  private entry: WorldSnapshot | null = null;
  /** the captured career commander as JSON — what the restore has to give back */
  private entryCommander = '';
  /** the live career commander, for the questions only it may answer */
  private career: CommanderData | null = null;
  private spec: ExerciseSpec | null = null;
  private startMissiles = 0;
  private round = 0;
  private roundElapsed = 0;
  private spawned = 0;
  private playerAlive = true;
  private quitting = false;
  private opponents: Opponent[] = [];
  private recorder: CombatSimRecorder | null = null;
  private records: CombatSimReport[] = [];
  private outcome: SimOutcome = 'quit';
  /** complaints about the requested brain, carried into every round's record */
  private brainWarnings: string[] = [];
  private refused: string[] = [];

  constructor(
    state: GameState, ordnance: Ordnance, combat: Combat,
    persistence: Persistence, host: SimHost, log: SimLog = makeSimLog(),
  ) {
    this.state = state;
    this.ordnance = ordnance;
    this.combat = combat;
    this.persistence = persistence;
    this.host = host;
    this.log = log;
    this.step = new WorldStep(state, ordnance, this.hostVerbs);
  }

  // --- what the Game and the screens may ask -------------------------------

  /** Is an exercise running, in either phase? */
  get active(): boolean { return this.phase !== 'idle'; }
  /** Is it still a fight, rather than a frame unwinding? */
  get fighting(): boolean { return this.phase === 'fighting'; }
  /** What was asked for, or null when nothing is running. */
  get exercise(): ExerciseSpec | null { return this.spec; }
  /**
   * What the cockpit shows while this exercise is flown — null when none is.
   *
   * Gated on `active`, the same question `Game.controlMode` asks, so the strip
   * and the keys can never disagree about whether this is a simulation. Reads
   * the ROUND'S OWN RECORDER, which the record is also derived from
   * (combat-sim-strip.ts), so nothing is counted twice.
   */
  get strip(): ExerciseStrip | null {
    if (!this.active || !this.spec || !this.recorder) return null;
    return exerciseStrip(this.spec, this.recorder.setup, this.recorder.progress);
  }
  /**
   * The commander the exercise is flying — the CLONE.
   *
   * Exposed so a test can prove the credit went somewhere: its `kills` climb
   * while the career's do not.
   */
  get commander(): CommanderData | null {
    return this.phase === 'idle' ? null : this.state.commander;
  }
  /**
   * Save writes the last teardown REFUSED, by key — evidence that the
   * suppression is load-bearing rather than vacuous.
   */
  get refusedWrites(): readonly string[] { return this.refused; }
  /** Records from exercises this session, oldest first. */
  get simLog(): SimLog { return this.log; }
  /**
   * The second layer, as the twelve verbs it is.
   *
   * @internal — `npm test` calls every member directly. A defence whose only
   * evidence is that one fight came out safe is not a tested defence.
   */
  get verbs(): StepHost { return this.hostVerbs; }

  /**
   * Start an exercise. Returns false if one is already running.
   *
   * @param fit the fit-out to lend the commander — applied to the clone only.
   */
  begin(spec: ExerciseSpec, fit: ExerciseFit = {}): boolean {
    if (this.phase !== 'idle') return false;
    const s = this.state;

    // LAYER 3 FIRST, before anything moves. The snapshot is what the career is
    // put back from, and it includes the rng state the career was about to draw
    // on.
    this.career = s.commander;
    this.entry = this.persistence.capture();
    this.entryCommander = JSON.stringify(this.entry.commander);

    this.spec = spec;
    this.round = 0;
    this.records = [];
    this.refused = [];
    this.playerAlive = true;
    this.quitting = false;
    this.outcome = 'quit';
    this.selectBrains(spec.brain);

    // A fresh stream for the fight, so a seed quoted in a report rebuilds it,
    // and the career's stream is restored on exit (docs/COMBAT-SIM.md: "do not
    // shift the career's rng stream").
    seedWorld(spec.seed);

    // LAYER 1. Everything downstream — the step, the gun, the ordnance, the law
    // — reads `state.commander`, and from now until teardown that is a clone
    // nobody will ever load.
    s.commander = exerciseCommander(this.career, fit);
    this.startMissiles = s.commander.missiles;

    this.clearSky();
    this.resetFlight();
    this.placePlayer();
    this.phase = 'fighting';
    this.host.enterFlight();

    if (!this.beginRound()) {   // no opposition: nothing to practise against
      this.finish('quit');
      this.settle();
      return false;
    }
    const name = spec.custom ? 'CUSTOM EXERCISE' : scenarioById(spec.scenario).name.toUpperCase();
    this.host.message(`COMBAT SIMULATION — ${name}`, 4);
    return true;
  }

  /**
   * One frame of exercise: the real world step, then the measurement, then the
   * rules. Returns what the step reported, for the Game to say out loud.
   */
  tick(dt: number, elapsed: number, pilot: PilotInput): StepEvent[] {
    if (this.phase !== 'fighting') return [];
    const events = this.step.step(dt, elapsed, pilot);
    this.roundElapsed += dt;

    // Only the step knows that a shot was fired. It rolls the hit, and the host
    // hears about hits alone. Shots are every accuracy denominator in the
    // report. `playerDealt` is the same rule the other way: the host is told
    // that a ship DIED, and never what it cost to kill it.
    for (const e of events) {
      if (e.kind === 'npcFired') this.npcFired(e.npc, e.weapon, e.atPlayer);
      else if (e.kind === 'playerDealt') this.playerDealt(e);
    }
    this.reap();
    this.recorder?.tick(dt, () => this.sample());

    // The phase may already be flipped, because a death inside the step calls
    // finish(). The rules then have nothing left to decide.
    if (this.phase === 'fighting') {
      const where = roundOutcome(this.session());
      if (where === 'roundOver') this.nextRound();
      else if (where === 'over') this.finish(this.verdict());
    }
    return events;
  }

  /**
   * Put the career back, once the exercise ends.
   *
   * `updateFlight` calls it AFTER the step returns. See the header on deferred
   * teardown. It is a no-op at any other time, so it is safe to call every
   * frame.
   */
  settle(): CombatSimReport[] | null {
    return this.phase === 'ending' ? this.teardown() : null;
  }

  /**
   * The pilot ended it.
   *
   * It is safe to call straight from input handling, and it tears down THERE. A
   * screen opened over the top stops the world step. An exercise that could only
   * end from inside a step it no longer runs would never end.
   */
  quit(): CombatSimReport[] | null {
    if (this.phase === 'idle') return null;
    if (this.phase === 'fighting') this.finish('quit');
    return this.settle();
  }

  /**
   * A kill the Game was asked for while an exercise is running.
   *
   * The energy bomb reaches `Game.destroyNpc` from `runCommand`, not through the
   * step, so the Game hands it here instead of crediting itself. Layer 1 makes
   * it harmless — the clone takes the credit — and this makes it show up in the
   * RECORD.
   */
  destroyNpc(npc: NpcShip): void {
    this.applySimCombat(this.combat.destroy(this.state.commander, npc), true);
  }

  /**
   * Damage the commander did to a ship, for the record.
   *
   * The step's own hits arrive through `tick`. This is the public door for the
   * one hit that does not go through the step: the ENERGY BOMB. The Game applies
   * that one from `runCommand`, and hands it here beside the kill that follows.
   *
   * It is safe while nothing runs, and for a ship that is not an opponent.
   * Either way there is no line to credit it to. Attribution is by IDENTITY,
   * because the event carries the ship itself. Nothing is inferred from a
   * position or from a magnitude.
   */
  playerDealt(hit: DealtEvent): void {
    if (hit.damage <= 0) return;    // a hit that took nothing off is not damage
    const o = this.opponents.find((x) => x.ship === hit.npc);
    if (o) this.recorder?.dealt(o.index, hit.damage, hit.source);
  }

  // --- the alternative StepHost --------------------------------------------

  /**
   * What the exercise's world step may ask of it — the second layer. Every
   * member of `StepHost` here with a decision against it:
   *
   *   PASS-THROUGH (1) — `wreckNpc`. A ship taken out of the sky, with credit to
   *     nobody, is the same act in an exercise as in the galaxy. It takes no
   *     commander, so there is nothing to leak.
   *
   *   REDIRECTED (5) — `inFlight` holds the exercise's own liveness and the flag
   *     that unwinds the frame. `applyPlayerDamage` is real damage, and a death
   *     ends the exercise. `destroyNpc` and `fireLaser` are real kills and real
   *     shots, credited to the clone and counted. `die` is the fifth, and it has
   *     to DO something: "death ends the exercise, not the career". A refusal
   *     would leave you in a dead ship, in a fight that could never end.
   *
   *   REFUSED (6) — `raiseLegal`, `dock`, `completeHyperspace`, `completeRescue`,
   *     `openHermitTrade` and `autoSave`. Each one reaches the career:
   *
   *       - `raiseLegal` — the legal status, and the station's Vipers;
   *       - `dock` — the fine, the save and the cleared world blob;
   *       - `completeHyperspace` — the fuel, the days and the system index;
   *       - `completeRescue` — your hold as salvage;
   *       - `openHermitTrade` — a market screen that stops the world mid-fight;
   *       - `autoSave` — the save itself.
   */
  private stepHost(): StepHost {
    // The table itself is in combat-sim-safety.ts, so the three layers of
    // "nothing leaves the exercise" read together there.
    return exerciseStepHost({
      fighting: () => this.phase === 'fighting',
      takeHit: (amount, from, source) => this.takeHit(amount, from, source),
      destroyNpc: (npc) => this.destroyNpc(npc),
      wreckNpc: (npc) => this.applySimCombat(this.combat.wreck(npc), false),
      pullTrigger: () => this.pullTrigger(),
      die: (reason) => this.simDeath(reason),
      say: (text, seconds) => this.host.message(text, seconds),
    });
  }


  // --- the round loop ------------------------------------------------------

  /** The facts the rules need. Plain data, and they never reach back. */
  private session(): ExerciseSession {
    return {
      spec: this.spec!,
      round: this.round,
      spawned: this.spawned,
      alive: this.opponents.filter((o) => !o.down).length,
      roundElapsed: this.roundElapsed,
      playerAlive: this.playerAlive,
      quitting: this.quitting,
      ...(this.career ? { threat: this.threatContext(this.career) } : {}),
    };
  }

  /**
   * What the live galaxy knows about you when it decides who to send.
   *
   * The CAREER commander, and not the clone. A clone has an empty hold and a
   * clean record. To ask what THAT is worth robbing would send Sidewinders at a
   * Dangerous commander in a full Python (combat-sim-scenarios.ts).
   */
  private threatContext(career: CommanderData): ThreatContext {
    const s = this.state;
    const sys = s.systems[career.systemIndex];
    return {
      sys,
      danger: s.living.danger(sys.index),
      commander: career,
      notoriety: s.living.notoriety(sys.index),
    };
  }

  /** Build the coming round, or report that there is not one. */
  private beginRound(): boolean {
    const list = nextOpposition(this.session(), random);
    if (!list || list.length === 0) return false;
    const ships = allShips(list);
    if (ships.length === 0) return false;

    const { opponents, opening } = this.spawn(ships);
    this.opponents = opponents;
    this.spawned = this.opponents.length;
    this.roundElapsed = 0;
    this.recorder = new CombatSimRecorder(this.setupFor(list, ships, opening));
    this.recorder.event(describeOpposition(list));
    // At t=0: whether the fight started where it meant to.
    this.recorder.event(`opening: ${describeOpening(opening)}`);
    // ...and, in the waves mode, what the ramp turned on by this one. The
    // record carries the escalation as a field; this is the same fact in the
    // event log, beside the fight it explains.
    const step = this.recorder.setup.escalation;
    if (step?.added) this.recorder.event(`wave ${step.wave} adds ${step.added} — ${step.why}`);
    for (const w of this.brainWarnings) this.recorder.warn(w);
    return true;
  }

  /**
   * Put the round in the sky, aimed at the commander.
   *
   * It goes where the scenario says. For six of the seven that is in front of
   * you (combat-sim-opening.ts).
   */
  private spawn(ships: readonly SimShip[]): { opponents: Opponent[]; opening: OpeningGeometry } {
    const units: OppositionUnit[] = ships.map((sh) => ({
      role: sh.role,
      count: 1,
      hull: sh.spec,
      tier: sh.tier,
      // The one per-ship lever: an organised gang flies the pack policy,
      // everyone else the solo one (CLAUDE.md's Training split, via brains.ts).
      brain: sh.organised ? 'pack' : 'solo',
      // Police and bounty hunters attack a clean commander only if provoked
      // (`isHostileToPlayer`); an authored interdiction says it was.
      hostile: true,
    }));
    const { player } = this.state;
    const plan = openingFor(this.spec!);
    const spawned = spawnOpposition(
      this.state.world, units, player.position,
      openingPlacement(plan, player.getForward(this.tmp)));
    // A ship spawned this frame has no world matrix yet, and `traceShot`
    // raycasts against `matrixWorld`, so the commander's first shot would test
    // against the origin. The renderer does it every frame after this one.
    for (const npc of spawned) npc.object.updateMatrixWorld(true);
    return {
      opponents: spawned.map((ship, index) => ({ index, ship, down: false })),
      // Measured from where they landed rather than restated from the plan, so
      // the record can be held against the intent instead of repeating it.
      opening: measureOpening(plan, player.position, player.quaternion,
        spawned.map((npc) => npc.object.position)),
    };
  }

  /** Everything fixed about the round, as the report will quote it. */
  private setupFor(
    list: readonly Opposition[], ships: readonly SimShip[], opening: OpeningGeometry,
  ): ExerciseSetup {
    const spec = this.spec!;
    const endless = MODES[spec.mode].endless;
    const opponents: OpponentSetup[] = ships.map((sh) => ({
      hull: shipDisplayName(sh.spec.designId),
      // From the roster entry about to be flown, not the mesh: the display name
      // above is a label, these two say what it IS.
      designId: sh.spec.designId,
      profileId: sh.spec.profileId,
      brain: this.flownBrain(sh),
      role: sh.role,
      tier: sh.tier,
    }));
    return {
      seed: roundSeed(spec.seed, this.round),
      scenario: spec.custom
        ? `custom: ${describeOpposition(list)}`
        : scenarioById(spec.scenario).name,
      mode: spec.mode,
      player: this.loadout(),
      // `state.brains` already carries this round's override if the panel set
      // one — begin() applies it before any round is set up.
      coPilot: defenceBrainNameFor(this.state.brains),
      opponents,
      opening,
      ...(endless ? { wave: this.round + 1 } : {}),
      // Waves only: sparring is endless but nothing about it escalates, so an
      // escalation of "stage 0, nothing added" on every sparring record would
      // mean nothing.
      ...(spec.mode === 'waves' ? { escalation: waveEscalation(this.round + 1) } : {}),
    };
  }

  /**
   * Which policy this ship will ACTUALLY fly.
   *
   * Asked of the SELECTION, not the opposition table, because the selection is
   * what `NpcShip.update` reads. `begin()` applies any A/B override to
   * `state.brains` first. So this answers correctly in all three cases: the
   * override took, the game cannot fly it, or there is none. One rule, one home:
   * brain-names.ts.
   */
  private flownBrain(sh: SimShip): BrainId {
    return liveBrainFor(sh.role, sh.organised, sh.tier, this.state.brains);
  }

  /** What the commander flew, for the record. Description, not simulation. */
  private loadout(): PlayerLoadout {
    const c = this.state.commander;
    return {
      shipId: c.shipId,
      laser: c.equipment.laser,
      rearLaser: c.equipment.rearLaser,
      missiles: c.missiles,
      ecm: c.equipment.ecm,
      energyUnit: c.equipment.energyUnit,
      energyBomb: c.equipment.energyBomb,
    };
  }

  /** A round is over and another follows: close the record and build it. */
  private nextRound(): void {
    this.close('cleared');
    this.round += 1;
    if (MODES[this.spec!.mode].restoreBetweenRounds) {
      // Sparring is for learning a hull, and attrition just ends the lesson
      // early. Waves do NOT get this: attrition is the question they ask.
      Object.assign(this.state.sys, freshSystems());
      this.state.commander.missiles = this.startMissiles;
      this.ordnance.clear();
    }
    if (!this.beginRound()) { this.finish('cleared'); return; }
    const setup = this.recorder!.setup;
    if (setup.wave === undefined) { this.host.message('NEXT OPPONENT', 3); return; }
    // The banner NAMES what is new, because a wave harder in a way the pilot
    // cannot see is indistinguishable from a wave that went badly. Only on the
    // wave that adds it: the strip carries the standing list from then on.
    const added = setup.escalation?.added;
    this.host.message(`WAVE ${setup.wave}${added ? ` — ${added}` : ''}`, added ? 5 : 3);
  }

  /** How this ended, for a round that ran out rather than being ended. */
  private verdict(): SimOutcome {
    if (!this.playerAlive) return 'destroyed';
    if (this.quitting) return 'quit';
    return this.opponents.some((o) => !o.down) ? 'timeout' : 'cleared';
  }

  /**
   * The exercise is over — but NOT torn down. Records the verdict and flips the
   * phase, making `inFlight()` false so the frame still inside `stepNpcs`
   * unwinds without a rebuilt world underneath it.
   */
  private finish(outcome: SimOutcome): void {
    if (this.phase !== 'fighting') return;
    this.outcome = outcome;
    this.phase = 'ending';
  }

  /** Close the round's record, into the run and into the ring. */
  private close(outcome: SimOutcome): void {
    if (!this.recorder) return;
    const report = this.recorder.report(outcome);
    this.records.push(report);
    // Pushed as each round finishes, so a long sparring session is usable data
    // even if the tab goes away.
    this.log.push(report);
    this.recorder = null;
  }

  /**
   * Put the career back. The only place that undoes any of the three layers,
   * and the order inside it is the whole safety argument.
   */
  private teardown(): CombatSimReport[] {
    this.close(this.outcome);

    // 1. The world, the commander, the brain selection and the rng stream, out
    //    of the entry snapshot. Saving is SUSPENDED, because the restore path
    //    ends at `Station.dock`, which writes the career's checkpoint. If
    //    `restore()` were ever subtly wrong, that write would persist the
    //    corruption OVER a good save. Fail safe first.
    const snap = this.entry!;
    this.refused = this.persistence.restoreWithoutSaving(snap);

    // 2. Verify. The career that came back must match the one that went in, to
    //    the byte. Where it does not, take the snapshot's copy and say so out
    //    loud. A silent repair is how a corruption ships.
    if (JSON.stringify(this.state.commander) !== this.entryCommander) {
      this.state.commander = JSON.parse(this.entryCommander) as CommanderData;
      const complaint = 'the exercise restored a commander that did not match the '
        + 'entry snapshot — the career was rebuilt from the snapshot and NOTHING '
        + 'was written to storage. This is a bug in persistence.ts, not in the fight.';
      for (const r of this.records) r.warnings.push(complaint);
      this.host.message('SIMULATOR: COMMANDER RESTORED FROM SNAPSHOT', 6);
    }

    const done = this.records;
    this.records = [];
    this.entry = null;
    this.career = null;
    this.spec = null;
    this.opponents = [];
    this.phase = 'idle';

    // 3. And the one thing that goes the other way. It is the single number a
    //    run may leave behind. It sits AFTER the restore and the byte check,
    //    because the restore would otherwise put it back. It is not a rating, a
    //    kill or a credit, and no career rule reads it (commander.ts).
    const reached = furthestWave(done);
    if (reached > 0) this.host.recordFurthestWave(reached);

    const last = done[done.length - 1];
    if (last) {
      this.host.message(
        `SIMULATION ${last.outcome.toUpperCase()} — `
        + `${last.kills.yours} KILL${last.kills.yours === 1 ? '' : 'S'}`
        + ` IN ${last.seconds}s`, 6);
    }
    this.host.finished(done);
    return done;
  }

  // --- what happens in the fight -------------------------------------------

  /**
   * The commander pulls the trigger.
   *
   * The gun is the real one — `firePlayerLaser` over the real state — and the
   * hit is read back out of the target's hull rather than guessed. A DISCHARGE
   * is what the recorder counts; `firePlayerLaser` is called every frame the
   * trigger is held and refuses internally while the laser is hot.
   *
   * What is read back is SOURCE ENERGY POINTS; "damage you took" is the
   * commander's own 255-point pool points. Both are whole source-scale numbers
   * but not the same unit — see `OpponentReport.damageFromYou`.
   */
  private pullTrigger(): void {
    const before = this.opponents.map((o) => o.ship.state.energy);
    const events = firePlayerLaser(this.state, this.combat, this.scratch);
    if (!events.some((e) => e.kind === 'fired')) return;   // hot gun, or no mount

    let landed: { opponent: number; damage: number } | null = null;
    for (let k = 0; k < this.opponents.length; k++) {
      const dealt = before[k] - this.opponents[k].ship.state.energy;
      if (dealt > 0) landed = { opponent: this.opponents[k].index, damage: dealt };
    }
    this.recorder?.playerShot(landed);
    this.applySimCombat(events, true);
  }

  /**
   * The commander takes a hit — the real damage model, on the real systems.
   *
   * `from` is how the hit is attributed. world-step.ts passes the attacker's own
   * `object.position`, which IS the ship's state vector. So identity is exact,
   * where a magnitude table was only ever a guess (see `DamageSource`).
   */
  private takeHit(
    amount: PlayerPoolPoints, from: THREE.Vector3, source: DamageSource): void {
    const hit = this.opponents.find((o) => o.ship.object.position === from);
    this.recorder?.taken(amount, source, hit?.index);
    this.host.flashDamage();
    this.applySimCombat(
      damagePlayer(this.state, this.combat, amount, from, this.scratch), false);
  }

  /** An opponent pulled its trigger. Lasers and missiles are counted apart. */
  private npcFired(npc: NpcShip, weapon: 'laser' | 'missile', atPlayer: boolean): void {
    if (!atPlayer) return;   // a shot at another ship is not a shot at you
    const o = this.opponents.find((x) => x.ship === npc);
    if (o) this.recorder?.npcShot(o.index, weapon);
  }

  /**
   * Combat decides; the exercise pays — and pays into a record instead of into a
   * career. The Game's `applyCombat` beside this one is the whole difference
   * between an exercise and a fight.
   */
  private applySimCombat(events: readonly CombatEvent[], credited: boolean): void {
    for (const e of events) {
      if (e.kind === 'sound' || e.kind === 'countdown' || e.kind === 'dockingMusic') {
        this.host.sound(e);
        continue;
      }
      switch (e.kind) {
        case 'message': this.host.message(e.text, e.seconds); break;
        // REFUSED. The clone's legal status is nobody's business, and raising
        // the career's is what launches the Vipers.
        case 'offence': break;
        // REFUSED for the same reason, from the other side: an exercise must
        // not pay a career's record off.
        case 'atonement': break;
        case 'wrecked':
          if (this.ordnance.targetLock === e.npc) this.ordnance.targetLock = null;
          this.down(e.npc, credited);
          break;
        case 'beam': this.host.aimBeams(e.at); break;
        case 'fired': this.state.session.beamTimer = BEAM_FLASH; break;
        case 'breach': this.breach(); break;
        case 'died': this.simDeath(e.reason); break;
      }
    }
  }

  /**
   * A hull breach really does cost you a tonne or a fitting — and the hold it
   * empties is the CLONE's. Layer 1 doing its job: the fight stays honest and
   * the career loses nothing.
   */
  private breach(): void {
    const lost = breachLoss(this.state.commander, random);
    if (lost.kind === 'equipment') {
      this.state.session.ccEngaged = false;
      this.recorder?.event(`hull breach: ${lost.name.toLowerCase()} destroyed`);
      this.host.message(`${lost.name} DESTROYED`, 4);
    } else if (lost.kind === 'cargo') {
      this.recorder?.event('hull breach: cargo lost');
    }
  }

  /** The commander's hull failed — in the simulator, so it costs nothing. */
  private simDeath(reason: string): void {
    if (!this.playerAlive) return;
    this.playerAlive = false;
    this.recorder?.event(`you were destroyed: ${reason.toLowerCase()}`);
    this.host.message(`SIMULATION: ${reason}`, 5);
    this.finish('destroyed');
  }

  /** An opponent left the sky, by whatever means. */
  private down(npc: NpcShip, credited: boolean): void {
    const o = this.opponents.find((x) => x.ship === npc);
    if (!o || o.down) return;
    o.down = true;
    this.recorder?.opponentDown(o.index, credited);
  }

  /**
   * Anything that left without being killed — a trader that jumped out, a ship
   * that despawned. Without this the round's `alive` count never falls and an
   * endless mode never advances.
   */
  private reap(): void {
    const live = this.state.world.npcs;
    for (const o of this.opponents) {
      if (o.down) continue;
      if (o.ship.state.alive && live.includes(o.ship)) continue;
      o.down = true;
      this.recorder?.opponentDown(o.index, false);
    }
  }

  /** The commander and every hostile, at one sample instant. */
  private sample(): FrameSample {
    const { player, sys } = this.state;
    const contacts: ContactSample[] = [];
    for (const o of this.opponents) {
      if (o.down) continue;
      const at = o.ship.object.position;
      contacts.push({
        opponent: o.index,
        dist: at.distanceTo(player.position),
        // Its OWN speed, which a turret cannot hide. It is the ship's state
        // vector rather than a difference between frames, so it is the number
        // the brain chose.
        speed: o.ship.state.speed,
        theirAim: aimAngle(at, o.ship.object.quaternion, player.position),
        doing: describeFlight(
          o.ship.state.flownBy, o.ship.state.attackPhase, o.ship.state.underFire,
          o.ship.state.tactic, o.ship.breakingOff),
        yourAim: aimAngle(player.position, player.quaternion, at),
      });
    }
    return {
      speed: player.speed,
      pitch: player.pitchRate,
      roll: player.rollRate,
      foreShield: sys.foreShield,
      aftShield: sys.aftShield,
      energy: sys.energy,
      contacts,
    };
  }

  // --- entering the arena --------------------------------------------------

  /** Nothing in the sky but what the scenario asks for. */
  private clearSky(): void {
    const s = this.state;
    s.world.clearNpcs();
    s.world.cargo.clear();
    s.world.effects.clear();
    this.ordnance.clear();
  }

  /**
   * A fresh flight, and the ambient traffic switched off.
   *
   * `freshSession()` rather than a hand-written list of fields: one home for
   * what a fresh flight is, and it is state.ts. A hand-written list drifts when
   * a field is added to `SessionState`.
   */
  private resetFlight(): void {
    const s = this.state;
    Object.assign(s.session, freshSession());
    Object.assign(s.sys, freshSystems());
    s.ecmDetectedTimer = 0;
    s.lastThreat = null;
    // Nothing to be awed by in an arena, and no derelict to announce.
    s.session.genShipSeen = true;
    s.encounterTimers = {
      trader: NO_AMBIENT_TRAFFIC,
      pirateWave: NO_AMBIENT_TRAFFIC,
      thargon: NO_AMBIENT_TRAFFIC,
    };
  }

  /** Out at the arena, with the planet ahead of you and the sun behind. */
  private placePlayer(): void {
    const { player, world } = this.state;
    const centre = arenaCentre(world);
    player.position.copy(centre);
    this.lookAlong(this.tmp.copy(world.planetPos).sub(centre));
    player.speed = player.maxSpeed * ENTRY_THROTTLE;
    player.pitchRate = 0;
    player.rollRate = 0;
  }

  /** Point the nose down `dir`. Matrix4.lookAt is camera convention: −Z leads. */
  private lookAlong(dir: THREE.Vector3): void {
    this.tmpM.lookAt(ZERO, dir, UP);
    this.state.player.quaternion.setFromRotationMatrix(this.tmpM);
  }

  // --- which brain the opposition flies ------------------------------------

  /**
   * Point `state.brains` at the exercise's choice.
   *
   * There is no put-it-back half: `state.brains` is in the entry snapshot, so
   * `teardown`'s restore returns the career's selection along with its world.
   * Making it state deleted the hazard of a career left flying an exercise's A/B
   * brain rather than guarding it.
   */
  private selectBrains(brain: BrainId | undefined): void {
    this.brainWarnings = [];
    if (!brain) return;
    const sel = selectionForBrain(brain);
    if (sel === undefined) {
      // No entry means a brain brains.ts does not import, so the game cannot
      // fly it. The career's own selection is left alone and the record says so.
      this.brainWarnings.push(`this exercise asked for ${brain}, which the game does `
        + 'not load — the opposition flew what the live game flies, and the '
        + 'per-opponent brain names say so.');
      return;
    }
    this.state.brains = sel;
  }
}
