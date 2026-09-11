// The thumb's buttons in flight: the command row and the flight menu
// (docs/TODO/204 M3 and M4).
//
// Both are painted from the binding table, so a button cannot press a key
// the table does not have, and a rebound key moves its button with it.
// These checks lived in test/key-help.test.ts until that file crossed the
// size ceiling, and they are one subject.

import {
  TOUCH_COMMANDS, TOUCH_MENU, keyCodeIfBound, touchCommandsHtml, touchMenuHtml,
} from '../src/ui/key-help.ts';
import { check, eq } from './harness.ts';

console.log('\nthe touch command row presses the flight keys it names (docs/TODO/204 M3)');
{
  const row = touchCommandsHtml();
  const missing = TOUCH_COMMANDS.filter(({ command }) => {
    const key = keyCodeIfBound('flight', command);
    return !key || !row.includes(`data-command="${command}" data-key="${key.code}"`);
  });
  check('every button carries the flight key of its command', missing.length === 0,
    missing.map((m) => m.command).join(', '));
  const launch = keyCodeIfBound('flight', 'launchMissile');
  check('...and MISSILE carries the launch key too, for the HUD to swap in once armed',
    launch !== null && row.includes(`data-launch="${launch.code}"`));
  eq('five buttons', (row.match(/class="touch-command"/g) ?? []).length, 5);
  check('a station row has no code for a button, because it is a row already',
    keyCodeIfBound('docked', 'openMarket') === null);
  const shifted = keyCodeIfBound('flight', 'openLog');
  check('a shifted key carries its modifier', shifted !== null && shifted.shift && shifted.code === 'KeyR');
}

console.log('\nthe flight menu\'s rows press the flight keys they name (docs/TODO/204 M4)');
{
  const menu = touchMenuHtml();
  const missing = TOUCH_MENU.filter(({ command }) => {
    const key = keyCodeIfBound('flight', command);
    return !key || !menu.includes(`data-command="${command}" data-key="${key.code}"`);
  });
  check('every row carries the flight key of its command', missing.length === 0,
    missing.map((m) => m.command).join(', '));
  check('a shifted key travels with its row', /data-command="openLog" data-key="KeyR" data-shift="1"/.test(menu));
  const pod = keyCodeIfBound('flight', 'launchEscapePod');
  check('the escape pod row asks first, and only YES carries the key',
    pod !== null && menu.includes('data-ask="pod">ESCAPE POD') && menu.includes(`data-command="launchEscapePod" data-key="${pod.code}"`)
    && !/data-ask="pod"[^>]*data-key/.test(menu));
  check('...and the menu closes on CLOSE', menu.includes('data-ask="">CLOSE'));
}

