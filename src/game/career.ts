// What a career keeps when a flight ends.
//
// A CAREER is one commander's continuing record. It is the thing `state.career`
// names, the thing a save is filed under, and the thing that outlives any single
// flight. docs/TODO/150 M5 split it out of `game.ts`.
//
// `persistence.ts` writes a world down and puts it back. `storage.ts` says where
// a save lives. `screens/saves.ts` shows a player the shelf. This is what the
// Game DOES with them. It writes the checkpoint down and takes it back. It
// hands the file to another machine. It starts again with nothing.
//
// ONE RESPONSIBILITY, AND DEATH IS INSIDE IT rather than beside it. In this
// game a death is not a game over. It is a return to the last checkpoint, which
// is why `abandonFlight` below can say "it costs what dying costs because it
// lands where dying lands".
//
// The two halves reach INTO each other, and that is measured rather than
// asserted. `die` reads the saves context and forgets the flight ring.
// `savesContext` reports whether the commander is dead. `respawn` is the way
// back that both of them lead to. Two files would need a link in both
// directions.
//
// THE ORDER IN `die` IS LOAD-BEARING. The in-flight ring is forgotten BEFORE
// anything else, so a reload cannot resume the seconds before the wreck. The
// docked checkpoint is deliberately left alone: it is the way back.
//
// IT IS PLATFORM, like `cockpit-view.ts` and unlike the other children, because
// the game-over panel, the file transfer and the save shelf are all screens.
// That costs the port nothing — every line was already inside `game.ts`, which
// is platform too.

import { generateGalaxy } from '../galaxy/galaxy.ts';
import { LivingGalaxy } from '../galaxy/living.ts';
import { sfx } from '../audio.ts';
import { bootCommander } from './storage.ts';
import { checkpointSummary, type SavesContext } from './screens/saves.ts';
import { startNewCommander } from './screens/new-commander.ts';
import { exportSaveFile, importSaveFile } from './screens/save-transfer.ts';
import { renderGameOver } from '../ui/screens-career.ts';
import { boundKey } from '../ui/key-help.ts';
import type { Persistence } from './persistence.ts';
import type { WorldBuild } from './world-build.ts';
import type { HyperspaceActions } from './hyperspace-actions.ts';
import type { DockArrival } from './station.ts';
import type { GameState } from './state.ts';

/**
 * What a career has to reach back to the Game for.
 *
 * EIGHT, and not one of them is a rule. Three are the mode machine, which the
 * orchestrator owns and this file only asks about or asks for. Two are the
 * simulator, which is a room at the station rather than a flight. A death in
 * there ends the exercise and not the career. The rest are the console, the
 * screen stack, and the one instrument a fresh ship must forget.
 *
 * THE MODE IS READ TWICE AND THEY ARE DIFFERENT QUESTIONS, the same way they
 * are in `law-actions.ts`. `mode()` includes an open screen, so a death cannot
 * arrive while the game-over panel is up. `baseMode()` does not, because a
 * screen CAN be open over a dead commander: the panel offers her the file. A
 * save asked which mode to write would then find `'saves'`.
 */
export interface CareerHost {
  /** the mode INCLUDING an open screen */
  mode(): string;
  /** the base state, ignoring any screen over it */
  baseMode(): string;
  /** the ship is gone: the game-over panel is the base state from now on */
  enterDeadMode(): void;
  /** put the commander back on the station */
  enterDocked(arrival?: DockArrival): void;
  showMessage(text: string, seconds: number): void;
  openScreen(id: 'saves' | 'quit'): void;
  inSimulator(): boolean;
  /** end the exercise — a death in the simulator ends that, not the career */
  quitSimulator(): void;
  /** a new ship has no lock — see combat-computer.ts */
  resetCombatComputer(): void;
}

export class Career {
  private readonly state: GameState;
  /** the record itself: what is written down, and what puts it back */
  private readonly saves: Persistence;
  /** the sky a respawn rebuilds when there is no checkpoint to resume */
  private readonly world: WorldBuild;
  /** the galaxy's history, which a booted commander still has to inherit */
  private readonly jump: HyperspaceActions;
  private readonly host: CareerHost;

  constructor(
    state: GameState, saves: Persistence, world: WorldBuild,
    jump: HyperspaceActions, host: CareerHost,
  ) {
    this.state = state;
    this.saves = saves;
    this.world = world;
    this.jump = jump;
    this.host = host;
  }

  /**
   * @internal — the same act the NAME YOUR COMMANDER prompt performs, for a
   * driver with no keyboard. It forwards and nothing else. What the act IS
   * lives in `startNewCommander`. What a player is TOLD on a failure lives in
   * the screen that asked them.
   * @returns false when the boot pointer would not move, so nothing happened.
   */
  newCommanderGame(name: string): boolean {
    return startNewCommander(this.savesContext(), name);
  }

  /** @internal — driven by src/game/game.ts, which delegates to it. */
  openSaves(): void {
    this.host.openScreen('saves');
  }

  /** Download this commander as a JSON file (portable saves, bug reports). */
  exportSave(): void {
    exportSaveFile(this.savesContext());
  }

  importSave(): void {
    // The reason comes back from the importer, which is the only thing that
    // knows which of the three it was. It is not a save, it is not this build's
    // save, or there is no room for it (save-transfer.ts).
    importSaveFile(this.savesContext(), (why) => {
      this.host.showMessage(why, 4);
      sfx.refused();
    });
  }

  /**
   * The only slice of the Game the saves screens are allowed to see.
   *
   * @internal — driven by src/game/game.ts, which hands it to four screens.
   */
  savesContext(): SavesContext {
    return {
      commander: this.state.commander,
      systems: this.state.systems,
      career: this.state.career,
      dead: this.host.baseMode() === 'dead',
      message: (text, seconds) => this.host.showMessage(text, seconds),
      capture: () => this.saves.capture(),
      checkpoint: () => this.saves.checkpoint(),
      saveNamed: (name) => this.saves.saveNamed(name),
    };
  }

  /**
   * The game-over panel, and the way back it offers.
   *
   * ONE HOME, because two places draw it: the death itself, and Escape off the
   * screen the panel opened (`showBaseScreen` in game.ts). The panel is a
   * commander plus what her checkpoint holds, and the two callers had that
   * three-part expression written out each.
   *
   * @internal — driven by src/game/game.ts, whose base screen redraws it.
   */
  showGameOver(): void {
    renderGameOver(this.state.commander, checkpointSummary(this.savesContext()));
  }

  die(reason: string): void {
    if (this.host.mode() === 'dead' || this.host.mode() === 'docked') return;
    // A death in the simulator ends the SIMULATION, not the career. The
    // exercise's own StepHost already redirects this, so no path reaches here
    // with an exercise live. But the next line deletes the in-flight ring, so
    // the guard is worth having twice over.
    if (this.host.inSimulator()) { this.host.quitSimulator(); return; }
    // The in-flight autosaves must not outlive the ship, or a reload would
    // resume the snapshot from seconds before the death. The DOCKED checkpoint
    // survives: it is the way back, and what the game-over screen offers.
    this.saves.forgetFlight();
    sfx.explosion();
    this.state.world.effects.explosion(this.state.player.position.clone(), 0xff8866);
    if (this.state.commander.equipment.escapePod) {
      // the pod gets you to the local station; ship and cargo are gone
      this.state.commander.equipment.escapePod = false;
      this.state.commander.cargo = this.state.commander.cargo.map(() => 0);
      this.host.enterDocked();
      this.host.showMessage('ESCAPE POD DEPLOYED — CARGO LOST', 6);
      return;
    }
    this.host.enterDeadMode();
    this.host.showMessage(reason, 6);
    this.showGameOver();
  }

  /**
   * Ask whether to give up on this flight — but only with the world stopped.
   *
   * The gate is PAUSE, and it is the whole point of the key's shape. To give up
   * a flight is a deliberate act. A stopped world makes it two decisions rather
   * than one mistyped letter. `WHILE_PAUSED` is what lets Q reach this handler
   * at all while paused. This is what refuses it the rest of the time.
   *
   * It SAYS SO rather than doing nothing. A bound key that appears dead is a bug
   * report. The same refusal answers a Q pressed during the launch tunnel, where
   * nothing is paused either.
   */
  quitFlight(): void {
    if (!this.state.session.paused) {
      this.host.showMessage(
        `PAUSE FIRST — ${boundKey('flight', 'togglePause')},`
        + ` THEN ${boundKey('flight', 'quitFlight')} TO QUIT THE FLIGHT`, 3);
      sfx.refused();
      return;
    }
    this.host.openScreen('quit');
  }

  /**
   * Give up on this flight and take the way back — the confirmed half of
   * `screens/quit.ts`.
   *
   * `forgetFlight` FIRST, and it is the same first move `die()` makes. The
   * in-flight ring must not outlive the flight it recorded, or the next boot
   * resumes the run that was just abandoned. `clearFlightSaves` re-aims the boot
   * pointer at the checkpoint on its way past. That is what makes the
   * `respawn()` below land on the station rather than on a guess.
   *
   * It costs what dying costs because it lands where dying lands. That is the
   * whole reason it is offered to every pilot rather than only to a marked
   * career. A flight home always pays better than a quit.
   *
   * @internal — driven by src/game/game.ts, which hands it to the quit screen.
   */
  abandonFlight(): void {
    this.saves.forgetFlight();
    this.respawn();
    this.host.showMessage('FLIGHT ABANDONED', 4);
  }

  /**
   * Take the way back: this career's docked checkpoint, whole.
   *
   * A full world restore rather than a commander reload, because the checkpoint
   * IS a world. It is written at a dock, and again immediately before a launch.
   * So it puts the ship back at the station it left, with what it left with.
   *
   * @internal — driven by src/game/game.ts, which delegates to it.
   */
  respawn(): void {
    this.host.resetCombatComputer();
    this.state.chart.targetIndex = null;
    this.state.session.witchspace = false;
    if (this.saves.resume()) return;
    // Nothing to come back to, because this career never docked. Boot the way
    // the first launch did.
    this.state.commander = bootCommander();
    // The loaded commander may name a DIFFERENT galaxy from the one we died in.
    // So `systems` and the living galaxy are rebuilt from it. Otherwise every
    // `get system()` lookup reads the wrong star.
    this.state.systems = generateGalaxy(this.state.commander.galaxy);
    this.state.living = new LivingGalaxy(this.state.systems);
    this.jump.loadOrWarmGalaxy();
    this.world.chooseBlueprintSet();
    this.world.buildWorld();
    // 'fresh', and not 'resumed'. There was no checkpoint to come back to, so
    // nothing stocked this station and `bootCommander` brought no market.
    this.host.enterDocked('fresh');
  }
}
