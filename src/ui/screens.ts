import {
  type StarSystem, type MarketEntry, ECONOMY_NAMES, GOVERNMENT_NAMES, COMMODITIES, speciesName,
} from '../galaxy/galaxy.ts';
import { planetDescription } from '../galaxy/goatsoup.ts';
import { systemDescription } from '../galaxy/descriptions.ts';
import { escapeHtml } from '../engine/escape-html.ts';
import { HUD, TINT } from '../palette.ts';
import { distanceTenths, distanceSqToPoint } from '../galaxy/navigation.ts';
import {
  type CommanderData, type Contract,
  cargoTonnes, formatCredits, cargoCapacity,
} from '../game/commander.ts';
import { MAX_FUEL, STARTING_CREDITS } from '../constants/commander.ts';
import { AUTOSAVE_INTERVAL } from '../constants/saves.ts';
import { rating } from '../game/rating.ts';
import { characterName } from '../game/character.ts';
import {
  equipmentOwned, fuelQuote, type FuelQuote,
} from '../game/shop.ts';
import { EQUIPMENT_CATALOGUE } from '../constants/shop.ts';
import {
  saveLabel, type LiveRun, type LoadCost, type SaveSummary,
} from '../game/save-file.ts';
import { describeContract } from '../game/contract-offers.ts';
import type { MarketEstimate } from '../game/market.ts';
import type { ChartState } from '../game/chart-state.ts';
import {
  overlayLegend, type ChartOverlay, type ChartOverlays,
} from '../game/chart-overlay.ts';
import type { PriceDrift } from '../galaxy/price-divergence.ts';
import type { TradeLane } from '../galaxy/trade-lanes.ts';
import { LANE_CARGO_NAMED, LANE_FADE_FLOOR } from '../constants/chart-overlay.ts';
import {
  type CombatSimReport, type OpeningGeometry, type WaveEscalation,
} from '../game/combat-sim-report.ts';
import { PASS_CLOSE, PASS_FAR } from '../constants/combat-record.ts';
import { brainName } from '../game/brain-names.ts';
import type {
  CompareGroup, SimComparePanel,
} from '../game/combat-sim-compare.ts';
import type { SimSetupPanel, SimSetupRow } from '../game/screens/combat-sim-setup.ts';
import type { TestModePanel } from '../game/screens/test-mode.ts';
import { elementById, inertElement } from '../engine/inert-dom.ts';
import { TORUS_MULTIPLIER } from '../constants/torus.ts';
import { TENTHS_PER_CHART_UNIT, CHART_Y_SQUASH } from '../constants/chart-metric.ts';
// The station menu's rows ARE the docked binding table — see ui/key-help.ts.
// A hand-written row here would be a second home for a key, and `data-key`
// becomes a keystroke, so it could advertise a key nothing was bound to.
import { boundKey, dockedMenuHtml } from './key-help.ts';
import {
  LOCAL_SCALE, LOCAL_CANVAS, CHART_CANVAS_W, CHART_CANVAS_H,
} from '../constants/chart-metric.ts';

// Full-page overlay screens, rendered as DOM. The Game owns all input and
// state; these are pure render functions.

// Inert with no document, so a headless Game can run the mode machine and the
// screen stack without a DOM — see engine/inert-dom.ts. Nothing reads these
// writes back, so dropping them changes no rule.
const el = (): HTMLElement => elementById('screen');
const body = (): HTMLElement => (typeof document === 'undefined'
  ? inertElement() : document.body);
/** These four callers already handle a missing element, so null is the honest answer. */
const maybeById = (id: string): HTMLElement | null => (typeof document === 'undefined'
  ? null : document.getElementById(id));

export function hideScreen(): void {
  body().classList.remove('screen-open');
  el().classList.add('hidden');
}

function show(html: string, wide = false): void {
  const s = el();
  s.innerHTML = html;
  s.classList.remove('hidden');
  // charts put their readout beside the map rather than under it, so they need
  // more width than a table screen
  s.classList.toggle('wide', wide);
  // Drop the cockpit console while a screen is up: nothing on a screen needs
  // the scanner or gauges, and the console otherwise costs the screen a third
  // of the viewport.
  body().classList.add('screen-open');
}

export function renderDockedMenu(sys: StarSystem, c: CommanderData, missionText = ''): void {
  show(`
    <h2>${sys.name.toUpperCase()} STATION</h2>
    <div class="rule"></div>
    <div class="info" style="text-align:center">
      ${ECONOMY_NAMES[sys.economy]} &middot; ${GOVERNMENT_NAMES[sys.government]} &middot; TECH LEVEL ${sys.techLevel + 1}<br/>
      ${formatCredits(c.credits)} &middot; FUEL ${(c.fuel / 10).toFixed(1)} LY &middot; MISSILES ${c.missiles}
      ${missionText ? `<br/><span style="color:var(--hud-amber)">${missionText}</span>` : ''}
    </div>
    ${dockedMenuHtml()}
  `);
}

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

export function renderNewGameConfirm(sys: StarSystem, c: CommanderData): void {
  show(`
    <h2>NEW COMMANDER</h2>
    <div class="rule"></div>
    <div class="info" style="text-align:center; line-height:2">
      This will put the commander you are flying aside:<br/>
      <span style="color:var(--hud-amber)">
        ${sys.name.toUpperCase()} &middot; ${formatCredits(c.credits)} &middot;
        ${c.kills} KILLS &middot; ${rating(c.combatScore ?? c.kills).toUpperCase()}
      </span><br/>
      and start again at Lave with 100.0 Cr.<br/>
      <span style="opacity:0.8; font-size:11px">
        NOTHING IS DELETED &mdash; every save on the commander file (S) stays
        where it is, this one included.<br/>
        You will be asked what the new commander is called.<br/>
        Press ESC or Q to cancel, X to export a backup first.
      </span>
    </div>
    <div class="buttons">
      <button data-key="KeyY">Y — NAME A NEW COMMANDER</button>
      <button data-key="Escape">ESC — CANCEL</button>
    </div>
  `);
}

/**
 * @param fuel what the station charges for fuel, or null where none is sold —
 *   a rock hermit trades cargo but cannot fill your tank, and a price for
 *   something unbuyable is worse than no price. The caller decides which.
 */
export function renderMarket(
  sys: StarSystem,
  market: MarketEntry[],
  c: CommanderData,
  selected: number,
  fuel: FuelQuote | null = null,
): void {
  const rows = market
    .map((m, i) => `
      <tr class="${i === selected ? 'sel' : ''} pick" data-row="${i}">
        <td>${m.name.toUpperCase()}</td>
        <td class="num">${m.price.toFixed(1)}</td>
        <td class="num">${m.quantity}${m.unit}</td>
        <td class="num">${c.cargo[i] > 0 ? c.cargo[i] + COMMODITIES[i].unit : '-'}</td>
      </tr>`)
    .join('');
  show(`
    <h2>${sys.name.toUpperCase()} MARKET</h2>
    <div class="rule"></div>
    <table>
      <tr><th>PRODUCT</th><th class="num">PRICE (Cr)</th><th class="num">FOR SALE</th><th class="num">IN HOLD</th></tr>
      ${rows}
    </table>
    ${fuel ? `<div class="keyline">
      FUEL ${formatCredits(fuel.perLightYear)}/LY &middot; ${fuel.full ? 'TANK FULL'
        : `TANK ${(c.fuel / 10).toFixed(1)}/${(MAX_FUEL / 10).toFixed(1)} LY &middot; ${formatCredits(fuel.cost)} TO FILL AT EQUIP SHIP`}
    </div>` : ''}
    <div class="buttons">
      <button data-key="KeyB">BUY 1</button>
      <button data-key="VirtBuyMax">BUY MAX</button>
      <button data-key="KeyV">SELL 1</button>
      <button data-key="VirtSellAll">SELL ALL</button>
      <button data-key="Escape">DONE</button>
    </div>
    <div class="keyline">
      CASH ${formatCredits(c.credits)} &middot; HOLD ${cargoTonnes(c)}/${cargoCapacity(c)}t
      &nbsp;&mdash;&nbsp; CLICK A ROW &middot; &uarr;&darr; SELECT &middot; B BUY (&#8679;B MAX) &middot; V SELL (&#8679;V ALL) &middot; ESC EXIT
    </div>
  `);
}

// --- Equip Ship ------------------------------------------------------------

export interface EquipRow {
  id: string;
  label: string;
  price: number; // tenths; 0 = nothing to buy
  status: '' | 'OWNED' | 'TL-LOCKED';
}

/** Purchasable rows for this station, shared by renderer and purchase logic. */
/**
 * @param cheat playtesting only — lifts the tech-level lock so anything in the
 *   catalogue can be fitted anywhere. See `GameState.cheat` in state.ts.
 */
export function equipRows(sys: StarSystem, c: CommanderData, cheat = false): EquipRow[] {
  const fuel = fuelQuote(c);
  const rows: EquipRow[] = [{
    id: 'fuel',
    label: `Fuel (${(fuel.needed / 10).toFixed(1)} LY needed)`,
    price: fuel.cost,
    status: fuel.full ? 'OWNED' : '',
  }];
  for (const item of EQUIPMENT_CATALOGUE) {
    const owned = equipmentOwned(item.id, c);
    const locked = !cheat && sys.techLevel + 1 < item.minTL;
    rows.push({
      id: item.id,
      label: item.name,
      price: item.price,
      status: owned ? 'OWNED' : locked ? 'TL-LOCKED' : '',
    });
  }
  return rows;
}

export function renderEquip(
  sys: StarSystem, c: CommanderData, selected: number, cheat = false,
): void {
  const rows = equipRows(sys, c, cheat)
    .map((r, i) => `
      <tr class="${i === selected ? 'sel' : ''} pick" data-row="${i}">
        <td>${r.label.toUpperCase()}</td>
        <td class="num">${r.price > 0 ? (r.price / 10).toFixed(1) : '-'}</td>
        <td class="num">${
          r.status === 'OWNED' ? 'OWNED'
          : r.status === 'TL-LOCKED' ? 'NOT AVAILABLE HERE'
          : cheat ? 'FREE'
          : ''
        }</td>
      </tr>`)
    .join('');
  show(`
    <h2>EQUIP SHIP &mdash; ${sys.name.toUpperCase()}</h2>
    <div class="rule"></div>
    ${cheat ? '<div class="info" style="text-align:center;color:var(--hud-amber)">CHEAT MODE &mdash; EVERYTHING FITTED FREE, ANY TECH LEVEL</div>' : ''}
    <table>
      <tr><th>ITEM</th><th class="num">PRICE (Cr)</th><th class="num"></th></tr>
      ${rows}
    </table>
    <div class="buttons">
      <button data-key="KeyB">BUY SELECTED</button>
      <button data-key="Escape">DONE</button>
    </div>
    <div class="keyline">
      CASH ${formatCredits(c.credits)} &middot; MISSILES ${c.missiles}
      &nbsp;&mdash;&nbsp; CLICK AN ITEM TO SELECT &middot; B / ENTER BUY &middot; ESC EXIT
    </div>
  `);
}

/** What the commander file is being asked, if anything. */
export interface SavesPending {
  /** a delete waiting on Y */
  deleting: SaveSummary | null;
  /** a load waiting on a second ENTER, and what it is about to cost */
  loading: { row: SaveSummary; cost: LoadCost } | null;
}

/** `DAVE, FILED UNDER ▶ CHRIS`, or just `▶ CHRIS` when nothing was renamed. */
function whoLine(live: LiveRun): string {
  const filed = `<span style="color:var(--hud-amber)">&#9654; ${live.career}</span>`;
  return live.name === live.career ? filed : `${live.name}, FILED UNDER ${filed}`;
}

/**
 * The commander file: the saves you named, the saves the game made, and the run
 * you are in — which is a LINE and not a row, because it is not a save.
 *
 * Every column answers one question a player asks (docs/TODO/55). COMMANDER is
 * the filing name, the one thing a rename does not move — so the line above the
 * table says both when they differ. SAVE is what the row IS: a name you typed,
 * or STATION AUTOSAVE / FLIGHT AUTOSAVE. One line shape for both halves (WHEN,
 * WHERE, worth), so choosing among the autosaves is a glance, not a read.
 */
export function renderSaves(
  rows: SaveSummary[],
  selected: number,
  live: LiveRun,
  pending: SavesPending,
): void {
  // A confirmation is MODAL: it names one row, so while it is up the rows stop
  // offering themselves to a click and the one key that acts on a different
  // noun — R, the pilot's name — stops being offered at all.
  const asking = Boolean(pending.deleting || pending.loading);
  const body = rows.map((r, i) => `
      <tr class="${i === selected ? 'sel' : ''} ${asking ? '' : 'pick'}"
        ${asking ? '' : `data-row="${i}"`}>
        <td>${r.career === live.career ? '&#9654;' : ''}${r.career}</td>
        <td>${saveLabel(r)}</td>
        <td>${r.when}</td>
        <td>${r.where}</td>
        <td class="num">${formatCredits(r.credits)}</td>
        <td>${r.rating}</td>
        <td class="num">DAY ${r.day}</td>
      </tr>`).join('')
    || `<tr><td colspan="7" style="opacity:0.5">&mdash; NOTHING SAVED YET
        ${live.over ? '' : '&mdash; S SAVES THE RUN ABOVE'} &mdash;</td></tr>`;
  const standing = `${live.place} &middot; ${formatCredits(live.credits)}
    &middot; ${live.rating} &middot; DAY ${live.day}`;
  const buttons = pending.deleting
    ? `<div class="buttons">
         <button data-key="KeyY">Y &mdash; DELETE ${saveLabel(pending.deleting)}</button>
         <button data-key="Escape">ESC &mdash; KEEP IT</button>
       </div>
       <div class="keyline note-warn">
         DELETE ${saveLabel(pending.deleting)}? THIS CANNOT BE UNDONE.
       </div>`
    : pending.loading
      ? `<div class="buttons">
           <button data-key="Enter">ENTER &mdash; LOAD ${saveLabel(pending.loading.row)}</button>
           ${pending.loading.cost.saveFirst
    ? '<button data-key="KeyS">S &mdash; SAVE THIS RUN FIRST</button>' : ''}
           <button data-key="Escape">ESC &mdash;
             ${live.over ? 'BACK' : `KEEP FLYING ${live.career}`}</button>
         </div>
         <div class="keyline ${pending.loading.cost.grave ? 'note-warn' : ''}">
           ${pending.loading.cost.note}
         </div>`
      : `<div class="buttons">
           ${live.over ? '' : '<button data-key="KeyS">S &mdash; SAVE THIS RUN</button>'}
           <button data-key="Enter">ENTER &mdash; LOAD THIS ONE</button>
           <button data-key="KeyD">D &mdash; DELETE THIS ONE</button>
           <button data-key="Escape">ESC &mdash; ${live.over ? 'BACK' : 'DONE'}</button>
         </div>
         <div class="keyline">
           &#9654; IS THE COMMANDER YOU ARE FLYING &middot; A STATION AUTOSAVE IS WRITTEN
           EVERY TIME YOU DOCK AND EVERY TIME YOU LAUNCH, AND IT IS WHERE A DEATH PUTS
           YOU BACK &middot; A FLIGHT AUTOSAVE IS THE LAST MINUTE OF FLYING, AND DOCKING
           OR DYING DROPS IT
         </div>`;
  show(`
    <h2>COMMANDER FILE</h2>
    <div class="rule"></div>
    <div class="info" style="text-align:center">
      ${live.over
    ? `YOUR SHIP IS DESTROYED &mdash; ${whoLine(live)} AT ${standing}`
    : `YOU ARE FLYING ${whoLine(live)} &mdash; ${standing}`}
    </div>
    ${live.over || asking ? '' : `<div class="buttons">
      <button data-key="KeyR">R &mdash; CHANGE WHAT YOU ARE CALLED</button>
    </div>`}
    <div class="rule"></div>
    <table>
      <tr><th>COMMANDER</th><th>SAVE</th><th>WHEN</th><th>WHERE</th>
        <th class="num">CASH</th><th>RATING</th><th class="num">DAY</th></tr>
      ${body}
    </table>
    ${buttons}
  `);
}

/**
 * Naming a save. The default offered is the commander's own name, and typing
 * REPLACES it rather than appending — there is no way to select text here.
 */
export function renderSavePrompt(buffer: string, confirming: boolean): void {
  show(`
    <h2>SAVE COMMANDER</h2>
    <div class="rule"></div>
    <div class="info" style="text-align:center; line-height:2.2">
      <span style="font-size:26px; letter-spacing:6px; color:var(--hud-amber)">
        ${buffer.length ? buffer : '&nbsp;'}<span style="opacity:0.6">_</span>
      </span><br/>
      ${confirming
        ? `<span class="note-warn">${buffer} ALREADY EXISTS &mdash; REPLACE IT?</span><br/>
           <span style="font-size:11px; opacity:0.8">Y REPLACE &middot; ESC BACK</span>`
        : `<span style="font-size:11px; opacity:0.7">
             A NAME THAT ALREADY EXISTS REPLACES IT &mdash; IT ASKS FIRST
           </span><br/>
           <span style="font-size:11px; opacity:0.8">
             LETTERS AND NUMBERS &middot; BACKSPACE &middot; ENTER TO SAVE &middot; ESC TO CANCEL
           </span>`}
    </div>
    <div class="buttons">
      ${confirming
        ? '<button data-key="KeyY">Y &mdash; REPLACE</button>'
        : '<button data-key="Enter">ENTER &mdash; SAVE</button>'}
      <button data-key="Escape">ESC &mdash; BACK</button>
    </div>
  `);
}

/**
 * RENAMING a commander, Elite-style: letters go straight in.
 *
 * `filedUnder` is the name their saves are keyed by, and it is on the screen
 * because this is the one act in the game where the two names come apart: a
 * rename changes what you are called and deliberately does not move a save
 * (screens/saves.ts). A player who is told that once is not surprised by a
 * list that still says the old name.
 */
export function renderNaming(buffer: string, current = '', filedUnder = ''): void {
  show(`
    <h2>COMMANDER NAME</h2>
    <div class="rule"></div>
    <div class="info" style="text-align:center; line-height:2.2">
      <span style="font-size:26px; letter-spacing:6px; color:var(--hud-amber)">
        ${buffer.length ? buffer : '&nbsp;'}<span style="opacity:0.6">_</span>
      </span><br/>
      <span style="font-size:11px; opacity:0.7">
        ${current ? `CURRENTLY ${current} &mdash; ESC KEEPS IT` : ''}
        ${filedUnder ? `<br/>THIS CHANGES WHAT YOU ARE CALLED &mdash;
          YOUR SAVES STAY FILED UNDER ${filedUnder}` : ''}
      </span><br/>
      <span style="font-size:11px; opacity:0.8">
        LETTERS AND NUMBERS &middot; BACKSPACE &middot; ENTER TO CONFIRM &middot; ESC TO CANCEL
      </span>
    </div>
  `);
}

/**
 * Naming a NEW commander — the first thing that happens to one.
 *
 * Blank, and nothing offered: a pre-filled field on these screens cannot be
 * selected, so the first keystroke would have to replace it (docs/TODO/56).
 *
 * @param leaving whoever is being set aside, so ESC says what it goes back to.
 */
export function renderNewCommander(buffer: string, leaving = ''): void {
  show(`
    <h2>NAME YOUR COMMANDER</h2>
    <div class="rule"></div>
    <div class="info" style="text-align:center; line-height:2.2">
      <span style="font-size:26px; letter-spacing:6px; color:var(--hud-amber)">
        ${buffer.length ? buffer : '&nbsp;'}<span style="opacity:0.6">_</span>
      </span><br/>
      <span style="font-size:11px; opacity:0.7">
        THIS IS WHO THE NEW SAVES BELONG TO &mdash;
        IT CANNOT BE A NAME ALREADY IN USE
      </span><br/>
      <span style="font-size:11px; opacity:0.8">
        LETTERS AND NUMBERS &middot; BACKSPACE &middot; ENTER TO BEGIN &middot;
        ESC ${leaving ? `KEEPS FLYING ${leaving}` : 'TO CANCEL'}
      </span>
    </div>
    <div class="buttons">
      <button data-key="Enter">ENTER &mdash; BEGIN</button>
      <button data-key="Escape">ESC &mdash; CANCEL</button>
    </div>
  `);
}

export function renderStatus(
  systems: StarSystem[],
  c: CommanderData,
  targetIndex: number | null,
  legalName: string,
): void {
  const sys = systems[c.systemIndex];
  const cargoLines = c.cargo
    .map((qty, i) => (qty > 0 ? `${COMMODITIES[i].name}: ${qty}${COMMODITIES[i].unit}` : null))
    .filter(Boolean)
    .join(' &middot; ') || 'Empty';
  const equipmentLines = EQUIPMENT_CATALOGUE
    .filter((item) => item.id !== 'missile' && equipmentOwned(item.id, c))
    .map((item) => item.name)
    .join(' &middot; ') || 'Standard fit';
  show(`
    <h2>COMMANDER ${c.name}</h2>
    <div class="rule"></div>
    <div class="info">
      Present system: ${sys.name}<br/>
      Hyperspace target: ${targetIndex === null ? 'None' : systems[targetIndex].name}<br/>
      Legal status: ${legalName}<br/>
      Character: ${characterName(c.disrepute ?? 0)}<br/>
      Fuel: ${(c.fuel / 10).toFixed(1)} / ${(MAX_FUEL / 10).toFixed(1)} light years<br/>
      Cash: ${formatCredits(c.credits)}<br/>
      Missiles: ${c.missiles}<br/>
      Equipment: ${equipmentLines}<br/>
      Cargo: ${cargoLines}<br/>
      ${c.trumbles > 0 ? `<span style="color:var(--hud-red)">Trumbles: ${c.trumbles}</span><br/>` : ''}
      Kills: ${c.kills}<br/>
      Rating: <span style="color:var(--hud-amber)">${rating(c.combatScore ?? c.kills).toUpperCase()}</span>
      ${c.tested ?? false
        ? '<br/><span style="color:var(--hud-amber)">Test mode: used in this career</span>'
        : ''}
    </div>
    <div class="buttons"><button data-key="Escape">BACK</button></div>
  `);
}

// The chart metric now lives in galaxy/navigation.ts, which owns it for the
// game, the contracts and the campaign alike. Re-exported here because the
// charts are its heaviest user and every caller already reaches for it from
// this module.
export { distanceTenths };

/**
 * Nearest system to a chart coordinate, within `radius` chart units
 * (measured with the half-weight-y metric the charts are drawn in).
 */
export function nearestSystem(
  systems: StarSystem[],
  x: number,
  y: number,
  radius = 12,
): StarSystem | null {
  let best: StarSystem | null = null;
  let bestD = radius * radius;
  for (const s of systems) {
    const d = distanceSqToPoint(s, x, y);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

/**
 * The trade lanes, faded by how much freight is on them — on both charts.
 *
 * Alpha rather than a second green: the busiest lane in the galaxy and the
 * quietest one drawn should not read alike, and a brightness ramp spelled in
 * new hex would be four more rungs on the chart ladder in src/palette.ts. The
 * floor keeps the quietest lane visible; without it the tail simply vanishes
 * and the threshold might as well have dropped it.
 *
 * The pointed-at lane is drawn last at full strength, so the line you are
 * reading about is the one that stands out.
 */
function drawLanes(
  ctx: CanvasRenderingContext2D,
  overlays: ChartOverlays,
  systems: StarSystem[],
  px: (s: { x: number; y: number }) => number,
  py: (s: { x: number; y: number }) => number,
): void {
  if (!overlays.lanes.length) return;
  // heaviest first out of busyLanes(), so the head is the scale
  const heaviest = overlays.lanes[0].tonnes || 1;
  const stroke = (lane: TradeLane, alpha: number): void => {
    const a = systems[lane.a];
    const b = systems[lane.b];
    if (!a || !b) return;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(px(a), py(a));
    ctx.lineTo(px(b), py(b));
    ctx.stroke();
  };

  ctx.strokeStyle = TINT.lane;
  for (const lane of overlays.lanes) {
    if (lane === overlays.hovered) continue;
    stroke(lane, LANE_FADE_FLOOR + (1 - LANE_FADE_FLOOR) * (lane.tonnes / heaviest));
  }
  if (overlays.hovered) {
    // the one being read about, in the brighter green the in-range systems use
    ctx.strokeStyle = HUD.green;
    stroke(overlays.hovered, 1);
  }
  // EVERY dot, ring, tick and crosshair after this shares the context
  ctx.globalAlpha = 1;
}

/**
 * What the lane under the pointer is carrying, in one line.
 *
 * Presentation, not a rule: `galaxy/trade-lanes.ts` decided which lane and
 * what is on it, and this only spells it — which is why the commodity NAMES
 * and the "in N days" arithmetic live here rather than in the model.
 */
function laneSummaryParts(lane: TradeLane, systems: StarSystem[], day: number): [string, string] {
  const cargo = lane.commodities.slice(0, LANE_CARGO_NAMED)
    .map((c) => COMMODITIES[c]?.name.toUpperCase()).filter(Boolean);
  const more = lane.commodities.length - cargo.length;
  const days = lane.soonestEta - day;
  const arrival = days <= 0 ? 'ARRIVING NOW'
    : days === 1 ? 'NEXT ARRIVAL TOMORROW'
      : `NEXT ARRIVAL IN ${days} DAYS`;
  // Literal · and ↔ rather than &middot;/&harr;: this reads as HTML on the
  // galactic chart's keyline and is painted into the canvas on the short-range
  // one, and only the characters themselves work in both.
  return [
    `${systems[lane.a]?.name.toUpperCase()} ↔ ${systems[lane.b]?.name.toUpperCase()}`
      + ` · ${lane.convoys} CONVOYS · ${lane.tonnes}t`,
    `${cargo.join(', ')}${more > 0 ? ` +${more}` : ''} · ${arrival}`,
  ];
}

/**
 * The whole line, for the galactic chart's keyline — which has the page's full
 * width. The short-range chart paints the two halves on two lines instead: its
 * canvas is 560px and the joined line runs off the end of it.
 */
const laneSummary = (lane: TradeLane, systems: StarSystem[], day: number): string =>
  laneSummaryParts(lane, systems, day).join(' · ');

/**
 * A tick above a system trading dear, below one trading cheap — on both charts.
 *
 * The tell is a SHAPE and a DIRECTION rather than a second colour scale: the
 * palette is green and amber (src/palette.ts owns it), it has no blue, and
 * inventing one for a price would be a fifth colour in a game that has four.
 * Amber is the one the target marker already uses, and cheap borrows the green
 * a world in range is drawn in — the same invitation, said twice. Up and down
 * carry the meaning, so a reader who cannot separate the two greens still gets
 * it right.
 */
function drawPriceTells(
  ctx: CanvasRenderingContext2D,
  prices: ReadonlyMap<number, PriceDrift>,
  systems: StarSystem[],
  px: (s: { x: number; y: number }) => number,
  py: (s: { x: number; y: number }) => number,
  reach: number,
): void {
  for (const [index, drift] of prices) {
    const s = systems[index];
    if (!s) continue;
    const up = drift === 'dear';
    ctx.strokeStyle = up ? HUD.amber : TINT.lift;
    const x = px(s);
    const y = py(s);
    // The tail starts clear of the dot rather than on it: at 2.5px a system,
    // a tick that began at the centre read as a blob rather than an arrow.
    const tip = up ? y - reach : y + reach;
    const base = up ? y - reach * 0.55 : y + reach * 0.55;
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.lineTo(x, tip);
    // the arrowhead, two strokes off the tip
    ctx.moveTo(x - 2.5, up ? tip + 2.5 : tip - 2.5);
    ctx.lineTo(x, tip);
    ctx.lineTo(x + 2.5, up ? tip + 2.5 : tip - 2.5);
    ctx.stroke();
  }
}

export function renderChart(
  systems: StarSystem[],
  c: CommanderData,
  chart: ChartState,
  overlays: ChartOverlays,
): void {
  show(`
    <h2>GALACTIC CHART ${c.galaxy}</h2>
    <div class="rule"></div>
    <canvas id="chart-canvas" width="${CHART_CANVAS_W}" height="${CHART_CANVAS_H}"></canvas>
    <div class="keyline" id="chart-info"></div>
    <div class="keyline">${chartKeyline(overlays.mode)}</div>
  `);
  drawChart(systems, c, chart, overlays);
}

/**
 * The chart keys and what the overlays mean. ONE home, used by both charts:
 * they were two hand-written copies and the second was always the one that
 * fell behind. Chart keys are the screen's own and exempt from the binding
 * tables (see the note at the top of this file), so this line is where they
 * live.
 */
const chartKeyline = (mode: ChartOverlay): string =>
  'CLICK A SYSTEM TO TARGET IT &middot; ARROWS MOVE &middot; ENTER TARGET'
  + ' &middot; D DATA ON SYSTEM &middot; M MARKET &middot; F FIND &middot; ESC EXIT'
  + ` &middot; ${overlayLegend(mode)} &middot; RED RING: PIRATE ACTIVITY`;

/**
 * Redraw only the canvas + info line (cheap, for cursor moves).
 *
 * `overlays` is decided by the models in `galaxy/` — this only paints it, and
 * draws whatever it is handed without knowing which mode is up.
 */
export function drawChart(
  systems: StarSystem[],
  c: CommanderData,
  chart: ChartState,
  overlays: ChartOverlays,
): void {
  const canvas = maybeById('chart-canvas') as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;
  const sx = w / 256;
  const sy = h / 128;
  const px = (s: { x: number; y: number }) => s.x * sx;
  const py = (s: { x: number; y: number }) => (s.y / CHART_Y_SQUASH) * sy;
  const current = systems[c.systemIndex];

  ctx.clearRect(0, 0, w, h);

  // Fuel range. An ellipse is correct HERE — unlike the short-range chart —
  // because sx and sy scale the two axes independently to fit the whole galaxy
  // into the canvas, so a circle in light years is not a circle in pixels.
  // Semi-axes are R*sx and R*sy with R = fuel/TENTHS_PER_CHART_UNIT (the chart
  // metric read backwards, hence the import rather than a literal 4).
  ctx.strokeStyle = TINT.fuelRing;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.ellipse(px(current), py(current), (c.fuel / TENTHS_PER_CHART_UNIT) * sx,
    (c.fuel / TENTHS_PER_CHART_UNIT) * sy, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Trade lanes, UNDER the systems: freight passes beneath the worlds it
  // serves, and a line over a 2.5px dot would swallow it.
  drawLanes(ctx, overlays, systems, px, py);

  // Systems. Given size and light because 256 of them are the whole point of
  // this screen and 1.5px of dim green on near-black is close to invisible.
  for (const s of systems) {
    const within = distanceTenths(current, s) <= c.fuel;
    ctx.fillStyle = within ? TINT.lift : TINT.far;
    const r = s.index === c.systemIndex ? 4.5 : 2.5;
    ctx.fillRect(px(s) - r / 2, py(s) - r / 2, r, r);
  }

  drawPriceTells(ctx, overlays.prices, systems, px, py, 8);

  // Pirate activity: the same fact the system data screen prints in words.
  // Drawn over the dots so a flagged world reads at a glance, in the red the
  // cursor already uses rather than a colour of its own.
  ctx.strokeStyle = HUD.red;
  for (const index of overlays.danger) {
    const s = systems[index];
    if (!s) continue;
    ctx.beginPath();
    ctx.arc(px(s), py(s), 5, 0, Math.PI * 2);
    ctx.stroke();
  }

  // current system crosshair
  ctx.strokeStyle = HUD.green;
  ctx.beginPath();
  ctx.moveTo(px(current) - 8, py(current)); ctx.lineTo(px(current) + 8, py(current));
  ctx.moveTo(px(current), py(current) - 8); ctx.lineTo(px(current), py(current) + 8);
  ctx.stroke();

  // target marker
  if (chart.targetIndex !== null) {
    const t = systems[chart.targetIndex];
    ctx.strokeStyle = HUD.amber;
    ctx.beginPath();
    ctx.arc(px(t), py(t), 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  // cursor
  ctx.strokeStyle = HUD.red;
  const cx = chart.cursorX * sx;
  const cy = (chart.cursorY / 2) * sy;
  ctx.beginPath();
  ctx.moveTo(cx - 6, cy); ctx.lineTo(cx + 6, cy);
  ctx.moveTo(cx, cy - 6); ctx.lineTo(cx, cy + 6);
  ctx.stroke();

  const info = maybeById('chart-info');
  if (info) {
    // A lane under the pointer takes the line: it is what you are pointing at,
    // and the cursor's system comes back the moment you leave it.
    if (overlays.hovered) {
      info.innerHTML = laneSummary(overlays.hovered, systems, overlays.day);
      return;
    }
    const near = nearestSystem(systems, chart.cursorX, chart.cursorY);
    if (near) {
      const d = distanceTenths(current, near);
      info.innerHTML =
        `${near.name.toUpperCase()} &middot; ${(d / 10).toFixed(1)} LY` +
        ` &middot; ${ECONOMY_NAMES[near.economy]} &middot; ${GOVERNMENT_NAMES[near.government]}` +
        ` &middot; TL ${near.techLevel + 1}` +
        (d > c.fuel ? ' &middot; <span style="color:var(--hud-red)">OUT OF RANGE</span>' : '');
    } else {
      info.textContent = ' ';
    }
  }
}

// --- Short range (local) chart ---------------------------------------------


export function renderLocalChart(
  systems: StarSystem[],
  c: CommanderData,
  chart: ChartState,
  overlays: ChartOverlays,
): void {
  show(`
    <h2>SHORT RANGE CHART</h2>
    <div class="rule"></div>
    <div class="chartrow" style="--chart-side:${LOCAL_CANVAS}px">
      <canvas id="local-canvas" width="${LOCAL_CANVAS}" height="${LOCAL_CANVAS}"></canvas>
      <div class="info" id="local-info"></div>
    </div>
    <div class="keyline">${chartKeyline(overlays.mode)}</div>
  `, true);
  drawLocalChart(systems, c, chart, overlays);
}

export function drawLocalChart(
  systems: StarSystem[],
  c: CommanderData,
  chart: ChartState,
  overlays: ChartOverlays,
): void {
  const canvas = maybeById('local-canvas') as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const current = systems[c.systemIndex];
  // x in chart units; y at half-weight so screen distance matches LY distance
  const px = (s: { x: number; y: number }) => cx + (s.x - current.x) * LOCAL_SCALE;
  const py = (s: { x: number; y: number }) =>
    cy + ((s.y - current.y) / CHART_Y_SQUASH) * LOCAL_SCALE;

  ctx.clearRect(0, 0, w, h);

  // fuel range circle (isotropic in this projection)
  ctx.strokeStyle = HUD.dim;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  // A CIRCLE, and it has to be one. distanceTenths divides dy by
  // CHART_Y_SQUASH and so does py(), so the plotted space is isotropic: equal
  // pixels mean equal light years in every direction, and reachable is a circle
  // of radius (fuel/TENTHS_PER_CHART_UNIT)*LOCAL_SCALE. The canvas is square
  // (see renderLocalChart) so the circle fits without clipping.
  ctx.arc(cx, cy, (c.fuel / TENTHS_PER_CHART_UNIT) * LOCAL_SCALE, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Trade lanes, under the systems as on the galactic chart. Lanes run up to
  // 7 LY, so one end is often off this zoom — the line is simply clipped by the
  // canvas, which reads correctly as freight heading out of the neighbourhood.
  drawLanes(ctx, overlays, systems, px, py);

  ctx.font = '10px Menlo, Consolas, monospace';
  for (const s of systems) {
    const x = px(s);
    const y = py(s);
    if (x < -20 || x > w + 20 || y < -12 || y > h + 12) continue;
    const within = distanceTenths(current, s) <= c.fuel;
    ctx.fillStyle = within ? HUD.green : TINT.lane;
    ctx.beginPath();
    ctx.arc(x, y, s.index === c.systemIndex ? 3.5 : 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = within ? TINT.liftLabel : TINT.farLabel;
    ctx.fillText(s.name.toUpperCase(), x + 7, y - 6);
  }

  drawPriceTells(ctx, overlays.prices, systems, px, py, 8);

  // Pirate activity, as on the galactic chart. Same cull as the dots above:
  // a ring for a system this zoom has scrolled off would be drawn at a
  // coordinate outside the canvas anyway.
  ctx.strokeStyle = HUD.red;
  for (const index of overlays.danger) {
    const s = systems[index];
    if (!s) continue;
    const x = px(s);
    const y = py(s);
    if (x < -20 || x > w + 20 || y < -12 || y > h + 12) continue;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  // current system crosshair
  ctx.strokeStyle = HUD.green;
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy); ctx.lineTo(cx + 10, cy);
  ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy + 10);
  ctx.stroke();

  // target marker
  if (chart.targetIndex !== null) {
    const t = systems[chart.targetIndex];
    ctx.strokeStyle = HUD.amber;
    ctx.beginPath();
    ctx.arc(px(t), py(t), 7, 0, Math.PI * 2);
    ctx.stroke();
  }

  // cursor
  ctx.strokeStyle = HUD.red;
  const ux = cx + (chart.cursorX - current.x) * LOCAL_SCALE;
  const uy = cy + ((chart.cursorY - current.y) / 2) * LOCAL_SCALE;
  ctx.beginPath();
  ctx.moveTo(ux - 7, uy); ctx.lineTo(ux + 7, uy);
  ctx.moveTo(ux, uy - 7); ctx.lineTo(ux, uy + 7);
  ctx.stroke();

  // The pointed-at lane is painted INTO the canvas, bottom-left, and not into
  // any row of chrome. `#local-info` is a 440px column measured to fit all 256
  // planet descriptions without scrolling (style.css) so it cannot grow a row,
  // and a new keyline pushed this screen's own keys under the controls banner.
  // The canvas has empty sky down there and costs no layout at all.
  if (overlays.hovered) {
    const [head, tail] = laneSummaryParts(overlays.hovered, systems, overlays.day);
    ctx.fillStyle = HUD.amber;
    ctx.fillText(head, 6, h - 20);
    ctx.fillText(tail, 6, h - 8);
  }

  // data on system (the nearest to the cursor)
  const info = maybeById('local-info');
  if (info) {
    const near = nearestSystem(systems, chart.cursorX, chart.cursorY);
    if (!near) {
      info.textContent = ' ';
      delete info.dataset.system;
      return;
    }
    // Rebuild ONLY when the cursor lands on a different system. This runs on
    // every cursor move, and re-setting innerHTML re-creates the <img>, making
    // the portrait flicker as you sweep the chart. Cheap guard.
    if (info.dataset.system === String(near.index)) return;
    info.dataset.system = String(near.index);

    const d = distanceTenths(current, near);
    const out = d > c.fuel && near.index !== c.systemIndex;
    const portrait = portraitUrl(near, c.galaxy);
    const more = systemDescription(near, c.galaxy);
    info.innerHTML =
      `<div class="sysname">${near.name.toUpperCase()}` +
      `<span class="dist"> &middot; ${(d / 10).toFixed(1)} LY</span>` +
      (out ? ' <span class="oor">OUT OF RANGE</span>' : '') +
      '</div>' +
`<div class="sysrow">` +
      `<dl class="sysfacts">
         <dt>Economy</dt><dd>${ECONOMY_NAMES[near.economy]}</dd>
         <dt>Government</dt><dd>${GOVERNMENT_NAMES[near.government]}</dd>
         <dt>Tech level</dt><dd>${near.techLevel + 1}</dd>
         <dt>Population</dt><dd>${(near.population / 10).toFixed(1)} Billion` +
           (portrait ? '' : ` (${speciesName(near)})`) + `</dd>
         <dt>Productivity</dt><dd>${near.productivity} M CR</dd>
         <dt>Radius</dt><dd>${near.radius} km</dd>
       </dl>` +
      (portrait
        ? `<figure class="chartface">
             <img src="${portrait}" alt="Inhabitant of ${near.name}"
                  onerror="this.parentElement.remove()"/>
             <figcaption>${speciesName(near)}</figcaption>
           </figure>`
        : '') +
      `</div>` +
      `<div class="sysblurb">${planetDescription(near)}</div>` +
      // The world half of the extended entry, under the 1984 line. The PEOPLE
      // half is not here: the portrait and its species caption above already
      // say who lives here, and both paragraphs together would scroll a panel
      // that changes on every cursor move. `D` opens the full entry.
      (more ? `<div class="sysblurb sysmore">${escapeHtml(more.description)}</div>` : '');
  }
}

/**
 * Market estimate for a system you haven't visited. Opened from the charts
 * with M.
 *
 * A painter: `market.ts` owns what the numbers ARE (`marketEstimate`). What
 * it draws is a distribution — the AVERAGE of every quote the system can roll
 * and the range those quotes span — so no row promises a price the destination
 * will honour on the day.
 */
export function renderMarketEstimate(
  sys: StarSystem, est: MarketEstimate[], c: CommanderData,
): void {
  const rows = est.map((m, i) => {
    const inHold = c.cargo[i] > 0 ? `${c.cargo[i]}${m.unit}` : '-';
    return `<tr><td>${m.name.toUpperCase()}</td><td class="num">${m.price.toFixed(1)}</td>` +
      `<td class="num">${m.low.toFixed(1)}&ndash;${m.high.toFixed(1)}</td>` +
      `<td class="num">${m.quantity}${m.unit}</td><td class="num">${inHold}</td></tr>`;
  }).join('');
  show(`
    <h2>${sys.name.toUpperCase()} — MARKET ESTIMATE</h2>
    <div class="rule"></div>
    <div class="info" style="text-align:center">
      ${ECONOMY_NAMES[sys.economy]} &middot; ${GOVERNMENT_NAMES[sys.government]} &middot;
      averaged over every price this market can roll &mdash; one visit lands
      somewhere in the range
    </div>
    <table>
      <tr><th>PRODUCT</th><th class="num">AVG PRICE (Cr)</th><th class="num">RANGE (Cr)</th><th class="num">AVG STOCK</th><th class="num">IN HOLD</th></tr>
      ${rows}
    </table>
    <div class="buttons"><button data-key="Escape">BACK TO CHART</button></div>
  `);
}

/**
 * Inverse of the galactic chart projection: a click on the canvas → chart
 * coordinates. Accounts for CSS scaling of the canvas element.
 */
export function chartCoordsFromClick(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const r = canvas.getBoundingClientRect();
  const px = (clientX - r.left) * (canvas.width / r.width);
  const py = (clientY - r.top) * (canvas.height / r.height);
  return { x: px / (canvas.width / 256), y: (py / (canvas.height / 128)) * 2 };
}

/** Inverse of the short-range chart projection (centred on the current system). */
export function localCoordsFromClick(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  current: StarSystem,
): { x: number; y: number } {
  const r = canvas.getBoundingClientRect();
  const px = (clientX - r.left) * (canvas.width / r.width);
  const py = (clientY - r.top) * (canvas.height / r.height);
  return {
    x: current.x + (px - canvas.width / 2) / LOCAL_SCALE,
    y: current.y + ((py - canvas.height / 2) / LOCAL_SCALE) * 2,
  };
}

/**
 * Where an inhabitant portrait lives, or '' if there isn't one.
 *
 * Galaxy 1 only: the filename carries index and system name, so a galaxy 2
 * world usually 404s and hides itself — but the eight galaxies share a name
 * pool, so a system could collide on index AND name and show the wrong species.
 * Cheaper to check the galaxy than to reason about the collision.
 *
 * The images are generated offline and committed (tools/generate-species.py),
 * so this is a plain static asset.
 *
 * Loaded eagerly, deliberately: `loading="lazy"` on a ~10 KB on-screen image
 * buys nothing and the intersection callback never fires in a throttled tab,
 * leaving the portrait blank while the same URL fetches fine.
 */
export function portraitUrl(sys: StarSystem, galaxy: number): string {
  if (galaxy !== 1) return '';
  return `species/${String(sys.index).padStart(3, '0')}-${sys.name.toLowerCase()}.png`;
}

/**
 * The original's "DATA ON <SYSTEM>" page: the full statistics block plus
 * the procedurally generated planet description.
 */
export function renderSystemData(
  sys: StarSystem, current: StarSystem, news = '', galaxy = 1,
): void {
  const d = distanceTenths(current, sys);
  const portrait = portraitUrl(sys, galaxy);
  // The 1984 line above is always there; this overlay is usually absent (no
  // entry, or no file for this galaxy). Absent renders exactly the old page,
  // which keeps generated prose from becoming load-bearing.
  const more = systemDescription(sys, galaxy);
  const extended = more ? `
    <div class="info sysdesc sysmore">
      <p>${escapeHtml(more.description)}</p>
      <p>${escapeHtml(more.inhabitants)}</p>
    </div>` : '';
  // onerror rather than a manifest: 256 files exist today, but a half-finished
  // regeneration should degrade to the old text-only page, not a broken icon.
  const face = portrait ? `
    <figure class="portrait">
      <img src="${portrait}" alt="Inhabitant of ${sys.name}"
           onerror="this.parentElement.remove()"/>
      <figcaption>${speciesName(sys)}</figcaption>
    </figure>` : '';
  show(`
    <h2>DATA ON ${sys.name.toUpperCase()}</h2>
    <div class="rule"></div>
    <div class="sysbody">
    ${face}
    <table class="sysdata">
      <tr><td>Distance:</td><td>${(d / 10).toFixed(1)} Light Years</td></tr>
      <tr><td>Economy:</td><td>${ECONOMY_NAMES[sys.economy]}</td></tr>
      <tr><td>Government:</td><td>${GOVERNMENT_NAMES[sys.government]}</td></tr>
      <tr><td>Tech Level:</td><td>${sys.techLevel + 1}</td></tr>
      <tr><td>Population:</td><td>${(sys.population / 10).toFixed(1)} Billion<br/>
        <span style="opacity:0.85">(${speciesName(sys)})</span></td></tr>
      <tr><td>Gross Productivity:</td><td>${sys.productivity} M CR</td></tr>
      <tr><td>Average Radius:</td><td>${sys.radius} km</td></tr>
    </table>
    </div>
    <div class="rule"></div>
    <div class="info sysdesc">${planetDescription(sys)}</div>
    ${extended}
    ${news ? `<div class="info sysdesc" style="color:var(--hud-amber);margin-top:8px">${news}</div>` : ''}
    <div class="buttons"><button data-key="Escape">BACK</button></div>
  `);
}

// describeContract lives in game/contract-offers.ts with the board itself
// (invariant 10) — a job's one-line description is not a property of the
// screen that happens to draw it. Re-exported so the screens' importers, and
// this file's own two uses below, still read naturally.
export { describeContract };

/** The station bulletin board: jobs on offer, and the ones you've taken. */
export function renderContracts(
  sys: StarSystem,
  systems: StarSystem[],
  c: CommanderData,
  offers: Contract[],
  selected: number,
): void {
  // Illicit freight is flagged, not disguised (docs/TODO/110): the reward is
  // paying for the police scan on the way out, and a player cannot choose to
  // take that on if the row reads like any other consignment. `--hud-amber` is
  // the warning colour this file already spells everywhere else, so no new
  // colour is coined for it — and since docs/TODO/93 there is nowhere to coin
  // one except src/palette.ts, which the gate would make you argue for.
  const illicit = (k: Contract) =>
    (k.kind === 'smuggle' ? ' style="color:var(--hud-amber)"' : '');

  const rows = offers.map((k, i) => `
    <tr class="${i === selected ? 'sel' : ''} pick" data-row="${i}"${illicit(k)}>
      <td>${describeContract(k, systems)}</td>
      <td class="num">${(distanceTenths(sys, systems[k.destination]) / 10).toFixed(1)} LY</td>
      <td class="num">${k.deadlineDay - c.day} days</td>
      <td class="num">${formatCredits(k.reward)}</td>
    </tr>`).join('') || '<tr><td colspan="4">No work on offer today.</td></tr>';

  const taken = c.contracts.map((k) => `
    <tr${illicit(k)}><td>${describeContract(k, systems)}${k.kind === 'bounty' ? ` (${k.progress}/${k.qty})` : ''}</td>
      <td class="num">${k.deadlineDay - c.day} days left</td>
      <td class="num">${formatCredits(k.reward)}</td></tr>`).join('');

  show(`
    <h2>${sys.name.toUpperCase()} BULLETIN BOARD</h2>
    <div class="rule"></div>
    <table>
      <tr><th>WORK ON OFFER</th><th class="num">DISTANCE</th><th class="num">TIME</th><th class="num">PAYS</th></tr>
      ${rows}
    </table>
    ${taken ? `<div class="rule"></div><table>
      <tr><th>ACCEPTED</th><th class="num">DEADLINE</th><th class="num">PAYS</th></tr>${taken}</table>` : ''}
    <div class="buttons">
      <button data-key="KeyA">ACCEPT SELECTED</button>
      <button data-key="Escape">DONE</button>
    </div>
    <div class="keyline">
      DAY ${c.day} &middot; CASH ${formatCredits(c.credits)} &middot;
      HOLD ${cargoTonnes(c)}/${cargoCapacity(c)}t &nbsp;&mdash;&nbsp; CLICK A JOB &middot; A ACCEPT &middot; ESC EXIT
    </div>
  `);
}

// --- the combat training simulator -----------------------------------------

/**
 * One line of the setup panel, with its group heading above it if it opens one.
 *
 * The heading is a `<tr>` with NO `data-row`, so a click on it walks up to a
 * table that has none either and is ignored: a heading cannot be selected, and
 * the row indices stay exactly `setupCells()`'s.
 */
const simSetupRow = (r: SimSetupRow, i: number, selected: number): string =>
  `${r.heading ? `<tr class="grouphead"><td colspan="2">${r.heading}</td></tr>` : ''}
      <tr class="${i === selected ? 'sel' : ''} pick" data-row="${i}"
        ${r.dim ? 'style="opacity:0.45"' : ''}>
        <td>${r.label}</td><td class="num">${r.value}</td>
      </tr>`;

/**
 * A block of notes that always occupies the height of its worst case.
 *
 * `reserve` is painted first and made invisible, `live` sits on top of it in the
 * same grid cell, and the taller of the two sets the height — so a warning
 * appearing does not push the rows above it up by a line while the cursor is on
 * one of them. Wrapping is included for free, which is why this is a ghost and
 * not a line count.
 */
const reservedNotes = (
  live: readonly string[], reserve: readonly string[], tone: string,
): string => {
  const lines = (xs: readonly string[]): string =>
    xs.map((t) => `<div class="keyline ${tone}">${t}</div>`).join('');
  return `<div class="reserved">
      <div class="hold" aria-hidden="true">${lines(reserve)}</div>
      <div>${lines(live)}</div>
    </div>`;
};

/**
 * The setup panel: a list of rows, and which one the cursor is on.
 *
 * A row list rather than a named field per control, because the panel's shape
 * depends on what has been picked. It paints a list; `screens/combat-sim-setup.ts`
 * decides what is in it and which one opens a group.
 */
export function renderCombatSimSetup(p: SimSetupPanel): void {
  const exercise = p.rows.map((r, i) => simSetupRow(r, i, p.selected)).join('');
  const hints = [
    'CLICK A ROW', '&uarr;&darr; SELECT', '&larr;&rarr; CHANGE', 'HOME/END ENDS OF LIST',
    'R RANDOM SEED',
    ...(p.hasReport ? ['L LAST REPORT'] : []), 'ESC DONE',
  ];
  show(`
    <h2>COMBAT TRAINING SIMULATOR</h2>
    <div class="rule"></div>
    <div class="info" style="text-align:center">
      NOTHING THAT HAPPENS IN HERE LEAVES IT &mdash;
      NO KILLS, NO RATING, NO CREDITS, NO LEGAL STATUS, NO SAVE
    </div>
    <table>${exercise}</table>
    ${reservedNotes(p.notes, p.notesReserve, 'note-help')}
    ${reservedNotes(p.brainNote ? [p.brainNote] : [], [p.brainReserve], 'note-brain')}
    <div class="buttons">
      <button data-key="Enter">ENTER &mdash; LAUNCH</button>
      ${p.hasReport ? '<button data-key="KeyL">L &mdash; LAST REPORT</button>' : ''}
      <button data-key="Escape">ESC &mdash; DONE</button>
    </div>
    <div class="keyline hints">${hints.map((h) => `<span>${h}</span>`).join('\n      ')}</div>
  `);
}

/** `1.23` / `-` — every statistic in a report is allowed to be unmeasured. */
const num = (x: number | null | undefined, dp = 0): string =>
  (x === null || x === undefined ? '-' : x.toFixed(dp));
const pct = (x: number | null | undefined): string =>
  (x === null || x === undefined ? '-' : `${(x * 100).toFixed(0)}%`);

/**
 * `OPENED AHEAD 4500 · 3900-5100 OUT · WIDEST 9° OFF YOUR NOSE · IN VIEW`.
 *
 * On the report because where a fight starts decides what the rest of it means:
 * a brain that came at you versus one already there, and NOT IN VIEW is how a
 * scenario that opens behind the pilot says so (combat-sim-opening.ts).
 */
function opening(o: OpeningGeometry): string {
  return `OPENED ${o.arc.toUpperCase()} ${o.range}`
    + ` &middot; ${num(o.nearest)}&ndash;${num(o.furthest)} OUT`
    + ` &middot; WIDEST ${num(o.widestBearingDeg)}&deg; OFF YOUR NOSE`
    + ` &middot; ${o.inView ? 'IN VIEW' : 'NOT IN VIEW'}`;
}

/**
 * `WAVE 14 OF A RAMP THAT SATURATES AT 18 · CARRYING MISSILES, E.C.M. · NEW: …`
 *
 * On the report because escalation past wave 11 changes the FIGHT rather than
 * the arithmetic — the opponent table still says six ships at tier 2 — so
 * without this line a pilot cannot tell a hard wave from an unlucky one. The
 * reason is quoted so a step's argument is not only in the source.
 */
function escalation(e: WaveEscalation): string {
  const carrying = e.active.length ? e.active.join(', ') : 'NOTHING YET';
  return `<div class="info" style="text-align:center">
      WAVE ${e.wave} OF A RAMP THAT SATURATES AT ${e.saturatesAt}
      &middot; CARRYING ${carrying}
      ${e.added ? `<br/><b>NEW THIS WAVE: ${e.added}</b> &mdash; ${e.why.toUpperCase()}`
    : `<br/>${e.why.toUpperCase()}`}
    </div>`;
}

/** `laser 41.0 (12) · ram 8.0 (1)` — what hurt, and how often. */
function bySource(
  tallies: Partial<Record<string, { damage: number; count: number }>>,
): string {
  const parts = Object.entries(tallies)
    .flatMap(([k, t]) => (t ? [`${k} ${t.damage.toFixed(1)} (${t.count})`] : []));
  return parts.length ? parts.join(' &middot; ') : '-';
}

/**
 * The record from one exercise, as the pilot reads it.
 *
 * The JSON is the deliverable (docs/COMBAT-SIM.md) and this is the human half
 * of the same numbers — so it shows what a pilot can act on, and the export
 * keys carry the rest.
 */
export function renderCombatSimReport(
  r: CombatSimReport, index: number, total: number,
): void {
  // What a ship was DOING, longest first, as seconds. The columns beside it say
  // where a ship was; this one says what it was trying to do, which is the only
  // one of them that explains the others.
  const spentDoing = (doing: Record<string, number>): string => {
    const parts = Object.entries(doing).filter(([, secs]) => secs >= 0.1);
    if (parts.length === 0) return '&mdash;';
    return parts.map(([what, secs]) => `${escapeHtml(what.toUpperCase())} ${secs.toFixed(1)}s`)
      .join(' &middot; ');
  };
  const opponents = r.opponents.map((o) => `
      <tr>
        <td>${o.hull.toUpperCase()}</td>
        <td>${o.brain}</td>
        <td class="num">${o.tier ?? '-'}</td>
        <td class="num">${o.livedSeconds.toFixed(1)}s</td>
        <td>${o.destroyed ? (o.killedByYou ? 'YOU KILLED IT' : 'LOST') : 'SURVIVED'}</td>
        <td class="num">${o.hits}/${o.shots}</td>
        <td class="num">${o.damageToYou.toFixed(1)}</td>
        <td class="num">${num(o.closestRange)}</td>
        <td class="num">${num(o.medianSpeed)}</td>
        <td class="num">${o.passes}</td>
        <td>${spentDoing(o.doing)}</td>
      </tr>`).join('');
  const stat = (label: string, you: string, them: string): string =>
    `<tr><td>${label}</td><td class="num">${you}</td><td class="num">${them}</td></tr>`;
  const e = r.envelope;
  const opp = r.opposition;
  show(`
    <h2>SIMULATION REPORT &mdash; ${r.outcome.toUpperCase()}</h2>
    <div class="rule"></div>
    <div class="info" style="text-align:center">
      ${r.scenario.toUpperCase()} &middot; ${r.mode.toUpperCase()}
      ${r.wave === undefined ? '' : `&middot; WAVE ${r.wave}`}
      &middot; ${r.seconds.toFixed(1)}s &middot; SEED ${r.seed}<br/>
      ${opening(r.opening)}<br/>
      YOUR SHIP: ${r.player.laser.toUpperCase()} LASER${r.player.rearLaser ? ' + REAR' : ''}
      &middot; ${r.player.missiles} MISSILES
      ${r.player.ecm ? '&middot; E.C.M.' : ''}
      ${r.player.energyUnit ? '&middot; ENERGY UNIT' : ''}
      ${r.player.energyBomb ? '&middot; ENERGY BOMB' : ''}<br/>
      COMBAT COMPUTER BRAIN: ${r.coPilot === 'scripted'
        ? 'NONE' : `${(brainName(r.coPilot) ?? r.coPilot).toUpperCase()}
          (${r.coPilot.toUpperCase()})`}
    </div>
    ${r.escalation ? escalation(r.escalation) : ''}
    <div class="chartrow">
      <table>
        <tr><th>&nbsp;</th><th class="num">YOU</th><th class="num">THEM</th></tr>
        ${stat('SHOTS', String(r.you.shots), String(r.them.shots))}
        ${stat('HITS', String(r.you.hits), String(r.them.hits))}
        ${stat('ACCURACY', pct(r.you.accuracy), pct(r.them.accuracy))}
        ${stat('DAMAGE DEALT', r.you.damageDealt.toFixed(1), r.them.damageToYou.toFixed(1))}
        ${stat('LINED UP', pct(r.linedUpShare.you), pct(r.linedUpShare.them))}
        ${stat('IN RANGE', pct(r.inRangeShare.you), pct(r.inRangeShare.them))}
        ${stat('MEAN AIM ERROR', `${num(r.meanAimErrorDeg.you, 1)}&deg;`,
          `${num(r.meanAimErrorDeg.them, 1)}&deg;`)}
        ${stat('ON THE OTHER\'S SIX', `${r.onSixSeconds.you.toFixed(1)}s`,
          `${r.onSixSeconds.them.toFixed(1)}s`)}
      </table>
      <table>
        <tr><th colspan="2">THE FIGHT</th></tr>
        <tr><td>KILLS</td><td class="num">${r.kills.yours} of ${r.opponents.length}</td></tr>
        <tr><td>FIRST / LAST KILL</td>
          <td class="num">${num(r.kills.firstAt, 1)}s / ${num(r.kills.lastAt, 1)}s</td></tr>
        <tr><td>ENGAGED</td><td class="num">${r.engagedSeconds.toFixed(1)}s</td></tr>
        <tr><td>RANGE (MEDIAN / CLOSEST)</td>
          <td class="num">${num(r.range.median)} / ${num(r.range.closest)}</td></tr>
        <tr><td>SHIELDS LOW (FORE / AFT)</td>
          <td class="num">${num(r.lowWater.foreShield, 1)} / ${num(r.lowWater.aftShield, 1)}</td></tr>
        <tr><td>ENERGY LOW</td><td class="num">${num(r.lowWater.energy, 1)}</td></tr>
        <tr><td>DAMAGE TO YOU, BY SOURCE</td>
          <td class="num">${bySource(r.them.damageBySource)}</td></tr>
        <tr><td>DAMAGE BY YOU, BY SOURCE</td>
          <td class="num">${bySource(r.you.damageBySource)}</td></tr>
        <tr><td>YOUR SPEED (MED / P90)</td>
          <td class="num">${num(e.speed?.median)} / ${num(e.speed?.p90)}</td></tr>
        <tr><td>YOUR PITCH / ROLL (P90)</td>
          <td class="num">${num(e.pitchRate?.p90, 2)} / ${num(e.rollRate?.p90, 2)}</td></tr>
        <tr><th colspan="2">HOW THEY FLEW</th></tr>
        <tr><td>THEIR SPEED (MED / P90)</td>
          <td class="num">${num(opp.speed?.median)} / ${num(opp.speed?.p90)}</td></tr>
        <tr><td>RANGE THEY HELD (P10 / MED / P90)</td>
          <td class="num">${num(opp.range?.p10)} / ${num(opp.range?.median)}
            / ${num(opp.range?.p90)}</td></tr>
        <tr><td>ATTACK RUNS (IN ${PASS_CLOSE}, OUT ${PASS_FAR})</td>
          <td class="num">${opp.passes}</td></tr>
      </table>
    </div>
    <table>
      <tr><th>HULL</th><th>BRAIN</th><th class="num">TIER</th><th class="num">LIVED</th>
        <th>FATE</th><th class="num">HITS/SHOTS</th><th class="num">DAMAGE</th>
        <th class="num">CLOSEST</th><th class="num">SPEED</th><th class="num">RUNS</th>
        <th>SPENT ITS TIME</th></tr>
      ${opponents}
    </table>
    ${r.warnings.map((w) => `<div class="keyline" style="color:var(--hud-amber)">${w}</div>`).join('')}
    <div class="buttons">
      <button data-key="KeyC">C &mdash; COPY JSON</button>
      <button data-key="KeyX">X &mdash; EXPORT FILE</button>
      <button data-key="Escape">ESC &mdash; BACK</button>
    </div>
    <div class="keyline">
      RECORD ${index + 1} OF ${total}${total > 1 ? ' &middot; &larr;&rarr; ANOTHER' : ''}
      ${total > 1 ? '&middot; ENTER COMPARE TWO' : ''}
      &middot; C COPY &middot; X EXPORT (&#8679;X ALL ${total})
      &middot; ALSO ON __simLog &middot; ESC BACK
    </div>
  `);
}

/** `RECORD 3 &middot; SEED 90210 &middot; 34.2s &middot; CLEARED` — which record a column is. */
const compareColumn = (which: string, r: CombatSimReport, index: number): string => `
    <div>${which}: RECORD ${index + 1} &middot; ${r.scenario.toUpperCase()}
      &middot; ${r.mode.toUpperCase()}${r.wave === undefined ? '' : ` &middot; WAVE ${r.wave}`}
      &middot; SEED ${r.seed} &middot; ${r.seconds.toFixed(1)}s
      &middot; ${r.outcome.toUpperCase()}</div>`;

/**
 * Two records side by side — the A/B the trainer's whole method is.
 *
 * A dumb painter over `compareReports()`, which has already decided whether the
 * pair may be subtracted at all and formatted every figure in its own unit. The
 * one rule this renderer holds is that a null `delta` is painted as NOTHING: on
 * a mismatched pair the difference column does not exist, rather than existing
 * with dashes in it, because a column that is there is a column that gets read.
 */
export function renderCombatSimCompare(p: SimComparePanel): void {
  const c = p.compare;
  const cols = c.comparable ? 4 : 3;
  const table = (groups: readonly CompareGroup[]): string => `<table>
      <tr><th>&nbsp;</th><th class="num">THIS</th><th class="num">THAT</th>
        ${c.comparable ? '<th class="num">&Delta;</th>' : ''}</tr>
      ${groups.map((g) => `
      <tr class="grouphead"><td colspan="${cols}">${g.heading}</td></tr>
      ${g.rows.map((r) => `<tr><td>${r.label}</td>
        <td class="num">${r.a}</td><td class="num">${r.b}</td>
        ${r.delta === null ? '' : `<td class="num${r.delta === 'SAME' ? ' same' : ''}">${r.delta}</td>`}
      </tr>`).join('')}`).join('')}
    </table>`;
  const half = Math.ceil(c.groups.length / 2);
  const respects = `IN ${c.confounds.length} `
    + `${c.confounds.length === 1 ? 'RESPECT' : 'RESPECTS'}`;
  const confounds = `
    <div class="fence">
      <div class="keyline note-warn">NOT AN A/B &mdash; THESE TWO RECORDS ARE OF
        DIFFERENT FIGHTS, ${respects}.
        NO DIFFERENCE IS SHOWN, BECAUSE IT WOULD NOT MEAN ANYTHING.</div>
      <table>
        <tr><th>WHAT DIFFERS</th><th class="num">THIS</th><th class="num">THAT</th></tr>
        ${c.confounds.map((f) => `<tr><td>${f.field}</td>
          <td class="num">${f.a}</td><td class="num">${f.b}</td></tr>`).join('')}
      </table>
    </div>`;
  const brains = `
    <table>
      <tr><th>WHAT FLEW</th><th class="num">THIS</th><th class="num">THAT</th></tr>
      ${c.brains.map((b) => `<tr><td>${b.index + 1} ${b.hull}</td>
        <td class="num">${b.a}</td>
        <td class="num${b.same ? ' same' : ''}">${b.b}</td></tr>`).join('')}
    </table>
    ${c.sameBrains ? `<div class="keyline note-calm">THE SAME BRAINS BOTH TIMES
      &mdash; THIS IS A REPEAT OF ONE FIGHT, NOT AN A/B</div>` : ''}`;
  show(`
    <h2>COMPARE &mdash; RECORD ${p.thisIndex + 1} AND ${p.thatIndex + 1}</h2>
    <div class="rule"></div>
    <div class="info" style="text-align:center">
      ${compareColumn('THIS', c.a, p.thisIndex)}
      ${compareColumn('THAT', c.b, p.thatIndex)}
    </div>
    ${c.comparable ? brains : confounds}
    <div class="chartrow">
      ${table(c.groups.slice(0, half))}
      ${table(c.groups.slice(half))}
    </div>
    <div class="buttons">
      <button data-key="KeyC">C &mdash; COPY PAIR</button>
      <button data-key="KeyX">X &mdash; EXPORT PAIR</button>
      <button data-key="Escape">ESC &mdash; BACK</button>
    </div>
    <div class="keyline hints">
      <span>&larr;&rarr; THE OTHER RECORD (${p.total} IN THE RING)</span>
      <span>C COPY PAIR</span><span>X EXPORT PAIR</span>
      ${c.comparable ? '<span>&Delta; IS THAT MINUS THIS</span><span>PP IS PERCENTAGE POINTS</span>' : ''}
      <span>ESC BACK</span>
    </div>
  `);
}

// --- giving up on a flight ---------------------------------------------------

/**
 * The quit confirmation: what it costs, and where you wake up.
 *
 * Deliberately the SAME sentence the game-over screen offers, off the same
 * `SaveSummary`, because it is the same save and the same promise — a player
 * who has read one has read the other. What differs is only the reason they are
 * looking at it.
 */
export function renderQuit(offer: SaveSummary | null): void {
  show(`
    <h2>QUIT THIS FLIGHT?</h2>
    <div class="rule"></div>
    <div class="info" style="text-align:center">
      ${offer
        ? `You go back to <b>${offer.place} STATION</b> as you left it &mdash;
           ${offer.when}, ${formatCredits(offer.credits)}, day ${offer.day}`
        : 'NO STATION AUTOSAVE WAS FOUND &mdash; you will start again at Lave'}
    </div>
    <div class="info" style="text-align:center;color:var(--hud-amber)">
      EVERYTHING SINCE YOU LAUNCHED IS LOST &mdash; CARGO, KILLS, DAMAGE AND FUEL.
      THIS IS WHAT DYING COSTS, WITHOUT THE DYING.
    </div>
    <div class="buttons">
      <button data-key="KeyY">Y &mdash; QUIT THE FLIGHT</button>
      <button data-key="Escape">ESC &mdash; KEEP FLYING</button>
    </div>
    <div class="keyline hints"><span>Y QUIT</span><span>N / ESC KEEP FLYING</span></div>
  `);
}

// --- test mode ---------------------------------------------------------------

/**
 * Why the dimmed rows do nothing.
 *
 * Painted through `reservedNotes` so it holds its own height whether it is
 * showing or not: the first row of this screen is what makes it appear and
 * disappear, and a note that pushed the rows down as you pressed it would move
 * the cursor out from under the hand that pressed it.
 */
const LEVERS_OFF = 'THE LEVERS BELOW DO NOTHING UNTIL TEST MODE IS ON';

/**
 * The development levers, and the amber warning above them.
 *
 * A row list rather than a named field per lever, for the setup panel's reason:
 * `game/screens/test-mode.ts` decides what is in it and this paints it. The
 * banner is unconditional — it says what the screen COSTS, which is true before
 * the mode has ever been switched on.
 */
export function renderTestMode(p: TestModePanel): void {
  // The heading is a `<tr>` with NO `data-row`, so a click on it walks up to a
  // table that has none either and is ignored — the row indices stay exactly
  // the panel's. Same construction as the trainer's setup rows.
  const rows = p.rows.map((r, i) => `${r.heading
    ? `<tr class="grouphead"><td colspan="2">${r.heading}</td></tr>` : ''}
      <tr class="${i === p.selected ? 'sel' : ''} pick"
        data-row="${i}" ${r.dim ? 'style="opacity:0.45"' : ''}>
        <td>${r.label}</td><td class="num">${r.value}</td>
      </tr>`).join('');
  show(`
    <h2>TEST MODE</h2>
    <div class="rule"></div>
    <div class="info" style="text-align:center;color:var(--hud-amber)">
      DEVELOPMENT LEVERS &mdash; A CAREER THAT HAS SWITCHED THIS ON
      SAYS SO ON ITS STATUS SCREEN, FOR GOOD
    </div>
    <table>${rows}</table>
    ${reservedNotes(p.on ? [] : [LEVERS_OFF], [LEVERS_OFF], 'note-help')}
    <div class="buttons">
      <button data-key="Escape">ESC &mdash; DONE</button>
    </div>
    <div class="keyline hints">
      <span>CLICK A ROW</span><span>&uarr;&darr; SELECT</span>
      <span>&larr;&rarr; OR ENTER CHANGE</span><span>ESC DONE</span>
    </div>
  `);
}

/**
 * The end of a run, and the way back out of it.
 *
 * `offer` is this career's docked checkpoint — by construction the state you
 * left the station in, because it is written on docking AND immediately before
 * launch. The in-flight autosaves are deliberately NOT offered: they are the
 * twenty seconds you just lost, and offering them would make dying optional.
 */
export function renderGameOver(c: CommanderData, offer: SaveSummary | null): void {
  show(`
    <h2>GAME OVER</h2>
    <div class="big">SHIP DESTROYED</div>
    <div class="info" style="text-align:center">
      Final rating: ${rating(c.combatScore ?? c.kills).toUpperCase()} &middot; ${c.kills} kills
    </div>
    <div class="info" style="text-align:center">
      ${offer
        ? `Back to <b>${offer.place} STATION</b> as you left it &mdash;
           ${offer.when}, ${formatCredits(offer.credits)}, day ${offer.day}`
        : 'NO STATION AUTOSAVE WAS FOUND &mdash; you will start again at Lave'}
    </div>
    <div class="buttons">
      <button data-key="Enter">ENTER &mdash; BACK TO THE STATION</button>
      <button data-key="KeyS">S &mdash; COMMANDER FILE</button>
    </div>
    <div class="keyline">
      THE STATION AUTOSAVE IS WRITTEN EVERY TIME YOU DOCK AND EVERY TIME YOU LAUNCH
    </div>
  `);
}
