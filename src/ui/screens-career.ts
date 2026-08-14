// The screens about the COMMANDER rather than about the flight.
//
// Split out of `ui/screens.ts` by docs/TODO/149. Naming one, filing one, putting
// one down, giving up a flight, throwing the development levers, and being
// destroyed — the whole life of a career outside the cockpit.
//
// They belong together because they are the screens that ask before they act.
// Four of the six confirm something irreversible, and they are worded to say
// what is about to be lost rather than to be dismissed: `renderNewGameConfirm`
// points at the export key first, and `renderQuit` names the checkpoint it is
// about to send you back to.
//
// The rules are elsewhere. `game/storage.ts` owns the store, `game/save-file.ts`
// owns what a save IS, and `game/screens/*.ts` own the keys.

import { type StarSystem } from '../galaxy/galaxy.ts';
import { type CommanderData, formatCredits } from '../game/commander.ts';
import { rating } from '../game/rating.ts';
import { saveLabel, type LiveRun, type LoadCost, type SaveSummary } from '../game/save-file.ts';
import { type TestModePanel } from '../game/screens/test-mode.ts';
import { show } from './screen-shell.ts';
import { reservedNotes } from './reserved-note.ts';

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
