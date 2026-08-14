// The combat trainer's three screens: the setup, the report, and the comparison.
//
// Split out of `ui/screens.ts` by docs/TODO/149. One subject and one consumer
// (`game/screens/combat-sim.ts`), and its five helpers — the two number
// formatters, the opening geometry, the wave escalation and the damage-by-source
// table — are used by nothing else in the game.
//
// It reads a report and writes a table. The exercise itself is `game/combat-sim.ts`,
// what it recorded is `game/combat-sim-report.ts`, and what two records differ by
// is `game/combat-sim-compare.ts`. Nothing here decides anything about a fight.

import { escapeHtml } from '../engine/escape-html.ts';
import { type CombatSimReport, type OpeningGeometry, type WaveEscalation } from '../game/combat-sim-report.ts';
import { PASS_CLOSE, PASS_FAR } from '../constants/combat-record.ts';
import { brainName } from '../game/brain-names.ts';
import { type CompareGroup, type SimComparePanel } from '../game/combat-sim-compare.ts';
import { type SimSetupPanel, type SimSetupRow } from '../game/screens/combat-sim-setup.ts';
import { show } from './screen-shell.ts';
import { reservedNotes } from './reserved-note.ts';

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
