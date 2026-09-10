// Which command each mode offers, and on what key. The tables themselves.
//
// Split out of `controls.ts` by docs/TODO/148. That file is the GRAMMAR: what a
// `Command` is, what a `Binding` is, and how a table is scanned. This is the
// DATA it reads. `command-help.ts` was split off the same file for the same
// reason, and is welded back the same way, by `Record<Command, …>`. It holds
// what a command does in words, apart from which key asks for it.
//
// The split is not tidiness. Three items in a row added a command here, and
// pushed the combined file past the 400-line ceiling. Each time, the answer was
// to cut a comment, which `CLAUDE.md` forbids in as many words. The tables are
// what grow. The scan stayed still for months.
//
// THIS IS THE ONE HOME OF A COMMAND KEY (CLAUDE.md's key-bindings invariant).
// The `?` panel, the manual page and the station menu are all RENDERED from
// this file and `command-help.ts` together (`ui/key-help.ts`). The README is
// prose, and `test/key-help.test.ts` holds it to these tables in both
// directions. `engine/keymap.ts` owns the flight AXES, which are not
// commands.
//
// TWO PROPERTIES OF THESE TABLES ARE READ BY THE SCAN, so they are rules rather
// than layout, and `controls.ts` states both in full:
//
//   - **ORDER.** The scan stops at the first match in the chain, so a table's
//     order decides which of two bindings on one key answers. A SHIFTED entry
//     must therefore sit above its plain twin, so ⇧H above H and ⇧Y above Y.
//     Otherwise the plain one takes the tap from the front.
//   - **`independent`.** A binding marked so is read on its own, neither
//     blocked by an earlier match nor blocking a later one. Only the views.
//
// The docked table has a third, and it belongs to a renderer rather than to
// the scan. It is in MENU ORDER, because `ui/key-help.ts` builds the station
// menu's rows straight from it.

import type { Binding, Command, ControlMode } from './controls.ts';

/** Bindings that answer whatever is on screen, overlays included. */
export const GLOBAL_BINDINGS: readonly Binding[] = [
  // ? toggles the controls guide (plain / is the classic decelerate key)
  { key: 'Question', command: 'toggleHelp' },
];

/**
 * The cockpit's own table, named so the simulator can be stated as a
 * SUBTRACTION from it rather than as a second copy of it.
 *
 * A hand-written second list of flight keys would be exactly the failure this
 * project is organised against. Somebody adds a key to the cockpit and forgets
 * the arena, or the reverse, and nothing notices either.
 */
const FLIGHT_BINDINGS: readonly Binding[] = [
  { key: 'Digit1', independent: true, command: 'view0' },
  { key: 'Digit2', independent: true, command: 'view1' },
  { key: 'Digit3', independent: true, command: 'view2' },
  { key: 'Digit4', independent: true, command: 'view3' },
  { key: 'KeyP', command: 'togglePause' },
  // The Spectrum's cheat, on the Spectrum's key: paused, F arms the drive to
  // mis-jump. It answers only while PAUSED (see WHILE_PAUSED), and the handler
  // says to pause first the rest of the time (docs/TODO/189).
  { key: 'KeyF', command: 'armMisjump' },
  { key: 'KeyG', command: 'openChart' },
  { key: 'KeyN', command: 'openLocalChart' },
  { key: 'KeyI', command: 'openStatus' },
  { key: 'KeyR', shift: true, command: 'openLog' },   // the log of the oRders; ⇧R docked too
  { key: 'KeyR', command: 'openMissions' },   // the standing oRders; R docked too
  { key: 'KeyT', command: 'armMissile' },
  { key: 'KeyM', command: 'launchMissile' },
  { key: 'KeyU', command: 'disarmMissile' },
  { key: 'KeyE', command: 'fireEcm' },
  { key: 'KeyK', command: 'toggleCombatComputer' },
  { key: 'KeyV', command: 'toggleMouseFlight' },
  { key: 'Tab', command: 'detonateEnergyBomb' },
  // ⇧C: C is the docking computer here and stays, and X and Z are the only plain
  // letters free. `Binding.shift` says why a modifier is legal in the cockpit.
  { key: 'KeyC', shift: true, command: 'openContracts' },
  { key: 'KeyC', command: 'toggleDockingComputer' },
  { key: 'KeyH', shift: true, command: 'galacticJump' },
  { key: 'KeyH', command: 'startHyperspace' },
  { key: 'KeyB', command: 'distressBeacon' },
  { key: 'KeyY', shift: true, command: 'jettison5' },
  { key: 'KeyY', command: 'jettison1' },
  // O for OVERBOARD. It sits on the top row a few keys along from Y, so the
  // three ways to empty the hold are under one hand. It is not a shifted Y. ⇧Y
  // is already five tonnes. The point of this key is that it takes the ONE
  // thing the law looks for. A modifier on a bulk dump would read as more of
  // the same, rather than as a different rule.
  { key: 'KeyO', command: 'jettisonContraband' },
  // ...and L is the other answer to the same warning. O throws the evidence
  // out, and L pays the man to look the other way. It sits under O on the
  // keyboard for that reason: a patrol closing on a dirty hold leaves you two
  // things, one finger apart.
  //
  // It is a plain letter rather than ⇧O. Shift already means MORE OF THE SAME
  // on ⇧Y, and a bribe is a different rule rather than a bigger dump. L
  // launches at the STATION. That is the established per-mode convention and
  // not a clash: C, M and T all mean two things across the two tables.
  { key: 'KeyL', command: 'bribePolice' },
  { key: 'KeyJ', command: 'toggleTorus' },
  // Q is the key that gives up on what you are doing. It is the same letter
  // that backs out of the new-commander confirmation at the station, and ends
  // an exercise in the arena. Three per-mode tables, one meaning. In the
  // cockpit it has two acts, and the letter is shared between them.
  //
  // PLAIN Q IS THE ESCAPE POD, and Chris named the key (GitHub #43,
  // docs/TODO/195). It is the ultimate way to give up a flight. It is pressed
  // in a hurry, so it takes the plain letter and no confirmation. It refuses
  // with a line when no pod is fitted.
  //
  // ⇧Q GIVES UP THE FLIGHT to the station autosave. It answers only while
  // PAUSED (see WHILE_PAUSED), and it asks before it acts. So a flight given
  // up takes three deliberate presses. It sits ABOVE the plain entry, because
  // the scan stops at the first match (see the header).
  { key: 'KeyQ', shift: true, command: 'quitFlight' },
  { key: 'KeyQ', command: 'launchEscapePod' },
];

/**
 * What a training exercise takes off you, and why each one.
 *
 * An arena you can leave is not an arena. Every command here would either end
 * the fight somewhere the report never mentions or spend something the exercise
 * has no business spending:
 *
 *  - `startHyperspace` / `galacticJump` — the exercise's `StepHost` refuses the
 *    arrival anyway, so the countdown would run and do nothing. The galactic
 *    drive also rebuilds the scene mid-fight.
 *  - `distressBeacon` — GalCop tows you out of the fight, for your cargo.
 *  - `jettison1` / `jettison5` / `jettisonContraband` — dumping cargo buys off a
 *    gang, and the clone's hold is deliberately EMPTY, so the keys can only ever
 *    mislead. The contraband key doubly so: there is no law in the arena to hide
 *    it from.
 *  - `bribePolice` — the same reason once more, and harder. An exercise has no
 *    hold to inspect, no police, and credits that are not the career's. So the
 *    one thing the key could do is spend money that is not there.
 *  - `toggleDockingComputer` — it flies you at a station 77,000 units away and
 *    docking is the one transition that writes the save.
 *  - `quitFlight` — it restores the CAREER's docked checkpoint, which is the one
 *    thing an exercise must never touch. The arena has its own way out on the
 *    same key. The filter below is what stops the cockpit's binding from
 *    shadowing it: a spread entry is matched before the two appended ones.
 *  - `launchEscapePod` — it docks the commander, and a dock writes the
 *    career's save. The clone may carry a pod, and the pod is the career's.
 *
 * Everything else the cockpit has is kept. That is the four views, the whole
 * missile cycle, the E.C.M., the energy bomb, the combat computer, mouse flight
 * and the torus drive. An exercise is meant to be the real ship.
 */
export const NOT_IN_THE_SIMULATOR: readonly Command[] = [
  'startHyperspace', 'galacticJump', 'distressBeacon', 'jettison1', 'jettison5',
  'jettisonContraband', 'bribePolice', 'toggleDockingComputer', 'quitFlight',
  'launchEscapePod',
];

/**
 * What a PAUSED cockpit answers. Everything else waits.
 *
 * A pause is not a menu in this game. It is the world stopped. So the list is
 * deliberately short: the key that starts it again, the one that gives up on
 * the flight, and one homage. Anything else would make a pause a place you can
 * play from, which is the thing a paused world is not.
 *
 * `armMisjump` is the homage, and Chris chose it on 2026-09-05 (docs/TODO/189).
 * The Spectrum's Elite let you pause, press F, and hear a beep. Every jump then
 * landed in witch-space until you did it again. It is a switch and not play:
 * the world stays stopped, and nothing moves until P.
 *
 * `quitFlight` is here because it is ONLY here. To give up a flight is a
 * deliberate act. The world has to be stopped first, which makes it two
 * decisions rather than one mistyped letter.
 *
 * The refusal when you press Q without a pause is the Game's, and not this
 * table's. A key that silently does nothing is a bug report, so it says what to
 * press instead.
 *
 * The same filter runs while the launch/docking TUNNEL is playing, where
 * nothing is paused at all. `quitFlight` reaches its handler there too and gets
 * the same honest refusal, which is why this list needs no third state.
 */
export const WHILE_PAUSED: readonly Command[] = ['togglePause', 'quitFlight', 'armMisjump'];

/**
 * The binding table. This IS the key map for commands — see CLAUDE.md's
 * key-bindings invariant, and `command-help.ts` for what each one does.
 */
export const BINDINGS: Record<ControlMode, readonly Binding[]> = {
  /**
   * The station menu: trade, outfit, take work, and leave.
   *
   * In MENU ORDER, and that is load-bearing rather than tidy. `ui/key-help.ts`
   * builds the menu's rows, and the keyline under them, straight from this
   * list. So the order here is the order on screen.
   *
   * Nothing else depends on it. No two docked bindings share a key, so the
   * first-match scan cannot see the difference. That is why the rows can be
   * arranged for a player.
   */
  docked: [
    // EVERY ROW IS A VIRTUAL CODE, and no row is a letter (docs/TODO/202 M2).
    // A tap or a click on the row injects the code, the cursor's Enter does
    // the same, and this table answers. A code is `Virt` and the command's
    // own name, so a row's key and its command cannot part company;
    // test/key-help.test.ts holds that. No keyboard produces one, so no
    // letter is spent here, and no modifier is read at the station.
    //
    // The order is the menu's order, top to bottom.
    { key: 'VirtLaunch', command: 'launch' },
    { key: 'VirtOpenMarket', command: 'openMarket' },
    { key: 'VirtOpenContracts', command: 'openContracts' },
    { key: 'VirtOpenEquip', command: 'openEquip' },
    // P used to clear the legal status. The station clears an Offender or
    // Fugitive record for a fine, by choice. A dock does not charge it at the door.
    { key: 'VirtPayFine', command: 'payFine' },
    { key: 'VirtOpenLocalChart', command: 'openLocalChart' },
    { key: 'VirtOpenChart', command: 'openChart' },
    // The menu advertised "D DATA ON SYSTEM" for months with nothing behind
    // it while docked. This reports the system you are standing on.
    { key: 'VirtOpenSystemData', command: 'openSystemData' },
    { key: 'VirtOpenStatus', command: 'openStatus' },
    { key: 'VirtOpenMissions', command: 'openMissions' },
    { key: 'VirtOpenLog', command: 'openLog' },
    { key: 'VirtOpenCombatSim', command: 'openCombatSim' },
    { key: 'VirtOpenBriefing', command: 'openBriefing' },
    { key: 'VirtToggleLayout', command: 'toggleLayout' },
    { key: 'VirtOpenSaves', command: 'openSaves' },
    { key: 'VirtExportSave', command: 'exportSave' },
    { key: 'VirtImportSave', command: 'importSave' },
    { key: 'VirtOpenTestMode', command: 'openTestMode' },
    // A destructive act shares a row with nothing. It asks first.
    { key: 'VirtAskNewGame', command: 'askNewGame' },
  ],

  /** The confirmation swallows every other key — that is the whole point of it. */
  confirmNewGame: [
    { key: 'KeyY', command: 'newGame' },
    { key: 'KeyX', command: 'exportSave' },   // back it up first
    { key: 'Escape', command: 'cancelNewGame' },
    { key: 'KeyQ', command: 'cancelNewGame' },
  ],

  /** The cockpit: views, weapons, the ship's computers, and the charts. */
  flight: FLIGHT_BINDINGS,

  /**
   * The galactic drive, with missions held: it swallows every other key until
   * she answers. Y jumps and fails them. Escape and N stay. The ship flies on
   * underneath, because a pause is its own key and this is not one.
   */
  confirmGalacticJump: [
    { key: 'KeyY', command: 'confirmGalacticJump' },
    { key: 'Escape', command: 'cancelGalacticJump' },
    { key: 'KeyN', command: 'cancelGalacticJump' },
  ],

  /**
   * The cockpit inside a training exercise: the same ship, minus every way out
   * of the arena, plus the two keys that end the exercise.
   *
   * Escape AND Q, deliberately. Escape is what every overlay in the game closes
   * with, so it is the key a hand reaches for. Q is the one that still works
   * where the browser claimed a keyboard's Escape.
   */
  simulator: [
    ...FLIGHT_BINDINGS.filter((b) => !NOT_IN_THE_SIMULATOR.includes(b.command)),
    { key: 'Escape', command: 'endExercise' },
    { key: 'KeyQ', command: 'endExercise' },
  ],

  /**
   * After a destruction: take the way back, or go and pick one.
   *
   * Enter is the guarantee. It is this career's docked checkpoint, which is by
   * construction the station you launched from.
   *
   * S is the same key that opens the commander file at the station. It is the
   * same screen, so a hand learns one key rather than two.
   */
  dead: [
    { key: 'Enter', command: 'respawn' },
    { key: 'KeyS', command: 'openSaves' },
  ],
};
