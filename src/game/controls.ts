// The command layer: the discrete things the player asks for, as data.
//
// Flight already had this seam. `FlightDemand` (src/player.ts) is what a pair
// of hands WANTS — rates, throttle, trigger — and a keyboard, the combat
// computer or a test harness can each produce one, all flown by the same
// `PlayerShip.update`. Everything else the player can do was still a
// hand-written `else if` chain of `input.pressed(...)` inside game.ts, and that
// cost three things: the bindings were not readable as a list, nothing but a
// browser could ask for one, and the only way to check that M opens the market
// was to play it.
//
// So this is the same move for the discrete half. This file DECIDES what was
// asked for and reports `Command`s; game.ts's `runCommand` applies them.
//
// THE GRAMMAR, NOT THE TABLES. What a `Command` is, what a `Binding` is, and
// how a table is scanned live here; WHICH key asks for what is `bindings.ts`,
// and what each one DOES in words is `command-help.ts`. All three are welded by
// `Command`: `command-help.ts` is a `Record<Command, CommandHelp>`, so a
// command with nothing written down about it does not compile.
//
// The tables left in docs/TODO/148, and the reason is worth keeping: three
// items in a row added a command, each pushed the combined file past the
// 400-line ceiling, and each time the answer was to cut a comment. The tables
// are what grow. The three rules below have not changed in months.
//
// It reads an INPUT, not a browser: `CommandInput` is the three methods a
// binding needs, `engine/input.ts` satisfies it structurally, and a replay or
// an AI satisfies it with an object literal. That is why this file is in the
// purity block despite being "the keyboard".
//
// Three rules the old chains encoded, all load-bearing. Each is a property of
// the SCAN and of the tables together, which is why `bindings.ts` names the two
// that constrain how a table is written:
//
//  - **One command per frame from a chain.** `Input.pressed()` consumes a tap,
//    so an `else if` chain could only ever run one branch. The scan stops at
//    the first match for that reason — it is not an optimisation. A tap the
//    chain did not reach is not dropped at the end of the frame any more
//    (`engine/input.ts` carries it, briefly and boundedly), so it is offered
//    to the NEXT frame's table — which is how a mashed key reaches the game
//    twice instead of once, and why the tables must stay per mode.
//  - **The view keys are independent.** The digit loop ran BEFORE the chain and
//    did not stop it, so 2 and G in the same frame still switches to the rear
//    view *and* opens the chart.
//  - **Shift is tested before the tap is consumed.** ⇧H is the galactic jump
//    and H the ordinary one; reading `pressed('KeyH')` first would eat the tap
//    on the shifted entry and then find nothing left for the plain one.

import { BINDINGS, GLOBAL_BINDINGS } from './bindings.ts';

/**
 * Everything the player can ask for that is not flying the ship.
 *
 * Deliberately intents, not actions: `openMarket`, never `screens.open`. What
 * a command COSTS — a beep, a screen, a save, a jump — is the Game's business,
 * which is what lets this file be a table.
 */
export type Command =
  // --- the station menu ---------------------------------------------------
  | 'launch'
  | 'openMarket'
  | 'openEquip'
  | 'openBriefing'
  | 'openSaves'
  | 'openSystemData'
  | 'openCombatSim'
  | 'openTestMode'
  | 'payFine'
  | 'exportSave'
  | 'importSave'
  | 'toggleLayout'
  // --- putting a commander down --------------------------------------------
  | 'askNewGame'
  | 'newGame'
  | 'cancelNewGame'
  // --- shared between the menu and the cockpit ----------------------------
  | 'openChart'
  | 'openLocalChart'
  | 'openStatus'
  | 'openMissions'
  | 'openContracts'
  // --- the cockpit --------------------------------------------------------
  | 'view0' | 'view1' | 'view2' | 'view3'
  | 'armMissile'
  | 'launchMissile'
  | 'disarmMissile'
  | 'fireEcm'
  | 'detonateEnergyBomb'
  | 'toggleCombatComputer'
  | 'toggleDockingComputer'
  | 'toggleMouseFlight'
  | 'toggleTorus'
  | 'togglePause'
  | 'startHyperspace'
  | 'galacticJump'
  | 'distressBeacon'
  | 'jettison1'
  | 'jettison5'
  | 'jettisonContraband'
  | 'bribePolice'
  | 'quitFlight'
  // --- the training simulator ---------------------------------------------
  | 'endExercise'
  // --- after the end ------------------------------------------------------
  | 'respawn'
  // --- whatever is on screen ----------------------------------------------
  | 'toggleHelp';

/**
 * Which set of bindings is live.
 *
 * `confirmNewGame` is a mode rather than a flag because that is what it is: the
 * put-this-commander-down confirmation swallows every other key, and saying so as a
 * table is both shorter and harder to get wrong than the early return it
 * replaced. The Game decides which mode it is in; the screen stack owns the
 * rest, so an open overlay never reaches this file at all.
 */
export type ControlMode = 'docked' | 'confirmNewGame' | 'flight' | 'simulator' | 'dead';

/**
 * The slice of `engine/input.ts` a binding needs.
 *
 * Three methods, structurally satisfied by `Input`. Nothing here knows what a
 * keydown is.
 */
export interface CommandInput {
  /** true once per tap, and CONSUMES it */
  pressed(code: string): boolean;
  /** live key state — used for modifiers, and never consumed */
  held(...codes: string[]): boolean;
  /** the shift the NEXT tap of this code carries, or null to ask `held` */
  tapShift(code: string): boolean | null;
}

export interface Binding {
  /** KeyboardEvent.code, or the 'Question' virtual code Input synthesises */
  key: string;
  /**
   * Require shift held (`true`) or ignore it (omitted). A shifted entry must
   * come FIRST for its key, since the plain one is the fallback.
   *
   * A MENU ROW MAY TAKE ONE TOO, since docs/TODO/146: the row sends the shift
   * it prints. `ui/key-help.ts` builds it and `test/key-help.test.ts` presses
   * every row to prove it.
   */
  shift?: boolean;
  /**
   * Read on its own: neither blocked by an earlier match nor blocking a later
   * one. Only the view keys, and only because the digit loop behaved that way.
   */
  independent?: boolean;
  command: Command;
}
/**
 * Does this binding fire this frame?
 *
 * The modifier is checked FIRST, deliberately: `pressed()` consumes, so asking
 * about the key before the shift state would swallow ⇧H's tap on the plain-H
 * entry and lose the jump. `tapShift` peeks for the same reason.
 *
 * A TAP ANSWERS FOR ITSELF WHERE IT CAN — a click carries the shift its row
 * printed, a real keydown carries null and defers to `held`. `Input.tapped`
 * says why that cannot be a flag on the frame (docs/TODO/146).
 */
function fires(b: Binding, i: CommandInput): boolean {
  if (b.shift !== undefined) {
    const tap = i.tapShift(b.key);
    const shifted = tap === null ? i.held('ShiftLeft', 'ShiftRight') : tap;
    if (b.shift !== shifted) return false;
  }
  return i.pressed(b.key);
}

/** Scan a table: every independent binding, then at most one from the chain. */
function scan(table: readonly Binding[], i: CommandInput): Command[] {
  const out: Command[] = [];
  for (const b of table) {
    if (b.independent && fires(b, i)) out.push(b.command);
  }
  for (const b of table) {
    if (b.independent) continue;
    if (fires(b, i)) { out.push(b.command); break; }
  }
  return out;
}

/** What the player asked for regardless of what is on screen. */
export function globalCommands(i: CommandInput): Command[] {
  return scan(GLOBAL_BINDINGS, i);
}

/**
 * What the player asked for in this mode, in the order it must be applied.
 *
 * The order is the old chain's: views before everything, because pressing 2
 * and G together switched view and then opened the chart, and a replay that
 * reversed them would open the chart from the wrong view.
 */
export function commandsFor(mode: ControlMode, i: CommandInput): Command[] {
  return scan(BINDINGS[mode], i);
}
