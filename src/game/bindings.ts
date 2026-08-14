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
  { key: 'KeyG', command: 'openChart' },
  { key: 'KeyN', command: 'openLocalChart' },
  { key: 'KeyI', command: 'openStatus' },
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
  // Q for QUIT. It is free in the cockpit. It is the same letter that backs out
  // of the new-commander confirmation at the station, and ends an exercise in
  // the arena. Three per-mode tables, one meaning: this is the key that gives
  // up on what you are doing.
  //
  // It answers only while PAUSED (see WHILE_PAUSED), and it asks before it
  // acts. So a flight given up takes three deliberate presses.
  { key: 'KeyQ', command: 'quitFlight' },
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
 *
 * Everything else the cockpit has is kept. That is the four views, the whole
 * missile cycle, the E.C.M., the energy bomb, the combat computer, mouse flight
 * and the torus drive. An exercise is meant to be the real ship.
 */
export const NOT_IN_THE_SIMULATOR: readonly Command[] = [
  'startHyperspace', 'galacticJump', 'distressBeacon', 'jettison1', 'jettison5',
  'jettisonContraband', 'bribePolice', 'toggleDockingComputer', 'quitFlight',
];

/**
 * What a PAUSED cockpit answers. Everything else waits.
 *
 * A pause is not a menu in this game. It is the world stopped. So the list is
 * deliberately two entries: the key that starts it again, and the one that
 * gives up on the flight. Anything else would make a pause a place you can play
 * from, which is the thing a paused world is not.
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
export const WHILE_PAUSED: readonly Command[] = ['togglePause', 'quitFlight'];

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
    { key: 'KeyL', command: 'launch' },
    { key: 'KeyM', command: 'openMarket' },
    { key: 'KeyC', command: 'openContracts' },
    { key: 'KeyE', command: 'openEquip' },
    { key: 'KeyN', command: 'openLocalChart' },
    { key: 'KeyG', command: 'openChart' },
    // The menu advertised "D DATA ON SYSTEM" all along, with nothing behind it
    // while docked. The only KeyD handlers were on the charts and the save
    // screen. This reports the system you are standing on.
    { key: 'KeyD', command: 'openSystemData' },
    { key: 'KeyI', command: 'openStatus' },
    // R for the standing oRders. A PLAIN letter, because this is a menu ROW —
    // see `Binding.shift`. R is the only one free in both tables, and this
    // screen is reached from the cockpit as well as from here.
    { key: 'KeyR', command: 'openMissions' },
    // ⇧T beside T, because the development levers and the simulator are the
    // two things on this menu that are not the career. It must come FIRST for
    // its key, because the plain entry is the fallback and would eat the tap
    // (see Binding). It is a keyline caption rather than a menu row. So its
    // position in this list decides where it sits on the keyline, and not the
    // menu's shape.
    { key: 'KeyT', shift: true, command: 'openTestMode' },
    // T for TRAINING. It is free on this menu, and it arms a missile in
    // FLIGHT. That is the established per-mode convention rather than a clash.
    // C is contracts docked and the docking computer in flight. M is the market
    // docked and launch-missile in flight. The tables are per mode.
    { key: 'KeyT', command: 'openCombatSim' },
    { key: 'KeyH', command: 'openBriefing' },
    // P to buy your name back. The station clears an Offender or Fugitive
    // record for a fine, by choice. A dock does not charge it at the door.
    { key: 'KeyP', command: 'payFine' },
    // --- the keyline under the menu: bound here, but not rows you arrow onto -
    { key: 'KeyB', command: 'toggleLayout' },
    { key: 'KeyS', command: 'openSaves' },
    { key: 'KeyX', command: 'exportSave' },
    { key: 'KeyZ', command: 'importSave' },
    // Q, not a shifted N. ⇧N shared a key with the local chart. A cancel of the
    // confirm with N, while shift was still down, re-opened it on the very next
    // tap. You could get stuck in a loop you couldn't type your way out of. A
    // destructive action should share a key with nothing, modifier or not.
    { key: 'KeyQ', command: 'askNewGame' },
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
