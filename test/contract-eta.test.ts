// Can the commander still make the delivery? The chart's answer (docs/TODO/140
// M4), in three parts.
//
// 1. THE VERDICT IS A FUNCTION. `game/contract-eta.ts` is pure, so the cases a
//    painted chart cannot easily reach — a deadline missed by one day, an
//    overdue job, two jobs at one world — are checked directly.
// 2. THE PAINTER MUST CALL IT. A correct wording function plus a painter that
//    never calls it is the exact defect docs/TODO/140 M2 fixed. So both charts
//    are painted and both info lines are read back.
// 3. THE MARKER IS DRAWN. A canvas mark is invisible to the info line, so this
//    file records the drawing calls instead (test/screen-capture.ts).
//
// The commander's day is the deadline clock, and the LIVING galaxy's day is the
// other number in scope in both painters. The two are driven apart here, as
// test/hud-binding.test.ts drives them apart for the topbar.

import type { StarSystem } from '../src/galaxy/galaxy.ts';
import { distanceTenths, daysForJump } from '../src/galaxy/navigation.ts';
import { routeEstimate } from '../src/galaxy/route.ts';
import { newCommander, type CommanderData, type Contract } from '../src/game/commander.ts';
import { contractDestinations, contractVerdict } from '../src/game/contract-eta.ts';
import { orderDestinations, orderVerdict } from '../src/game/orders.ts';
import { MAX_FUEL } from '../src/constants/commander.ts';
import {
  CHART_CANVAS_W, CHART_CANVAS_H, CHART_Y_SQUASH, LOCAL_CANVAS, LOCAL_SCALE,
} from '../src/constants/chart-metric.ts';
import { HUD } from '../src/palette.ts';
import type { ChartState } from '../src/game/chart-state.ts';
import type { ChartOverlays } from '../src/game/chart-overlay.ts';
import { drawChart } from '../src/ui/chart-galactic.ts';
import { drawLocalChart } from '../src/ui/chart-local.ts';
import { captureById, captureCanvas, type CanvasOp } from './screen-capture.ts';
import { g1 } from './fixtures.ts';
import { check, eq } from './harness.ts';

/**
 * No overlay is drawn. The price tells are the reason this matters: a system
 * trading dear is stroked in the same amber the contract marker uses, so an
 * empty price map keeps the marker check honest.
 *
 * `day` is the LIVING galaxy's day, and it is 500 days from every commander
 * below. A verdict computed from it would be wrong by 500 days.
 */
const NO_OVERLAYS: ChartOverlays = {
  mode: 'none',
  danger: new Set<number>(),
  lanes: [],
  prices: new Map(),
  hovered: null,
  day: 500,
};

/** A commander at `index`, on day `day`, with a full tank. */
function standing(index: number, day = 0): CommanderData {
  const c = newCommander();
  c.systemIndex = index;
  c.fuel = MAX_FUEL;
  c.day = day;
  return c;
}

/** A courier job to `destination`, due on `deadlineDay`. */
function job(destination: number, deadlineDay: number): Contract {
  return {
    kind: 'courier', destination, commodity: 0, qty: 1, reward: 500, deadlineDay, progress: 0,
  };
}

/** The verdict for a commander who owes one job, standing `daysAway` from it. */
function verdictFor(daysLeft: number, daysAway: number | null): string {
  const c = standing(7, 10);
  c.contracts = [job(50, 10 + daysLeft)];
  const v = contractVerdict(c, 50, daysAway);
  return v === null ? 'none' : `${v.text}${v.late ? ' [RED]' : ''}`;
}

console.log('\nthe contract verdict, as a function');
{
  eq('a system nobody sent you to gets no verdict',
    contractVerdict(standing(7, 10), 50, 3), null);

  eq('a comfortable deadline states both numbers',
    verdictFor(10, 3), 'DUE IN 10 DAYS · 3 DAYS AWAY');
  eq('one day, singular, on both halves of the line',
    verdictFor(1, 1), 'DUE IN 1 DAY · 1 DAY AWAY');

  // The boundary, and game/contracts.ts owns it: settlement calls a delivery
  // late when `c.day > k.deadlineDay`, so arriving ON the deadline day pays.
  // A verdict that painted this red would refuse a job the game accepts.
  eq('a journey that arrives exactly on the deadline day is not late',
    verdictFor(6, 6), 'DUE IN 6 DAYS · 6 DAYS AWAY');
  eq('...and one day longer is TOO FAR',
    verdictFor(6, 7), 'DUE IN 6 DAYS · 7 DAYS AWAY · TOO FAR [RED]');

  eq('the last day says DUE TODAY', verdictFor(0, 2), 'DUE TODAY · 2 DAYS AWAY · TOO FAR [RED]');
  eq('...and standing on the destination on the last day still pays',
    verdictFor(0, 0), 'DUE TODAY · YOU ARE HERE');
  eq('a destination you stand in has no journey left', verdictFor(9, 0),
    'DUE IN 9 DAYS · YOU ARE HERE');

  eq('a deadline already passed says how far past', verdictFor(-2, 3),
    'OVERDUE BY 2 DAYS [RED]');
  eq('...and one day past is singular', verdictFor(-1, 3), 'OVERDUE BY 1 DAY [RED]');

  // Galaxy 7 splits into a mainland and an island of 27 systems, and no system
  // in galaxy 8 is within a full tank of Oresrati. So this is an answer about
  // the map (src/galaxy/route.ts), not a guard against bad input.
  eq('a destination no chain of jumps reaches says so', verdictFor(9, null),
    'DUE IN 9 DAYS · NO ROUTE [RED]');
}

console.log('\ntwo jobs to one world');
{
  const c = standing(7, 10);
  c.contracts = [job(50, 40), job(50, 25), job(111, 30)];

  const v = contractVerdict(c, 50, 5)!;
  // The tightest deadline decides when the commander must leave. The looser one
  // is counted, because the marker on the chart covers both of them.
  eq('the tightest deadline is the one priced', v.text, 'DUE IN 15 DAYS · 5 DAYS AWAY · +1 MORE');
  check('...and it is the one that decides the colour',
    contractVerdict(c, 50, 20)!.late && !contractVerdict(c, 50, 14)!.late);

  const marks = contractDestinations(c);
  eq('two jobs to one world make one marker', marks.size, 2);
  check('...on the two worlds that were named', marks.has(50) && marks.has(111));
  eq('a commander who owes nothing marks nothing', contractDestinations(standing(7)).size, 0);
}

// --- what the charts paint --------------------------------------------------

/** Paint both charts with the cursor on `cursor`. Return the two info lines. */
function infoLines(c: CommanderData, cursor: StarSystem): { wide: string; local: string } {
  const chart: ChartState = { cursorX: cursor.x, cursorY: cursor.y, targetIndex: null };
  const wide = captureById(() => drawChart(g1, c, chart, NO_OVERLAYS));
  const local = captureById(() => drawLocalChart(g1, c, chart, NO_OVERLAYS));
  return { wide: wide.get('chart-info') ?? '', local: local.get('local-info') ?? '' };
}

/** The verdict as painted, with the markup stripped. */
const painted = (line: string): string =>
  (/<span class="due"[^>]*>([^<]*)<\/span>/.exec(line) ?? ['', 'none'])[1];

/** True when the painted verdict is red rather than amber. */
const inRed = (line: string): boolean => /<span class="due" style="color:var\(--hud-red\)"/.test(line);

console.log('\nboth charts carry the verdict');
{
  const lave = g1[7];
  // A neighbour inside the tank, so the chart prices the journey as one jump.
  const near = g1.filter((s) => s.index !== 7 && distanceTenths(lave, s) <= MAX_FUEL)
    .sort((a, b) => distanceTenths(lave, a) - distanceTenths(lave, b))[0];
  const away = daysForJump(distanceTenths(lave, near));

  const c = standing(7, 10);
  c.contracts = [job(near.index, 10 + away + 4)];
  const owed = infoLines(c, near);
  eq(`the galactic chart states the deadline and the journey to ${near.name.toUpperCase()}`,
    painted(owed.wide), `DUE IN ${away + 4} DAYS · ${away} DAYS AWAY`);
  eq('...and so does the short range chart', painted(owed.local), painted(owed.wide));
  check('...in amber, because the deadline can be met',
    !inRed(owed.wide) && !inRed(owed.local));

  // The living galaxy is on day 500 in NO_OVERLAYS. A painter that read it
  // would print a deadline 500 days out of date, or an overdue one.
  check('...measured on the commander\'s day and not the galaxy\'s',
    painted(owed.wide).startsWith(`DUE IN ${away + 4} DAYS`));

  const elsewhere = infoLines(c, g1[111]);
  check('a world nobody sent you to carries no verdict on either chart',
    painted(elsewhere.wide) === 'none' && painted(elsewhere.local) === 'none');

  // The same commander, one day later than the journey allows.
  const tight = standing(7, 10);
  tight.contracts = [job(near.index, 10 + away - 1)];
  const missed = infoLines(tight, near);
  check(`a deadline the journey misses by one day says TOO FAR (${painted(missed.wide)})`,
    painted(missed.wide).endsWith('TOO FAR') && painted(missed.local) === painted(missed.wide));
  check('...and both charts paint it red', inRed(missed.wide) && inRed(missed.local));
}

console.log('\nthe verdict and the days term price one journey');
{
  // The line says the journey twice: once as what it costs, once as how far
  // away the deadline is. Two measurements would let one line contradict
  // itself, which is why ui/screens.ts measures once and hands the number to
  // both terms.
  const lave = g1[7];
  const far = g1.find((s) => distanceTenths(lave, s) > MAX_FUEL)!;
  const route = routeEstimate(g1, lave, far)!;
  const c = standing(7, 10);
  c.contracts = [job(far.index, 40)];
  const { wide, local } = infoLines(c, far);

  eq(`beyond the tank the verdict uses the route estimate to ${far.name.toUpperCase()}`,
    painted(wide), `DUE IN 30 DAYS · ${route.days} DAYS AWAY`);
  eq('...and the short range chart agrees', painted(local), painted(wide));
  check(`...which is the number the days term already gave (EST ${route.days} DAYS)`,
    wide.includes(`EST ${route.days} DAYS, ${route.jumps} JUMP`));
}

// --- the marker -------------------------------------------------------------

/**
 * Every amber diamond the painter drew, by its centre.
 *
 * The diamond opens at its top point, so the centre is that point plus `reach`.
 * Only `moveTo` is taken, so one diamond gives one entry. Nothing else on
 * either chart strokes amber through `moveTo`: the target ring is an `arc`, and
 * the price tells are the other amber `moveTo` and are switched off above.
 */
function diamonds(ops: CanvasOp[], reach: number): { x: number; y: number }[] {
  return ops
    .filter((o) => o.method === 'moveTo' && o.strokeStyle === HUD.amber)
    .map((o) => ({ x: o.args[0] as number, y: (o.args[1] as number) + reach }));
}

/** Both charts' marks, for a commander with the cursor parked on their home. */
function marks(c: CommanderData): { wide: { x: number; y: number }[];
  local: { x: number; y: number }[]; } {
  const home = g1[c.systemIndex];
  const chart: ChartState = { cursorX: home.x, cursorY: home.y, targetIndex: null };
  const wide = captureCanvas(() => drawChart(g1, c, chart, NO_OVERLAYS),
    CHART_CANVAS_W, CHART_CANVAS_H);
  const local = captureCanvas(() => drawLocalChart(g1, c, chart, NO_OVERLAYS),
    LOCAL_CANVAS, LOCAL_CANVAS);
  return {
    wide: diamonds(wide.get('chart-canvas') ?? [], 7),
    local: diamonds(local.get('local-canvas') ?? [], 8),
  };
}

/** Where the galactic chart puts a system, and where the short range one does. */
const widePoint = (s: StarSystem) => ({
  x: s.x * (CHART_CANVAS_W / 256),
  y: (s.y / CHART_Y_SQUASH) * (CHART_CANVAS_H / 128),
});
const localPoint = (s: StarSystem, home: StarSystem) => ({
  x: LOCAL_CANVAS / 2 + (s.x - home.x) * LOCAL_SCALE,
  y: LOCAL_CANVAS / 2 + ((s.y - home.y) / CHART_Y_SQUASH) * LOCAL_SCALE,
});
const at = (got: { x: number; y: number }[], want: { x: number; y: number }): boolean =>
  got.some((p) => Math.abs(p.x - want.x) < 0.001 && Math.abs(p.y - want.y) < 0.001);

console.log('\nthe chart marks the world you owe a delivery to');
{
  const lave = g1[7];
  const inside = g1.filter((s) => s.index !== 7 && distanceTenths(lave, s) <= MAX_FUEL)[0];
  const beyond = g1.find((s) => distanceTenths(lave, s) > MAX_FUEL)!;

  const none = marks(standing(7, 10));
  check('a commander who owes nothing gets no marker on either chart',
    none.wide.length === 0 && none.local.length === 0);

  const c = standing(7, 10);
  c.contracts = [job(inside.index, 40), job(beyond.index, 40)];
  const drawn = marks(c);
  eq('two jobs, two marks on the galactic chart', drawn.wide.length, 2);
  check(`...on ${inside.name.toUpperCase()} and ${beyond.name.toUpperCase()}`,
    at(drawn.wide, widePoint(inside)) && at(drawn.wide, widePoint(beyond)));
  // The marker is always on, like the danger ring. A destination beyond the
  // tank is exactly the one a pilot has to plan for.
  check('...including the destination beyond the tank',
    at(drawn.wide, widePoint(beyond)));
  check('the short range chart marks the neighbour in its own projection',
    at(drawn.local, localPoint(inside, lave)));

  // The marker is not the jump target. Both are amber, so only the shape tells
  // them apart, and a ring drawn for a contract would say TARGET.
  const chart: ChartState = { cursorX: lave.x, cursorY: lave.y, targetIndex: inside.index };
  const ops = captureCanvas(() => drawChart(g1, standing(7, 10), chart, NO_OVERLAYS),
    CHART_CANVAS_W, CHART_CANVAS_H).get('chart-canvas') ?? [];
  const rings = ops.filter((o) => o.method === 'arc' && o.strokeStyle === HUD.amber);
  check('a jump target with no contract on it draws a ring and no diamond',
    rings.length === 1 && diamonds(ops, 7).length === 0);
}

// --- and the other kind of standing order (docs/TODO/144 M4) ----------------
//
// The Navy mission sends a commander to a system exactly as a contract does,
// and until now the chart drew it as any other world. That is the half of
// GitHub #27 that bites in FLIGHT: the bulletin board does not open there, so
// the chart is the only surface left that could have said where to go.
//
// `game/orders.ts` owns the union and the verdict. The rig above is this
// block's as well, so the two kinds cannot be marked by two different rules.

console.log('\nthe chart marks the world the Navy sent you to');
{
  const lave = g1[7];
  const inside = g1.filter((s) => s.index !== 7 && distanceTenths(lave, s) <= MAX_FUEL)[0];
  const away = daysForJump(distanceTenths(lave, inside));

  /** A commander hunting the Constrictor at `target`. */
  const hunting = (target: number): CommanderData => {
    const c = standing(7, 10);
    c.mission = { stage: 1, targetIndex: target };
    return c;
  };

  const c = hunting(inside.index);
  eq('the hunt marks the one world', orderDestinations(c).size, 1);
  const drawn = marks(c);
  check('...and both charts draw the diamond on it',
    at(drawn.wide, widePoint(inside)) && at(drawn.local, localPoint(inside, lave)));

  const line = infoLines(c, inside);
  eq('the galactic chart names the mission and prices the journey',
    painted(line.wide), `NAVY MISSION · ${away} DAY${away === 1 ? '' : 'S'} AWAY`);
  eq('...and the short range chart agrees', painted(line.local), painted(line.wide));
  check('...in amber, because a mission has no deadline to miss',
    !inRed(line.wide) && !inRed(line.local));

  const here = infoLines(hunting(7), lave);
  eq('standing in the system it is hiding in says so',
    painted(here.wide), 'NAVY MISSION · YOU ARE HERE');

  // A CONTRACT ANSWERS FIRST where one world carries both, because a contract
  // has a deadline and the mission does not.
  const both = hunting(inside.index);
  both.contracts = [job(inside.index, 40)];
  eq('one world under two orders is still one marker', orderDestinations(both).size, 1);
  check('...and the deadline is the line that is printed',
    painted(infoLines(both, inside).wide).startsWith('DUE IN 30 DAYS'));

  // Stage 2 is the gap between the kill and the next briefing, and stage 4 is
  // over. `missionDestination` is what keeps a cleared `targetIndex` off the
  // chart, rather than every caller knowing which stages mean anything.
  const between = standing(7, 10);
  between.mission = { stage: 2, targetIndex: null };
  eq('between the two legs nothing is marked', orderDestinations(between).size, 0);
  eq('...and a system nobody sent her to has no verdict',
    orderVerdict(between, inside.index, 2), null);
}
