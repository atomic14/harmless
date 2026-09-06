// The Navy's gun warning, and the thing breeding in your cabin.
//
// Two things that change between docks without the commander deciding
// anything. The first is what her gun is worth against the ship the Navy sent
// her after, which the briefing states in two numbers. The second is a
// stowaway that eats the hold. They were the back half of
// test/contracts.test.ts, which carried three subjects and crossed the size
// ceiling when passenger work landed (docs/TODO/109). The Navy's five-stage
// machine was the first subject here until docs/TODO/190 replaced it. Its
// tests are test/mission-machine.test.ts now.
//
// Both modules are pure (game/hunt-warning.ts, game/trumbles.ts), so these
// drive them directly rather than through a Game.

import { newCommander } from '../src/game/commander.ts';
import type { CommanderData } from '../src/game/commander.ts';
import { stepTrumbles, trumbleMessage } from '../src/game/trumbles.ts';
import { BREED_INTERVAL, MAX_TRUMBLES } from '../src/constants/trumbles.ts';
import { constrictorGunCheck, constrictorWarning } from '../src/game/hunt-warning.ts';
import { check, eq } from './harness.ts';

// --- the Navy's gun warning --------------------------------------------------

console.log('\nthe Navy gun warning');
{
  // --- what the job NEEDS, which is the other half of a briefing -------------
  //
  // TODO 29's ruling on the Constrictor: the source-exact halving stays, and
  // what was missing was the signposting. A commander must not fly forty light
  // years to discover that the upgrade she bought does nothing.
  {
    const withLaser = (laser: string) => {
      const c = newCommander();
      c.equipment.laser = laser as CommanderData['equipment']['laser'];
      return c;
    };
    const beam = constrictorGunCheck(withLaser('beam'));
    eq('a beam laser scores nothing at all against the Constrictor', beam.perHit, 0);
    eq('...and the military laser is what does', `${beam.best}/${beam.bestPerHit}`,
      'military/3');
    check('so the briefing says so, with both numbers in it',
      constrictorWarning(withLaser('beam')).includes('BEAM')
      && constrictorWarning(withLaser('beam')).includes('MILITARY'));
    eq('a commander already carrying the right gun is told nothing',
      constrictorWarning(withLaser('military')), '');
  }
}

// --- trumbles ---------------------------------------------------------------

console.log('\ntrumbles');
{
  const cmdr = (trumbles: number, cargo: number[] = new Array(17).fill(0)) =>
    ({ trumbles, cargo: [...cargo] }) as unknown as Parameters<typeof stepTrumbles>[0];
  const half = () => 0.5;

  {
    const c = cmdr(0);
    const r = stepTrumbles(c, 1, 0, 0, half);
    check('no trumbles, nothing happens', r.events.length === 0 && c.trumbles === 0);
  }
  {
    const c = cmdr(1);
    const r = stepTrumbles(c, 1, 0, 0, half);
    check('they breed', c.trumbles > 1 && r.timer === BREED_INTERVAL);
  }
  {
    // one dt per brood interval, so each call is one generation
    const c = cmdr(1);
    let timer = 0;
    for (let i = 0; i < 8; i++) timer = stepTrumbles(c, BREED_INTERVAL, 0, timer, half).timer;
    check(`...exponentially (1 -> ${c.trumbles} in 8 broods)`, c.trumbles > 20);
    check('...but not without bound', c.trumbles <= MAX_TRUMBLES);
  }
  {
    const cargo = new Array(17).fill(0); cargo[0] = 10;
    const c = cmdr(16, cargo);
    const r = stepTrumbles(c, 1, 0, 0, half);
    check('a big enough brood eats the hold',
      c.cargo[0] < 10 && r.events.some((e) => e.kind === 'ate'));
  }
  {
    const cargo = new Array(17).fill(0); cargo[0] = 10;
    const c = cmdr(4, cargo);
    stepTrumbles(c, 1, 0, 0, half);
    check('a small one is not hungry enough to bite', c.cargo[0] === 10);
  }
  {
    // the cure is a sun-skim — the same manoeuvre that refuels you
    const c = cmdr(50);
    const r = stepTrumbles(c, 1, 0.9, BREED_INTERVAL, half);
    check('cabin heat drives them out', c.trumbles < 50 && r.timer === 0);
    const c2 = cmdr(1);
    const r2 = stepTrumbles(c2, 1, 0.9, 0, half);
    check('...to the last one', c2.trumbles === 0 && r2.events[0]?.kind === 'purged');
  }
  check('every event has a line', ['purged', 'fleeing', 'ate', 'breeding'].every((k) =>
    trumbleMessage({ kind: k, left: 1, total: 1, commodity: 0, tonnes: 1 } as never).length > 0));
}
