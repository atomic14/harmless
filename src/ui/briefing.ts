// The new pilot's briefing: what to actually DO, for somebody new to the game.
//
// Split out of `ui/screens.ts` by docs/TODO/149. It is the one block in that
// file that was DATA plus its own renderer. That data is player-facing prose,
// which `CLAUDE.md` deliberately exempts from the house style. A person who is
// stuck reads differently from a person at work on the code.
//
// Short and paged, rather than one long screen. Somebody here wants the next
// action, not a manual. The manual is at /manual.html.
//
// IT NAMES NO KEY (docs/TODO/225). A button is named by its words, and a
// station command is a row on the menu since docs/TODO/202. The prose names
// the row off the dictionary the menu paints from, so a renamed row renames
// its own prose. The `?` guide and the manual hold the key map.

import { MAX_FUEL, STARTING_CREDITS } from '../constants/commander.ts';
import { AUTOSAVE_INTERVAL } from '../constants/saves.ts';

import { show } from './screen-shell.ts';
import { TORUS_MULTIPLIER } from '../constants/torus.ts';
import { COMMAND_HELP } from '../game/command-help.ts';

/**
 * The pages. Five, one action each, in the cockpit's own words (docs/TODO/225).
 *
 * A BUTTON IS NAMED BY ITS WORDS, AND NO KEY IS NAMED. A phone has no keys,
 * and the `?` guide and the manual hold the key map for a desktop. A station
 * command is a row since docs/TODO/202, and the prose names the row off the
 * same dictionary the menu paints from. The chart's cursor keys are the
 * screen's own, so the chart page says "tap".
 *
 * NO SENTENCE SAYS WHERE A BUTTON IS, with one exception. The course list at
 * the top right is the one thing a first flight must find. Its place is the
 * same since docs/TODO/205. Every other position the old pages gave moved by
 * docs/TODO/222, and nothing could hold them.
 */
const ROW = {
  market: COMMAND_HELP.openMarket.menu,
  contracts: COMMAND_HELP.openContracts.menu,
  missions: COMMAND_HELP.openMissions.menu,
  equip: COMMAND_HELP.openEquip.menu,
  localChart: COMMAND_HELP.openLocalChart.menu,
  launch: COMMAND_HELP.launch.menu,
  briefing: COMMAND_HELP.openBriefing.menu,
};
export const BRIEFING: { title: string; body: string }[] = [
  {
    title: 'WHERE YOU ARE',
    body: `You are docked at a space station in your own Cobra Mk III, with
      ${STARTING_CREDITS / 10} credits and a rating of <b>Harmless</b>.<br/><br/>
      Buy cargo cheap here, sell it dear somewhere else, and spend the profit
      on a better ship. Every kill lifts your rating toward
      <b>Elite</b>.<br/><br/>
      Every command is a row on a menu or a button on the screen. Tap it, or
      click it. <b>${ROW.briefing}</b> on the station menu brings this
      briefing back whenever you want it.`,
  },
  {
    title: 'BUY, SELL, AND FUEL',
    body: `Open <b>${ROW.market}</b>. <b>Agricultural</b> worlds sell food,
      textiles, liquor and furs cheaply. <b>Industrial</b> worlds sell
      machinery, computers and alloys cheaply. Each pays well for the other's
      goods, so fill the hold with what is cheap here.<br/><br/>
      <b>${ROW.contracts}</b> pays better for the same trip, with a deadline.
      <b>${ROW.missions}</b> shows who has work for you, when somebody
      does.<br/><br/>
      Before you go, open <b>${ROW.equip}</b> and fill the tank. A jump burns
      fuel, and an empty tank goes nowhere.`,
  },
  {
    title: 'GO',
    body: `Open <b>${ROW.localChart}</b>. The circle is how far a full tank
      takes you: ${MAX_FUEL / 10} light years. Tap a world inside it with the
      opposite economy to this one.<br/><br/>
      Then <b>${ROW.launch}</b>, and choose <b>JUMP TO</b> your world. The
      ship leaves, jumps and arrives by itself.<br/><br/>
      You arrive a long way from the planet. Open <b>ACTIONS</b> at the top
      right and choose <b>FLY TO THE STATION</b>. The ship flies there on the
      torus drive, at ${TORUS_MULTIPLIER} times speed. <b>▶▶</b>
      hurries the trip while nothing hostile is near. The game saves at every
      dock, and every ${AUTOSAVE_INTERVAL} seconds in flight.`,
  },
  {
    title: 'A FIGHT',
    body: `Sooner or later somebody opens fire. The computer takes the stick
      and lines the ship up. The trigger is yours: hold <b>FIRE LASER</b> in
      short bursts, because a laser overheats.<br/><br/>
      <b>◎</b> lists what is out there, and a row sends the computer
      after that ship. <b>ARM MISSILE</b> arms one. It locks when a ship
      crosses your sights, and <b>FIRE MISSILE</b> sends it. <b>E.C.M.</b>
      destroys a missile coming at you.<br/><br/>
      If it goes badly, <b>RUN FOR IT</b> joins <b>ACTIONS</b>, and buttons offer
      what fits: pay a patrol off, or throw cargo to a pirate. If the
      worst happens, death puts you back at the last station you docked at,
      without the flight you were on.`,
  },
  {
    title: 'DOCK',
    body: `The station turns, and its port turns with it. <b>FLY TO THE
      STATION</b> flies the approach, stops in front of the port, and hands
      you the last stretch.<br/><br/>
      Two things are yours. The roll: the port is a letterbox, so drag the
      <b>DRAG TO ROLL</b> strip until you are the same way up. The speed:
      hold <b>THRUST</b> or <b>BRAKE</b> to cross the mark on the speed bar.
      The marker turns green when you are lined up. Go in.<br/><br/>
      Get it wrong and you bounce clear and try again. When you can afford
      one, buy a docking computer, and the <b>DOCKING COMPUTER</b> button
      flies the slot for you. The full manual, with a worked first run, is at
      <a href="/manual" target="_blank">/manual</a>.`,
  },
];
/** How many pages the briefing has, so the Game clamps and imports nothing. */
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
    <div class="buttons">
      <button data-key="ArrowLeft">&larr; PREVIOUS</button>
      <button data-key="ArrowRight">NEXT &rarr;</button>
      <button data-key="Escape">CLOSE</button>
    </div>
    <div class="keyline">
      &larr; &rarr; TURN THE PAGE &middot; ESC CLOSE
    </div>
  `);
}
