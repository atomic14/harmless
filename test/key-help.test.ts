// A key is only bound once, and every surface that lists it renders from that.
//
// This is the enforcement half of docs/INVARIANTS.md invariant 9. A binding used to be
// written out by hand in six places and they disagreed: the combat computer,
// the energy bomb and the galactic jump were missing from the manual, the
// distress beacon — which hands GalCop your cargo — was in NO in-game help
// surface at all, ⇧Y was in none of them, and D was listed as a flight key when
// it is bound at the station and nowhere else.
//
// Three of those surfaces are generated now (`src/ui/key-help.ts`), so what is
// left to assert is the joins:
//
//   1. every binding, in every mode, lands in exactly one section of the `?`
//      guide — a key documented nowhere is a test failure, not a discovery
//   2. every section has a host in play.html to be painted into
//   3. every docked binding is either a menu row or on the keyline under it
//   4. the manual's tables are per MODE, so D cannot appear as a flight key
//   5. the README — the one surface still written by hand, because it is prose
//      for people who have not launched the game — lists exactly the keys the
//      table binds, in both directions
//
// The `what` of each command is welded by the type system rather than by a test:
// `COMMAND_HELP` is a `Record<Command, CommandHelp>`, so a command with nothing
// written down about it does not compile.

import { readFileSync } from 'node:fs';
import {
  BINDINGS, GLOBAL_BINDINGS, commandsFor,
  type Binding, type Command, type ControlMode,
} from '../src/game/controls.ts';
import { COMMAND_HELP } from '../src/game/command-help.ts';
import { rating, ratingLadder } from '../src/game/rating.ts';
import {
  ALL_BINDINGS, boundKey, dockedMenuHtml, guideSections, guideTableHtml, keyLabel,
  manualCommandsHtml, menuRowsHtml, paintCommandGuide,
} from '../src/ui/key-help.ts';
import { BRIEFING } from '../src/ui/screens.ts';
import { check, clicks, eq, eqc } from './harness.ts';

/** A binding's identity for these tests: the same key does the same thing. */
const id = (b: Binding): string => `${keyLabel(b.key, b.shift)} → ${b.command}`;
const sorted = (xs: string[]): string[] => [...new Set(xs)].sort();

console.log('\nthe ? guide documents every binding');
{
  const bound = sorted(ALL_BINDINGS.map(id));
  const documented = sorted(guideSections().flatMap((s) => s.bindings.map(id)));

  const missing = bound.filter((k) => !documented.includes(k));
  const invented = documented.filter((k) => !bound.includes(k));
  check(`every bound key is in a section of the guide (${bound.length} keys)`,
    missing.length === 0, missing.join(', '));
  check('...and the guide invents none', invented.length === 0, invented.join(', '));

  // The two directions above are one comparison, so this is the control that
  // says the comparison can fail at all: the same predicate, aimed at a table
  // of its own. Without it, a `guideSections()` that returned nothing and an
  // `ALL_BINDINGS` that collected nothing would both read as green.
  const fake: Binding[] = [{ key: 'KeyW', command: 'launch' }];
  check('...and that check is not vacuous',
    bound.length >= 40
    && fake.map(id).filter((k) => !documented.includes(k)).length === 1);

  // A cockpit binding with no `section` belongs to no table, so it would drop
  // out of the guide silently — the coverage check above catches it, and this
  // says which one and why.
  const sectionless = BINDINGS.flight.filter((b) => !COMMAND_HELP[b.command].section);
  check('every cockpit command says which table of the guide it belongs in',
    sectionless.length === 0, sectionless.map((b) => b.command).join(', '));

  // Each section's markup: one row per command, the keys that ask for it, and
  // what it does. Merged rows are the reason this is not a row count — ESC and
  // Q both end an exercise, and printing that twice reads as two rules.
  for (const section of guideSections()) {
    const html = guideTableHtml(section.bindings);
    const missingText = section.bindings
      .filter((b) => !html.includes(COMMAND_HELP[b.command].what));
    check(`${section.id} paints what each of its ${section.bindings.length} keys does`,
      section.bindings.length > 0 && missingText.length === 0,
      missingText.map((b) => b.command).join(', '));
  }

  const confirm = guideTableHtml(BINDINGS.confirmNewGame);
  check('two keys for one command are one row, not two',
    confirm.includes('<td>ESC / Q</td>'), confirm);

  // And the paint itself: each section's markup into its OWN host, which is the
  // step between "the guide is right" and "the panel shows it".
  const globals = globalThis as unknown as { document?: unknown };
  const previous = globals.document;
  const painted = new Map<string, string>();
  globals.document = {
    getElementById: (host: string) => ({
      set innerHTML(html: string) { painted.set(host, html); },
    }),
  };
  paintCommandGuide();
  const wrong = guideSections()
    .filter((s) => painted.get(s.id) !== guideTableHtml(s.bindings));
  check(`paintCommandGuide fills every host (${painted.size})`,
    wrong.length === 0, wrong.map((s) => s.id).join(', '));

  // With no document at all it is inert rather than fatal
  // (engine/inert-dom.ts), which is what lets a headless Game boot.
  delete globals.document;
  paintCommandGuide();
  globals.document = previous;
  check('...and painting it headlessly writes nothing and throws nothing',
    painted.size === guideSections().length);
}

console.log('\nthe ? panel has a host for every section');
{
  const play = readFileSync(new URL('../play.html', import.meta.url), 'utf8');
  const homeless = guideSections().filter((s) => !play.includes(`id="${s.id}"`));
  check(`play.html hosts every generated section (${guideSections().length})`,
    homeless.length === 0, homeless.map((s) => s.id).join(', '));
  check('...and that check is not vacuous', !play.includes('id="help-nonesuch"')
    && play.includes('id="help-docked"'));
  // The four flight-axis rows are NOT generated — they change with the layout
  // and engine/keymap.ts rewrites them in place — so their ids have to survive.
  const axes = ['help-pitch', 'help-pitch-desc', 'help-roll', 'help-decel', 'help-fire'];
  const lost = axes.filter((axis) => !play.includes(`id="${axis}"`));
  check('...and the layout-dependent rows keymap.ts rewrites are still there',
    lost.length === 0, lost.join(', '));
}

console.log('\nthe station menu advertises exactly what is bound there');
{
  const both = BINDINGS.docked.filter((b) => {
    const help = COMMAND_HELP[b.command];
    return (help.menu === undefined) === (help.keyline === undefined);
  });
  check('every docked command is a menu row or a keyline entry, never both or neither',
    both.length === 0, both.map((b) => b.command).join(', '));

  const menu = dockedMenuHtml();
  const rowKeys = [...menu.matchAll(/data-key="([^"]+)"/g)].map((m) => m[1]);
  const wanted = BINDINGS.docked.filter((b) => COMMAND_HELP[b.command].menu).map((b) => b.key);
  eq('the rows are the docked bindings that have a row, in table order',
    rowKeys.join(','), wanted.join(','));

  const keyline = (menu.match(/<div class="keyline">([^<]*)</) ?? ['', ''])[1];
  const unadvertised = [...GLOBAL_BINDINGS, ...BINDINGS.docked]
    .filter((b) => COMMAND_HELP[b.command].keyline)
    .filter((b) => !keyline.includes(`${keyLabel(b.key, b.shift)} ${COMMAND_HELP[b.command].keyline}`));
  check(`the keyline carries the rest (${keyline})`,
    unadvertised.length === 0, unadvertised.map((b) => b.command).join(', '));
  check('...and neither of those is vacuous',
    rowKeys.length >= 8 && keyline.includes('? CONTROLS GUIDE'));

  // A ROW IS A CLICK TARGET, so PRESS each one. Every rule above asks what a row
  // ADVERTISES; this asks what it DOES, which is the half that was missing when
  // `⇧I MISSIONS` shipped for an afternoon and clicked through to COMMANDER
  // STATUS (docs/TODO/144 M6).
  //
  // The tap carries the row's own shift (docs/TODO/146), so this is the proof
  // that the mechanism works rather than a ban on writing a shifted row. It
  // reads the RENDERED markup, not the table, because `data-shift` is what the
  // browser will actually send.
  const rendered = [...menu.matchAll(/data-key="([^"]+)"(?:\s+data-shift="([^"]*)")?/g)]
    .map((m) => ({ key: m[1], shift: m[2] === '1' }));
  const rowFor = (b: { key: string; shift?: boolean }) =>
    rendered.find((r) => r.key === b.key && r.shift === (b.shift === true));
  const clicked = BINDINGS.docked
    .filter((b) => COMMAND_HELP[b.command].menu)
    .filter((b) => {
      const row = rowFor(b);
      return !row || !commandsFor('docked', clicks([row])).includes(b.command);
    });
  check('clicking a menu row asks for the command the row advertises',
    clicked.length === 0,
    clicked.map((b) => `${keyLabel(b.key, b.shift)} ${COMMAND_HELP[b.command].menu}`).join(', '));

  // NO SHIPPED ROW IS SHIFTED TODAY — ⇧T is a keyline caption — so the loop
  // above can only exercise the unshifted branch, and it read green through the
  // whole of docs/TODO/144 M6 while the shifted case was broken. `menuRowsHtml`
  // takes its bindings so the branch can be driven directly.
  const shiftedRow = menuRowsHtml([{ key: 'KeyT', shift: true, command: 'openTestMode' }]);
  check('a shifted row prints the modifier it will send',
    shiftedRow.includes('data-key="KeyT"') && shiftedRow.includes('data-shift="1"')
    && shiftedRow.includes('⇧T'), shiftedRow);
  const plainRow = menuRowsHtml([{ key: 'KeyT', command: 'openCombatSim' }]);
  check('an unshifted row prints no modifier', !plainRow.includes('data-shift'));

  // ...and pressed through the REAL table. ⇧T and T are the station's one
  // shifted pair, so this is the join the emitter alone cannot make: the row's
  // modifier reaches `commandsFor` and picks the shifted entry over the plain
  // one that shares its key.
  eqc('a click carrying the row\'s shift asks for the shifted command',
    commandsFor('docked', clicks([{ key: 'KeyT', shift: true }])), ['openTestMode']);
  eqc('...and without it, the plain entry answers',
    commandsFor('docked', clicks([{ key: 'KeyT' }])), ['openCombatSim']);
}

console.log('\nthe manual page is generated per mode');
{
  const html = manualCommandsHtml();
  const split = html.indexOf('Commands at the station');
  check('the manual has a flight table and a station table', split > 0);
  const inFlight = html.slice(0, split);
  const atStation = html.slice(split);

  const absent = (part: string, bindings: readonly Binding[]): Binding[] =>
    bindings.filter((b) => !part.includes(`<kbd>${keyLabel(b.key, b.shift)}</kbd>`));
  check('every cockpit key is in the flight table',
    absent(inFlight, [...BINDINGS.flight, ...GLOBAL_BINDINGS]).length === 0,
    absent(inFlight, BINDINGS.flight).map((b) => b.key).join(', '));
  check('every station key is in the station table',
    absent(atStation, BINDINGS.docked).length === 0,
    absent(atStation, BINDINGS.docked).map((b) => b.key).join(', '));

  // The bug the hand-written table had: D is bound on the station menu and
  // nowhere else, and it was printed as a flight command.
  check('D is a station key, and the flight table does not claim it',
    atStation.includes('<kbd>D</kbd>') && !inFlight.includes('<kbd>D</kbd>'));
  check('...and ⇧Y, which the old table missed entirely, is there',
    inFlight.includes('<kbd>⇧Y</kbd>'));
}

console.log('\nthe README lists exactly what is bound');
{
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');

  /** The first column of one README table, as the keys it names. */
  const advertised = (heading: string): string[] => {
    const from = readme.indexOf(heading);
    const rest = readme.slice(from + heading.length);
    const end = rest.indexOf('\n##');
    return sorted(rest.slice(0, end === -1 ? undefined : end)
      .split('\n')
      .filter((line) => line.startsWith('|'))
      .map((line) => line.split('|')[1].replaceAll(/[*`]/g, '').trim())
      .filter((cell) => cell !== '' && !/^-+$/.test(cell) && cell !== 'Key')
      .flatMap((cell) => cell.split(/[\s/]+/))
      .filter(Boolean));
  };

  const table = (heading: string, bindings: readonly Binding[]): void => {
    const listed = advertised(heading);
    const want = sorted(bindings.map((b) => keyLabel(b.key, b.shift)));
    const missing = want.filter((k) => !listed.includes(k));
    const extra = listed.filter((k) => !want.includes(k));
    check(`README "${heading.trim()}" lists every key that is bound (${want.length})`,
      missing.length === 0, missing.join(', '));
    check(`README "${heading.trim()}" lists nothing that is not bound`,
      extra.length === 0, extra.join(', '));
  };

  table('### Commands (identical in both layouts)',
    [...BINDINGS.flight, ...GLOBAL_BINDINGS]);
  table('### Docked\n', BINDINGS.docked);

  // The control: the parser found a table, and the predicate says no when a
  // key is absent. A heading that stopped matching would leave two empty lists
  // and two passes, which is exactly how a vacuous guard reads.
  const flight = advertised('### Commands (identical in both layouts)');
  check('...and the README parser is reading a real table',
    flight.length >= 20 && flight.includes('TAB') && flight.includes('⇧H')
    && !flight.includes('D'));
}

console.log('\nthe briefing surfaces the whole first journey');
{
  // The newcomer journey — trade, launch, navigate, jump, fight, escape,
  // dock — as the commands that carry it. Each must be quoted in the briefing
  // with the key the table actually binds; the pages interpolate `boundKey`,
  // so a REBOUND key rewrites its own prose, and what this holds is that the
  // guidance is not REMOVED — docs/TODO/106 milestone 3.
  const journey: [ControlMode, Command][] = [
    ['docked', 'openMarket'], ['docked', 'openContracts'],
    ['docked', 'openLocalChart'], ['docked', 'launch'],
    ['docked', 'openBriefing'], ['docked', 'toggleHelp'],
    ['flight', 'startHyperspace'], ['flight', 'toggleTorus'],
    ['flight', 'armMissile'], ['flight', 'launchMissile'],
    ['flight', 'fireEcm'], ['flight', 'jettison1'],
    ['flight', 'toggleDockingComputer'],
  ];
  const text = BRIEFING.map((p) => `${p.title} ${p.body}`).join(' ');
  const unquoted = journey
    .filter(([mode, c]) => !text.includes(`<b>${boundKey(mode, c)}</b>`))
    .map(([, c]) => c);
  check(`every journey command is quoted with its bound key (${journey.length})`,
    unquoted.length === 0, unquoted.join(', '));

  // The control: a bound key the briefing deliberately does not teach.
  check('...and the check can fail — the briefing does not quote ⇧Y',
    !text.includes(`<b>${boundKey('flight', 'jettison5')}</b>`));

  // Where the pilot starts and what dying does, in the same words everywhere:
  // the README promises the auto-opening briefing and H as the way back, and
  // the briefing's death line matches the respawn the game ships.
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  check('the README promises the automatic first briefing',
    readme.includes('opens by itself the first time'));
  check('...and H as the permanent way back',
    readme.includes(`**${boundKey('docked', 'openBriefing')}** at the station reopens it`));
  check('the briefing tells a pilot what death does',
    text.includes('death puts you back at the last station'));
}

console.log('\nthe modes the guide covers are the modes there are');
{
  // A new ControlMode with a table of its own would otherwise be documented
  // nowhere and nothing would say so: the coverage check at the top reads
  // `ALL_BINDINGS`, which walks `Object.keys(BINDINGS)`, so it grows on its
  // own — this is what makes sure it does.
  const modes = Object.keys(BINDINGS) as ControlMode[];
  const counted = modes.flatMap((m) => BINDINGS[m]).length + GLOBAL_BINDINGS.length;
  eq('ALL_BINDINGS walks every mode', ALL_BINDINGS.length, counted);
}

// --- the same bargain, applied to the combat ladder --------------------------
//
// Invariant 9 is written about keys, but the rule under it is general: a
// surface that LISTS something renders from the thing it lists. The manual's
// rating ladder was the other hand-written list on that page, and it had gone
// wrong the same way — nine rungs printed against ten in the table, missing
// BELOW AVERAGE, so a commander could read their own rating off the status
// screen and fail to find it on the chart. It is `#rating-ladder`, filled by
// `src/manual.ts` from `game/rating.ts`, and this is what keeps it that way.
console.log('\nthe manual renders the combat ladder rather than restating it');
{
  const manual = readFileSync(new URL('../manual.html', import.meta.url), 'utf8');
  const ladder = ratingLadder();
  check(`the ladder runs Harmless to E L I T E (${ladder.length} rungs)`,
    ladder[0] === 'Harmless' && ladder[ladder.length - 1] === 'E L I T E'
    && ladder.includes('Below Average'));
  // ...and every rung is a score somebody can actually hold, so `ratingLadder`
  // and `rating` cannot drift apart into a name nothing returns.
  const reachable = new Set<string>();
  for (let s = 0; s <= 25_600; s++) reachable.add(rating(s));
  check(`every rung is reachable (${reachable.size} of ${ladder.length})`,
    reachable.size === ladder.length && ladder.every((r) => reachable.has(r)));
  check('the manual has a host for it', manual.includes('id="rating-ladder"'));
  // What is banned is the LIST, not the words. The page says "Poor worlds have
  // the sharpest prices" and "Most commanders die Competent", and both are
  // prose. A hand-written ladder is two rungs IN ORDER with a separator between
  // them, so that is what this looks for.
  const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pairs = (page: string): string[] => ladder.slice(1)
    .map((r, i) => [ladder[i], r] as const)
    .filter(([a, b]) => new RegExp(`${esc(a)}[\\s\\S]{0,30}?${esc(b)}`).test(page))
    .map(([a, b]) => `${a}→${b}`);
  check(`...and writes no rung out beside the next one (${pairs(manual).join(', ') || 'no run of the ladder in the page'})`,
    pairs(manual).length === 0);
  // The control: the same predicate against a page that DOES write the ladder
  // out, so a mangled regex cannot make the check above read green.
  check('...and that check can fail',
    pairs(`<p class="ladder">${ladder.join(' · ')}</p>`).length === ladder.length - 1);
  check('the prose still names both ends',
    manual.includes('<b>Harmless</b>') && manual.includes('<b>E L I T E</b>'));
}
