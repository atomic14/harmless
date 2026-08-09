// The Navy's mission, and the thing breeding in your cabin.
//
// The two things that change a commander between docks without her deciding
// anything: a five-stage state machine the Navy walks her through, and a
// stowaway that eats the hold. They were the back half of
// test/contracts.test.ts, which carried three subjects and crossed the size
// ceiling when passenger work landed (docs/TODO/109) — the contract rules keep
// that file; these two share a file because neither is big enough for its own
// and both answer "what happened while I was flying?".
//
// Both modules are pure (game/missions.ts, game/trumbles.ts), so these drive
// them directly rather than through a Game.

import { newCommander } from '../src/game/commander.ts';
import type { CommanderData } from '../src/game/commander.ts';
import { stepTrumbles, trumbleMessage } from '../src/game/trumbles.ts';
import { BREED_INTERVAL, MAX_TRUMBLES } from '../src/constants/trumbles.ts';
import {
  stepMissionAtDock,
  constrictorDestroyed,
  constrictorLurksHere,
  missionHeadline, constrictorGunCheck, constrictorWarning,
} from '../src/game/missions.ts';
import { generateGalaxy } from '../src/galaxy/galaxy.ts';
import { check, eq } from './harness.ts';

// --- the Navy mission -------------------------------------------------------

// A five-stage state machine that lived in three private methods of game.ts
// and one branch of destroyNpc, so nothing could advance a commander through
// it. game/missions.ts is pure, so these are its first tests.

console.log('\nNavy mission');
{
  const systems = generateGalaxy(1);
  // A real commander underneath, because the headline now derives the Navy's
  // weapon warning from the hull and the fitted gun (missions.ts
  // `constrictorGunCheck`) — a stub with no `shipId` is not a ship.
  const cmdr = (over: Record<string, unknown> = {}) => ({
    ...newCommander(),
    kills: 0, galaxy: 1, systemIndex: 7, credits: 1000,
    mission: { stage: 0, targetIndex: null }, ...over,
  }) as unknown as Parameters<typeof stepMissionAtDock>[0];
  const half = () => 0.5;

  {
    const c = cmdr({ kills: 15 });
    check('the Navy ignores you below the kill threshold',
      stepMissionAtDock(c, systems, half).length === 0 && c.mission.stage === 0);
  }
  {
    const c = cmdr({ kills: 16 });
    const ev = stepMissionAtDock(c, systems, half);
    check('...and briefs you at it', ev[0]?.kind === 'briefed' && c.mission.stage === 1);
    check('...with a target that is somewhere else', c.mission.targetIndex !== 7);
  }
  {
    const c = cmdr({ kills: 16, galaxy: 2 });
    check('the mission is galaxy 1 only',
      stepMissionAtDock(c, systems, half).length === 0);
  }
  {
    const c = cmdr({ mission: { stage: 1, targetIndex: 7 } });
    check('the Constrictor lurks where you were told', constrictorLurksHere(c));
    const before = c.credits;
    const e = constrictorDestroyed(c);
    check('killing it pays the Navy bounty and moves you to stage 2',
      e?.bounty === 25_000 && c.credits === before + 25_000 && c.mission.stage === 2);
    check('...and it cannot be claimed twice', constrictorDestroyed(c) === null);
  }
  {
    const c = cmdr({ mission: { stage: 2, targetIndex: null } });
    const ev = stepMissionAtDock(c, systems, half);
    check('reporting back gets the courier orders',
      ev[0]?.kind === 'courierOrders' && c.mission.stage === 3);
    // fly there and dock
    c.systemIndex = c.mission.targetIndex as number;
    const before = c.credits;
    const done = stepMissionAtDock(c, systems, half);
    check('delivering the plans pays and completes it',
      done[0]?.kind === 'delivered' && c.credits === before + 15_000 && c.mission.stage === 4);
  }
  {
    check('an idle commander has no mission line',
      missionHeadline(cmdr(), systems) === '');
    check('a briefed one names the system',
      missionHeadline(cmdr({ mission: { stage: 1, targetIndex: 7 } }), systems).includes('LAVE'));
  }

  // --- what the job NEEDS, which is the other half of a briefing -------------
  //
  // TODO 29's ruling on the Constrictor: the source-exact halving stays, and
  // what was missing was the signposting. A commander must not fly forty light
  // years to discover that the upgrade she bought does nothing.
  {
    const withLaser = (laser: string) => {
      const c = cmdr({ mission: { stage: 1, targetIndex: 7 } }) as unknown as CommanderData;
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
    check('and the mission headline carries the warning while the hunt is on',
      missionHeadline(withLaser('beam'), systems).includes('MILITARY'));
    check('...but not once she has the gun',
      !missionHeadline(withLaser('military'), systems).includes('MILITARY LASER'));
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
