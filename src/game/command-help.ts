// What each command DOES, in the player's words. The captions to controls.ts.
//
// `controls.ts` owns which KEY asks for a command. This file owns the one line
// that says what the player gets. `Record<Command, CommandHelp>` welds the two
// together. Add a `Command` next door, and this file does not compile until
// somebody writes down what it does. That is the whole point.
//
// Invariant 9 used to be four hand-maintained lists, and it cost two live keys.
// The first is the distress beacon, which hands GalCop your cargo. The second
// is ⇧Y, which dumps five tonnes. Neither appeared in ANY help surface the game
// shipped.
//
// Nothing here is a rule and nothing branches on it. Three surfaces render it
// and none of them holds a copy:
//
//   the `?` panel      ui/key-help.ts paints it into play.html's hosts
//   the manual page    src/manual.ts renders the same tables
//   the station menu   ui/screens.ts builds its rows and keyline from it
//
// so a key that changes in `controls.ts` changes in all three, or the build
// fails.
//
// The README is the one surface still written by hand. It is prose for a reader
// who never launched the game. `test/key-help.test.ts` holds it to this table
// in both directions.

import type { Command } from './controls.ts';
import { TORUS_MULTIPLIER } from '../constants/torus.ts';

/**
 * Which table of the `?` guide a FLIGHT command belongs in.
 *
 * Only read for bindings in the cockpit — the other modes are one section
 * each, so a section is the mode. `test/key-help.test.ts` asserts every
 * cockpit command has one, which is the half a type cannot state.
 */
export type HelpSection = 'flight' | 'combat' | 'navigation';

export interface CommandHelp {
  /** One line. Lower case, no full stop — it is a table cell, not a sentence. */
  what: string;
  /** Which `?` table this appears in when it is bound in the cockpit. */
  section?: HelpSection;
  /**
   * The station menu's own words for it, when the command gets a MENU ROW.
   *
   * A row is a click target (`data-key`, invariant 13). So this is the label of
   * a control, rather than a description of one. Short, and upper case.
   */
  menu?: string;
  /**
   * The same, for the keyline UNDER the menu. It is bound at the station and
   * worth a mention, and it is not a row you can arrow onto.
   */
  keyline?: string;
}

/**
 * Every command, with what it does.
 *
 * Exhaustive by type. The order is the order the `?` guide and the manual read
 * in, because both render from the binding tables rather than from this one.
 * This is a dictionary, not a layout.
 */
export const COMMAND_HELP: Record<Command, CommandHelp> = {
  // --- the station menu -----------------------------------------------------
  launch: { what: 'launch from the station', menu: 'LAUNCH' },
  openMarket: { what: 'market prices — buy and sell cargo', menu: 'MARKET PRICES' },
  openEquip: { what: 'equip ship — fuel, missiles and upgrades', menu: 'EQUIP SHIP' },
  openBriefing: {
    // No page count in the caption. The pages are ui/screens.ts's BRIEFING
    // array, and a number here is a copy of its length, ready to go stale.
    what: "new pilot's briefing — what to actually do, page by page",
    menu: "NEW PILOT'S BRIEFING",
  },
  openSaves: {
    what: 'commander file — named saves and autosaves',
    keyline: 'COMMANDER FILE',
  },
  openSystemData: {
    what: 'data on the system you are standing on',
    menu: 'DATA ON SYSTEM',
  },
  openCombatSim: {
    what: 'combat training simulator — free, and nothing in it reaches your commander',
    menu: 'COMBAT TRAINING',
  },
  openTestMode: {
    what: 'test mode — development levers; the career that uses them is marked for good',
    // The keyline, and not a menu row. The keyline holds keys that work here
    // and are not controls you arrow onto (see CommandHelp.keyline). That is
    // the right shelf for a development door.
    keyline: 'TEST MODE',
  },
  payFine: { what: 'pay your fine — clears an Offender or Fugitive legal status', menu: 'PAY FINE' },
  exportSave: { what: 'export a save file', keyline: 'EXPORT' },
  importSave: { what: 'import a save file', keyline: 'IMPORT' },
  toggleLayout: { what: 'switch keyboard layout: classic / modern', keyline: 'KEYBOARD LAYOUT' },

  // --- the end of a commander -------------------------------------------------
  askNewGame: { what: 'start a new commander (asks first)', keyline: 'NEW COMMANDER' },
  newGame: { what: 'yes — name a new commander and start again' },
  cancelNewGame: { what: 'keep flying this commander' },

  // --- shared between the menu and the cockpit -------------------------------
  openChart: { what: 'galactic chart', section: 'navigation', menu: 'GALACTIC CHART' },
  openLocalChart: { what: 'short range chart', section: 'navigation', menu: 'LOCAL CHART' },
  openStatus: { what: 'commander status', section: 'navigation', menu: 'COMMANDER STATUS' },
  openMissions: {
    what: 'missions — what the Navy wants doing, and where',
    section: 'navigation',
    menu: 'MISSIONS',
  },
  openContracts: {
    what: 'contracts — the work you have signed for, and the board at a station',
    section: 'navigation',
    menu: 'CONTRACTS',
  },

  // --- the cockpit ----------------------------------------------------------
  view0: { what: 'front view', section: 'flight' },
  view1: { what: 'rear view', section: 'flight' },
  view2: { what: 'left view', section: 'flight' },
  view3: { what: 'right view', section: 'flight' },
  armMissile: {
    what: 'arm a missile — it locks when a target enters your sights',
    section: 'combat',
  },
  launchMissile: { what: 'fire the armed missile', section: 'combat' },
  disarmMissile: { what: 'unarm the missile', section: 'combat' },
  fireEcm: { what: 'E.C.M. — destroys incoming missiles (if fitted)', section: 'combat' },
  detonateEnergyBomb: {
    what: 'energy bomb — destroys everything close by (if fitted)',
    section: 'combat',
  },
  toggleCombatComputer: {
    what: 'combat computer — the trained defence AI flies your ship (if fitted)',
    section: 'combat',
  },
  toggleDockingComputer: {
    what: 'docking computer — flies you in; press again, or touch the controls, to take over',
    section: 'navigation',
  },
  toggleMouseFlight: {
    what: 'mouse flight — a pointer-locked analogue stick, left button fires',
    section: 'flight',
  },
  toggleTorus: {
    // The one caption that carries a number, and it is the drive's own rather
    // than a digit. It read "8×" while the step wrote 7. The two agreed only
    // because the step's 7 is one less than the total.
    what: `torus jump drive (${TORUS_MULTIPLIER}×; cuts out when something massive is near)`,
    section: 'flight',
  },
  togglePause: { what: 'pause', section: 'flight' },
  startHyperspace: { what: 'hyperspace jump to your target', section: 'navigation' },
  galacticJump: {
    what: 'galactic hyperdrive — one jump to the next galaxy (if fitted)',
    section: 'navigation',
  },
  distressBeacon: {
    what: 'distress beacon — GalCop tows you to the station AND TAKES YOUR CARGO',
    section: 'navigation',
  },
  jettison1: {
    what: 'jettison a tonne of cargo — pirates came for the goods, not for you',
    section: 'flight',
  },
  jettison5: { what: 'jettison five tonnes at once', section: 'flight' },
  jettisonContraband: {
    what: 'jettison a tonne of the ILLEGAL cargo — the evidence, which is rarely the most valuable thing aboard',
    section: 'flight',
  },
  bribePolice: {
    what: 'offer the police ship in front of you money — he may refuse and report you; it never clears your legal status, and it always costs your reputation',
    section: 'flight',
  },
  quitFlight: {
    what: 'pause first, then Q gives up the flight — asks, then puts you back at the station autosave you launched from',
    section: 'flight',
  },

  // --- the training simulator ------------------------------------------------
  endExercise: { what: 'end the exercise — nothing in it reaches your commander' },

  // --- after the end ---------------------------------------------------------
  respawn: { what: 'back to the station autosave you launched from' },

  // --- whatever is on screen -------------------------------------------------
  toggleHelp: { what: 'this controls guide', keyline: 'CONTROLS GUIDE' },
};
