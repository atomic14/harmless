// The orchestrator: which mode the game is in, and who gets the frame.
//
// ONE RESPONSIBILITY, and it is a short list because docs/TODO/150 and
// docs/TODO/155 took the rest out. This file owns `baseMode`, hands each frame
// to the half that owns it, routes every key to the child that answers it, and
// says out loud what those children report. Nothing else.
//
// THE TWO HALVES ARE THE SHAPE (docs/TODO/155). `docked.ts` holds what a
// commander does when the ship has stopped; `flight.ts` holds what she does in
// the sky, over `flight-weapons.ts` and `flight-instruments.ts`. Neither half
// reaches into the other. A step that ends in a dock, a jump, a tow or a death
// reports it HERE, and this file decides what the game becomes — which is the
// whole reason the two are apart.
//
// THE OTHER SEVEN CHILDREN each hold one subject beside the rules it spends:
// the law (`law-actions.ts`), the sky (`world-build.ts`), the cockpit
// (`cockpit-view.ts`), the jump (`hyperspace-actions.ts`), the career
// (`career.ts`), the save (`persistence.ts`) and the screen stack
// (`ui/screen-host.ts`).
//
// The shape repeats deliberately. Each child gets ONE host object literal —
// `stepHost()`, `persistenceHost()`, and the literal beside each field —
// listing the verbs it may ask of the Game, and returns events the matching
// `apply*` says and plays. Anything that DRAWS from the seeded rng is a host
// CALL and never a deferred event, because the order of draws is the world's
// determinism.
//
// Input follows the same split: the player, a replay and an AI reach the game
// through the same two verbs. `controls.ts` turns an input into `Command`s and
// `runCommand` below applies them. The `commands` table is deliberately the
// whole of that surface.
//
// `__game` exposes a console compatibility view for the autopilot harness
// (console.ts, game-handles.ts, train/jameson-autopilot.js) and console poking.
import { publish, installPolicyKit } from './console.ts';
import { legacyHandles } from './game-handles.ts';
import type { Shell, Presentation, ShellFactory } from '../engine/shell.ts';
import { viewRight, VIEW_QUATS } from './views.ts';
import * as THREE from 'three';

import { COMMODITIES, type StarSystem } from '../galaxy/galaxy.ts';
import { createStarfield, SpaceDust } from '../world/starfield.ts';
import { Input } from '../engine/input.ts';
import { layoutName, toggleLayout, refreshHelpPanel } from '../engine/keymap.ts';
import { Hud } from '../hud/hud.ts';
import { TunnelEffect } from '../hud/tunnel.ts';
import { sfx, type Place } from '../audio.ts';
import { NpcShip } from './npc.ts';
import { type NpcSpec } from './ship-specs.ts';

import { type NpcRole } from './ship-roles.ts';

import { HyperspaceActions, type HyperspaceHost } from './hyperspace-actions.ts';
import { Flight, type FlightHost } from './flight.ts';
import type { ExerciseFit } from './combat-sim.ts';
import type { ExerciseSpec } from './combat-sim-scenarios.ts';
import type { CombatSimReport } from './combat-sim-report.ts';
import type { CombatObserver } from './instrumentation.ts';
import { Career, type CareerHost } from './career.ts';
import { FIXED_DT, MAX_FRAME_TIME, MAX_STEPS_PER_FRAME } from '../constants/world-clock.ts';
import { bootCareer, bootCommander, bootSave, clearFlightSaves, withoutSaving, writeDockSave, writeFlightSave, writeNamedSave } from './storage.ts';
import { MAX_NAMED_SAVES } from '../constants/saves.ts';
import { type WorldSnapshot } from './snapshot.ts';
import { showMessage as setMessage, queueMessage, tickBeam, tickMessage } from './session.ts';
import { Persistence, type PersistenceHost } from './persistence.ts';
import { Docked, type DockedHost } from './docked.ts';
import type { DockArrival } from './station.ts';

import { CombatComputer } from './combat-computer.ts';
import { LawActions, type LawHost } from './law-actions.ts';
import { WorldBuild, type WorldBuildHost } from './world-build.ts';
import { CockpitView, type CockpitHost } from './cockpit-view.ts';
import type { SoundEvent } from './sounds.ts';
import { commandsFor, globalCommands, type Command, type ControlMode } from './controls.ts';
import { WHILE_PAUSED } from './bindings.ts';
import { Ordnance } from './ordnance.ts';

import { SavesScreen, checkpointSummary } from './screens/saves.ts';
import { SavePromptScreen, NamingScreen } from './screens/save-naming.ts';
import { NewCommanderScreen } from './screens/new-commander.ts';
import { MarketScreen, EquipScreen } from './screens/trade.ts';
import { StatusScreen, type StatusContext } from './screens/status.ts';
import { MissionsScreen, type MissionsContext } from './screens/missions.ts';
import { DataScreen, type DataContext } from './screens/data.ts';
import { BriefingScreen } from './screens/briefing.ts';
import { ContractsScreen, type ContractsContext } from './screens/contracts.ts';
import { ChartScreen, type ChartContext } from './screens/chart.ts';
import { nextOverlay, type ChartOverlay } from './chart-overlay.ts';
import { CombatSimScreen, type CombatSimContext } from './screens/combat-sim.ts';
import { TestModeScreen, type TestModeContext } from './screens/test-mode.ts';
import { QuitScreen, type QuitContext } from './screens/quit.ts';
import { SurvivorsScreen, type SurvivorsContext } from './screens/survivors.ts';
import { ScreenHost } from '../ui/screen-host.ts';

import { characterVerdict } from './character.ts';
import { CHARACTER_LINE_SECONDS } from '../constants/character.ts';
import { hideScreen } from '../ui/screens.ts';
import { renderNewGameConfirm } from '../ui/screens-career.ts';
import { boundKey, keyPointer, paintCommandGuide } from '../ui/key-help.ts';
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
  private readonly market_ = new MarketScreen(() => this.docked_.tradeContext());
  private readonly contracts_ = new ContractsScreen(() => ({
    commander: this.state.commander,
    system: this.system,
    systems: this.state.systems,
    offers: this.state.contractOffers,
    atStation: this.baseMode === 'docked',
    accept: (index) => { this.contracts_.selected = index; this.docked_.acceptContract(); },
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

  /** missiles, E.C.M. and the energy bomb — see ordnance.ts */
  private readonly ordnance = new Ordnance(this.state.world);

  /**
   * The docked half's five acts that something outside reaches by name.
   *
   * Delegates rather than reaches through `docked_`, and the reason differs by
   * line. `launch` and `enterDocked` are pressed by two dozen tests; the other
   * three are driven by `test/playtest.js`, which nothing type-checks, so a
   * rename here would break the harness in silence (docs/TODO/151).
   */
  launch(): void { this.docked_.launch(); }

  /** @internal — public for the tests, which dock a commander through it. */
  enterDocked(arrival: DockArrival = 'arrived'): void { this.docked_.enterDocked(arrival); }

  /** @internal — driven by test/playtest.js */
  buyCargo(want: number): void { this.docked_.buyCargo(want); }

  /** @internal — driven by test/playtest.js */
  buyEquipment(id: string): void { this.docked_.buyEquipment(id); }

  /** @internal — driven by test/playtest.js */
  acceptContract(): void { this.docked_.acceptContract(); }

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
   * What a commander does while she is docked (docs/TODO/155 M1).
   *
   * Four collaborators and thirteen host methods, and the width is the point
   * rather than a cost: this is half an ORCHESTRATOR, not a rule module, so
   * what it reaches back for is the machinery the other half stands on too —
   * the mode machine, the console, the sounds and three pieces of cockpit.
   *
   * `setBaseMode` is the seam. The station decides that a dock happened; the
   * Game decides what the game then IS.
   */
  private readonly docked_ = new Docked(
    this.state, this.ordnance, this.market_, this.contracts_, this.persistence, {
      baseMode: () => this.baseMode,
      setBaseMode: (mode) => { this.baseMode = mode; },
      showMessage: (text, seconds) => this.showMessage(text, seconds),
      queueMessage: (text, seconds) => this.queueMessage(text, seconds),
      sayEvent: (e) => this.sayEvent(e),
      playSound: (e) => this.playSound(e),
      markName: (before, after) => this.markName(before, after),
      raiseLegal: (level) => this.raiseLegal(level),
      system: () => this.system,
      lookAlong: (dir) => this.lookAlong(dir),
      populateSystem: (situation) => this.populateSystem(situation),
      openScreen: (id) => this.screens.open(id),
      releaseMouseFlight: () => this.input.releaseMouseFlight(),
      startTunnel: (seconds, way) => this.tunnel.start(seconds, way),
    } satisfies DockedHost);

  /** The records the last exercise produced — what the report panel reads. */
  private simReports: readonly CombatSimReport[] = [];

  /** The picker and the report, behind one screen id. */
  private readonly combatSim_ = new CombatSimScreen(() => ({
    commander: this.state.commander,
    reports: this.simReports,
    begin: (spec, fit) => this.flight_.startExercise(spec, fit),
    message: (text, seconds) => this.showMessage(text, seconds),
  } satisfies CombatSimContext));

  private readonly dust = new SpaceDust();

  /**
   * The law's consequences (docs/TODO/150 M1).
   *
   * `law.ts` owns the rules and `law-actions.ts` owns what the Game does with
   * them. The host below is what it reaches back for: the console, the two
   * sounds, and the two different questions about what mode the ship is in.
   */
  private readonly law_ = new LawActions(this.state, {
    showMessage: (text, seconds) => this.showMessage(text, seconds),
    queueMessage: (text, seconds) => this.queueMessage(text, seconds),
    markName: (before, after) => this.markName(before, after),
    mode: () => this.mode,
    baseMode: () => this.baseMode,
    refused: () => sfx.refused(),
    defenceLaunched: () => sfx.stationDefenceLaunched(),
    cargoJettisoned: () => sfx.cargoJettisoned(),
  } satisfies LawHost);

  /**
   * Building the sky and filling it (docs/TODO/150 M2).
   *
   * Five host methods, and none of them is a rule: the console, the two pieces
   * of cockpit furniture a new system changes, the sound, and where we are.
   */
  private readonly world_ = new WorldBuild(this.state, {
    showMessage: (text, seconds) => this.showMessage(text, seconds),
    setSystem: (sys) => this.hud.setSystem(sys),
    startTunnel: (seconds) => this.tunnel.start(seconds),
    hyperspaceSound: () => sfx.hyperspace(),
    system: () => this.system,
  } satisfies WorldBuildHost);

  /**
   * Leaving a system, and arriving in one (docs/TODO/150 M4).
   *
   * One collaborator and ten host methods. The collaborator is the sky itself,
   * because every arrival builds one — `hyperspace-actions.ts` decides WHEN a
   * system is entered and `world-build.ts` decides what is in it. The host is
   * the console, the cockpit tunnel, the two sounds, and the three facts only
   * the orchestrator holds.
   */
  private readonly jump_ = new HyperspaceActions(this.state, this.world_, {
    showMessage: (text, seconds) => this.showMessage(text, seconds),
    markName: (before, after) => this.markName(before, after),
    system: () => this.system,
    lookAlong: (dir) => this.lookAlong(dir),
    startTunnel: (seconds) => this.tunnel.start(seconds),
    inSimulator: () => this.flight_.inSimulator(),
    refused: () => sfx.refused(),
    countdownSound: (seconds) => sfx.countdown(seconds),
    hyperspaceSound: () => sfx.hyperspace(),
    distressBeaconSound: () => sfx.distressBeacon(),
  } satisfies HyperspaceHost);

  /**
   * What a career keeps when a flight ends (docs/TODO/150 M5).
   *
   * Three collaborators and eight host methods. The collaborators are the three
   * things a way back is made of — the record itself, the sky a respawn
   * rebuilds, and the galaxy history a booted commander inherits — and the host
   * is the mode machine, the simulator and the console.
   */
  private readonly career_ = new Career(
    this.state, this.persistence, this.world_, this.jump_, {
      mode: () => this.mode,
      baseMode: () => this.baseMode,
      enterDeadMode: () => { this.baseMode = 'dead'; },
      enterDocked: (arrival) => this.docked_.enterDocked(arrival),
      showMessage: (text, seconds) => this.showMessage(text, seconds),
      openScreen: (id) => this.screens.open(id),
      inSimulator: () => this.flight_.inSimulator(),
      quitSimulator: () => { this.flight_.endExercise(); },
      resetCombatComputer: () => this.combatComputer.reset(),
    } satisfies CareerHost);

  /** Build the scene for the system we are standing in. */
  buildWorld(): void { this.world_.buildWorld(); }

  /** Mis-jump limbo: the sky is banished and the Thargoids arrive. */
  enterWitchspace(): void { this.world_.enterWitchspace(); }

  /** @internal — a harness hook; the world owns the spawn. */
  spawnNpc(role: NpcRole, position: THREE.Vector3, seed: number, spec?: NpcSpec): NpcShip {
    return this.world_.spawnNpc(role, position, seed, spec);
  }

  private populateSystem(situation: 'launch' | 'arrival'): void {
    this.world_.populateSystem(situation);
  }

  /**
   * The record moves. @internal — no caller outside this class (docs/TODO/151
   * M1). `stepHost` wires it, so the step raises a record through the Game
   * rather than through a reach into `law_`.
   */
  raiseLegal(level: number): void { this.law_.raiseLegal(level); }

  /**
   * Offer the law money. @internal — driven by test/bribe-flight.test.ts and
   * test/character-line.test.ts.
   */
  bribePolice(): void { this.law_.bribePolice(); }

  /**
   * What the cockpit shows about the world (docs/TODO/150 M3).
   *
   * Four collaborators and four host methods. The collaborators are the things
   * the picture is READ FROM and PAINTED ON — the world, the ordnance racks,
   * the camera with its beams, and the dashboard — and the host is the four
   * facts about the machine that only the orchestrator holds.
   */
  private readonly cockpit_ = new CockpitView(this.state, this.ordnance, this.hud, {
      inFlight: () => this.mode === 'flight',
      controlMode: () => this.controlMode(),
      exerciseStrip: () => this.flight_.strip,
      setSightLit: (on) => this.shell.setSightLit(on),
      view: () => this.render,
    } satisfies CockpitHost);

  /**
   * What the cockpit is offering right now.
   *
   * @internal — a delegate rather than a reach through `cockpit_`, because
   * test/prompts.test.ts and test/bribe-flight.test.ts read it off the Game to
   * see the offers without scraping the painted line.
   */
  keyPrompts(): string[] { return this.cockpit_.keyPrompts(); }

  /**
   * The flight half's eight acts that something outside reaches by name.
   *
   * Delegates rather than reaches through `flight_`, and the reasons split
   * three ways. `fireLaser` and `massLocked` are driven by `test/playtest.js`
   * and `train/jameson-autopilot.js`, which nothing type-checks. The exercise's
   * three are the console harnesses' way in. And the rest are pressed by tests
   * that assert a consequence rather than a screen.
   */
  fireLaser(): void { this.flight_.racks.fireLaser(); }

  /**
   * Anything close enough to hold the torus drive down.
   *
   * @internal — driven by test/playtest.js and train/jameson-autopilot.js
   */
  massLocked(): boolean { return this.flight_.switches.massLocked(); }

  /** @internal — driven by test/record-line.test.ts */
  destroyNpc(npc: NpcShip): void { this.flight_.racks.destroyNpc(npc); }

  /** @internal — driven by test/jettison.test.ts */
  jettisonCargo(tonnes = 1): void { this.flight_.racks.jettisonCargo(tonnes); }

  /** @internal — driven by test/jettison.test.ts */
  jettisonContraband(tonnes = 1): void { this.flight_.racks.jettisonContraband(tonnes); }

  /** @internal — driven by test/persistence.test.ts, and the console harnesses. */
  startExercise(spec: ExerciseSpec, fit?: ExerciseFit): boolean {
    return this.flight_.startExercise(spec, fit);
  }

  /** @internal — driven by test/persistence.test.ts, and the console harnesses. */
  endExercise(): readonly CombatSimReport[] | null { return this.flight_.endExercise(); }

  /** @internal — driven by test/instrumentation.test.ts */
  setCombatObserver(observer: CombatObserver | null): () => void {
    return this.flight_.racks.setCombatObserver(observer);
  }

  /**
   * What a commander does while she is flying (docs/TODO/155 M2).
   *
   * Six collaborators and seventeen host methods, and the width is what a HALF
   * costs rather than a fault. The collaborators are the things a station
   * spends too — the racks, the keyboard, the cockpit, the law, the record and
   * the combat computer — so they stay here and are lent. What flight alone
   * uses is ITS field: the world step, the guns, the autopilots, the
   * instrumentation and the simulator all moved.
   *
   * FIVE OF THE SEVENTEEN ARE WAYS OUT OF FLIGHT. A step that ends in a dock, a
   * completed jump, a tow or a death reports it here and the orchestrator
   * decides what the game becomes, so neither half reaches into the other.
   */
  private readonly flight_ = new Flight(
    this.state, this.ordnance, this.input, this.cockpit_, this.law_,
    this.persistence, this.combatComputer, {
      mode: () => this.mode,
      baseMode: () => this.baseMode,
      enterFlightMode: () => {
        this.screens.exit();
        this.baseMode = 'flight';
        hideScreen();
      },
      showMessage: (text, seconds) => this.showMessage(text, seconds),
      sayEvent: (e) => this.sayEvent(e),
      playSound: (e) => this.playSound(e),
      raiseLegal: (level) => this.raiseLegal(level),
      die: (reason) => this.career_.die(reason),
      dock: () => this.docked_.enterDocked(),
      completeHyperspace: () => this.jump_.completeHyperspace(),
      completeRescue: () => this.jump_.completeRescue(),
      openHermitTrade: () => this.docked_.openHermitTrade(),
      autoSave: () => this.autoSave(),
      flashDamage: () => this.hud.flashDamage(),
      flashBomb: () => this.shell.flashBomb(),
      updateDust: (velocity) => this.dust.update(this.state.player.position, velocity),
      showReport: (reports) => {
        this.simReports = reports;
        if (reports.length === 0) return;
        this.combatSim_.showReport();
        this.screens.open('combat-sim');
      },
    } satisfies FlightHost);

  private readonly tmpM = new THREE.Matrix4();
  /**
   * Scratch for placing a sound, and its OWN pair rather than `tmp`/`tmp2`.
   *
   * `playSound` is called from inside `applyStep`, `applyCombat`, `applyStation`
   * and `applyOrdnance`, which run in the middle of a frame that is already
   * holding a vector in each of those two. A shared scratch would make a bang
   * corrupt whatever the frame was measuring, silently and only sometimes.
   */
  private readonly soundAt = new THREE.Vector3();
  private readonly soundRight = new THREE.Vector3();

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
  private sayEvent(
    e: { text: string; seconds: number; queued?: boolean; command?: Command },
  ): void {
    // A line that announces a standing order says where the rest of it lives
    // (invariant 16). The module named a `Command` and never a letter, so the
    // key is looked up HERE — the same seam `flightPrompts` uses, and the
    // reason `test/key-prose.test.ts` can still scan `src/game/` for letters.
    const text = e.command === undefined
      ? e.text
      : `${e.text} — ${keyPointer(this.cameFrom(), e.command)}`;
    if (e.queued) this.queueMessage(text, e.seconds);
    else this.showMessage(text, e.seconds);
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
    this.jump_.loadOrWarmGalaxy();
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
      new EquipScreen(() => this.docked_.tradeContext()),
      new SavesScreen(() => this.career_.savesContext()),
      new SavePromptScreen(() => this.career_.savesContext()),
      new NamingScreen(() => this.career_.savesContext()),
      new NewCommanderScreen(() => this.career_.savesContext()),
      new StatusScreen(() => ({
        commander: this.state.commander,
        systems: this.state.systems,
        targetIndex: this.state.chart.targetIndex,
      } satisfies StatusContext)),
      new MissionsScreen(() => ({
        commander: this.state.commander,
        systems: this.state.systems,
      } satisfies MissionsContext)),
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
        checkpoint: checkpointSummary(this.career_.savesContext()),
        abandon: () => this.abandonFlight(),
        // You paused to get here, so backing out returns you to the pause
        // rather than dropping you live into whatever you stopped. `step`
        // clears `paused` while any screen is up (the mode is not 'flight'),
        // which is what this puts back.
        keepFlying: () => { this.state.session.paused = true; },
      } satisfies QuitContext)),
      new SurvivorsScreen(() => ({
        people: this.state.commander.survivors,
        offers: this.docked_.survivorOffers(),
        handOver: () => this.docked_.answerForSurvivors('medical'),
        sell: () => this.docked_.answerForSurvivors('sold'),
        release: () => this.docked_.answerForSurvivors('released'),
      } satisfies SurvivorsContext)),
    ]) this.screens.register(screen);

    // A boot enters a system too, so it chooses a roster like any arrival. A
    // resume below overwrites it with the one the save was taken under.
    this.world_.chooseBlueprintSet();
    this.buildWorld();
    // Resume mid-flight if the last session ended there; otherwise the
    // station, as Elite always did.
    if (!this.resumeSavedWorld()) this.docked_.enterDocked('fresh');
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
      exercising: { get: () => this.flight_.inSimulator() },
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
    this.shell.setSightRadius(this.cockpit_.sightRadius(pxPerRad));
  }

  private get system(): StarSystem {
    return this.state.systems[this.state.commander.systemIndex];
  }

  // --- world lifecycle -----------------------------------------------------

  // --- mode transitions ----------------------------------------------------

  /**
   * @internal — driven by test/career-identity.test.ts. A delegate rather than
   * a reach through `career_`, because the harness names this act.
   */
  newCommanderGame(name: string): boolean { return this.career_.newCommanderGame(name); }

  /** @internal — driven by test/saves.test.ts, and the docked S key. */
  openSaves(): void { this.career_.openSaves(); }

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
        if (mode === 'docked') this.docked_.enterDocked('resumed');
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

  /** @internal — public for the tests, which capture a world to compare it. */
  captureSnapshot(): WorldSnapshot { return this.persistence.capture(); }

  /** @internal — public for the tests, which restore a captured world. */
  restoreSnapshot(snap: WorldSnapshot): void { this.persistence.restore(snap); }

  private autoSave(): void { this.persistence.autoSave(); }

  private resumeSavedWorld(): boolean { return this.persistence.resume(); }

  /** @internal — driven by test/playtest.js */
  lookAlong(dir: THREE.Vector3): void {
    // Matrix4.lookAt uses camera convention: -Z (our nose) points at target.
    this.tmpM.lookAt(ZERO, dir, UP);
    this.state.player.quaternion.setFromRotationMatrix(this.tmpM);
  }

  /**
   * Give up on this flight and take the way back.
   *
   * @internal — a delegate rather than a reach through `career_`, because the
   * quit screen's context is built here with the rest of the screen wiring.
   */
  abandonFlight(): void { this.career_.abandonFlight(); }

  /**
   * Take the way back: this career's docked checkpoint, whole.
   *
   * @internal — driven by test/playtest.js
   */
  respawn(): void { this.career_.respawn(); }

  // --- contracts (station bulletin board) ----------------------------------

  /**
   * @internal — driven by test/playtest.js. A delegate rather than a reach
   * through `jump_`, because the harness presses this by name.
   */
  startHyperspace(): void { this.jump_.startHyperspace(); }

  /** @internal — driven by test/blueprint-override.test.ts */
  arriveInSystem(): void { this.jump_.arriveInSystem(); }

  // --- combat --------------------------------------------------------------

  // --- the ship's autopilots -----------------------------------------------

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
      case 'sound': {
        // One call for every name, placed or not. A voice that takes no place is
        // assignable to one that takes an optional place — fewer parameters is
        // assignable to more — so a cockpit beep goes through the same line and
        // ignores what it is handed. The alternative is a list of which names
        // are placed, which is a second home for a fact audio.ts already states.
        const voice: (place?: Place) => void = sfx[e.name];
        voice(this.placeOf(e.at));
        break;
      }
    }
  }

  /**
   * Where a sound happened, as the cockpit hears it (docs/TODO/142).
   *
   * Geometry only. How loud that is, and whether the sound cares at all, is
   * `audio.ts`'s to decide — the same split the countdown's pitch made when it
   * left the world step.
   *
   * `undefined` for a sound with no place, which is most of them: the beeps, the
   * warnings, the dock and the launch all happen where the pilot is.
   */
  private placeOf(at?: THREE.Vector3): Place | undefined {
    if (!at) return undefined;
    const { player, session } = this.state;
    const to = this.soundAt.subVectors(at, player.position);
    const distance = to.length();
    // A source AT the pilot has no direction, and normalising it would hand
    // `pan.value` a NaN — which takes the voice out in silence rather than
    // throwing, so nothing would report it. This is `nose × heading` again
    // (docs/TODO/134): the degenerate case arrives exactly when the geometry
    // succeeds.
    //
    // No emitter reaches it today, and that was checked rather than assumed:
    // the closest is a warhead on your own hull, and `hitPlayer` carries the
    // MISSILE's position, which is inside `MISSILE_HIT_RANGE` and never equal.
    // The guard is here because the next emitter is one line of somebody else's
    // work away, and the failure it prevents is a silence with no error.
    const side = distance > 0
      ? to.divideScalar(distance)
        .dot(viewRight(player.quaternion, session.view, this.soundRight))
      : 0;
    return { distance, side };
  }

  /**
   * Stranded in witch-space without the fuel to jump clear.
   *
   * @internal — driven by test/playtest.js. A delegate rather than a reach
   * through `jump_`, because the harness presses this by name.
   */
  sendDistressBeacon(): void { this.jump_.sendDistressBeacon(); }

  /**
   * One-shot jump to the next galaxy; lands at the nearest system to our coords.
   *
   * @internal — driven by test/prewarm.test.ts. Public for the same reason
   * `respawn` and `launch` are: ⇧H needs a shift HELD, which `Input` only
   * learns from a real keydown, so a headless test cannot press it. The
   * binding itself is pinned in test/ui.test.ts.
   */
  galacticJump(): void { this.jump_.galacticJump(); }

  // --- per-frame -----------------------------------------------------------

  /**
   * One simulation step and one frame drawn.
   *
   * A single call because the console harness drives the game with it
   * (test/playtest.js); the real loop separates them and steps a FIXED dt
   * however long the frame took.
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
        this.showMessage(this.flight_.pausedHint(), 0.4);
        this.finishStep(dt);
        return;
      }
    }
    if (!this.tunnel.active) this.handleInput(dt);
    else this.handleInput(dt, true);
    if (this.state.session.paused) {
      this.showMessage(this.flight_.pausedHint(), 0.4);
      this.finishStep(dt);
      return;
    }
    this.tunnel.update(dt);
    if (this.mode === 'flight') this.flight_.update(dt, elapsed);
    this.finishStep(dt);
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
    this.cockpit_.renderHud(dt);
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
    if (this.mode === 'flight') return this.flight_.inSimulator() ? 'simulator' : 'flight';
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
    launch: () => this.docked_.launch(),
    openMarket: () => this.screens.open('market'),
    openEquip: () => this.screens.open('equip'),
    openBriefing: () => this.screens.open('briefing'),
    openSaves: () => this.openSaves(),
    openSystemData: () => this.openSystemData(this.system, 'docked'),
    openCombatSim: () => this.screens.open('combat-sim'),
    openTestMode: () => this.screens.open('test-mode'),
    payFine: () => this.law_.payFine(),
    exportSave: () => this.career_.exportSave(),
    importSave: () => this.career_.importSave(),
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
      this.docked_.showDockedMenu();
    },
    // --- shared between the menu and the cockpit --------------------------
    openChart: () => this.openChart(this.cameFrom()),
    openLocalChart: () => this.openLocalChart(this.cameFrom()),
    openStatus: () => this.openReadingScreen('status', this.cameFrom()),
    openMissions: () => this.openReadingScreen('missions', this.cameFrom()),
    // A reading screen from the cockpit, and the board it also carries is a
    // station's — `ContractsContext.atStation` is what makes that the SCREEN's
    // question rather than this call's.
    openContracts: () => this.openReadingScreen('contracts', this.cameFrom()),
    // --- the cockpit ------------------------------------------------------
    view0: () => this.flight_.switches.setView(0),
    view1: () => this.flight_.switches.setView(1),
    view2: () => this.flight_.switches.setView(2),
    view3: () => this.flight_.switches.setView(3),
    armMissile: () => this.flight_.racks.armMissile(),
    launchMissile: () => this.flight_.racks.launchMissile(),
    disarmMissile: () => this.flight_.racks.disarmMissile(),
    fireEcm: () => this.flight_.racks.triggerEcm(),
    detonateEnergyBomb: () => this.flight_.racks.detonateEnergyBomb(),
    toggleCombatComputer: () => this.flight_.switches.toggleCombatComputer(),
    toggleDockingComputer: () => this.flight_.switches.dockingComputer(),
    toggleMouseFlight: () => this.flight_.switches.toggleMouseFlight(),
    toggleTorus: () => this.flight_.switches.toggleTorus(),
    togglePause: () => { this.state.session.paused = !this.state.session.paused; },
    startHyperspace: () => this.startHyperspace(),
    galacticJump: () => this.galacticJump(),
    distressBeacon: () => this.sendDistressBeacon(),
    quitFlight: () => this.career_.quitFlight(),
    jettison1: () => this.flight_.racks.jettisonCargo(1),
    jettison5: () => this.flight_.racks.jettisonCargo(5),
    jettisonContraband: () => this.flight_.racks.jettisonContraband(1),
    bribePolice: () => this.bribePolice(),
    // --- the training simulator -------------------------------------------
    endExercise: () => this.flight_.endExercise(),
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
    this.docked_.showDockedMenu();
  }

  /**
   * @internal — driven by test/chart-overlay.test.ts and
   * test/danger-overlay.test.ts.
   */
  openChart(from: 'docked' | 'flight'): void {
    this.input.releaseMouseFlight();
    this.baseMode = from;
    this.screens.open('chart');
  }

  /**
   * @internal — driven by test/chart-overlay.test.ts and
   * test/danger-overlay.test.ts.
   */
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

  /**
   * @internal — no caller outside this class (docs/TODO/151 M1). The command
   * table calls it.
   *
   * `from` is no longer read: the stack remembers where you came from, since
   * data is pushed ON TOP of the chart rather than replacing it. It stayed in
   * the signature for test/playtest.js, which does not call this method at all,
   * so the parameter has no caller either (docs/TODO/151 M1).
   */
  openSystemData(sys: StarSystem, from?: 'docked' | 'chart' | 'local'): void {
    void from;
    this.dataSubject = sys;
    this.screens.open('data');
  }

  /**
   * Open a screen that only REPORTS, from wherever the key was pressed.
   *
   * Three screens qualify: what you are (`status`), what the Navy wants
   * (`missions`), and what you signed for (`contracts`). Each is bound in the
   * cockpit as well as at the station, so each must record which base state to
   * come back to, and each must let go of mouse flight before a pointer is any
   * use.
   *
   * `contracts` is the one that can also SPEND — it signs for work at a board.
   * That door is the screen's own (`ContractsContext.atStation`) rather than
   * this call's, because the screen is what knows a board is a station's.
   */
  private openReadingScreen(
    id: 'status' | 'missions' | 'contracts', from: 'docked' | 'flight',
  ): void {
    this.input.releaseMouseFlight();
    this.baseMode = from;
    this.screens.open(id);
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
      this.career_.showGameOver();
      return;
    }
    this.docked_.showBaseScreen();
  }

}
