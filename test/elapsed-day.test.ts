// The elapsed day, on the screens a pilot consults before a jump.
//
// A jump spends three things — fuel, money and DAYS — and the day was the one
// nothing named where the decision is made (docs/TODO/140). `commander.day` was
// correct throughout: it moved on a jump and on a mis-jump tow and on nothing
// else, and it appeared only on a saves column, a bulletin-board keyline and
// the docked menu's first contract. So the defect was never in a rule, and
// every check here is a STRING check, because a string is what was missing.
//
// The binding half — that the flight topbar is handed the commander's clock and
// not the living galaxy's — is test/hud-binding.test.ts, beside the frame it
// belongs to. This file is the two docked screens and the markup the topbar
// needs.

import { readFileSync } from 'node:fs';
import { newCommander } from '../src/game/commander.ts';
import { renderDockedMenu, renderStatus } from '../src/ui/screens.ts';
import { daysForJump } from '../src/galaxy/navigation.ts';
import { capture } from './screen-capture.ts';
import { check } from './harness.ts';

/** One system to paint a station screen for; nothing here reads its economy. */
const LAVE = { name: 'Lave', economy: 0, government: 5, techLevel: 4 } as never;

console.log('\nthe two docked screens print the elapsed day');
{
  const painted = (day: number) => {
    const c = newCommander();
    c.day = day;
    // renderStatus looks its own system up by index, so the stand-in goes where
    // a new commander actually stands rather than at the head of the array.
    const systems: never[] = [];
    systems[c.systemIndex] = LAVE;
    return {
      status: capture(() => renderStatus(systems, c, null, 'Clean')),
      menu: capture(() => renderDockedMenu(LAVE, c)),
    };
  };

  const fresh = painted(0);
  check(`a new career stands on day 0 on the COMMANDER screen (${
    (fresh.status.match(/Elapsed: [^<]*/) ?? ['nothing'])[0]})`,
  fresh.status.includes('Elapsed: 0 days'));
  check('...and on the station menu', fresh.menu.includes('DAY 0'));

  // The number is READ, not decorated: a career 34 days old says 34, and says
  // it on both screens. A painter that wrote the fresh value out as a literal
  // passes the pair above and fails here.
  const later = painted(34);
  check('a career 34 days old says so on the COMMANDER screen',
    later.status.includes('Elapsed: 34 days'));
  check('...and on the station menu', later.menu.includes('DAY 34'));

  // The position is the argument for it (docs/TODO/140 M1): fuel and days are
  // what a jump spends, and cash is what a market spends.
  check('the status screen puts the day between fuel and cash',
    later.status.indexOf('Fuel:') < later.status.indexOf('Elapsed:')
    && later.status.indexOf('Elapsed:') < later.status.indexOf('Cash:'));

  // THE CONTROL. `capture` could answer '' to everything and every check above
  // would still be an honest-looking `ok` — which is exactly what an inert
  // painter did before test/screen-capture.ts existed.
  check('the capture helper really recorded a screen',
    later.status.includes('COMMANDER') && later.menu.includes('LAVE STATION'));
  check('...and it left no document behind for the next test file',
    typeof document === 'undefined');
}

// The topbar's fourth span. The HUD is a dumb painter and nothing reads its
// writes back (invariant 15), so the ELEMENT is what a test can hold it to:
// hud.ts caches `day-display` in a field initializer, and a missing id there
// becomes an inert sink that paints nowhere, silently, for the rest of the run.
console.log('\nthe flight topbar has somewhere to put the day');
{
  const play = readFileSync(new URL('../play.html', import.meta.url), 'utf8');
  check('play.html carries a #day-display span', /id="day-display"/.test(play));
  check('...inside the topbar, beside the system name',
    /id="topbar"[\s\S]*id="day-display"[\s\S]*id="condition"/.test(play));
  // The day term itself is arithmetic that already has an owner
  // (galaxy/navigation.ts). Nothing in the topbar recomputes it; this is the
  // reminder of where the number the pilot watches tick comes from.
  check('a jump costs at least one day, which is what the topbar will tick',
    daysForJump(0) === 1 && daysForJump(47) > 1);
}
