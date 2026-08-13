// The contracts screen, and the half of it that travels (docs/TODO/145).
//
// A bulletin board is a STATION's: the offers are that station's work, and
// `state.contractOffers` still holds the last one's the whole time she is in
// flight. What she SIGNED for is different — it is true wherever she is, and
// until 145 it could only be read at a station, which is the gap GitHub #27
// reported for the Navy mission and which contracts shared.
//
// So the screen has two halves and one of them is conditional. The condition is
// `atStation`, and these are its two states.

import {
  newCommander, type CommanderData, type Contract,
} from '../src/game/commander.ts';
import { renderContracts } from '../src/ui/screens.ts';
import { standingOrders } from '../src/game/orders.ts';
import { generateGalaxy } from '../src/galaxy/galaxy.ts';
import { ContractsScreen } from '../src/game/screens/contracts.ts';
import type { Input } from '../src/engine/input.ts';
import { captureById } from './screen-capture.ts';
import { check, cmds, eq, eqc } from './harness.ts';

console.log('\nthe contracts screen, docked and in flight');
{
  const systems = generateGalaxy(1);
  const here = systems[7];

  const job = (over: Partial<Contract> = {}): Contract => ({
    kind: 'courier', destination: 42, commodity: 0, qty: 1,
    reward: 5000, deadlineDay: 106, progress: 0, ...over,
  });

  const c: CommanderData = {
    ...newCommander(), systemIndex: 7, day: 100,
    contracts: [job(), job({ kind: 'cargo', destination: 11, commodity: 3, qty: 5 })],
  };
  const offers = [job({ destination: 55, reward: 7000 })];

  const paint = (atStation: boolean): string => captureById(() => {
    renderContracts(here, systems, c, offers, 0, atStation);
  }).get('screen') ?? '';

  const docked = paint(true);
  const flying = paint(false);

  check('docked, the board is on the screen',
    docked.includes('WORK ON OFFER AT LAVE'));
  // `describeContract` upper-cases the destination, so match what it writes.
  check('...with the work it is offering',
    docked.includes(systems[55].name.toUpperCase()));
  check('...and the accept control', docked.includes('ACCEPT SELECTED'));

  // The half that travels.
  check('in flight the work she signed for is still on the screen',
    flying.includes('ACCEPTED')
    && flying.includes(systems[42].name.toUpperCase())
    && flying.includes(systems[11].name.toUpperCase()));

  // The half that does not. `state.contractOffers` is the LAST station's board,
  // so drawing it in flight shows a pilot work she cannot take.
  check('...but the board is not, because a board is a station\'s',
    !flying.includes('WORK ON OFFER'));
  check('...and neither is the control that signs for one',
    !flying.includes('ACCEPT SELECTED'));
  check('...nor the keyline that advertises it',
    !flying.includes('A ACCEPT') && flying.includes('ESC EXIT'));

  // One name for the screen, at both. The row says CONTRACTS, so the heading
  // does too — `LEESTI STATION BULLETIN BOARD` was a second name for one thing.
  check('the screen has one name, and the menu row uses it',
    docked.includes('<h2>CONTRACTS</h2>') && flying.includes('<h2>CONTRACTS</h2>'));

  const idle = captureById(() => {
    renderContracts(here, systems, { ...c, contracts: [] }, [], 0, false);
  }).get('screen') ?? '';
  check('a commander who signed for nothing still gets a screen, and it says so',
    idle.includes('CONTRACTS') && idle.includes('signed for no work'));
}

console.log('\n⇧C reaches it from the cockpit, and C is still the docking computer');
{
  eqc('⇧C in the cockpit asks for the contracts',
    cmds('flight', ['KeyC'], ['ShiftLeft']), ['openContracts']);
  eqc('...and plain C is still the docking computer',
    cmds('flight', ['KeyC'], []), ['toggleDockingComputer']);
  eqc('C at the station is the contracts, unshifted and clickable',
    cmds('docked', ['KeyC'], []), ['openContracts']);
}

// The key, not just the button. A control that is not DRAWN but whose key still
// answers is the "dead control that looks alive" failure inverted: the pilot
// cannot see it, and it spends her money anyway. So the screen refuses it.

console.log('\nthe accept key is refused in flight, not merely hidden');
{
  const systems = generateGalaxy(1);
  const offers: Contract[] = [{
    kind: 'courier', destination: 55, commodity: 0, qty: 1,
    reward: 7000, deadlineDay: 140, progress: 0,
  }];

  /** A one-shot keyboard, as test/quit.test.ts builds one. */
  const taps = (code: string): Input => {
    let left = 1;
    return {
      pressed: (c: string) => (c === code && left-- > 0),
      held: () => false,
    } as unknown as Input;
  };

  const drive = (atStation: boolean): number => {
    let signed = 0;
    const screen = new ContractsScreen(() => ({
      commander: { ...newCommander(), systemIndex: 7, day: 100, contracts: [] },
      system: systems[7],
      systems,
      offers,
      atStation,
      accept: () => { signed += 1; },
    }));
    screen.open();
    screen.input(taps('KeyA'));
    return signed;
  };

  eq('docked, A signs for the selected job', drive(true), 1);
  eq('in flight it signs for nothing', drive(false), 0);
}

// One subtraction, one home. The WORDS were never at risk — both halves call
// `describeContract` — but the days-left arithmetic was written twice, and
// docs/TODO/140 M4 records what a deadline measured from the wrong day costs.

console.log('\nthe ACCEPTED rows and the docked summary count the same days');
{
  const systems = generateGalaxy(1);
  const c: CommanderData = {
    ...newCommander(), systemIndex: 7, day: 100,
    contracts: [
      { kind: 'courier', destination: 42, commodity: 0, qty: 1, reward: 5000, deadlineDay: 106, progress: 0 },
      { kind: 'bounty', destination: 11, commodity: 0, qty: 5, reward: 9000, deadlineDay: 130, progress: 2 },
    ],
  };
  const html = captureById(() => {
    renderContracts(systems[7], systems, c, [], 0, false);
  }).get('screen') ?? '';

  const orders = standingOrders(c, systems)
    .filter((o) => o.kind === 'contract');
  check('every accepted job is a row', orders.length === 2);
  check('...and each row carries the days the reader counted',
    orders.every((o) => html.includes(`${(o as { daysLeft: number }).daysLeft} days left`)));
  check('...with a bounty\'s progress, which no summary carries',
    html.includes('(2/5)'));

  // The row order is the reader's, so the tightest deadline is at the top of
  // both surfaces rather than in board order on one of them.
  check('the tightest deadline is the first row',
    html.indexOf('6 days left') < html.indexOf('30 days left'));
}
