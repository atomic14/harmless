// The new pilot's briefing: what to actually DO, for somebody who has never played.
//
// Split out of `ui/screens.ts` by docs/TODO/149. It is the one block in that file
// that was DATA plus the renderer for it, and the data is player-facing prose —
// which `CLAUDE.md` deliberately exempts from the house style, because a person
// who is stuck reads differently from a person who is maintaining something.
//
// Short and paged rather than one long screen: somebody reading this wants the
// next action, not a manual. The manual is at /manual.html.
//
// EVERY KEY IT NAMES IS READ OFF THE BINDING TABLE (`boundKey`), so a rebound
// command rewrites its own prose and an unbound one fails the build. The chart's
// cursor keys are the screen's own (`game/screens/chart.ts`), not bindings, so
// those stay written out.

import { MAX_FUEL, STARTING_CREDITS } from '../constants/commander.ts';
import { AUTOSAVE_INTERVAL } from '../constants/saves.ts';

import { show } from './screen-shell.ts';
import { TORUS_MULTIPLIER } from '../constants/torus.ts';
import { boundKey } from './key-help.ts';

/**
 * Confirmation for starting over — spells out what is about to be destroyed
 * and points at the export key first, the only action that throws away a career.
 */
/**
 * The in-game briefing: what to actually DO, for someone who has never played.
 *
 * Short and paged rather than one long screen: somebody reading this is stuck
 * and wants the next action, not a manual — the manual exists at /manual.html.
 */
// Every key the briefing names is read off the binding table (`boundKey`), so
// a rebound command rewrites its own prose and an unbound one fails the build.
// The chart's cursor keys are the screen's own (screens/chart.ts), not
// bindings, so those stay written out. The briefing explains goals and
// consequences; the complete key map is the `?` guide and the manual.
const KEY = {
  market: boundKey('docked', 'openMarket'),
  contracts: boundKey('docked', 'openContracts'),
  localChart: boundKey('docked', 'openLocalChart'),
  launch: boundKey('docked', 'launch'),
  briefing: boundKey('docked', 'openBriefing'),
  help: boundKey('docked', 'toggleHelp'),
  jump: boundKey('flight', 'startHyperspace'),
  torus: boundKey('flight', 'toggleTorus'),
  dockingComputer: boundKey('flight', 'toggleDockingComputer'),
  jettison: boundKey('flight', 'jettison1'),
  ecm: boundKey('flight', 'fireEcm'),
  armMissile: boundKey('flight', 'armMissile'),
  fireMissile: boundKey('flight', 'launchMissile'),
};
export const BRIEFING: { title: string; body: string }[] = [
  {
    title: 'WHERE YOU ARE',
    body: `You are docked at a space station in your own Cobra Mk III, with
      ${STARTING_CREDITS / 10} credits and no reputation at all.<br/><br/>
      Nobody will give you a mission or tell you where to go. You make money by
      hauling cargo between worlds that want different things, and you spend it
      on a better ship, and that is the whole game. The only score that matters
      is your combat rating, which starts at <b>Harmless</b>.<br/><br/>
      Everything on this menu is a letter key. <b>&uarr; &darr;</b> and
      <b>ENTER</b> work too. <b>${KEY.help}</b> shows every control, here and
      in flight; <b>${KEY.briefing}</b> reopens this briefing whenever you
      want it back.`,
  },
  {
    title: 'MAKE SOME MONEY',
    body: `Press <b>${KEY.market}</b> for the market.<br/><br/>
      Worlds are short of what they do not make. <b>Agricultural</b> worlds sell
      food, textiles, liquor and furs cheaply. <b>Industrial</b> worlds sell
      machinery, computers and alloys cheaply — and each pays well for the
      other's goods.<br/><br/>
      So: buy a hold full of something cheap here, and sell it somewhere with
      the opposite economy. <b>Contracts</b> (<b>${KEY.contracts}</b>) pay
      better than plain cargo for the same trip, but they have deadlines.`,
  },
  {
    title: 'CHOOSE A DESTINATION',
    body: `Press <b>${KEY.localChart}</b> for the short range chart.<br/><br/>
      The dashed circle is how far your fuel will take you — ${MAX_FUEL / 10} light years on a
      full tank. Anything inside it you can reach.<br/><br/>
      Move the cursor with the <b>arrow keys</b>, press <b>ENTER</b> to set your
      target, <b>D</b> for a full report on a world, and <b>F</b> to search by
      name. Look for an economy opposite to this one.`,
  },
  {
    title: 'FLY THERE',
    body: `<b>${KEY.launch}</b> to launch, then <b>${KEY.jump}</b> to jump once
      you are clear of the station. The game saves on its own: a checkpoint at
      every docking, and an autosave every ${AUTOSAVE_INTERVAL} seconds in
      flight.<br/><br/>
      You come out of hyperspace a long way from the planet. Point at it and
      press <b>${KEY.torus}</b> for the torus drive — ${TORUS_MULTIPLIER} times speed. It cuts out near
      anything with mass: a planet, a station, or somebody who has come to meet
      you.<br/><br/>
      Watch the scanner in the middle of the console. You are the centre. Red
      contacts are hostile.`,
  },
  {
    title: 'A FIGHT',
    body: `Sooner or later somebody opens fire. Your laser shoots straight
      ahead: put them in the crosshair and hold the trigger — the stick and
      trigger depend on your keyboard layout, and <b>${KEY.help}</b> shows
      yours. Lasers overheat; short bursts.<br/><br/>
      <b>${KEY.armMissile}</b> arms a missile, which locks when a target
      crosses your sights; <b>${KEY.fireMissile}</b> fires it.<br/><br/>
      Kills raise your rating toward <b>Elite</b>. If the fight goes badly, run
      — and if the worst happens, death puts you back at the last station you
      docked at, without the flight you were on.`,
  },
  {
    title: 'DOCKING',
    body: `The hard part, and everybody finds it hard at first.<br/><br/>
      The station <b>rotates</b>, and so does its docking port. An amber marker
      shows where the port is, with an arrow at the edge of the screen when it
      is behind you.<br/><br/>
      Get onto the axis straight out from the port, then <b>roll until you match
      its rotation</b> — the opening is a letterbox and you must be the same way
      up as it. Then go in slowly. The marker turns green when you are lined
      up.<br/><br/>
      When you can afford one, buy a <b>docking computer</b> and press
      <b>${KEY.dockingComputer}</b>.`,
  },
  {
    title: 'STAYING ALIVE',
    body: `Pirates want your cargo and they size you up first — a fat hold on a
      soft ship draws a crowd. Anarchies are the worst.<br/><br/>
      <b>${KEY.jettison}</b> jettisons cargo, and it genuinely works: a pirate
      who gets paid loses interest. <b>${KEY.ecm}</b> fires the E.C.M., which
      kills incoming missiles — equip one early. Your shields recharge, so
      turning to put a fresh face towards an attacker buys real time.<br/><br/>
      Police care about contraband and about who shot first.<br/><br/>
      The full manual, with a first-run worked example and rather more besides,
      is at <b>/manual.html</b>.`,
  },
];
/** How many pages the briefing has, so the Game can clamp without importing it. */
export const BRIEFING_PAGES = BRIEFING.length;
export function renderBriefing(page: number): void {
  const p = BRIEFING[Math.max(0, Math.min(BRIEFING.length - 1, page))];
  const n = BRIEFING.length;
  const dots = BRIEFING.map((_, i) =>
    `<span class="${i === page ? 'on' : ''}">&bull;</span>`).join('');
  show(`
    <h2>${p.title}</h2>
    <div class="rule"></div>
    <div class="info brief">${p.body}</div>
    <div class="pager">${dots} &nbsp; ${page + 1} / ${n}</div>
    <div class="keyline">
      &larr; &rarr; TURN THE PAGE &middot; ESC CLOSE &middot; FULL MANUAL AT /manual.html
    </div>
  `);
}
