// A standing order has a screen (docs/INVARIANTS.md invariant 16, docs/TODO/144).
//
// A STANDING ORDER is an obligation that outlives the moment it is announced.
// The game has two kinds: a signed contract, and the Navy mission. GitHub #27
// reported what happened when they shared one line — `Station.missionText`
// returned the first contract and reached the Navy line only when the commander
// held none, so two jobs hid the Constrictor's system completely. The commander
// then met that ship by flying into the system by accident.
//
// This file is the gate on the rule rather than on the wording. It drives the
// REAL mission machine (`stepMissionAtDock`), because a fixture that sets
// `mission.stage` by hand would pass while the machine that sets it was broken.

import { newCommander, type CommanderData, type Contract } from '../src/game/commander.ts';
import { standingOrders, ordersSummary } from '../src/game/orders.ts';
import { stepMissionAtDock } from '../src/game/missions.ts';
import { generateGalaxy } from '../src/galaxy/galaxy.ts';
import { renderMissions } from '../src/ui/screens.ts';
import { keyPointer } from '../src/ui/key-help.ts';
import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { withoutSaving } from '../src/game/storage.ts';
import { seedWorld } from '../src/game/rng.ts';
import { captureById } from './screen-capture.ts';
import { check, cmds, consoleWatcher, dismissBriefing, eq, eqc } from './harness.ts';

console.log('\nstanding orders — every kind the commander holds is named');
{
  const systems = generateGalaxy(1);

  /** A real commander: the warning derives from the hull and the fitted gun. */
  const cmdr = (over: Partial<CommanderData> = {}): CommanderData => ({
    ...newCommander(),
    kills: 0, galaxy: 1, systemIndex: 7, day: 100, contracts: [],
    mission: { stage: 0, targetIndex: null }, ...over,
  });

  const job = (over: Partial<Contract> = {}): Contract => ({
    kind: 'courier', destination: 42, commodity: 0, qty: 1,
    reward: 5000, deadlineDay: 106, progress: 0, ...over,
  });

  /** The seeded draw the machine takes; a fixed one keeps the target stable. */
  const half = () => 0.5;

  // 1. the hunt ------------------------------------------------------------
  {
    const c = cmdr({ kills: 16 });
    stepMissionAtDock(c, systems, half);
    eq('the machine briefs her', c.mission.stage, 1);
    const orders = standingOrders(c, systems);
    const target = systems[c.mission.targetIndex as number].name.toUpperCase();
    eq('...and the hunt is one standing order', orders.length, 1);
    check('...that names the system the Constrictor is hiding in',
      orders[0]?.line.includes(target) === true);
    check('...and it is the Navy that gave it', orders[0]?.kind === 'navy');
  }

  // 2. the courier run -----------------------------------------------------
  {
    const c = cmdr({ mission: { stage: 2, targetIndex: null } });
    eq('between the two legs she is under no Navy order',
      standingOrders(c, systems).length, 0);
    stepMissionAtDock(c, systems, half);
    eq('...the machine then hands her the plans', c.mission.stage, 3);
    const orders = standingOrders(c, systems);
    const target = systems[c.mission.targetIndex as number].name.toUpperCase();
    check('...and the courier run names where they go',
      orders[0]?.line.includes(target) === true);
  }

  // 3. the defect #27 reported ---------------------------------------------
  //
  // Two contracts and a briefing, which is the state Chris was in. The old
  // line printed the first contract and stopped.
  {
    const c = cmdr({
      kills: 16,
      contracts: [job({ deadlineDay: 106 }), job({ destination: 11, deadlineDay: 112 })],
    });
    stepMissionAtDock(c, systems, half);
    const orders = standingOrders(c, systems);
    eq('two contracts and a briefing are three standing orders', orders.length, 3);
    eq('...the Navy sorts above the work, because it is briefed one time',
      orders[0]?.kind, 'navy');

    const line = ordersSummary(orders);
    const target = systems[c.mission.targetIndex as number].name.toUpperCase();
    check('...and the summary still names the system she must fly to',
      line.includes(target));
    check('...beside the job that used to hide it', line.includes('SEALED DATA'));
    check('...with the tighter deadline of the two, and a count for the rest',
      line.includes('6 DAYS') && line.includes('(+1 MORE)'));
  }

  // 4. the everyday cases --------------------------------------------------
  {
    eq('a commander under no orders gets no line', ordersSummary(standingOrders(cmdr(), systems)), '');

    const one = cmdr({ contracts: [job()] });
    const line = ordersSummary(standingOrders(one, systems));
    check('one job reads as it always did', line.includes('SEALED DATA') && line.includes('6 DAYS'));
    check('...and does not count a job that is not there', !line.includes('MORE'));

    const tomorrow = cmdr({ contracts: [job({ deadlineDay: 101 })] });
    check('the last day is a day, not days',
      ordersSummary(standingOrders(tomorrow, systems)).includes('1 DAY —') === false
      && ordersSummary(standingOrders(tomorrow, systems)).includes('— 1 DAY'));
  }

  // 5. the contracts sort by deadline --------------------------------------
  //
  // The row at the top decides when she must leave, so the tightest deadline
  // is the one the summary prices.
  {
    const c = cmdr({
      contracts: [job({ deadlineDay: 130 }), job({ destination: 11, deadlineDay: 104 })],
    });
    const orders = standingOrders(c, systems);
    check('the tightest deadline sorts first',
      orders[0].kind === 'contract' && orders[0].daysLeft === 4);
    check('...and it is the one the summary prices',
      ordersSummary(orders).includes('4 DAYS'));
  }

  // 6. the warning is carried, and it is not on the summary -----------------
  {
    const c = cmdr({ kills: 16 });
    c.equipment.laser = 'beam';
    stepMissionAtDock(c, systems, half);
    const orders = standingOrders(c, systems);
    check('the Navy order carries what her gun is worth',
      orders[0].kind === 'navy' && orders[0].warning.includes('MILITARY'));
    check('...and the summary carries the order rather than the warning',
      !ordersSummary(orders).includes('MILITARY'));
  }
}

// The screen is the other half of the rule. A reader that returns an order and
// a screen that does not draw it is the same failure with a longer path — which
// is the defect docs/TODO/140 M2 fixed for the chart's contract verdict.

console.log('\nthe MISSIONS screen draws every order the reader returns');
{
  const systems = generateGalaxy(1);
  const paint = (c: CommanderData): string =>
    captureById(() => { renderMissions(standingOrders(c, systems), systems); }).get('screen') ?? '';

  const c: CommanderData = {
    ...newCommander(),
    kills: 16, galaxy: 1, systemIndex: 7, day: 100,
    contracts: [{
      kind: 'cargo', destination: 11, commodity: 0, qty: 5,
      reward: 5000, deadlineDay: 106, progress: 0,
    }],
    mission: { stage: 0, targetIndex: null },
  };
  c.equipment.laser = 'beam';
  stepMissionAtDock(c, systems, () => 0.5);

  const html = paint(c);
  const orders = standingOrders(c, systems);
  check('every order the reader returns is on the screen',
    orders.every((o) => html.includes(o.line)));
  check('...each with the world it sends her to',
    orders.every((o) => html.includes(systems[o.destination].name)));
  check('...and the gun warning under the hunt it belongs to',
    html.includes('MILITARY LASER'));
  check('a Navy leg shows no deadline, because it has none',
    html.includes('&mdash;'));

  const idle = paint({ ...newCommander(), contracts: [], mission: { stage: 0, targetIndex: null } });
  check('a commander under no orders still gets a screen, and it says so',
    idle.includes('STANDING ORDERS') && idle.includes('no standing orders'));
}

// The last stretch is the wiring, and it is where docs/TODO/140 M2's defect
// lives: a correct function that nothing calls. So these drive a real Game.

console.log('\nthe station line and the briefing, through a real Game');
{
  const g = withoutSaving(() => {
    seedWorld(11);
    const game = new Game(() => headlessShell());
    dismissBriefing(game);
    return game;
  }).value;

  const c = g.state.commander;
  c.kills = 16;
  c.galaxy = 1;
  c.contracts = [
    { kind: 'courier', destination: 42, commodity: 0, qty: 1, reward: 5000, deadlineDay: c.day + 6, progress: 0 },
    { kind: 'courier', destination: 11, commodity: 0, qty: 1, reward: 5000, deadlineDay: c.day + 12, progress: 0 },
  ];
  c.equipment.laser = 'beam';

  const said = consoleWatcher(g);
  g.enterDocked();
  const lines = said(30);

  const briefing = lines.find((t) => t.startsWith('INCOMING NAVY TRANSMISSION'));
  check('the transmission still fires at the dock', briefing !== undefined);
  check('...and it now says where the rest of the briefing lives',
    briefing?.includes('MISSIONS') === true);
  check('...naming the key off the binding table rather than a letter in prose',
    briefing?.includes(keyPointer('docked', 'openMissions')) === true);

  // The gun warning EXPLAINS the transmission, so it queues behind it
  // (session.ts). Said in the same frame it took the console away, and a
  // commander with the wrong gun never saw that the Navy had called.
  const after = said(400);
  check('the gun warning arrives after the line it explains, not instead of it',
    after.some((t) => t.includes('MILITARY LASER')));

  // The MENU, painted by the Game itself. `missionText` is private, and the
  // question is not what it returns — it is whether the line a docked pilot
  // reads carries both kinds. A second dock re-paints it and advances nothing:
  // `stepMissionAtDock` has no branch for stage 1.
  const menu = captureById(() => { g.enterDocked('resumed'); }).get('screen') ?? '';
  const target = g.state.systems[c.mission.targetIndex as number].name.toUpperCase();
  eq('the machine briefed her, so there is a Navy order to hide', c.mission.stage, 1);
  check('the station menu names the Navy mission, with two contracts held',
    menu.includes(target));
  check('...and still names the work she signed for', menu.includes('SEALED DATA'));
  check('...and the count of the job it did not print', menu.includes('(+1 MORE)'));

}

// ⇧I reaches the screen from the station AND from the cockpit. The commander
// who met the Constrictor was in flight, and the bulletin board does not open
// there. A shift HELD is not something `Input` learns without a real keydown
// (see `Game.galacticJump`), so the binding is read off the table the way
// test/ui.test.ts reads ⇧H.

console.log('\n⇧I is bound in both modes, and it does not eat the plain key');
{
  eqc('⇧I at the station asks for the standing orders',
    cmds('docked', ['KeyI'], ['ShiftLeft']), ['openMissions']);
  eqc('...and in the cockpit, where the briefing was lost',
    cmds('flight', ['KeyI'], ['ShiftLeft']), ['openMissions']);
  eqc('plain I is still the commander status at the station',
    cmds('docked', ['KeyI'], []), ['openStatus']);
  eqc('...and in the cockpit', cmds('flight', ['KeyI'], []), ['openStatus']);
}
