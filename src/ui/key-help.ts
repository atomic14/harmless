// The key tables, rendered — the `?` panel, the manual page and the station
// menu, all from `BINDINGS` and `COMMAND_HELP` and from nothing else.
//
// This file exists to DELETE homes rather than to add one. Before it, a binding
// was written out by hand in six places. Two of them are the bindings
// themselves: keymap.ts and controls.ts. The other four were copies:
//
//   - play.html's `?` panel;
//   - the README;
//   - `manual.ts`'s own COMMANDS array;
//   - the docked menu in `ui/screens.ts`.
//
// Hope kept those four in step, and they were not in step. Three of the four
// render from here now. One surface is left where a key can move and leave what
// the game TELLS you behind: the README.
// `test/key-help.test.ts` holds that one to the table in both directions.
//
// It renders and nothing else: strings in, strings out, one guarded paint at
// the end. No rule is read from it and nothing branches on what it returns.

import {
  type Binding, type Command, type ControlMode,
} from '../game/controls.ts';
import {
  BINDINGS, GLOBAL_BINDINGS,
} from '../game/bindings.ts';
import { COMMAND_HELP, type HelpSection } from '../game/command-help.ts';
import { elementById } from '../engine/inert-dom.ts';

/** Physical key codes are not what anybody calls these. */
const LABELS: Record<string, string> = {
  Comma: ',',
  Period: '.',
  Slash: '/',
  Space: 'SPACE',
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  Tab: 'TAB',
  Escape: 'ESC',
  Enter: 'ENTER',
  // the virtual code Input synthesises for `?`, which is a shifted / on most
  // layouts and its own key on some
  Question: '?',
};

/**
 * The key that asks for `command` in `mode`'s table (or anywhere, for a
 * global binding), as the guide prints it.
 *
 * It is for PROSE that names a key, such as the briefing. So a sentence cannot
 * outlive the binding it quotes. The throw on an unbound command is the point.
 * Prose that quotes a key nothing answers should fail the build, not ship.
 */
export function boundKey(mode: ControlMode, command: Command): string {
  const key = keyIfBound(mode, command);
  if (key === null) throw new Error(`boundKey: '${command}' is not bound in '${mode}'`);
  return key;
}

/**
 * The same lookup. It answers `null`, and throws nothing.
 *
 * It is for the cockpit's key PROMPTS (game/prompts.ts). There an unbound
 * command is an ordinary answer rather than a mistake. The training arena
 * subtracts eight commands from the flight table (`NOT_IN_THE_SIMULATOR`). A
 * prompt for a key that mode does not bind must simply not appear.
 *
 * Prose still uses `boundKey`, which fails the build. The difference is that
 * somebody writes a sentence once, and a situation raises a prompt.
 */
export function keyIfBound(mode: ControlMode, command: Command): string | null {
  const b = [...BINDINGS[mode], ...GLOBAL_BINDINGS].find((x) => x.command === command);
  return b ? keyLabel(b.key, b.shift) : null;
}

/** What to print for a `KeyboardEvent.code`, with the modifier the table wants. */
export function keyLabel(code: string, shift = false): string {
  const name = LABELS[code]
    ?? (code.startsWith('Key') ? code.slice(3)
      : code.startsWith('Digit') ? code.slice(5) : code);
  return shift ? `⇧${name}` : name;
}

/** One row of a rendered table: the keys that ask for a command, and what it does. */
export interface HelpRow {
  /** every key bound to this command in this table, in table order */
  keys: string[];
  what: string;
}

/**
 * Bindings to rows. It merges the keys that ask for the SAME command.
 *
 * ESC and Q both cancel a new commander. Two rows that say the same thing read
 * as two different things.
 */
function helpRows(bindings: readonly Binding[]): HelpRow[] {
  const rows: HelpRow[] = [];
  const byCommand = new Map<string, HelpRow>();
  for (const b of bindings) {
    const found = byCommand.get(b.command);
    if (found) { found.keys.push(keyLabel(b.key, b.shift)); continue; }
    const row: HelpRow = { keys: [keyLabel(b.key, b.shift)], what: COMMAND_HELP[b.command].what };
    byCommand.set(b.command, row);
    rows.push(row);
  }
  return rows;
}

/** A section of the `?` guide: the element that holds it, and what goes in it. */
export interface GuideSection {
  /** the id of its host in play.html — an absent one is a section nobody sees */
  id: string;
  bindings: readonly Binding[];
}

const flightIn = (section: HelpSection): Binding[] =>
  BINDINGS.flight.filter((b) => COMMAND_HELP[b.command].section === section);

/**
 * The whole guide, as data.
 *
 * Every binding the game has sits in exactly one of these, and
 * `test/key-help.test.ts` asserts precisely that. So "a key documented nowhere"
 * is a test failure, rather than a discovery six months later.
 *
 * The cockpit is three sections, because a guide of twenty rows all alike is
 * not a guide. Every other mode is one section.
 */
export function guideSections(): GuideSection[] {
  const inFlight = new Set<Binding>(BINDINGS.flight);
  return [
    { id: 'help-flight', bindings: flightIn('flight') },
    { id: 'help-combat', bindings: flightIn('combat') },
    { id: 'help-navigation', bindings: flightIn('navigation') },
    { id: 'help-docked', bindings: BINDINGS.docked },
    { id: 'help-confirm', bindings: BINDINGS.confirmNewGame },
    { id: 'help-dead', bindings: BINDINGS.dead },
    // what the SIMULATOR adds to the cockpit; what it takes away is
    // NOT_IN_THE_SIMULATOR, and the panel says so in prose beside this
    { id: 'help-simulator', bindings: BINDINGS.simulator.filter((b) => !inFlight.has(b)) },
    { id: 'help-anywhere', bindings: GLOBAL_BINDINGS },
  ];
}

const rowsHtml = (rows: HelpRow[], key: (label: string) => string): string =>
  rows.map((r) => `<tr><td>${r.keys.map(key).join(' / ')}</td><td>${r.what}</td></tr>`).join('');

/** One `?`-panel table. Plain, because the panel's CSS styles bare cells. */
export const guideTableHtml = (bindings: readonly Binding[]): string =>
  `<table>${rowsHtml(helpRows(bindings), (k) => k)}</table>`;

/**
 * Paint every generated section of the `?` panel.
 *
 * It is called once at boot. `refreshHelpPanel()` rewrites the flight rows on
 * every toggle of the layout, and a command key is the same in both layouts.
 *
 * An absent host is inert rather than fatal (engine/inert-dom.ts). So this runs
 * headless, with no document at all.
 */
export function paintCommandGuide(): void {
  for (const section of guideSections()) {
    elementById(section.id).innerHTML = guideTableHtml(section.bindings);
  }
}

// --- the manual page --------------------------------------------------------

/**
 * The manual's command tables: the cockpit, then the station.
 *
 * The scope is the point. A hand-written table here listed D as a flight key
 * for months. It is bound on the station menu and nowhere else. A render per
 * MODE is what makes that impossible to get wrong.
 */
export function manualCommandsHtml(): string {
  const table = (bindings: readonly Binding[]): string =>
    `<table class="data cmd">${rowsHtml(helpRows(bindings), (k) => `<kbd>${k}</kbd>`)}</table>`;
  return `
    <h3>Commands in flight</h3>
    ${table([...BINDINGS.flight, ...GLOBAL_BINDINGS])}
    <h3>Commands at the station</h3>
    ${table(BINDINGS.docked)}`;
}

// --- the station menu -------------------------------------------------------


/**
 * The clickable rows themselves, taken as an argument.
 *
 * A SEAM, and it is there to be tested: `data-shift` is how a row sends what it
 * SHOWS — the label reads ⇧I, so the click presses ⇧I (docs/TODO/146) — and no
 * SHIPPED row is shifted today, so a test driving `dockedMenuHtml` alone could
 * only ever exercise the unshifted branch. `guideTableHtml` takes its bindings
 * for the same reason.
 */
export function menuRowsHtml(bindings: readonly Binding[]): string {
  return bindings
    .map((b) => `<div data-key="${b.key}"${b.shift ? ' data-shift="1"' : ''}>`
      + `<b>${keyLabel(b.key, b.shift)}</b> ${COMMAND_HELP[b.command].menu}</div>`)
    .join('\n      ');
}

/**
 * The docked menu's rows and the keyline under them.
 *
 * `data-key` IS the click path (invariant 13), so a row naming a key the table
 * does not have is a dead control that looks alive — which the menu shipped for
 * months as "D DATA ON SYSTEM" with no KeyD binding while docked. Generating
 * the rows FROM the table is what retires that failure: there is no longer a
 * way to write one.
 *
 * A docked command is a row if it has a menu label and a keyline entry if it
 * has a keyline one; `test/key-help.test.ts` asserts every docked binding has
 * exactly one of the two, so nothing bound at the station is unadvertised.
 *
 * **A ROW SENDS THE SHIFT IT PRINTS**, and this function is the one place that
 * says so: `data-shift` beside `data-key`, read by `ScreenHost.click` and by
 * the menu cursor's Enter, and carried on the TAP rather than set on the frame
 * (docs/TODO/146).
 *
 * It could not, once. `data-key` carried the key alone, so a click on a shifted
 * row pressed the plain key and the unshifted entry answered — `⇧I MISSIONS`
 * shipped for an afternoon and clicked through to COMMANDER STATUS
 * (docs/TODO/144 M6). `test/key-help.test.ts` presses every row, and that
 * assertion is now the proof this works rather than a ban on writing one.
 */
export function dockedMenuHtml(): string {
  const rows = menuRowsHtml(BINDINGS.docked.filter((b) => COMMAND_HELP[b.command].menu));
  // The keyline is not clickable, so it carries no data-key: these are keys
  // that work here, not controls you can arrow onto. `?` comes first because it
  // is the one that explains all the others.
  const line = [...GLOBAL_BINDINGS, ...BINDINGS.docked]
    .filter((b) => COMMAND_HELP[b.command].keyline)
    .map((b) => `${keyLabel(b.key, b.shift)} ${COMMAND_HELP[b.command].keyline}`)
    .join(' &middot; ');
  return `<div class="menu">
      ${rows}
    </div>
    <div class="keyline">${line}</div>`;
}

/**
 * The key and the label a console line points at, as `⇧I MISSIONS`.
 *
 * Invariant 9 forbids a message that spells a key out. Invariant 16 wants an
 * announcement to say where the rest of it lives. Both hold at once only where
 * the rule NAMES a command and the edge renders it. `game/prompts.ts` already
 * does that for the cockpit, and `game.ts` now does it for a `StationEvent`
 * that carries one.
 *
 * The label is the menu row's, then the keyline's, then nothing beyond the key.
 * A command advertised nowhere still points somewhere.
 */
export function keyPointer(mode: ControlMode, command: Command): string {
  const help = COMMAND_HELP[command];
  const label = help.menu ?? help.keyline ?? '';
  const key = boundKey(mode, command);
  return label ? `${key} ${label}` : key;
}

/** Every mode's table, for the tests that ask "is this key written down anywhere?" */
export const ALL_BINDINGS: readonly Binding[] = [
  ...GLOBAL_BINDINGS,
  ...(Object.keys(BINDINGS) as ControlMode[]).flatMap((m) => BINDINGS[m]),
];
