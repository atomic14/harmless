// The orchestrator. Game owns the mode state machine (docked | flight |
// market | chart | local | equip | status | dead), routes input per mode,
// runs the fixed-timestep frame, and resolves every consequence the modules
// around it report: combat.ts says a ship was destroyed and this file pays the
// bounty, escalates legal status and launches the Vipers. Screens
// (ui/screens.ts) and the HUD (hud/hud.ts) are pure renderers fed from here.
//
// The world's own motion is NOT here. `world-step.ts` owns the five phases of
// flight; this file hands it a FlightDemand and applies the events it returns.
// Neither is the save (`persistence.ts`), the two station transitions
// (`station.ts`), the two computers that fly the ship for you (`autopilot.ts`),
// nor the key bindings (`controls.ts`). What that leaves is orchestration: the
// frame, the mode machine, the routing, and the consequences modules report.
//
// The shape repeats deliberately. Each module gets ONE host object literal —
// `stepHost()`, `persistenceHost()`, `stationHost()` — listing the verbs it may
// ask of the Game, and returns events the matching `apply*` puts on the HUD.
// Anything that DRAWS from the seeded rng is a host CALL and never a deferred
// event, because the order of draws is the world's determinism.
//
// Input follows the same split: the player, a replay and an AI reach the game
// through the same two verbs. `controls.ts` turns an input into `Command`s and
// `runCommand` below applies them.
//
// `__game` exposes a console compatibility view for the autopilot harness
// (console.ts, game-handles.ts, train/jameson-autopilot.js) and console poking.
import { publish, installPolicyKit, installSimLog } from './console.ts';
import { legacyHandles } from './game-handles.ts';
import type { Shell, Presentation, ShellFactory } from '../engine/shell.ts';
import { viewDirection, VIEW_QUATS } from './views.ts';
import * as THREE from 'three';

import { generateGalaxy, COMMODITIES, type StarSystem } from '../galaxy/galaxy.ts';
import { LivingGalaxy, prewarm } from '../galaxy/living.ts';
import { generateContractOffers } from './contract-offers.ts';
import { acceptContract, settleContracts, contractMessage, type ContractEvent } from './contracts.ts';
import { hermitMarket } from './market.ts';
import { pirateThreat, markOf } from './threat.ts';
import { createStarfield, SpaceDust } from '../world/starfield.ts';
import { type FlightDemand } from '../player.ts';
import { PLAYER_FLIGHT } from '../constants/player-flight.ts';
import { BRIEFING_VERSION } from '../constants/commander.ts';
import { Input } from '../engine/input.ts';
import { flightDemand } from '../engine/flight-controls.ts';
import {
  keymap, layoutName, toggleLayout, manualFlightKeys, refreshHelpPanel,
} from '../engine/keymap.ts';
import { Hud } from '../hud/hud.ts';
import { buildHudFrame } from '../hud/hud-binding.ts';
import { TunnelEffect } from '../hud/tunnel.ts';
import { sfx } from '../audio.ts';
import { nearestEngaging, nearestNpc, NpcShip } from './npc.ts';
import { flightPrompts, type Prompt } from './prompts.ts';
import { npcImpactDamage } from './impact-damage.ts';
import { IMPACT } from '../constants/impact.ts';
import { dealToNpc } from './damage-dealt.ts';
import type { PlayerPoolPoints } from './damage-units.ts';
import { defenceBrain } from './brains.ts';
import { defenceBrainNameFor } from './brain-names.ts';
import { type NpcSpec } from './ship-specs.ts';
import { type NpcRole } from './ship-roles.ts';
import { spawnPopulation, launchStationDefence } from './spawning.ts';
import { dumpCargo, dumpContraband, offerBribe, type Dumped } from './jettison.ts';
import {
  Combat, BEAM_FLASH, firePlayerLaser, damagePlayer,
  type CombatEvent, type DamageSource,
} from './combat.ts';
import {
  CombatInstrumentation, type CombatObserver,
} from './instrumentation.ts';
import {
  checkJump, resolveJump, refusalMessage,
  checkGalacticJump, resolveGalacticJump, galacticRefusalMessage,
} from './hyperspace.ts';
import { constrictorLurksHere } from './missions.ts';
import {
  WorldStep, massLocked,
  type StepEvent, type StepHost,
} from './world-step.ts';
import { COUNTDOWN, WITCHSPACE_ESCAPE_COST } from '../constants/jump.ts';
import { WITCHPOINT_RADII } from '../constants/planet.ts';
import { TORUS_MULTIPLIER } from '../constants/torus.ts';
import { FIXED_DT, MAX_FRAME_TIME, MAX_STEPS_PER_FRAME } from '../constants/world-clock.ts';
import { random, randomDirection, rngState, seedWorld } from './rng.ts';
import {
  bootCareer, bootCommander, bootSave, clearFlightSaves, withoutSaving,
  writeDockSave, writeFlightSave, writeNamedSave,
} from './storage.ts';
import { MAX_NAMED_SAVES } from '../constants/saves.ts';
import { type WorldSnapshot } from './snapshot.ts';
import {
  showMessage as setMessage, queueMessage, tickBeam, tickMessage,
} from './session.ts';
import { Persistence, type PersistenceHost } from './persistence.ts';
import {
  Station, type DockArrival, type StationHost, type StationEvent,
} from './station.ts';
import { CombatSim, type ExerciseFit, type SimHost } from './combat-sim.ts';
import type { CombatSimReport } from './combat-sim-report.ts';
import type { ExerciseSpec } from './combat-sim-scenarios.ts';
import { planPopulation } from './population.ts';
import { CombatComputer } from './combat-computer.ts';
import { Autopilot, type AutopilotEvent } from './autopilot.ts';
import type { SoundEvent } from './sounds.ts';
import {
  commandsFor, globalCommands, WHILE_PAUSED, type Command, type ControlMode,
} from './controls.ts';
import {
  Ordnance, ordnanceMessage, fireEcm,
  type OrdnanceOutcome,
} from './ordnance.ts';
import { AIM_ASSIST, LASER_RANGE } from '../constants/player-gun.ts';
import { hitCone } from './gunnery.ts';
import { freshTimers } from './encounters.ts';
import { THARGON_REDEPLOY } from '../constants/encounters.ts';
import {
  THARGOID_AMBUSH_EXTRA_CHANCE, THARGOID_AMBUSH_MIN, THARGOID_AMBUSH_RANGE,
  THARGOID_AMBUSH_RANGE_SPAN, WITCHSPACE_ENTRY_SPEED,
} from '../constants/witchspace.ts';
import { breachLoss } from './systems.ts';
import {
  SavesScreen, checkpointSummary,
  type SavesContext,
} from './screens/saves.ts';
import { SavePromptScreen, NamingScreen } from './screens/save-naming.ts';
import { NewCommanderScreen, startNewCommander } from './screens/new-commander.ts';
import { exportSaveFile, importSaveFile } from './screens/save-transfer.ts';
import {
  MarketScreen, EquipScreen, buyEquipment, type TradeContext,
} from './screens/trade.ts';
import { StatusScreen, type StatusContext } from './screens/status.ts';
import { DataScreen, type DataContext } from './screens/data.ts';
import { BriefingScreen } from './screens/briefing.ts';
import { ContractsScreen, type ContractsContext } from './screens/contracts.ts';
import { ChartScreen, type ChartContext } from './screens/chart.ts';
import { nextOverlay, type ChartOverlay } from './chart-overlay.ts';
import { CombatSimScreen, type CombatSimContext } from './screens/combat-sim.ts';
import { TestModeScreen, type TestModeContext } from './screens/test-mode.ts';
import { QuitScreen, type QuitContext } from './screens/quit.ts';
import { SurvivorsScreen, type SurvivorsContext } from './screens/survivors.ts';
import {
  resolveSurvivors, survivorMessage, survivorOffers, type SurvivorChoice,
} from './survivors.ts';
import { SLAVES } from '../constants/commodities.ts';
import { ScreenHost } from '../ui/screen-host.ts';
import { BEAM_Z } from '../engine/render-stack.ts';

import {
  formatCredits,
  recordFurthestWave,
  type Contract,
} from './commander.ts';
import {
  LEGAL_NAMES, CLEAN, DEFENCE_RANGE, SCAN_LINE_SECONDS,
} from '../constants/law.ts';
import { SMUGGLE_DELIVERY_NOTORIETY } from '../constants/contracts.ts';
import {
  bribeOffered, carryingContraband, inspectionPrice, patrolPrice, patrolReach,
  recordCleared, recordVerdict,
} from './law.ts';
import { afterDecay, characterVerdict } from './character.ts';
import { CHARACTER_LINE_SECONDS } from '../constants/character.ts';
import {
  hideScreen, renderDockedMenu, renderNewGameConfirm,
  renderGameOver,
} from '../ui/screens.ts';
import { boundKey, keyIfBound, paintCommandGuide } from '../ui/key-help.ts';
import { freshState, type GameState } from './state.ts';



type Mode = 'docked' | 'flight' | 'market' | 'chart' | 'local' | 'equip' | 'status' | 'data' | 'contracts' | 'saves' | 'save-name' | 'naming' | 'briefing' | 'dead';

const ZERO = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

// Fields the autonomous playtest agent (test/playtest.js) reads or drives
// are public rather than private; they are otherwise internal.
export class Game {
  /**
   * The machine this is running on — see engine/shell.ts. A desktop port writes
   * another one; nothing below this line names a browser API.
   */
  private readonly shell: Shell;
  /** what the game is SEEN through: a camera, the beams, and one draw call */
  private readonly render: Presentation;



  /**
   * The canonical mutable game model. Public so tests, console agents and ports
   * have one explicit route to state; the `legacyHandles()` getters are
   * console-only, not a second writable path.
   *
   * Snapshot capture is a hand-written list because `world` and `player` need
   * bespoke handling. A test fails if either side misses a GameState field.
   */
  readonly state: GameState = freshState(bootCommander());

  readonly input = new Input();
  private readonly hud = new Hud();
  private readonly tunnel = new TunnelEffect();

  private baseMode: 'docked' | 'flight' | 'dead' = 'docked';

  /**
   * The screen stack. Single source of truth for which overlay is open, and
   * for what Escape returns to.
   */
  readonly screens = new ScreenHost(() => this.showBaseScreen());

  /**
   * What is on screen: the top overlay, or the base state when there is none.
   * DERIVED — assign `baseMode` or push/pop the stack instead.
   */
  get mode(): Mode {
    return (this.screens.topId ?? this.baseMode) as Mode;
  }

  /** waiting on the player to confirm erasing their commander */
  private pendingNewGame = false;

  /**
   * Whether the `?` controls guide is open. The Game owns the flag rather than
   * asking the DOM, because the guide is not just paint: while it covers
   * whatever is underneath, no other input may reach that screen, and
   * `handleInput` gates on this. The shell's `toggleHelp()` only shows and
   * hides the panel; the two stay in sync because this command is the panel's
   * only caller and both start closed.
   */
  private helpOpen = false;

  /** the `?` guide: a topmost overlay above every screen, never a Screen */
  get helpVisible(): boolean {
    return this.helpOpen;
  }
  private readonly market_ = new MarketScreen(() => this.tradeContext());
  private readonly contracts_ = new ContractsScreen(() => ({
    commander: this.state.commander,
    system: this.system,
    systems: this.state.systems,
    offers: this.state.contractOffers,
    accept: (index) => { this.contracts_.selected = index; this.acceptContract(); },
  } satisfies ContractsContext));

  /** Which system the data screen is reading about. */
  private dataSubject: StarSystem | null = null;

  /**
   * Which overlay the charts are drawing. Here rather than on either screen so
   * both show the same one — the same reason `dataSubject` is here. A view
   * mode, so deliberately not in the snapshot.
   */
  private chartOverlay: ChartOverlay = 'none';

  private chartContext(): ChartContext {
    return {
      commander: this.state.commander,
      systems: this.state.systems,
      system: this.system,
      chart: this.state.chart,
      viewData: (sys) => { this.dataSubject = sys; },
      priceMultiplier: (index, commodity) => this.state.living.priceMultiplier(index, commodity),
      // the read-only accessor, never state(): see ChartContext.danger
      danger: (index) => this.state.living.danger(index),
      convoys: this.state.living.convoys,
      day: this.state.living.day,
      overlay: this.chartOverlay,
      cycleOverlay: () => { this.chartOverlay = nextOverlay(this.chartOverlay); },
    };
  }
  // the combat computer's TRAINED seat — dormant (defenceBrain() is null);
  // the scripted pure-pursuit co-pilot flies instead, see pilotDemand()
  private readonly combatComputer = new CombatComputer();
  /** Explicit telemetry seam; absent during ordinary play. */
  private readonly combatInstrumentation = new CombatInstrumentation();

  /**
   * Observe live combat without replacing production methods.
   *
   * The returned disposer removes only this registration, so one recorder
   * stopping cannot detach another.
   */
  setCombatObserver(observer: CombatObserver | null): () => void {
    return this.combatInstrumentation.setObserver(observer);
  }
  /**
   * The two computers that fly the ship for you — see autopilot.ts.
   *
   * Kept beside `combatComputer` rather than owning it, because the SNAPSHOT
   * needs the policy's mid-thought state (persistence.ts) and the autopilot is
   * the thing that engages it.
   */
  private readonly autopilot = new Autopilot(this.state, this.combatComputer);
  /** missiles, E.C.M. and the energy bomb — see ordnance.ts */
  private readonly ordnance = new Ordnance(this.state.world);
  /**
   * Resolving hits: shots, wrecks, bounties — see combat.ts. */
  private readonly combat = new Combat(this.state.world);

  /**
   * The world advancing by one slice — see world-step.ts.
   *
   * It owns the five phases of flight and knows nothing about a HUD, a
   * keyboard or a renderer: it takes a demand, moves everything, and reports
   * what it did. `stepHost()` below is the whole of what it may ask of us.
   */
  private readonly worldStep = new WorldStep(this.state, this.ordnance, this.stepHost());

  /**
   * Saving the world and putting it back — see persistence.ts.
   *
   * The snapshot's shape lives in snapshot.ts and its home in storage.ts; this
   * is the part that knows how a running world becomes one, which is why it
   * needs the ordnance and the autopilot as well as the state.
   */
  private readonly persistence = new Persistence(
    this.state, this.ordnance, this.combatComputer, this.persistenceHost());

  /**
   * Docking, launching, and the menu between them — see station.ts.
   *
   * The two transitions that switch `baseMode`, and the only two places the
   * station's own rules (the fine, the market roll, the bulletin board) are
   * applied.
   */
  private readonly station = new Station(this.state, this.ordnance, this.stationHost());

  /**
   * The combat training simulator — see combat-sim.ts.
   *
   * Owned the way `station`, `ordnance` and `persistence` are, and deliberately
   * NOT a field on `GameState`: a state field is obliged to appear in the save
   * (a test enforces it), and an exercise must not survive a reload — close the
   * tab mid-exercise and you wake up at the station with the career intact.
   *
   * An exercise is not a screen. It is ordinary flight with a different
   * `StepHost` behind it, and `updateFlight` picks which step to run.
   */
  private readonly combatSim = new CombatSim(
    this.state, this.ordnance, this.combat, this.persistence, this.simHost(),
    installSimLog());

  /**
   * What an exercise may ask of the Game. The rebuild and the mode machine are
   * not here: `Persistence` already owns both, and the exercise holds it.
   */
  private simHost(): SimHost {
    return {
      enterFlight: () => {
        this.screens.exit();
        this.baseMode = 'flight';
        hideScreen();
      },
      message: (text, seconds) => this.showMessage(text, seconds),
      sound: (event) => this.playSound(event),
      flashDamage: () => this.hud.flashDamage(),
      aimBeams: (at) => this.aimBeams(at),
      // The one number a run leaves behind. The RULE is commander.ts's — only
      // ever grows, and it says whether it moved — so this applies it and saves
      // it, which is all an orchestrator does. Written straight to storage
      // rather than left for the next autosave, because a pilot who reads their
      // best wave off the panel and closes the tab has earned it.
      recordFurthestWave: (wave) => {
        if (recordFurthestWave(this.state.commander, wave)) this.persistence.checkpoint();
      },
      // The exercise has torn down and the career is back: hold the records and
      // put the report on screen. Ordering is not incidental — teardown restores
      // the mode first (`enterMode` clears the stack), so pushing the screen
      // afterwards leaves it sitting on the station menu it was launched from.
      finished: (reports) => {
        this.simReports = reports;
        if (reports.length === 0) return;
        this.combatSim_.showReport();
        this.screens.open('combat-sim');
      },
    };
  }

  /** The records the last exercise produced — what the report panel reads. */
  private simReports: readonly CombatSimReport[] = [];

  /** The picker and the report, behind one screen id. */
  private readonly combatSim_ = new CombatSimScreen(() => ({
    commander: this.state.commander,
    reports: this.simReports,
    begin: (spec, fit) => this.startExercise(spec, fit),
    message: (text, seconds) => this.showMessage(text, seconds),
  } satisfies CombatSimContext));

  /**
   * Start a training exercise.
   *
   * @internal — the picker calls it through `CombatSimContext.begin`, and the
   * console harnesses call it directly.
   */
  startExercise(spec: ExerciseSpec, fit?: ExerciseFit): boolean {
    if (this.baseMode === 'dead') return false;
    return this.combatSim.begin(spec, fit);
  }

  /**
   * End one early, from anywhere. Returns the records it produced.
   *
   * Reached from the `simulator` binding table (Escape or Q) and from the
   * console harnesses.
   */
  endExercise(): readonly CombatSimReport[] | null { return this.combatSim.quit(); }

  /**
   * What the world step may ask of the Game — the consequences that reach
   * outside the sky, and nothing else it can get at.
   *
   * An object literal rather than `implements StepHost` on purpose: the
   * methods behind it stay private, so this list IS the surface, and adding to
   * it is a decision rather than an accident.
   */
  private stepHost(): StepHost {
    return {
      inFlight: () => this.mode === 'flight',
      applyPlayerDamage: (amount, from, source) =>
        this.applyPlayerDamage(amount, from, source),
      destroyNpc: (npc) => this.destroyNpc(npc),
      wreckNpc: (npc) => this.wreckNpc(npc),
      fireLaser: () => this.fireLaser(),
      raiseLegal: (level) => this.raiseLegal(level),
      die: (reason) => this.die(reason),
      dock: () => this.enterDocked(),
      completeHyperspace: () => this.completeHyperspace(),
      completeRescue: () => this.completeRescue(),
      openHermitTrade: () => this.openHermitTrade(),
      autoSave: () => this.autoSave(),
    };
  }

  /** Ordnance reports what it did; saying it is ours. */
  private say(reply: OrdnanceOutcome['reply']): void {
    if (!reply) return;
    const m = ordnanceMessage(reply);
    // A refusal with an answer names the COMMAND (ordnance.ts); the letter is
    // this side's business, from the same table the prompt line reads.
    const offer = m.offer ? this.renderPrompt(m.offer) : null;
    this.showMessage(offer ? `${m.text} — ${offer}` : m.text, m.seconds);
  }

  /** Ordnance sounds first, then says its semantic reply, as before extraction. */
  private applyOrdnance(outcome: OrdnanceOutcome): void {
    for (const event of outcome.events) this.playSound(event);
    this.say(outcome.reply);
  }

  private armMissile(): void {
    this.applyOrdnance(this.ordnance.arm(this.state.commander));
  }

  private launchMissile(): void {
    this.applyOrdnance(this.ordnance.launch(
      this.state.commander, this.state.player.position));
  }

  private triggerEcm(): void {
    // The burst and its price are `fireEcm` — one call, because the combat
    // computer presses the same button from `pilotDemand` and a training
    // episode's target presses it too (docs/TODO/72).
    this.applyOrdnance(fireEcm(this.state.commander, this.state.sys, this.ordnance));
  }

  private detonateEnergyBomb(): void {
    const outcome = this.ordnance.detonateEnergyBomb(
      this.state.commander, this.state.player.position);
    this.applyOrdnance(outcome);
    if (outcome.reply !== 'bombFired') return;   // no bomb fitted: no flash either
    this.shell.flashBomb();
    for (const npc of outcome.caught) {
      // The bomb is a stated `IMPACT` like every other non-laser source, spent
      // through the same `dealToNpc` — 255 points, above every released bank,
      // so everything it caught is gone.
      //
      // The two lines are the same pair as the step's: what it cost the ship,
      // then the kill. The bomb is the one damage path that never touches the
      // world step, so both are handed to a running exercise here.
      const hit = dealToNpc(
        npc, npcImpactDamage(IMPACT.energyBomb), this.state.player.position, 'bomb');
      this.combatSim.playerDealt(hit.event);
      this.destroyNpc(npc);
    }
  }

  private readonly dust = new SpaceDust();
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();
  /** the shot's ray and scratch vectors, reused every trigger pull */
  private readonly combatScratch = {
    a: new THREE.Vector3(), b: new THREE.Vector3(),
    q: new THREE.Quaternion(), ray: new THREE.Raycaster(),
  };
  /** scratch for the per-frame dashboard read, so it allocates nothing */
  private readonly hudScratch = {
    a: new THREE.Vector3(), b: new THREE.Vector3(),
    c: new THREE.Vector3(), q: new THREE.Quaternion(),
  };
  private readonly tmpM = new THREE.Matrix4();

  /** The single write seam for every console message. */
  private showMessage(text: string, seconds = 3): void {
    setMessage(this.state.session, text, seconds);
  }

  /** ...and for one said BEHIND the line that caused it (session.ts). */
  private queueMessage(text: string, seconds = 3): void {
    queueMessage(this.state.session, text, seconds);
  }

  /**
   * One message event, from whichever module reported it: said now, or said
   * once the console is free of the line it explains.
   *
   * Every `apply*` below routes through here rather than carrying its own copy
   * of the branch, so a module cannot find that its queued line is honoured
   * from flight and ignored from the station.
   */
  private sayEvent(e: { text: string; seconds: number; queued?: boolean }): void {
    if (e.queued) this.queueMessage(e.text, e.seconds);
    else this.showMessage(e.text, e.seconds);
  }

  /**
   * Your name changed hands on the ladder — say so, once the deed that moved
   * it has been read (docs/TODO/129).
   *
   * Called with the score either side of a deed or a quiet week; silent unless
   * a RUNG was crossed, so the hidden number never becomes a running
   * commentary. `characterVerdict` (character.ts) decides both questions, so
   * no caller is free to disagree about what counts as a crossing or about
   * what the line says.
   */
  private markName(before: number, after: number): void {
    const named = characterVerdict(before, after);
    if (named) this.queueMessage(named, CHARACTER_LINE_SECONDS);
  }

  /**
   * The living galaxy this career inherits: the saved one, or — for a career
   * that has none — a warmed one (docs/TODO/117).
   *
   * WARMING ONLY WHERE THERE IS NOTHING TO LOAD. `prewarm` is what a galaxy's
   * history costs, and it is paid once: from the first checkpoint on the deltas
   * are `commander.galaxyState` like any other drift, so a reload resumes the
   * galaxy it saved instead of warming another 30 days on top of it.
   *
   * The other warming site is `galacticJump`, which arrives in a galaxy no save
   * describes — same seam, same seed rule, no state to consult.
   */
  private loadOrWarmGalaxy(): void {
    if (this.state.commander.galaxyState) {
      this.state.living.load(this.state.commander.galaxyState);
      return;
    }
    prewarm(this.state.living, this.freshGalaxySeed());
  }

  /**
   * The seed a galaxy's history is drawn on: the world's, salted by which
   * galaxy it is — the same mixing `arriveInSystem` seeds arrivals with.
   *
   * The salt is what stops the eighth galaxy being the first one again after a
   * galactic jump. The world's stream is READ here and never drawn from — the
   * history runs on `prewarm`'s own derived stream — so the seeded pins
   * downstream of a boot are exactly where they were.
   */
  private freshGalaxySeed(): number {
    return rngState().seed ^ (this.state.commander.galaxy * 0x9e3779b1);
  }

  constructor(makeShell: ShellFactory) {
    // The shell is built HERE, not passed in ready-made, because it needs the
    // scene and the scene belongs to the world this object just constructed.
    this.shell = makeShell(this.state.world.scene);
    this.render = this.shell.view;
    this.shell.onResize(() => this.resize());
    this.resize();

    // Which career's autosaves this session writes. It comes off the shelf
    // before anything can write, and NOTHING replaces it afterwards — the
    // record owns it. See state.ts.
    this.state.career = bootCareer(this.state.commander);
    this.loadOrWarmGalaxy();
    // catch the galaxy up if this save has been away a while
    if (this.state.living.day < this.state.commander.day) {
      this.state.living.advance(
        Math.min(60, this.state.commander.day - this.state.living.day),
        COMMODITIES.map((c) => c.gradient));
    }

    this.state.world.scene.add(createStarfield());
    this.state.world.scene.add(this.dust.points, this.dust.streaks);
    this.state.world.scene.add(this.render.camera);


    // Screens register themselves with the host and are addressed by id from
    // then on. Adding one is a new file plus a line here and a line in
    // ScreenId — deliberately the whole shared surface. Registered BEFORE the
    // boot dock below: entering docked may open the briefing over the menu
    // (docs/TODO/106), and a host asked for a screen it has never heard of
    // throws rather than shrugs.
    for (const screen of [
      this.market_,
      new EquipScreen(() => this.tradeContext()),
      new SavesScreen(() => this.savesContext()),
      new SavePromptScreen(() => this.savesContext()),
      new NamingScreen(() => this.savesContext()),
      new NewCommanderScreen(() => this.savesContext()),
      new StatusScreen(() => ({
        commander: this.state.commander,
        systems: this.state.systems,
        targetIndex: this.state.chart.targetIndex,
      } satisfies StatusContext)),
      new DataScreen(() => ({
        subject: this.dataSubject ?? this.system,
        here: this.system,
        galaxy: this.state.commander.galaxy,
        headline: (index) => this.state.living.headline(index),
      } satisfies DataContext)),
      new BriefingScreen(),
      this.contracts_,
      new ChartScreen('chart', () => this.chartContext()),
      new ChartScreen('local', () => this.chartContext()),
      this.combatSim_,
      // The development levers. It takes the whole state because writing the
      // state is what it is for — see TestModeContext.
      new TestModeScreen(() => ({
        state: this.state,
        checkpoint: () => { this.persistence.checkpoint(); },
      } satisfies TestModeContext)),
      new QuitScreen(() => ({
        checkpoint: checkpointSummary(this.savesContext()),
        abandon: () => this.abandonFlight(),
        // You paused to get here, so backing out returns you to the pause
        // rather than dropping you live into whatever you stopped. `step`
        // clears `paused` while any screen is up (the mode is not 'flight'),
        // which is what this puts back.
        keepFlying: () => { this.state.session.paused = true; },
      } satisfies QuitContext)),
      new SurvivorsScreen(() => ({
        people: this.state.commander.survivors,
        offers: this.survivorOffers(),
        handOver: () => this.answerForSurvivors('medical'),
        sell: () => this.answerForSurvivors('sold'),
        release: () => this.answerForSurvivors('released'),
      } satisfies SurvivorsContext)),
    ]) this.screens.register(screen);

    this.buildWorld();
    // Resume mid-flight if the last session ended there; otherwise the
    // station, as Elite always did.
    if (!this.resumeSavedWorld()) this.enterDocked('fresh');
    // The `?` guide, in two halves: the flight axes change with the layout and
    // keymap.ts rewrites them whenever it is toggled; the command rows are the
    // same in both layouts, so they are painted from the binding table once.
    refreshHelpPanel();
    paintCommandGuide();
    // ...and the two keys this line names come from that same table rather than
    // from the sentence (docs/TODO/128 M3): the guide is a global binding and
    // the layout toggle is the docked table's, which is where a commander
    // reading this is standing.
    this.showMessage(
      `PRESS ${boundKey('docked', 'toggleHelp')} FOR CONTROLS`
      + ` — ${layoutName().toUpperCase()} LAYOUT`
      + ` (${boundKey('docked', 'toggleLayout')} TO SWITCH)`, 8);

    // all screens accept mouse input; the shell owns the listener and hands
    // back the element that carries data-key/data-row
    this.shell.onScreenClick((el, e) => this.handleScreenClick(el, e));
    // Reporting only, and the Game forwards it without naming a DOM type, as
    // it does clicks — see handleScreenClick.
    this.shell.onScreenMove((el, e) => this.screens.hover(el, e));

    // Console and automated agents keep their convenient read handles without
    // making those aliases part of the orchestrator's class surface.
    publish('__game', legacyHandles(this, {
      exercising: { get: () => this.combatSim.active },
      missiles: { get: () => this.ordnance.missiles },
      targetLock: {
        get: () => this.ordnance.targetLock,
        set: (v) => { this.ordnance.targetLock = v as NpcShip | null; },
      },
      missileArmed: {
        get: () => this.ordnance.armed,
        set: (v) => { this.ordnance.armed = Boolean(v); },
      },
      marketSelected: {
        get: () => this.market_.selected,
        set: (v) => { this.market_.selected = Number(v); },
      },
      contractSelected: {
        get: () => this.contracts_.selected,
        set: (v) => { this.contracts_.selected = Number(v); },
      },
    }));
    installPolicyKit();

    // Fixed timestep, decoupled from the frame rate.
    //
    // The world only ever advances in FIXED_DT slices, whatever the display is
    // doing. A variable dt means a 144Hz machine and a 30Hz one get different
    // physics from the same inputs — which is a bug on its own, and fatal to
    // the thing this is for: a run that cannot be reproduced cannot be
    // replayed, tested against, or trained on.
    //
    // The clamp stops the spiral of death: after a long stall (a tab in the
    // background, a hyperspace hitch) we drop the backlog rather than trying
    // to catch up, because catching up costs more time than we lost.
    let last = performance.now();
    let accumulator = 0;
    let simTime = 0;
    this.shell.runLoop((now: number): void => {
      accumulator += Math.min((now - last) / 1000, MAX_FRAME_TIME);
      last = now;
      let steps = 0;
      while (accumulator >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
        simTime += FIXED_DT;
        this.step(FIXED_DT, simTime);
        accumulator -= FIXED_DT;
        steps += 1;
      }
      if (steps === MAX_STEPS_PER_FRAME) accumulator = 0; // gave up catching up
      this.draw(FIXED_DT);
    });
  }

  private resize(): void {
    const { width: w, height: h } = this.shell.size();
    const pxPerRad = this.render.resize(w, h);
    this.hud.resizeOverlay(w, h);
    // Draw the sight to the assist envelope, so the circle means something: a
    // target inside it is a target the shot will reach for. Derived from the
    // real projection rather than picked by eye, so it stays honest if the fov
    // or the assist angle ever change.
    this.shell.setSightRadius(Math.tan(AIM_ASSIST) * pxPerRad);
  }

  private get system(): StarSystem {
    return this.state.systems[this.state.commander.systemIndex];
  }

  /** The only slice of the Game the market and outfitters are allowed to see. */
  private tradeContext(): TradeContext {
    return {
      commander: this.state.commander,
      system: this.system,
      market: this.state.market,
      atHermit: this.state.session.hermitTrading,
      cheat: this.state.cheat,
      message: (text, seconds) => this.showMessage(text, seconds),
      queueMessage: (text, seconds) => this.queueMessage(text, seconds),
      addNotoriety: (amount) => this.state.living.addNotoriety(this.state.commander.systemIndex, amount),
      checkpoint: () => { this.persistence.checkpoint(); },
      leaveHermit: () => {
        this.state.session.hermitTrading = false;
        this.state.session.hermitCooldown = true;
        this.showMessage('LEAVING THE HERMIT', 3);
      },
    };
  }

  /** @internal — driven by test/playtest.js */
  buyCargo(want: number): void { this.market_.buy(want); }

  /** @internal — driven by test/playtest.js */
  sellCargo(want: number): void { this.market_.sell(want); }

  /** @internal — driven by test/playtest.js */
  buyEquipment(id: string): void { buyEquipment(id, this.tradeContext()); }

  // --- world lifecycle -----------------------------------------------------

  /** @internal — driven by test/playtest.js */
  buildWorld(): void {
    this.state.world.build(this.system);
    this.hud.setSystem(this.system);
  }

  /**
   * Witch-space: mis-jump limbo. We reuse the system scene but banish the
   * planet, station and sun beyond reach — just stars, and Thargoids.
   */
  /** @internal — driven by test/playtest.js */
  enterWitchspace(): void {
    this.state.session.witchspace = true;
    this.buildWorld();
    this.state.world.banishScenery();
    this.state.player.position.set(0, 0, 0);
    this.state.player.speed = WITCHSPACE_ENTRY_SPEED;
    const n = THARGOID_AMBUSH_MIN + (random() < THARGOID_AMBUSH_EXTRA_CHANCE ? 1 : 0);
    for (let i = 0; i < n; i++) {
      this.state.world.spawn('thargoid',
        randomDirection(new THREE.Vector3())
          .multiplyScalar(THARGOID_AMBUSH_RANGE + random() * THARGOID_AMBUSH_RANGE_SPAN), i);
    }
    this.state.encounterTimers.thargon = THARGON_REDEPLOY;
    sfx.hyperspace();
    this.tunnel.start(1.1);
    this.showMessage('WITCH-SPACE — THARGOID AMBUSH', 6);
  }

  /** @internal — driven by test/playtest.js */
  spawnNpc(role: NpcRole, position: THREE.Vector3, seed: number, spec?: NpcSpec): NpcShip {
    return this.state.world.spawn(role, position, seed, spec);
  }





  /**
   * Station space is policed: launching only meets legitimate traffic.
   * Arriving from hyperspace drops pirates along the corridor to the station.
   *
   * The rules are in population.ts, the placement in spawning.ts. This is the
   * wiring plus the consequences — the arrival bookkeeping that jettisonCargo
   * later reads, and the two announcements.
   */
  private populateSystem(situation: 'launch' | 'arrival'): void {
    const sys = this.system;
    const plan = planPopulation(
      sys, situation,
      this.state.living.imminentArrivals(sys.index).length,
      // Pirates are businesses: lawlessness and the living galaxy set how many
      // are out here, but what you're visibly worth sets who they are and
      // whether they bothered to organise.
      situation === 'arrival'
        ? pirateThreat(sys, this.state.living.danger(sys.index),
          markOf(this.state.commander, this.state.living.notoriety(sys.index)))
        : null,
    );

    const constrictorHere = situation === 'arrival' && constrictorLurksHere(this.state.commander);

    const built = spawnPopulation(
      this.state.world, plan, sys, this.state.player.position, constrictorHere, situation);

    if (plan.threat) {
      this.state.lastThreat = plan.threat;
      this.state.session.jettisonedValue = 0;
      this.state.session.arrivalCargoValue = markOf(this.state.commander).cargoValue;
      // The carrot half of a bad name (docs/TODO/96): somebody out there
      // recognised it and called the reception off. Said aloud, because a
      // reception that never forms is otherwise indistinguishable from a quiet
      // system and the player would never learn the rule.
      if (plan.threat.passed) {
        this.showMessage('PIRATE CHANNEL: "LEAVE THAT ONE"', 4);
      }
    }
    if (built.generationShip) this.state.session.genShipSeen = false;
    if (built.missionTarget) {
      this.showMessage('SCANNER: UNREGISTERED PROTOTYPE DETECTED', 5);
    }
  }

  // --- mode transitions ----------------------------------------------------

  /**
   * What the station transitions may ask of the Game.
   *
   * Same shape and same reason as `stepHost()` and `persistenceHost()`.
   * `populateSystem` is a call rather than a returned event because it DRAWS
   * from the seeded stream (see station.ts). `settleContracts` remains a call
   * at its exact seeded position, but reports its sound and message for the
   * station event stream instead of applying either.
   */
  private stationHost(): StationHost {
    return {
      baseMode: () => this.baseMode,
      setBaseMode: (mode) => { this.baseMode = mode; },
      lookAlong: (dir) => this.lookAlong(dir),
      populateSystem: (situation) => this.populateSystem(situation),
      checkpoint: () => { this.persistence.checkpoint(); },
      settleContracts: () => this.settleContracts(),
      resetContractSelection: () => { this.contracts_.selected = 0; },
    };
  }

  /** The station decides; the Game says it. Same shape as applyStep. */
  private applyStation(events: readonly StationEvent[]): void {
    for (const e of events) {
      if (e.kind === 'sound' || e.kind === 'countdown' || e.kind === 'dockingMusic') {
        this.playSound(e);
        continue;
      }
      switch (e.kind) {
        case 'message': this.sayEvent(e); break;
        case 'persistence':
          if (e.action === 'forgetFlight') this.persistence.forgetFlight();
          else this.persistence.checkpoint();
          break;
        case 'presentation':
          if (e.action === 'releaseMouseFlight') this.input.releaseMouseFlight();
          else if (e.action === 'tunnel') this.tunnel.start(1.4, e.way);
          else if (e.screen === 'docked') {
            renderDockedMenu(this.system, this.state.commander, this.station.missionText());
          } else {
            hideScreen();
          }
          break;
      }
    }
  }

  /** @internal — driven by test/playtest.js */
  enterDocked(arrival: DockArrival = 'arrived'): void {
    // Once per commander, whatever brought them here: a fresh boot, a real
    // docking, or a restored save from before the marker existed. The marker
    // moves BEFORE the dock so an 'arrived' checkpoint persists it in the same
    // act; the other arrivals write nothing here (docs/TODO/43/45), so theirs
    // rides the next ordinary save. Opening counts as shown — abandoning the
    // briefing must not trap a player in an onboarding loop, and H is the
    // permanent way back (docs/TODO/106).
    const brief = this.state.commander.briefingSeen < BRIEFING_VERSION;
    if (brief) this.state.commander.briefingSeen = BRIEFING_VERSION;
    this.applyStation(this.station.dock(arrival));
    if (brief) this.screens.open('briefing');
    // ...and the question the station will not proceed without an answer to,
    // pushed LAST so it is on TOP (docs/TODO/127). Both can be due at once — a
    // save from before the briefing marker, restored with somebody aboard — and
    // the order is decided here rather than left to whichever happens to open:
    // the forced choice is what is holding the clearance up, and the briefing
    // is reading matter that will still be there behind it.
    if (this.state.commander.survivors > 0) this.screens.open('survivors');
  }

  /**
   * @internal — the same act the NAME YOUR COMMANDER prompt performs, for a
   * driver with no keyboard. It forwards and nothing else: what the act IS
   * lives in `startNewCommander`, and what a player is TOLD when it fails lives
   * in the screen that asked them.
   * @returns false when the boot pointer would not move, so nothing happened.
   */
  newCommanderGame(name: string): boolean {
    return startNewCommander(this.savesContext(), name);
  }

  openSaves(): void {
    this.screens.open('saves');
  }

  /** Download this commander as a JSON file (portable saves, bug reports). */
  private exportSave(): void {
    exportSaveFile(this.savesContext());
  }

  private importSave(): void {
    // The reason comes back from the importer, which is the only thing that
    // knows which of them it was — not a save, not this build's save, or no
    // room for it (save-transfer.ts).
    importSaveFile(this.savesContext(), (why) => {
      this.showMessage(why, 4);
      sfx.refused();
    });
  }

  /** The only slice of the Game the saves screens are allowed to see. */
  private savesContext(): SavesContext {
    return {
      commander: this.state.commander,
      systems: this.state.systems,
      career: this.state.career,
      dead: this.baseMode === 'dead',
      message: (text, seconds) => this.showMessage(text, seconds),
      capture: () => this.persistence.capture(),
      checkpoint: () => this.persistence.checkpoint(),
      saveNamed: (name) => this.persistence.saveNamed(name),
    };
  }

  /**
   * What saving and restoring a world may ask of the Game.
   *
   * The same shape and the same reason as `stepHost()`: an object literal, so
   * the methods behind it stay private and this list IS the surface. Four of
   * the six are the mode machine and the scene rebuild, which are the two
   * things a snapshot cannot put back by assignment.
   */
  private persistenceHost(): PersistenceHost {
    return {
      baseMode: () => this.baseMode,
      enterMode: (mode) => {
        this.baseMode = mode;
        this.screens.exit();
        // 'resumed', and the word is load-bearing: `restore` has already put
        // this station's market and bulletin board back, and a dock that rolls
        // over them is a reload-to-reroll exploit (docs/TODO/46).
        if (mode === 'docked') this.enterDocked('resumed');
        else hideScreen();
      },
      buildWorld: () => this.buildWorld(),
      enterWitchspace: () => this.enterWitchspace(),
      // `baseMode`, NOT `mode`: after a death a screen CAN be open (the
      // game-over panel offers the commander file), and reading `mode` would
      // then find `'saves'` and write a checkpoint of the wreck over the
      // station the player is about to go back to.
      isDead: () => this.baseMode === 'dead',
      message: (text, seconds) => this.showMessage(text, seconds),
      writeDockSave,
      writeFlightSave,
      writeNamedSave: (name, career, world) =>
        writeNamedSave(name, career, world, MAX_NAMED_SAVES),
      bootWorld: () => bootSave()?.record.world ?? null,
      clearFlightSaves,
      withoutSaving,
    };
  }

  /** @internal — driven by test/playtest.js and the console harnesses */
  captureSnapshot(): WorldSnapshot { return this.persistence.capture(); }

  /** @internal — driven by test/playtest.js and the console harnesses */
  restoreSnapshot(snap: WorldSnapshot): void { this.persistence.restore(snap); }

  private autoSave(): void { this.persistence.autoSave(); }

  private resumeSavedWorld(): boolean { return this.persistence.resume(); }


  /** @internal — driven by test/playtest.js */
  launch(): void {
    this.applyStation(this.station.launch());
  }

  /** @internal — driven by test/playtest.js */
  lookAlong(dir: THREE.Vector3): void {
    // Matrix4.lookAt uses camera convention: -Z (our nose) points at target.
    this.tmpM.lookAt(ZERO, dir, UP);
    this.state.player.quaternion.setFromRotationMatrix(this.tmpM);
  }

  private die(reason: string): void {
    if (this.mode === 'dead' || this.mode === 'docked') return;
    // A death in the simulator ends the SIMULATION, not the career. The
    // exercise's own StepHost already redirects this, so no path reaches here
    // with one running — but the next line deletes the in-flight ring, so it is
    // worth being unreachable twice over.
    if (this.combatSim.active) { this.combatSim.quit(); return; }
    // The in-flight autosaves must not outlive the ship, or a reload would
    // resume the snapshot from seconds before the death. The DOCKED checkpoint
    // survives: it is the way back, and what the game-over screen offers.
    this.persistence.forgetFlight();
    sfx.explosion();
    this.state.world.effects.explosion(this.state.player.position.clone(), 0xff8866);
    if (this.state.commander.equipment.escapePod) {
      // the pod gets you to the local station; ship and cargo are gone
      this.state.commander.equipment.escapePod = false;
      this.state.commander.cargo = this.state.commander.cargo.map(() => 0);
      this.enterDocked();
      this.showMessage('ESCAPE POD DEPLOYED — CARGO LOST', 6);
      return;
    }
    this.baseMode = 'dead';
    this.showMessage(reason, 6);
    renderGameOver(this.state.commander, checkpointSummary(this.savesContext()));
  }

  /**
   * Ask whether to give up on this flight — but only with the world stopped.
   *
   * The gate is PAUSE, and it is the whole point of the key's shape: giving up
   * a flight is a deliberate act, and requiring the world to be stopped first
   * makes it two decisions rather than one mistyped letter. `WHILE_PAUSED` is
   * what lets Q reach this handler at all while paused; this is what refuses it
   * the rest of the time.
   *
   * It SAYS SO rather than doing nothing. A bound key that appears dead is a
   * bug report, and the same refusal answers a Q pressed during the launch
   * tunnel, where nothing is paused either.
   */
  private quitFlight(): void {
    if (!this.state.session.paused) {
      this.showMessage(
        `PAUSE FIRST — ${boundKey('flight', 'togglePause')},`
        + ` THEN ${boundKey('flight', 'quitFlight')} TO QUIT THE FLIGHT`, 3);
      sfx.refused();
      return;
    }
    this.screens.open('quit');
  }

  /**
   * Give up on this flight and take the way back — the confirmed half of
   * `screens/quit.ts`.
   *
   * `forgetFlight` FIRST, and it is the same first move `die()` makes: the
   * in-flight ring must not outlive the flight it recorded, or the next boot
   * would resume the run that was just abandoned. `clearFlightSaves` re-aims
   * the boot pointer at the checkpoint on its way past, which is what makes the
   * `respawn()` below land on the station rather than on a guess.
   *
   * It costs what dying costs because it lands where dying lands. That is the
   * whole reason it can be offered to every pilot rather than only to a marked
   * career: there is nothing to gain by quitting that flying home would not
   * have paid better.
   */
  abandonFlight(): void {
    this.persistence.forgetFlight();
    this.respawn();
    this.showMessage('FLIGHT ABANDONED', 4);
  }

  /**
   * Take the way back: this career's docked checkpoint, whole.
   *
   * A full world restore rather than a commander reload, because the checkpoint
   * IS a world — written on docking and again immediately before launch, so it
   * puts the ship back at the station it left with what it left with.
   *
   * @internal — driven by test/playtest.js
   */
  respawn(): void {
    this.combatComputer.reset();
    this.state.chart.targetIndex = null;
    this.state.session.witchspace = false;
    if (this.persistence.resume()) return;
    // Nothing to come back to — a career that has never docked. Boot as the
    // first launch did.
    this.state.commander = bootCommander();
    // The loaded commander may name a DIFFERENT galaxy than the one we died in,
    // so `systems` and the living galaxy are rebuilt from it — otherwise every
    // `get system()` lookup reads the wrong star.
    this.state.systems = generateGalaxy(this.state.commander.galaxy);
    this.state.living = new LivingGalaxy(this.state.systems);
    this.loadOrWarmGalaxy();
    this.buildWorld();
    // 'fresh', not 'resumed': there was no checkpoint to come back to, so
    // nothing has stocked this station and `bootCommander` brought no market.
    this.enterDocked('fresh');
  }

  // --- contracts (station bulletin board) ----------------------------------

  /**
   * Work on offer here today. Deliberately generous compared to the original,
   * which gated missions behind a high combat rating — a new commander should
   * always have somewhere to be.
   * @internal — driven by test/playtest.js
   */
  generateContractOffers(): Contract[] {
    return generateContractOffers(this.system, this.state.systems, this.state.commander.day);
  }

  /**
   * The bulletin board decides; the Game says it and plays its named sound.
   *
   * Messages come back as StationEvents rather than going straight to the HUD
   * because docking says several things in a row and the last one is the one
   * the player reads — see station.ts.
   *
   * ...and the consequences the pure module cannot reach: landing a smuggling
   * run raises the destination's temperature, which is `LivingGalaxy` state
   * `settleContracts` has no handle on. The module decides, the orchestrator
   * applies (invariant 15). ONE application per event, here and at the
   * campaign's own settle site — the dock path in station.ts must not add a
   * second, which would double the heat of every delivery.
   */
  private applyContracts(events: readonly ContractEvent[]): StationEvent[] {
    return events.flatMap((e): StationEvent[] => {
      if (e.kind === 'paid' && e.contract.kind === 'smuggle') {
        this.state.living.addNotoriety(
          e.contract.destination, e.contract.qty * SMUGGLE_DELIVERY_NOTORIETY);
      }
      const m = contractMessage(e, this.state.systems);
      return [
        ...(m.sound ? [{ kind: 'sound' as const, name: m.sound }] : []),
        { kind: 'message', text: m.text, seconds: m.seconds, queued: m.queued },
      ];
    });
  }

  /** @internal — driven by test/playtest.js */
  acceptContract(): void {
    const events = acceptContract(
      this.state.commander, this.state.contractOffers, this.contracts_.selected);
    if (events.some((e) => e.kind === 'accepted')) {
      this.contracts_.selected = Math.max(0, this.contracts_.selected - 1);
    }
    this.applyStation(this.applyContracts(events));
  }

  /**
   * What the two dirty answers pay here: the station's own Slaves quote, read
   * off the market this dock rolled rather than priced again (docs/TODO/127).
   */
  private survivorOffers(): { sale: number; release: number } {
    return survivorOffers(
      this.state.commander.survivors, this.state.market[SLAVES]?.price ?? 0);
  }

  /**
   * The survivors rule decides; the Game says it (docs/TODO/127).
   *
   * Same shape as `applyContracts` and for the same reason: `survivors.ts` is
   * pure, and everything a choice touches outside the commander — the console,
   * and in M3 the region's heat and the Government's opinion — lands here.
   */
  private answerForSurvivors(choice: SurvivorChoice): void {
    const c = this.state.commander;
    const before = c.disrepute ?? 0;
    const e = resolveSurvivors(c, choice, this.survivorOffers());
    if (!e) return;
    // The law and the region first, so the SALE has the console after them:
    // `raiseLegal` says LEGAL STATUS as it moves the record, and the line the
    // player needs to read is the one explaining what they just did.
    if (e.kind === 'sold') {
      this.state.living.addNotoriety(c.systemIndex, e.heat);
      this.raiseLegal(e.offence);
    }
    this.showMessage(survivorMessage(e), 4);
    // ...then what the record now means, and what it did to your name — both
    // queued behind the receipt that caused them (docs/TODO/122, docs/TODO/129).
    // `recordVerdict` rather than a second sentence about being an Offender:
    // police hunt Fugitives, so a sale leaves you walking out unmolested, and
    // the console has to say who DOES come.
    if (e.kind === 'sold') this.queueMessage(recordVerdict(c.legalStatus), SCAN_LINE_SECONDS);
    this.markName(before, c.disrepute ?? 0);
  }

  /** Pay out anything delivered here; drop anything overdue. */
  private settleContracts(): StationEvent[] {
    return this.applyContracts(settleContracts(this.state.commander));
  }


  /** @internal — driven by test/playtest.js */
  startHyperspace(): void {
    // The simulator is a room at the station, not a place you can leave: the
    // exercise's StepHost refuses `completeHyperspace` anyway, so without this
    // the countdown would run and then silently do nothing.
    if (this.combatSim.active) {
      this.showMessage('HYPERSPACE IS OFFLINE IN THE SIMULATOR', 3);
      sfx.refused();
      return;
    }
    const check = checkJump(this.state.commander, this.state.systems, this.state.chart.targetIndex,
      this.state.session.witchspace, this.state.session.hyperCountdown >= 0,
      // JUMP ANYWHERE (docs/TODO/121): the flag goes IN, and the refusal stays
      // where it was decided. Nothing here reads the tank.
      this.state.cheat);
    if (!check.ok) {
      if (check.reason === 'alreadyJumping') return;
      this.showMessage(refusalMessage(check.reason, this.state.session.witchspace), 4);
      sfx.refused();
      return;
    }
    this.state.session.hyperCountdown = COUNTDOWN;
    this.showMessage(`HYPERSPACE IN ${COUNTDOWN}`, 1.2);
    sfx.countdown(COUNTDOWN);
  }

  private completeHyperspace(): void {
    const target = this.state.chart.targetIndex!;
    const jump = resolveJump(this.state.commander, this.state.systems, target, this.state.session.witchspace);
    if (jump.misjump) {
      this.enterWitchspace(); // target retained for the escape jump
      return;
    }
    this.state.living.advance(jump.days, COMMODITIES.map((c) => c.gradient));
    // the galaxy forgets a little on the way — a jump is days of honest
    // distance, and falling back down a rung is the one piece of good news the
    // character system has, so it is said too (docs/TODO/129)
    const wasNamed = this.state.commander.disrepute ?? 0;
    this.state.commander.disrepute = afterDecay(wasNamed, jump.days);
    this.markName(wasNamed, this.state.commander.disrepute);
    this.state.chart.targetIndex = null;
    this.arriveInSystem();
    this.showMessage(`ARRIVED: ${this.system.name.toUpperCase()}`, 4);
  }

  /** @internal — driven by test/playtest.js */
  arriveInSystem(): void {
    // Seed the world from WHERE and WHEN you are, so a given save arriving in
    // a given system on a given day meets the same reception twice. Without
    // this the fixed timestep buys repeatable physics and nothing else.
    seedWorld(this.state.commander.galaxy * 0x9e3779b1
      ^ (this.state.commander.systemIndex << 8) ^ this.state.commander.day);
    this.state.session.witchspace = false; // any arrival leaves witch-space (incl. galactic jump)
    this.buildWorld();
    // Arrive at the witchpoint, well out — the classic long torus cruise in.
    // Bearing is biased to the station's side of the planet (~30° cone) so
    // the planet never blocks the run.
    const stationDir = this.state.world.station.position.clone().normalize();
    const dir = stationDir
      .add(randomDirection(new THREE.Vector3()).multiplyScalar(0.5))
      .normalize();
    this.state.player.position.copy(dir.multiplyScalar(this.state.world.planetRadius * WITCHPOINT_RADII));
    this.lookAlong(this.tmp.copy(this.state.player.position).negate());
    this.state.player.speed = 250;
    this.state.session.policeScanned = false;
    this.state.encounterTimers = freshTimers();
    this.populateSystem('arrival');
    sfx.hyperspace();
    this.tunnel.start(1.1);
  }

  // --- combat --------------------------------------------------------------

  /** Direction the current view faces, in world space. The maths is the step's. */
  private viewDir(out: THREE.Vector3): THREE.Vector3 {
    return viewDirection(this.state.player.quaternion, this.state.session.view, out);
  }

  /**
   * Anything close enough to hold the torus drive down.
   *
   * @internal — driven by test/playtest.js and train/jameson-autopilot.js
   */
  massLocked(): boolean { return massLocked(this.state); }

  /** @internal — driven by test/playtest.js */
  raiseLegal(level: number): void {
    if (level <= CLEAN) return;   // shooting a pirate is nobody's business
    if (this.state.commander.legalStatus < level) {
      this.state.commander.legalStatus = level;
      this.showMessage(`LEGAL STATUS: ${LEGAL_NAMES[level].toUpperCase()}`, 3);
    }
    this.callStationDefence();
  }

  /**
   * Buy your name back at the station — the optional half of the law.
   *
   * Docking no longer clears your record (station.ts); this is the choice that
   * does. `recordCleared` (law.ts) owns the rule — the fine, capped at what you
   * can pay — and this applies it and announces it.
   */
  private payFine(): void {
    const c = this.state.commander;
    const cleared = recordCleared(c.legalStatus, c.credits);
    if (!cleared) {
      this.showMessage('RECORD CLEAN — NO FINE DUE', 3);
      return;
    }
    c.credits = cleared.creditsLeft;
    c.legalStatus = CLEAN;
    this.showMessage(`FINE PAID: ${formatCredits(cleared.paid)} — RECORD CLEAR`, 4);
  }

  /**
   * Stations keep "a small fleet of ships for their own defence, which they
   * may risk to assist a trader if they see him attacked" — misbehave in
   * sight of the station and Vipers launch from the slot.
   */
  private callStationDefence(): void {
    // ...MISBEHAVE, which means in the sky. `raiseLegal` is reachable from the
    // station now — selling a survivor is an offence filed over a counter
    // (docs/TODO/127 M3) — and a docked ship is parked INSIDE the range test
    // below, so without this the sale would scramble Vipers into a world the
    // player is not in and cannot see. The record still moves; the fleet is
    // what waits until there is a ship to launch at.
    if (this.baseMode !== 'flight') return;
    if (this.state.session.witchspace || this.state.session.defenceLaunched) return;
    if (this.state.player.position.distanceTo(this.state.world.station.position) > DEFENCE_RANGE) return;
    this.state.session.defenceLaunched = true;
    launchStationDefence(this.state.world, this.tmp);
    this.showMessage('STATION DEFENCE LAUNCHED', 4);
    sfx.stationDefenceLaunched();
  }

  /**
   * Pull the trigger. The arguments are built from the state by combat.ts, so
   * the same gun can be fired against a state that is not this Game's; what
   * lands on the HUD and in the law is what makes this one the Game's.
   *
   * @internal — driven by test/playtest.js
   */
  fireLaser(): void {
    this.applyCombat(firePlayerLaser(this.state, this.combat, this.combatScratch));
  }

  /** Destruction credited to the player. @internal — driven by test/playtest.js */
  destroyNpc(npc: NpcShip): void {
    // The ENERGY BOMB reaches this from runCommand rather than through the step,
    // so it is the one kill an exercise cannot see through its own StepHost. An
    // exercise credits its clone and its record instead (see combat-sim.ts).
    if (this.combatSim.active) { this.combatSim.destroyNpc(npc); return; }
    this.applyCombat(this.combat.destroy(this.state.commander, npc));
  }

  /** Removal with no credit — an NPC-vs-NPC kill, or a collision. */
  private wreckNpc(npc: NpcShip): void {
    this.applyCombat(this.combat.wreck(npc));
  }

  /**
   * The player takes a hit.
   *
   * `source` says what did it. Mechanics treat every source the same, but the
   * explicit CombatObserver seam records the fact without replacing this
   * method at runtime.
   */
  private applyPlayerDamage(
    amount: PlayerPoolPoints, from: THREE.Vector3, source: DamageSource): void {
    // the co-pilot's own record that the commander is being hit, kept live end
    // to end so evasive behaviour can read it (scripted-co-pilot.ts)
    this.autopilot.noteUnderFire();
    this.hud.flashDamage();
    this.applyCombat(damagePlayer(this.state, this.combat, amount, from, this.combatScratch));
    this.combatInstrumentation.playerDamaged(amount, from, source);
  }

  /**
   * Combat decides; the Game pays. Every consequence that reaches outside the
   * world — the HUD, the law, the missile lock, the death screen — lands here.
   */
  private applyCombat(events: readonly CombatEvent[]): void {
    for (const e of events) {
      if (e.kind === 'sound' || e.kind === 'countdown' || e.kind === 'dockingMusic') {
        this.playSound(e);
        continue;
      }
      switch (e.kind) {
        case 'message': this.sayEvent(e); break;
        case 'offence': this.raiseLegal(e.level); break;
        case 'wrecked': if (this.ordnance.targetLock === e.npc) this.ordnance.targetLock = null; break;
        case 'beam': this.aimBeams(e.at); break;
        case 'fired': this.state.session.beamTimer = BEAM_FLASH; break;
        case 'breach': this.damageSomething(); break;
        case 'died': this.die(e.reason); break;
      }
    }
  }

  /** A hull hit destroys a tonne of cargo, or knocks out a fitting. */
  private damageSomething(): void {
    const lost = breachLoss(this.state.commander, random);
    if (lost.kind === 'cargo') {
      const c = COMMODITIES[lost.commodity];
      this.showMessage(`CARGO LOST: 1${c.unit} ${c.name.toUpperCase()}`, 3);
      sfx.cargoLost();
    } else if (lost.kind === 'equipment') {
      // Losing ANY fitting hands control back: a hit hard enough to knock out
      // equipment is a moment the player should be flying.
      this.state.session.ccEngaged = false;
      this.showMessage(`${lost.name} DESTROYED`, 4);
      sfx.equipmentDestroyed();
    }
  }

  // --- the ship's autopilots -----------------------------------------------

  /**
   * The autopilots decide; the Game says it and plays it. Same shape as
   * applyStep and applyStation — and the sounds are events here because that
   * is what keeps autopilot.ts clear of audio.ts, and therefore node-safe.
   */
  private applyAutopilot(events: readonly AutopilotEvent[]): void {
    for (const e of events) {
      if (e.kind === 'message') this.sayEvent(e);
      else this.playSound(e);
    }
  }

  /**
   * The ONE place a `SoundEvent` becomes a noise.
   *
   * Both the world step and the autopilots return them (sounds.ts), and both
   * `apply*` end up here rather than carrying a switch each — two near-identical
   * `beep` arms in two switches is how a rule grows a second home.
   */
  private playSound(e: SoundEvent): void {
    switch (e.kind) {
      case 'countdown': sfx.countdown(e.n); break;
      case 'dockingMusic':
        if (e.on) sfx.dockingMusic();
        else sfx.stopDockingMusic();
        break;
      case 'sound': sfx[e.name](); break;
    }
  }

  private dockingComputer(): void {
    this.applyAutopilot(this.autopilot.toggleDocking());
  }

  /** @internal — driven by test/playtest.js */
  toggleCombatComputer(): void {
    this.applyAutopilot(this.autopilot.toggleCombat());
  }

  /**
   * Stranded in witch-space without the fuel to jump clear: GalCop will come
   * for you, at a price — your cargo pays the salvage fee.
   */
  sendDistressBeacon(): void {
    if (!this.state.session.witchspace) {
      this.showMessage('DISTRESS BEACON IS FOR EMERGENCIES ONLY', 3);
      sfx.refused();
      return;
    }
    if (this.state.session.beaconTimer >= 0) {
      this.showMessage('BEACON ALREADY BROADCASTING', 2);
      return;
    }
    this.state.session.beaconTimer = 20;
    this.showMessage('DISTRESS BEACON BROADCAST — HOLD ON, COMMANDER', 6);
    sfx.distressBeacon();
  }

  private completeRescue(): void {
    const c = this.state.commander;
    const salvage = c.cargo.reduce((s, q) => s + q, 0);
    c.cargo = c.cargo.map(() => 0);
    // enough for one jump clear, which is what the escape costs — the same
    // number the step's stranded hint is offered below.
    c.fuel = Math.max(c.fuel, WITCHSPACE_ESCAPE_COST);
    this.state.session.beaconTimer = -1;
    // dumped at the nearest system to where the mis-jump left us
    const target = this.state.chart.targetIndex ?? c.systemIndex;
    c.systemIndex = target;
    c.day += 3; // the tow takes a while
    this.state.living.advance(3, COMMODITIES.map((cm) => cm.gradient));
    const wasNamed = c.disrepute ?? 0;
    c.disrepute = afterDecay(wasNamed, 3);
    this.markName(wasNamed, c.disrepute);
    this.state.chart.targetIndex = null;
    this.state.session.witchspace = false;
    this.arriveInSystem();
    this.showMessage(
      salvage > 0
        ? `RESCUED — ${salvage}t OF CARGO TAKEN AS SALVAGE`
        : 'RESCUED — NOTHING ABOARD WORTH TAKING',
      6);
  }

  /**
   * One-shot jump to the next galaxy; lands at the nearest system to our coords.
   *
   * @internal — driven by test/prewarm.test.ts. Public for the same reason
   * `respawn` and `launch` are: ⇧H needs a shift HELD, which `Input` only
   * learns from a real keydown, so a headless test cannot press it. The
   * binding itself is pinned in test/ui.test.ts.
   */
  galacticJump(): void {
    const may = checkGalacticJump(this.state.commander, this.combatSim.active);
    if (!may.ok) {
      this.showMessage(galacticRefusalMessage(may.reason), 3);
      sfx.refused();
      return;
    }
    const jump = resolveGalacticJump(this.state.commander, this.system);
    this.state.systems = jump.systems;
    // A NEW GALAXY BRINGS ITS OWN ECONOMY (docs/TODO/117). Keeping the old
    // `LivingGalaxy` across the jump left galaxy 2's system 7 wearing galaxy
    // 1's Lave danger and price pressure, and every convoy in the list flying
    // between two systems it had never departed or been bound for. The state is
    // per-galaxy, so it is rebuilt with the systems it describes — and warmed,
    // because a galaxy arrived at has no more been standing still than the one
    // left behind. The saved deltas describe the galaxy just left, so they are
    // not reloaded here; the next checkpoint writes these over them.
    this.state.living = new LivingGalaxy(this.state.systems);
    prewarm(this.state.living, this.freshGalaxySeed());
    this.state.chart.targetIndex = null;
    this.arriveInSystem();
    this.showMessage(
      `GALAXY ${jump.galaxy} — ${this.system.name.toUpperCase()}`, 5);
  }

  // --- per-frame -----------------------------------------------------------

  /**
   * One simulation step and one frame drawn.
   *
   * A single call because the console harnesses drive the game with it
   * (test/playtest.js, test/gang-trial.js); the real loop separates them and
   * steps a FIXED dt however long the frame took.
   * @internal — driven by test/playtest.js
   */
  update(dt: number, elapsed: number): void {
    this.step(dt, elapsed);
    this.draw(dt);
  }

  /**
   * Advance the world by exactly `dt`.
   *
   * Draws nothing and reads no clock. Everything about the world that can
   * change lives downstream of this call, which is what makes a fixed
   * timestep worth having: the same inputs and the same seed produce the same
   * outcome regardless of frame rate.
   */
  step(dt: number, elapsed: number): void {
    tickMessage(this.state.session, dt);
    // Flight is the only state that can be paused. While it is paused, route
    // input through the same command table as any other frame, but apply only
    // what a paused cockpit answers — controls.ts's WHILE_PAUSED.
    if (this.mode !== 'flight') this.state.session.paused = false;
    if (this.state.session.paused) {
      this.handleInput(dt, true);
      if (this.state.session.paused) {
        this.showMessage(this.pausedHint(), 0.4);
        this.finishStep(dt);
        return;
      }
    }
    if (!this.tunnel.active) this.handleInput(dt);
    else this.handleInput(dt, true);
    if (this.state.session.paused) {
      this.showMessage(this.pausedHint(), 0.4);
      this.finishStep(dt);
      return;
    }
    this.tunnel.update(dt);
    if (this.mode === 'flight') this.updateFlight(dt, elapsed);
    this.finishStep(dt);
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
   */
  private pausedHint(): string {
    return `PAUSED — ${boundKey('flight', 'togglePause')} TO RESUME`
      + ` · ${boundKey('flight', 'quitFlight')} TO QUIT THE FLIGHT`;
  }

  /**
   * Finish every fixed step after its commands and world events have applied.
   * The beam ages at the tail of the step, so a shot fired this step keeps its
   * ordering while display cadence stays irrelevant to canonical state.
   */
  private finishStep(dt: number): void {
    this.input.endFrame();
    tickBeam(this.state.session, dt);
  }

  /** Put the current world on screen. Changes nothing about it. */
  draw(dt: number): void {
    this.render.camera.position.copy(this.state.player.position);
    this.render.camera.quaternion.copy(this.state.player.quaternion).multiply(VIEW_QUATS[this.state.session.view]);
    this.render.beams.visible = this.state.session.beamTimer > 0;
    this.render.draw();
    this.renderHud(dt);
  }

  /**
   * One frame of flight: produce a demand, advance the world, apply what it
   * reports.
   *
   * The five phases live in world-step.ts. What is left here is the two things
   * the world cannot do for itself: read the hands at the controls, and say
   * things out loud.
   */
  private updateFlight(dt: number, elapsed: number): void {
    const demand = this.pilotDemand(dt);
    const pilot = { demand, handsOn: this.handsOn() };

    // WHICH step. An exercise is ordinary flight with a different StepHost
    // behind it (combat-sim.ts), and its teardown is DEFERRED — `settle()` puts
    // the career back HERE, after the step has returned, because restoring from
    // inside `stepNpcs` would rebuild the scene while the step was still
    // iterating over it.
    if (this.combatSim.active) {
      this.applyStep(this.combatSim.tick(dt, elapsed, pilot));
      this.combatSim.settle();
    } else {
      this.applyStep(this.worldStep.step(dt, elapsed, pilot));
    }

    // The dust is seen, never simulated — updated out here, from wherever the
    // step left the ship. It needs our actual velocity to streak: the torus
    // drive multiplies travel by `TORUS_MULTIPLIER`. Read from the drive rather
    // than written out again, so the streaks cannot disagree with the physics.
    this.dust.update(
      this.state.player.position,
      this.state.player.getForward(this.tmp).multiplyScalar(this.state.player.speed
        * (this.state.session.torusEngaged && !this.massLocked() ? TORUS_MULTIPLIER : 1)),
    );
  }

  /**
   * The step decides; the Game says it and plays it. Same shape as applyCombat,
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
      if (e.kind === 'message') this.sayEvent(e);
      else if (e.kind !== 'npcFired' && e.kind !== 'playerDealt') this.playSound(e);
    }
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
    const auto = defenceBrainNameFor(this.state.brains) === 'attack-run'
      ? this.autopilot.combatSteer(dt, this.handsOn(), this.ordnance.hostileMissilePos)
      : this.autopilot.combatDemand(
        dt, this.handsOn(), defenceBrain(this.state.brains), this.ordnance.hostileMissilePos);
    this.applyAutopilot(auto.events);
    // A co-pilot that can answer a warhead — the same button, the same price
    // and the same messages as the player's own E.C.M. key (docs/TODO/72). It
    // is applied here rather than inside the autopilot because spending the
    // bank is a consequence, and consequences are the orchestrator's.
    if (auto.ecm) this.triggerEcm();
    return auto.demand
      ? { ...auto.demand, fire: auto.demand.fire || hands.fire }
      : hands;
  }


  /**
   * Hermits deal in ore and ask no questions — the one place to sell
   * contraband without a police scan, at the cost of finding them.
   */
  /** @internal — driven by test/playtest.js */
  openHermitTrade(): void {
    this.state.session.hermitTrading = true;
    // what the miner charges is a price rule, and price rules live in
    // contracts.ts so the headless campaign can reach them (invariant 10)
    // What the miner charges depends on who is asking: a known smuggler gets
    // mates' rates (docs/TODO/96). Whether he opens the door at all was decided
    // before this — `world-step.ts` never calls this for a refused pilot.
    this.state.hermitMarket = hermitMarket(this.system, this.state.commander.disrepute ?? 0);
    this.state.market = this.state.hermitMarket;

    // ONE push, because `open()` already renders — a second push would stack
    // the same screen twice and leave one Escape short of flight. `Game.mode`
    // is DERIVED from the stack.
    this.screens.open('market');
    this.baseMode = 'flight';
    this.state.player.speed = 0;
    sfx.dock();
  }



  // --- input ---------------------------------------------------------------

  /**
   * Read the controls, and do what they asked for.
   *
   * The bindings are a table in controls.ts and the consequences are
   * `runCommand` below — the same decides/applies split as the world step and
   * the station, applied to the keyboard. What is left here is the routing
   * that genuinely belongs to the orchestrator: the help panel is global, the
   * screen stack gets first refusal, and only then does the base state get the
   * frame.
   */
  private handleInput(dt: number, pausedOnly = false): void {
    const i = this.input;
    if (!pausedOnly) {
      for (const c of globalCommands(i)) this.runCommand(c);

      // The `?` guide is topmost (docs/TODO/106): while it is open, nothing
      // below it reads the keyboard, so a letter cannot operate the screen it
      // is covering. Escape closes the guide instead of that screen; every
      // other tap goes unread and is dropped at endFrame, not banked for the
      // screen underneath.
      if (this.helpOpen) {
        if (i.pressed('Escape')) this.runCommand('toggleHelp');
        return;
      }

      // The host runs the menu cursor and gives the frame to the top screen.
      // Every overlay has migrated to the Screen contract, so if one is open it
      // handles the frame and we are done — what is left below is the three
      // states that are NOT screens.
      if (this.screens.update(i, dt)) return;
    }

    const mode = this.controlMode();
    if (!mode) return;
    for (const c of commandsFor(mode, i)) {
      if (!pausedOnly || WHILE_PAUSED.includes(c)) this.runCommand(c);
    }
  }

  /**
   * Which binding table is live.
   *
   * Null while a screen is open — `mode` is then that screen's id, and a screen
   * owns its own keys (invariant 13), so no cockpit table applies. Reachable
   * only on the paused path, where `handleInput` skips the screen stack;
   * ordinarily `screens.update()` has already taken the frame and returned.
   */
  private controlMode(): ControlMode | null {
    if (this.mode === 'docked') return this.pendingNewGame ? 'confirmNewGame' : 'docked';
    // An exercise is ordinary flight with a different StepHost, so it is the
    // same mode to the world and a different TABLE to the keyboard: no
    // hyperspace, no beacon, no jettison, no docking computer — and Escape or Q
    // ends it (controls.ts, NOT_IN_THE_SIMULATOR).
    if (this.mode === 'flight') return this.combatSim.active ? 'simulator' : 'flight';
    if (this.mode === 'dead') return 'dead';
    return null;
  }

  /**
   * Every command, as data.
   *
   * A `Record<Command, ...>` rather than a switch, so the compiler REFUSES a
   * Command with no entry — a lookup has no branches and no case can silently
   * fall through.
   *
   * Deliberately one-liners: anything longer belongs in the module that owns
   * the rule. This is the whole surface a replay, an AI or a test drives the
   * game through — the same one a pair of hands does, via controls.ts.
   */
  private readonly commands: Record<Command, () => void> = {
    // --- global -----------------------------------------------------------
    toggleHelp: () => { this.helpOpen = !this.helpOpen; this.shell.toggleHelp(); },
    // --- the station menu -------------------------------------------------
    launch: () => this.launch(),
    openMarket: () => this.screens.open('market'),
    openContracts: () => this.screens.open('contracts'),
    openEquip: () => this.screens.open('equip'),
    openBriefing: () => this.screens.open('briefing'),
    openSaves: () => this.openSaves(),
    openSystemData: () => this.openSystemData(this.system, 'docked'),
    openCombatSim: () => this.screens.open('combat-sim'),
    openTestMode: () => this.screens.open('test-mode'),
    payFine: () => this.payFine(),
    exportSave: () => this.exportSave(),
    importSave: () => this.importSave(),
    toggleLayout: () => this.switchLayout(),
    // --- putting a commander down -----------------------------------------
    askNewGame: () => {
      this.pendingNewGame = true;
      renderNewGameConfirm(this.system, this.state.commander);
    },
    // The panel has said what will happen; the last thing it needs is a name,
    // and the name IS the new commander's identity (screens/new-commander.ts).
    // Dropping the pending flag first means ESC out of the prompt lands back on
    // the docked menu rather than on a confirmation already answered.
    newGame: () => {
      this.pendingNewGame = false;
      this.screens.open('new-name');
    },
    cancelNewGame: () => {
      this.pendingNewGame = false;
      renderDockedMenu(this.system, this.state.commander, this.station.missionText());
    },
    // --- shared between the menu and the cockpit --------------------------
    openChart: () => this.openChart(this.cameFrom()),
    openLocalChart: () => this.openLocalChart(this.cameFrom()),
    openStatus: () => this.openStatus(this.cameFrom()),
    // --- the cockpit ------------------------------------------------------
    view0: () => this.setView(0),
    view1: () => this.setView(1),
    view2: () => this.setView(2),
    view3: () => this.setView(3),
    armMissile: () => this.armMissile(),
    launchMissile: () => this.launchMissile(),
    disarmMissile: () => this.disarmMissile(),
    fireEcm: () => this.triggerEcm(),
    detonateEnergyBomb: () => this.detonateEnergyBomb(),
    toggleCombatComputer: () => this.toggleCombatComputer(),
    toggleDockingComputer: () => this.dockingComputer(),
    toggleMouseFlight: () => this.toggleMouseFlight(),
    toggleTorus: () => this.toggleTorus(),
    togglePause: () => { this.state.session.paused = !this.state.session.paused; },
    startHyperspace: () => this.startHyperspace(),
    galacticJump: () => this.galacticJump(),
    distressBeacon: () => this.sendDistressBeacon(),
    quitFlight: () => this.quitFlight(),
    jettison1: () => this.jettisonCargo(1),
    jettison5: () => this.jettisonCargo(5),
    jettisonContraband: () => this.jettisonContraband(1),
    bribePolice: () => this.bribePolice(),
    // --- the training simulator -------------------------------------------
    endExercise: () => this.endExercise(),
    // --- after the end ----------------------------------------------------
    respawn: () => this.respawn(),
  };

  private runCommand(c: Command): void {
    this.commands[c]();
  }


  /**
   * Where an overlay was opened from, so Escape puts the ship back.
   * Only ever asked while docked or in flight — the dead press one key.
   */
  private cameFrom(): 'docked' | 'flight' {
    return this.baseMode === 'docked' ? 'docked' : 'flight';
  }

  private switchLayout(): void {
    const layout = toggleLayout();
    this.showMessage(`KEYBOARD: ${layout.toUpperCase()} LAYOUT`, 3);
    renderDockedMenu(this.system, this.state.commander, this.station.missionText());
  }

  private disarmMissile(): void {
    if (!this.ordnance.targetLock && !this.ordnance.armed) return;
    this.ordnance.disarm();   // one home for "no lock, no pylon" — ordnance.ts
    this.showMessage('MISSILE DISARMED', 2);
    sfx.missileDisarmed();
  }

  private toggleMouseFlight(): void {
    if (this.input.mouseFlight) {
      this.input.releaseMouseFlight();
      this.showMessage('MOUSE FLIGHT OFF', 2);
    } else {
      this.input.requestMouseFlight();
      // ESC is the browser's own way out of a pointer lock and belongs to no
      // table; the other one is this command's own key, read from it.
      this.showMessage(
        `MOUSE FLIGHT — ESC OR ${boundKey('flight', 'toggleMouseFlight')} TO RELEASE`, 4);
    }
  }

  private toggleTorus(): void {
    if (this.massLocked()) {
      this.showMessage('MASS LOCKED', 2);
      sfx.refused();
      return;
    }
    this.state.session.torusEngaged = !this.state.session.torusEngaged;
    // Engaging the drive opens the throttle. Nobody engages a jump drive in
    // order to crawl, and having to hold the accelerator afterwards was
    // busywork with one sensible answer.
    if (this.state.session.torusEngaged) this.state.player.speed = this.state.player.maxSpeed;
    this.showMessage(this.state.session.torusEngaged ? 'TORUS DRIVE ENGAGED' : 'TORUS DRIVE OFF', 2);
    if (this.state.session.torusEngaged) sfx.torusEngaged();
  }

  /** @internal — driven by test/playtest.js */
  openChart(from: 'docked' | 'flight'): void {
    this.input.releaseMouseFlight();
    this.baseMode = from;
    this.screens.open('chart');
  }

  /** @internal — driven by test/playtest.js */
  openLocalChart(from: 'docked' | 'flight'): void {
    this.input.releaseMouseFlight();
    this.baseMode = from;
    this.screens.open('local');
  }

  /**
   * Mouse input for the overlay screens. Buttons and menu rows carry a
   * `data-key`, which is injected as a synthetic key press so clicks and
   * the keyboard run through exactly the same handlers; table rows carry a
   * `data-row` selection index; charts map clicks back to chart coordinates.
   */
  private handleScreenClick(el: unknown, e: unknown): void {
    // The host owns all of it: data-key becomes a keystroke so a click and the
    // printed shortcut take exactly the same path, data-row goes to the top
    // screen's select(), and anything else — a chart canvas — reaches its
    // clickAt() with the raw event so it can map pixels to its own space.
    this.screens.click(el, this.input, e);
  }



  private setView(v: number): void {
    if (this.state.session.view === v) return;
    this.state.session.view = v;
    sfx.viewChanged();
  }


  /** @internal — driven by test/playtest.js
   * `from` is no longer read: the stack remembers where you came from, since
   * data is pushed ON TOP of the chart rather than replacing it. Kept in the
   * signature for test/playtest.js.
   */
  openSystemData(sys: StarSystem, from?: 'docked' | 'chart' | 'local'): void {
    void from;
    this.dataSubject = sys;
    this.screens.open('data');
  }

  private openStatus(from: 'docked' | 'flight'): void {
    this.input.releaseMouseFlight();
    this.baseMode = from;
    this.screens.open('status');
  }

  /**
   * Nothing on the stack: show the docked menu, or clear back to flight — or
   * put the game-over panel back.
   *
   * The dead case is here rather than in station.ts because a death is not one
   * of the station's two transitions, and the panel offers the commander file,
   * so Escape out of that screen has somewhere to come back TO.
   */
  private showBaseScreen(): void {
    if (this.baseMode === 'dead') {
      renderGameOver(this.state.commander, checkpointSummary(this.savesContext()));
      return;
    }
    this.applyStation(this.station.showBaseScreen());
  }



  /**
   * Dump a tonne over the side. Pirates came for cargo, not for you — give
   * them enough of it and the opportunists break off and go collect, which
   * turns "I can't win this fight" into a decision rather than a death.
   * Organised gangs want considerably more convincing.
   */
  /** @internal — driven by test/playtest.js */
  jettisonCargo(tonnes = 1): void {
    this.throwOverboard(
      (cargo) => dumpCargo(cargo, tonnes), 'HOLD EMPTY');
  }

  /**
   * Dump a tonne of the ILLEGAL cargo — the evidence, not the profit.
   *
   * The same act with a different reach, which is why it is a key of its own
   * rather than a mode on the one above: `dumpCargo` takes the most valuable
   * thing in the hold because that is what buys off a pirate, and Slaves are
   * 14th of 17 on the 1984 price table. Inside the window a police warning
   * opens, that key throws the run's profit into space while the crime stays
   * aboard. See `dumpContraband` (jettison.ts) for the ordering.
   */
  /** @internal — driven by test/playtest.js */
  jettisonContraband(tonnes = 1): void {
    this.throwOverboard(
      (cargo) => dumpContraband(cargo, tonnes), 'NO CONTRABAND ABOARD');
  }

  /**
   * Offer the law money.
   *
   * Two situations and no mode: the Viper shooting at you, and the patrol
   * closing on a dirty hold. The key reads which one is in front of you, and
   * when there is neither it says so and spends nothing, the way an empty hold
   * answers HOLD EMPTY.
   *
   * `law.ts` decides what each costs and what it leaves; this spends the
   * credits, writes the latch and writes `satisfied` (invariant 10).
   *
   * **Neither half touches the record.** The inspection latches `policeScanned`
   * with no `raiseLegal`, so the scan does not happen and the Government's
   * paperwork stays spotless; the fight buys one ship out of one fight and
   * leaves you exactly as Fugitive as you were. The name pays for both
   * (`bribeOffered`), refusals included. That asymmetry is the whole feature: a
   * bribe never clears a record and never buys one back.
   *
   * @internal — driven by test/playtest.js
   */
  bribePolice(): void {
    if (this.mode !== 'flight') { sfx.refused(); return; }
    const c = this.state.commander;
    const session = this.state.session;

    // The fight comes first: a Viper already shooting is the more urgent
    // purchase, and buying an inspection off a man who is trying to kill you
    // would be money for nothing. One press buys ONE ship — a pair costs twice,
    // exactly as a gang of pirates does.
    const hunter = nearestEngaging(this.state.world.npcs, this.state.player.position,
      c.legalStatus, 'police');
    if (hunter) {
      const paid = this.offerTo(hunter.npc, patrolPrice(c.legalStatus));
      if (paid === null) return;
      // The same field the jettisoned cargo sets, honoured by the same line of
      // `isHostileToPlayer` — this ship is done with you. The RECORD is not
      // touched: you are still a Fugitive, the next patrol is a fresh problem,
      // and the station still wants its money.
      hunter.npc.state.satisfied = true;
      this.showMessage(`PATROL BREAKS OFF — ${formatCredits(paid)} AND YOUR NAME`, 4);
      return;
    }

    // The inspection: contraband aboard, nobody has read it yet, and a patrol
    // close enough to. `patrolReach` is the same window the console warned you
    // about, rather than a second opinion about the same two ranges.
    const cop = nearestNpc(this.state.world.npcs, this.state.player.position,
      (npc) => npc.role === 'police');
    if (!session.policeScanned && !session.witchspace && carryingContraband(c.cargo)
      && cop && patrolReach(cop.distance) !== 'none') {
      const paid = this.offerTo(cop.npc, inspectionPrice(c.cargo));
      if (paid === null) return;
      session.policeScanned = true;
      this.showMessage(
        `PATROL LOOKS THE OTHER WAY — ${formatCredits(paid)} AND YOUR NAME`, 4);
      return;
    }

    this.showMessage('NOBODY TO PAY OFF', 2);
    sfx.refused();
  }

  /**
   * Put the money in front of one ship: what it cost, or null if it bought
   * nothing.
   *
   * Both halves of the key go through here, so neither can acquire an answer
   * the other does not have — the shortfall, the refusal and the name are one
   * rule about offering money to a policeman, and only the CONSEQUENCE of a
   * taken offer differs between them.
   *
   * The roll comes off the world's seeded stream (invariant 11), and only when
   * an offer is actually made: a commander who cannot cover the price has not
   * said anything out loud, so nothing is spent and no draw is consumed.
   *
   * A refusal is an offence in front of a witness. `provokedByPlayer` — not
   * `provoked`, which is damage from any source — so he engages under the rule
   * that already exists, and the name is charged for the asking.
   */
  private offerTo(target: NpcShip, price: number): number | null {
    const c = this.state.commander;
    const offer = bribeOffered(price, c.credits, c.disrepute ?? 0, random());
    if (offer.outcome === 'short') {
      // the pirate bribe's own words for the same failure, rather than a second
      // way of saying "not enough, and here is the figure"
      this.showMessage(`THEY WANT MORE (${formatCredits(Math.ceil(offer.short))})`, 3);
      sfx.refused();
      return null;
    }
    // The name is charged here, so the line that says so is queued here too —
    // behind whichever of the four answers below the caller puts on the
    // console. A REFUSAL costs it as well, which is the one case that reads
    // like a bug until you have read docs/TODO/123: the deed is the asking.
    this.markName(c.disrepute ?? 0, offer.disrepute);
    c.disrepute = offer.disrepute;
    if (offer.outcome === 'refused') {
      target.state.provokedByPlayer = true;
      this.showMessage('THE OFFER IS REFUSED — AND REPORTED', 4);
      sfx.refused();
      return null;
    }
    c.credits = offer.creditsLeft;
    return offer.price;
  }

  /**
   * The road out of the ship, shared by both dumps: clear of your own scoop,
   * counted toward the toll, and offered to the pirates.
   *
   * `choose` is the only difference between them — WHICH tonnes go — and it is
   * passed rather than branched on so neither ordering can quietly acquire the
   * other's rule.
   */
  private throwOverboard(
    choose: (cargo: number[]) => Dumped,
    nothingToDump: string,
  ): void {
    if (this.mode !== 'flight') { sfx.refused(); return; }

    const dumped = choose(this.state.commander.cargo);
    if (dumped.tonnes.length === 0) {
      this.showMessage(nothingToDump, 1.5);
      sfx.refused();
      return;
    }
    // Out of the back, clear of your own scoop reach — `cargo.jettison`, not
    // `cargo.spawn`, which scatters a wreck's hold where it fell. Dropped at
    // the nose it landed inside SCOOP_RANGE and a commander with fuel scoops
    // fitted collected it again on the next frame.
    const nose = this.state.player.getForward(this.tmp);
    for (const commodity of dumped.tonnes) {
      this.state.world.cargo.jettison(this.state.player.position, nose, commodity);
    }
    this.state.session.jettisonedValue += dumped.value;
    sfx.cargoJettisoned();

    const n = dumped.tonnes.length;
    const bribe = offerBribe(
      this.state.world.npcs.filter((npc) => npc.role === 'pirate'),
      this.state.session.jettisonedValue, this.state.session.arrivalCargoValue);
    if (bribe.bought > 0) {
      this.showMessage(
        `${bribe.bought} ATTACKER${bribe.bought > 1 ? 'S' : ''} BREAKING OFF`, 3);
    } else if (bribe.stillWant !== null) {
      this.showMessage(
        `JETTISONED ${n}t ${dumped.lastName} — THEY WANT MORE `
        + `(${formatCredits(Math.ceil(bribe.stillWant))})`, 3);
    } else {
      this.showMessage(`JETTISONED ${n}t ${dumped.lastName}`, 2);
    }
  }

  // --- HUD -----------------------------------------------------------------

  /**
   * Light the sight when the aim assist would actually reach the target.
   *
   * The circle shows the envelope at knife range; this tells the truth for
   * the target in front of you right now, since the assist tapers with
   * distance. Together they answer "will this shot land?" without the player
   * having to learn the numbers.
   */
  private updateSight(): void {
    let on = false;
    if (this.mode === 'flight') {
      const forward = this.viewDir(this.tmp);
      for (const npc of this.state.world.npcs) {
        if (!npc.state.alive || npc.role === 'asteroid') continue;
        const to = this.tmp2.copy(npc.object.position).sub(this.state.player.position);
        const dist = to.length();
        if (dist > LASER_RANGE) continue;
        const cone = hitCone(npc.radius, dist);
        if (forward.angleTo(to.normalize()) < cone) { on = true; break; }
      }
    }
    this.shell.setSightLit(on);
  }

  /**
   * Point the cockpit beams at `target`, or straight down the gun axis when
   * there is nothing to converge on.
   *
   * The beams are children of the camera and meet at (0, 0, -BEAM_Z), so the
   * convergence point is simply the target direction in camera space at the
   * same depth. Only the meeting point moves — the emitters stay on the hull
   * corners, which is what sells the beams as bending.
   */
  private aimBeams(target: THREE.Vector3 | null): void {
    const pos = this.render.beams.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    let x = 0, y = 0, z = -BEAM_Z;
    if (target) {
      const local = this.render.camera.worldToLocal(this.tmp2.copy(target));
      const len = local.length();
      if (len > 1e-3) {
        x = (local.x / len) * BEAM_Z;
        y = (local.y / len) * BEAM_Z;
        z = (local.z / len) * BEAM_Z;
      }
    }
    // vertices 1 and 3 are the convergence point (0 and 2 are the emitters)
    arr[3] = x; arr[4] = y; arr[5] = z;
    arr[9] = x; arr[10] = y; arr[11] = z;
    pos.needsUpdate = true;
  }

  /**
   * The prompt line: what a key can do about what is happening, with the key
   * the table actually binds in front of it.
   *
   * The join between a pure rule and invariant 9. `prompts.ts` decides WHICH
   * commands are worth offering and what each is worth right now; `boundKey`
   * answers what to press, from `controls.ts`, which is the one home of that —
   * so rebinding a command rewrites its own prompt and no letter is ever
   * written out in prose. Only in flight: the station menu already renders its
   * own keys from the same table.
   *
   * @internal — public so a test can read what the cockpit is offering without
   * scraping the painted line, the way `jettisonCargo` is driven directly.
   */
  keyPrompts(): string[] {
    const mode = this.controlMode();
    if (this.mode !== 'flight' || !mode) return [];
    return flightPrompts({
      commander: this.state.commander,
      playerPos: this.state.player.position,
      npcs: this.state.world.npcs,
      policeScanned: this.state.session.policeScanned,
      witchspace: this.state.session.witchspace,
      energy: this.state.sys.energy,
      missileInbound: this.ordnance.missileInbound,
      // `>= 0` is `sendDistressBeacon`'s own reading of the timer, a few methods
      // up: a beacon already broadcasting is what that key refuses, and this is
      // the prompt for that key.
      beaconSent: this.state.session.beaconTimer >= 0,
      stationDistance: this.state.player.position
        .distanceTo(this.state.world.station.position),
      dcEngaged: this.state.session.dcEngaged,
    }).flatMap((p) => {
      const line = this.renderPrompt(p);
      return line ? [line] : [];
    });
  }

  /**
   * One offer as the cockpit prints it: the key this mode binds, then the
   * words. Null when it binds none.
   *
   * `keyIfBound`, not `boundKey`: the arena's table subtracts eight of the
   * cockpit's commands, so an unbound one here is an ordinary answer — the
   * offer simply is not made — rather than a build failure. Shared with the
   * ordnance refusals, which carry a `Prompt` for the same reason a prompt does
   * (docs/TODO/128 M3): a rule module may not name a key.
   */
  private renderPrompt(p: Prompt): string | null {
    const mode = this.controlMode();
    const key = mode ? keyIfBound(mode, p.command) : null;
    return key ? `${key} ${p.what}` : null;
  }

  private renderHud(dt: number): void {
    this.updateSight();
    const frame = buildHudFrame({
      commander: this.state.commander,
      sys: this.state.sys,
      world: this.state.world,
      camera: this.render.camera,
      playerPos: this.state.player.position,
      playerQuat: this.state.player.quaternion,
      playerForward: this.state.player.getForward(this.tmp),
      viewDir: this.viewDir(this.tmp2),
      speedFrac: this.state.player.speed / this.state.player.maxSpeed,
      rollFrac: this.state.player.rollRate / PLAYER_FLIGHT.maxRoll,
      pitchFrac: this.state.player.pitchRate / PLAYER_FLIGHT.maxPitch,
      view: this.state.session.view,
      missiles: this.ordnance.missiles,
      canisters: this.state.world.cargo.items,
      targetLock: this.ordnance.targetLock,
      missileArmed: this.ordnance.armed,
      inFlight: this.mode === 'flight',
      witchspace: this.state.session.witchspace,
      assist: this.state.session.ccEngaged,
      ecmDetected: this.state.ecmDetectedTimer > 0,
      messageText: this.state.session.messageText,
      messageTimer: this.state.session.messageTimer,
      prompts: this.keyPrompts(),
      // Null in career flight, and gated on the same `active` that decides the
      // exercise owns the keyboard (controlMode) — the strip is the exercise's
      // own view of itself, not a second opinion about one.
      exercise: this.combatSim.strip,
    }, this.hudScratch);

    this.hud.render(dt, frame);
  }
}
