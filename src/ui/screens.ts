import { type StarSystem, ECONOMY_NAMES, GOVERNMENT_NAMES, COMMODITIES, speciesName } from '../galaxy/galaxy.ts';
import { planetDescription } from '../galaxy/goatsoup.ts';
import { systemDescription } from '../galaxy/descriptions.ts';
import { escapeHtml } from '../engine/escape-html.ts';
import { distanceTenths } from '../galaxy/navigation.ts';

import { type CommanderData, type Contract, cargoTonnes, formatCredits, cargoCapacity } from '../game/commander.ts';
import { standingOrders, type ContractOrder } from '../game/orders.ts';
import type { MissionLeg } from '../game/missions.ts';
import { MAX_FUEL } from '../constants/commander.ts';

import { rating } from '../game/rating.ts';
import { characterName } from '../game/character.ts';
import { equipmentOwned } from '../game/shop.ts';
import { EQUIPMENT_CATALOGUE } from '../constants/shop.ts';
import { describeContract } from '../game/contract-offers.ts';

import { hideScreen, show } from './screen-shell.ts';
import { portraitUrl } from './portrait.ts';

// Re-exported so a caller that wants "hide whatever is up" does not have to
// know which screen module it came from. The screens themselves import `show`
// from the shell directly.
export { hideScreen };

// The station menu's rows ARE the docked binding table — see ui/key-help.ts.
// A hand-written row here would be a second home for a key, and `data-key`
// becomes a keystroke, so it could advertise a key nothing was bound to.
import { dockedMenuHtml } from './key-help.ts';

// Full-page overlay screens, rendered as DOM. The Game owns all input and
// state; these are pure render functions.
//
// `show`, `hideScreen` and the inert-DOM seam under them are `screen-shell.ts`
// since docs/TODO/149, so every screen module reaches the page the same way and
// none of them reaches through another.

export function renderDockedMenu(
  sys: StarSystem, c: CommanderData, orderLines: readonly string[] = [],
): void {
  show(`
    <h2>${sys.name.toUpperCase()} STATION</h2>
    <div class="rule"></div>
    <div class="info" style="text-align:center">
      ${ECONOMY_NAMES[sys.economy]} &middot; ${GOVERNMENT_NAMES[sys.government]} &middot; TECH LEVEL ${sys.techLevel + 1}<br/>
      ${formatCredits(c.credits)} &middot; FUEL ${(c.fuel / 10).toFixed(1)} LY &middot; MISSILES ${c.missiles} &middot; DAY ${c.day}
      ${orderLines.length
    // One ROW per order rather than one wrapped run of them. A joined line broke
    // wherever the column ran out, which was usually mid-order (docs/TODO/144).
    ? `<br/><span style="color:var(--hud-amber)">${orderLines.join('<br/>')}</span>`
    : ''}
    </div>
    ${dockedMenuHtml()}
  `);
}

/**
 * The forced choice on docking with somebody in your crew spaces
 * (docs/TODO/127).
 *
 * No ESC row in the keyline, because there is no ESC: this is the one screen in
 * the game with no way out but an answer, and advertising one it does not have
 * would be the cruellest kind of wrong. `game/screens/survivors.ts` refuses the
 * key; this is what makes the refusal read as deliberate.
 */
export function renderSurvivors(
  people: number, offers: { sale: number; release: number },
): void {
  const many = people > 1;
  show(`
    <h2>${people} SURVIVOR${many ? 'S' : ''} ABOARD</h2>
    <div class="rule"></div>
    <div class="info" style="text-align:center; line-height:2">
      Station control is holding your clearance until the
      ${many ? `${people} people` : 'person'} you scooped out of
      ${many ? 'their capsules' : 'a capsule'} ${many ? 'are' : 'is'} accounted for.<br/>
      <span style="opacity:0.8; font-size:11px">
        WHAT HAPPENS TO THEM IS YOUR DECISION, AND THE STATION WILL WAIT FOR IT.
      </span>
    </div>
    <div class="buttons">
      <button data-key="KeyM">M &mdash; HAND THEM TO STATION MEDICAL</button>
      <button data-key="KeyV">V &mdash; SELL THEM &mdash; ${formatCredits(offers.sale)}</button>
      <button data-key="KeyL">L &mdash; TAKE ${formatCredits(offers.release)} TO LET THEM GO</button>
    </div>
    <div class="keyline hints">
      <span>M MEDICAL &mdash; NO PAYMENT, NO QUESTIONS</span>
      <span style="color:var(--hud-amber)">V AND L BOTH COST YOUR NAME</span>
    </div>
  `);
}

/**
 * The COMMANDER screen.
 *
 * `Elapsed` sits between `Fuel` and `Cash` because that is the argument for it:
 * fuel and days are the two things a jump spends, and cash is what a market
 * spends. It was the one cost of a jump no screen named (docs/TODO/140).
 */
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
      Elapsed: ${c.day} days<br/>
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

/**
 * What the Navy has this commander doing (docs/TODO/144, split by 145).
 *
 * This screen is what invariant 16 asks for: the briefing was said one time,
 * for five seconds, and the one line under the station header was the only
 * other place the target system was ever written — which any contract took away
 * from it (GitHub #27).
 *
 * THE NAVY'S ORDERS ONLY. Board work has its own screen, because a contract and
 * a mission are two kinds of thing (Chris, 2026-08-13). The docked summary line
 * still names both, and that is a different rule: it is the one surface where
 * dropping a kind hides it completely.
 *
 * One leg runs at a time, so this is a panel rather than a table. `missionLeg`
 * (game/missions.ts) decides what it says.
 */
export function renderMissions(leg: MissionLeg | null, systems: StarSystem[]): void {
  show(`
    <h2>NAVY MISSIONS</h2>
    <div class="rule"></div>
    ${leg === null ? '<div class="info">The Navy has no orders for you.</div>' : `
    <div class="info">
      ${leg.line}<br/>
      Destination: ${systems[leg.destination].name}<br/>
      Pays: ${formatCredits(leg.reward)} on completion
      ${leg.warning
    // Amber, which is the colour this file already spends on a warning. The
    // Navy states the two numbers and lets the commander decide;
    // `constrictorWarning` is the one home of that sentence.
    ? `<br/><br/><span style="color:var(--hud-amber)">${leg.warning}</span>` : ''}
    </div>`}
    <div class="buttons"><button data-key="Escape">BACK</button></div>
  `);
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
  atStation: boolean,
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

  // The ACCEPTED half reads `standingOrders`, so the days-left subtraction has
  // one home rather than one here and one in `game/orders.ts`. The WORDS were
  // never at risk — both halves call `describeContract` — but two copies of the
  // same arithmetic are two chances to measure a deadline from the wrong day,
  // which is the defect docs/TODO/140 M4 records for the charts.
  const taken = standingOrders(c, systems)
    .filter((o): o is ContractOrder => o.kind === 'contract')
    .map((o) => `
    <tr${illicit(o.job)}><td>${describeContract(o.job, systems)}${o.job.kind === 'bounty' ? ` (${o.job.progress}/${o.job.qty})` : ''}</td>
      <td class="num">${o.daysLeft} days left</td>
      <td class="num">${formatCredits(o.reward)}</td></tr>`).join('');

  // A BOARD IS A STATION'S. In flight there is nothing to sign, and the offers
  // in `state.contractOffers` are the last station's — drawing them would show
  // a pilot work she cannot take. The ACCEPTED half travels with her, because
  // what she owes is true wherever she is (docs/TODO/145).
  const board = !atStation ? '' : `
    <table>
      <tr><th>WORK ON OFFER AT ${sys.name.toUpperCase()}</th><th class="num">DISTANCE</th><th class="num">TIME</th><th class="num">PAYS</th></tr>
      ${rows}
    </table>`;

  show(`
    <h2>CONTRACTS</h2>
    <div class="rule"></div>
    ${board}
    ${taken ? `${board ? '<div class="rule"></div>' : ''}<table>
      <tr><th>ACCEPTED</th><th class="num">DEADLINE</th><th class="num">PAYS</th></tr>${taken}</table>`
    : '<div class="info">You have signed for no work.</div>'}
    <div class="buttons">
      ${atStation ? '<button data-key="KeyA">ACCEPT SELECTED</button>' : ''}
      <button data-key="Escape">DONE</button>
    </div>
    <div class="keyline">
      DAY ${c.day} &middot; CASH ${formatCredits(c.credits)} &middot;
      HOLD ${cargoTonnes(c)}/${cargoCapacity(c)}t
      ${atStation ? '&nbsp;&mdash;&nbsp; CLICK A JOB &middot; A ACCEPT &middot; ESC EXIT' : '&nbsp;&mdash;&nbsp; ESC EXIT'}
    </div>
  `);
}

// --- the combat training simulator -----------------------------------------
