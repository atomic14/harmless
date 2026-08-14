// The cost of a jump in days, on the two screens where a pilot chooses a jump.
//
// A jump costs fuel, money and days. Both charts gave the first two costs and
// never gave the third one (docs/TODO/140 M2). Every check here is a string
// check, because a string is what was absent. `daysForJump` is the arithmetic
// behind the string, it was correct, and galaxy/navigation.ts owns it.
//
// These checks paint both charts through test/screen-capture.ts. They do not
// call the wording function on its own. That is the point. A correct helper
// plus a painter that never calls it is the exact defect this milestone fixed.
// Only a full paint can find it.

import { generateGalaxy } from '../src/galaxy/galaxy.ts';
import type { StarSystem } from '../src/galaxy/galaxy.ts';
import { distanceTenths, daysForJump } from '../src/galaxy/navigation.ts';
import { newCommander, type CommanderData } from '../src/game/commander.ts';
import { MAX_FUEL } from '../src/constants/commander.ts';
import type { ChartState } from '../src/game/chart-state.ts';
import type { ChartOverlays } from '../src/game/chart-overlay.ts';
import { drawChart } from '../src/ui/chart-galactic.ts';
import { drawLocalChart } from '../src/ui/chart-local.ts';
import { captureById } from './screen-capture.ts';
import { g1 } from './fixtures.ts';
import { check } from './harness.ts';

/** No overlay is drawn here. The subject is the info line under the cursor. */
const NO_OVERLAYS: ChartOverlays = {
  mode: 'none',
  danger: new Set<number>(),
  lanes: [],
  prices: new Map(),
  hovered: null,
  day: 0,
};

/**
 * The days term as the charts paint it, and nothing else.
 *
 * `&middot; 4.7 LY` has the same shape, so the word must follow the digits. The
 * short-range chart also carries a planet description. That description is
 * prose and can say anything, and this pattern cannot match inside it.
 */
const DAYS_TERM = /&middot; (\d+) DAYS?(?![A-Z])/;

/**
 * The estimate the charts paint beyond the tank: `&middot; EST 7 DAYS, 2 JUMPS`
 * (docs/TODO/140 M3).
 *
 * A different shape from the term above, and deliberately so. One jump costs
 * what it costs. A journey of several jumps is a plan the pilot has not made,
 * and the two must not read alike. `DAYS_TERM` cannot match this string,
 * because EST stands between the separator and the digits.
 */
const ESTIMATE_TERM = /&middot; EST (\d+) DAYS?, (\d+) JUMPS?(?![A-Z])/;

/** Paint both charts with the cursor on `cursor`. Return the two info lines. */
function infoLines(
  systems: StarSystem[],
  c: CommanderData,
  cursor: StarSystem,
): { wide: string; local: string } {
  const chart: ChartState = { cursorX: cursor.x, cursorY: cursor.y, targetIndex: null };
  const wide = captureById(() => drawChart(systems, c, chart, NO_OVERLAYS));
  const local = captureById(() => drawLocalChart(systems, c, chart, NO_OVERLAYS));
  return { wide: wide.get('chart-info') ?? '', local: local.get('local-info') ?? '' };
}

/** A commander at system `index`, with `fuel` tenths of a light year aboard. */
function standing(index: number, fuel: number): CommanderData {
  const c = newCommander();
  c.systemIndex = index;
  c.fuel = fuel;
  return c;
}

console.log('\nboth charts give the cost of a jump in days');
{
  // Five home systems across galaxy 1. One neighbourhood could agree with a
  // wrong painter by chance. Five cannot.
  const homes = [7, 50, 111, 172, 233];
  let priced = 0;
  let silent = 0;
  let estimated = 0;
  const values = new Set<number>();
  let wrong = '';

  for (const home of homes) {
    const c = standing(home, MAX_FUEL);
    const current = g1[home];
    for (const s of g1) {
      const { wide, local } = infoLines(g1, c, s);
      // The expected value comes from the distance. It does not come from
      // `oneJumpDays`, which is the function the painter calls. An expectation
      // taken from the code under test agrees with a wrong answer too.
      const tenths = distanceTenths(current, s);
      const expected = (s.index === home || tenths > c.fuel) ? null : daysForJump(tenths);
      // Beyond the tank the line owes an ESTIMATE instead. Every system in
      // galaxy 1 is reachable from every other by full-tank jumps — the map has
      // one connected part — so there is no third case here. Galaxy 8 strands
      // Oresrati and galaxy 7 strands 27 systems; test/route.test.ts owns them.
      const owesEstimate = s.index !== home && tenths > c.fuel;
      for (const [screen, line] of [['galactic', wide], ['short range', local]]) {
        const found = DAYS_TERM.exec(line);
        const said = found ? Number(found[1]) : null;
        if (said !== expected) {
          wrong ||= `${screen} chart at ${current.name}->${s.name}`
            + ` said ${said} days, wanted ${expected}: ${line.slice(0, 120)}`;
        }
        const guess = ESTIMATE_TERM.exec(line);
        if (owesEstimate !== (guess !== null)) {
          wrong ||= `${screen} chart at ${current.name}->${s.name}`
            + ` ${guess ? 'estimated' : 'estimated nothing'}: ${line.slice(0, 120)}`;
        }
        // A journey takes at least one jump and at least one day. The numbers
        // themselves belong to test/route.test.ts, which can check them against
        // the map rather than against a painted string.
        if (guess && (Number(guess[1]) < 1 || Number(guess[2]) < 1)) {
          wrong ||= `${screen} chart estimated ${guess[0]} for ${current.name}->${s.name}`;
        }
        // No two systems in galaxy 1 share a chart point. So a cursor on one
        // system describes that system. A line about a different system would
        // make every day check above worthless.
        if (!line.includes(s.name.toUpperCase())) {
          wrong ||= `${screen} chart put the cursor on ${s.name} and named something else`;
        }
      }
      if (expected === null) silent++;
      else { priced++; values.add(expected); }
      if (owesEstimate) estimated++;
    }
  }

  check(`every system on both charts gives the cost of the jump (${wrong || 'none wrong'})`,
    wrong === '');
  // The control on the check above. A painter that gave a days term nowhere,
  // or one that gave a days term everywhere, also leaves `wrong` empty.
  check(`${priced} jumps got a days term and ${silent} did not`, priced > 0 && silent > 0);
  check(`${estimated} journeys beyond the tank got an estimate instead`, estimated > 0);
  // The term is read, not written out. One constant passes every check above.
  check(`the term comes from the distance (${[...values].sort((a, b) => a - b).join(', ')} days seen)`,
    values.size >= 3);
}

console.log('\nthe two jumps with no honest one-jump cost');
{
  const c = standing(7, MAX_FUEL); // Lave, full tank
  const lave = g1[7];

  const here = infoLines(g1, c, lave);
  check('the system you stand in costs no days on the galactic chart',
    !DAYS_TERM.test(here.wide) && here.wide.includes('LAVE'));
  check('...and no days on the short range chart',
    !DAYS_TERM.test(here.local) && here.local.includes('LAVE'));
  // This is the trap the rule exists for. The arithmetic alone gives 1 day for
  // a jump to where you are, because the base day is the jump itself.
  check('...although daysForJump(0) is 1', daysForJump(0) === 1);

  const far = g1.find((s) => distanceTenths(lave, s) > MAX_FUEL)!;
  const beyond = infoLines(g1, c, far);
  check(`${far.name.toUpperCase()} is out of range, so neither chart gives a days term`,
    !DAYS_TERM.test(beyond.wide) && !DAYS_TERM.test(beyond.local));
  check('...and both charts still say OUT OF RANGE',
    beyond.wide.includes('OUT OF RANGE') && beyond.local.includes('OUT OF RANGE'));
  // What M3 put in place of that silence. One jump cannot make the journey, so
  // one jump's cost would be a lie; the route across several jumps is not.
  check(`...and both charts estimate the journey instead`
    + ` (${(ESTIMATE_TERM.exec(beyond.wide) ?? ['nothing'])[0]})`,
  ESTIMATE_TERM.test(beyond.wide) && ESTIMATE_TERM.test(beyond.local));
}

console.log('\nthe estimate beyond the tank is priced on a full tank');
{
  // Fuel costs money and every station sells it. Fuel costs no days. So the
  // journey a pilot is quoted must not get longer because the tank is low —
  // that number would price a shortage the pilot can end at the fuel bay.
  const lave = g1[7];
  const far = g1.find((s) => distanceTenths(lave, s) > MAX_FUEL)!;
  const full = infoLines(g1, standing(7, MAX_FUEL), far);
  const dry = infoLines(g1, standing(7, 0), far);
  const said = (line: string): string => (ESTIMATE_TERM.exec(line) ?? ['none'])[0];
  check(`${far.name.toUpperCase()} costs ${said(full.wide)} on a full tank`,
    ESTIMATE_TERM.test(full.wide));
  check('...and the same on an empty one, on both charts',
    said(dry.wide) === said(full.wide) && said(dry.local) === said(full.local));
}

console.log('\nthe fuel aboard decides the range');
{
  // A neighbour with a days term on a full tank must lose it when the fuel is
  // too low. The OUT OF RANGE text beside it means the same thing. A range test
  // against MAX_FUEL keeps a price on a jump the ship cannot make.
  const lave = g1[7];
  const near = g1.filter((s) => s.index !== 7 && distanceTenths(lave, s) <= MAX_FUEL)
    .sort((a, b) => distanceTenths(lave, b) - distanceTenths(lave, a))[0];
  const reach = distanceTenths(lave, near);

  const full = infoLines(g1, standing(7, reach), near);
  const dry = infoLines(g1, standing(7, reach - 1), near);
  check(`${near.name.toUpperCase()} is ${(reach / 10).toFixed(1)} LY away, and both charts`
    + ' price it on exactly that much fuel',
  DAYS_TERM.test(full.wide) && DAYS_TERM.test(full.local));
  check('...and neither chart prices it one tenth of a light year short',
    !DAYS_TERM.test(dry.wide) && !DAYS_TERM.test(dry.local));
  // It becomes an estimate of one jump instead: a full tank still reaches it in
  // one, and the pilot buys the fuel at the bay. So the ONE JUMP is singular,
  // and it is the fuel term that changed rather than the journey.
  check(`...and both charts estimate one jump instead`
    + ` (${(ESTIMATE_TERM.exec(dry.wide) ?? ['nothing'])[0]})`,
  /&middot; EST \d+ DAYS?, 1 JUMP(?!S)/.test(dry.wide)
    && /&middot; EST \d+ DAYS?, 1 JUMP(?!S)/.test(dry.local));
}

console.log('\na jump of no distance still costs one DAY, singular');
{
  // Galaxy 4 puts Riusbequ and Quzaarar on the same chart point. The shortest
  // jump in the game costs `JUMP_DAYS_BASE` alone. This is the only case where
  // the plural reads wrong. A shipped galaxy contains it, so the singular is a
  // rule and not decoration.
  const g4 = generateGalaxy(4);
  const [first, second] = [g4.find((s) => s.name === 'Riusbequ')!,
    g4.find((s) => s.name === 'Quzaarar')!].sort((a, b) => a.index - b.index);
  check('the two systems are on the same point', distanceTenths(first, second) === 0);

  // Stand on the higher index. Point at the lower one. The cursor cannot
  // separate the two, and the painter keeps the first system it finds at a tie.
  const { wide, local } = infoLines(g4, standing(second.index, MAX_FUEL), first);
  check(`the galactic chart says 1 DAY (${(DAYS_TERM.exec(wide) ?? ['nothing'])[0]})`,
    /&middot; 1 DAY(?!S)/.test(wide));
  check('...and so does the short range chart', /&middot; 1 DAY(?!S)/.test(local));
}
