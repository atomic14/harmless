// The two released blueprint overrides, and the caller — docs/TODO/138 M4.
//
// `test/blueprint-set.test.ts` pins the chooser, which TAKES an override and
// never works one out. This is the other end: who names one, and when.
//
//   - THE CALLER IS THE ONLY PLACE THAT KNOWS. Three facts raise an override and
//     they sit in three files — the hunting leg and the courier run in
//     `missions.ts`, the limbo flag in `game.ts`. None of them is the chooser's.
//   - THE ASSERTIONS ARE SHARP BECAUSE THE SYSTEMS WERE PICKED TO MAKE THEM SO.
//     Both test systems fly a set that is never C, D or G at any of the four bit
//     values, so an override that failed to fire cannot land on the right letter
//     by luck. `ORDINARY` below is that claim, and it is asserted rather than
//     assumed.
//   - LIMBO OUTRANKS THE HUNT. A mis-jump on the hunting leg is still limbo, and
//     the Constrictor waits in a system rather than between two.
//   - THE AMBUSH DID NOT MOVE. An override answers on its own, so the number is
//     not consulted and no dice are drawn to fill it. The pinned positions are
//     what says that: a draw made behind an override would shift every one of
//     them, because the ambush rolls off the same stream two lines later.

import { check, dismissBriefing, eq } from './harness.ts';
import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { withoutSaving } from '../src/game/storage.ts';
import { seedWorld } from '../src/game/rng.ts';
import { newCommander, type CommanderData } from '../src/game/commander.ts';
import { missionBlueprintOverride } from '../src/game/missions.ts';
import { blueprintSetFor } from '../src/game/blueprint-set.ts';
import { emptyBandsForSet, specsForSet } from '../src/game/set-roster.ts';
import {
  CONSTRICTOR_BLUEPRINT_SET, THARGOID_BLUEPRINT_SET_HIGH_TECH,
  THARGOID_BLUEPRINT_SET_LOW_TECH,
} from '../src/constants/blueprint-set.ts';
import { generateGalaxy } from '../src/galaxy/galaxy.ts';
import { isHighTechSystem } from '../src/galaxy/tech.ts';

console.log('\nwho names a blueprint override (docs/TODO/138 M4)');

// --- the mission's two, driven directly ---------------------------------------

{
  const cmdr = (stage: number, target: number | null): CommanderData => ({
    ...newCommander(), systemIndex: 7, mission: { stage, targetIndex: target },
  }) as unknown as CommanderData;

  eq('an idle commander raises no override', missionBlueprintOverride(cmdr(0, null)), null);
  eq('the hunt raises the Constrictor\'s, at the system she was sent to',
    missionBlueprintOverride(cmdr(1, 7)), 'constrictor');
  eq('...and raises nothing at any other system',
    missionBlueprintOverride(cmdr(1, 8)), null);
  eq('reporting the kill raises nothing', missionBlueprintOverride(cmdr(2, null)), null);
  eq('carrying the plans raises the Thargoid one',
    missionBlueprintOverride(cmdr(3, 12)), 'thargoid');
  eq('...and delivering them puts it down again',
    missionBlueprintOverride(cmdr(4, null)), null);
}

// --- the wiring, through a real arrival ----------------------------------------

{
  // Galaxy 1, and two systems chosen for what they are NOT: neither flies C, D
  // or G at any of the four bit values, so every assertion below fails if the
  // override does not fire.
  const GALAXY_1 = generateGalaxy(1);
  const LOW = 0; // Tibedied, shown tech 9
  const HIGH = 3; // Biarge, shown tech 12
  const ordinary = (index: number): string[] =>
    [0, 1, 2, 3].map((bits) => blueprintSetFor(GALAXY_1[index], 1, bits));

  check('the two test systems are the two tech branches',
    !isHighTechSystem(GALAXY_1[LOW].techLevel) && isHighTechSystem(GALAXY_1[HIGH].techLevel));
  check('...and neither can reach an override\'s set on its own number',
    [LOW, HIGH].every((index) => ordinary(index).every(
      (set) => set !== CONSTRICTOR_BLUEPRINT_SET
        && set !== THARGOID_BLUEPRINT_SET_LOW_TECH
        && set !== THARGOID_BLUEPRINT_SET_HIGH_TECH)));

  const g = withoutSaving(() => new Game(() => headlessShell())).value;
  dismissBriefing(g);
  // Launched, and it is load-bearing for the reload below: a save says what it
  // IS, and docking is what clears the limbo flag (`station.ts`). A snapshot
  // captured from the station would restore a docked commander however the
  // session read when it was written.
  withoutSaving(() => g.launch());
  const s = g.state;

  /** Fly her there and let the arrival choose, as a jump does. */
  const arriveAt = (index: number, stage: number, target: number | null): string => {
    s.commander.mission = { stage, targetIndex: target };
    s.commander.systemIndex = index;
    withoutSaving(() => g.arriveInSystem());
    return s.session.blueprintSet;
  };

  check('an ordinary arrival flies the set its own number picked',
    ordinary(LOW).includes(arriveAt(LOW, 0, null))
    && s.world.roster === specsForSet(s.session.blueprintSet));

  eq('the Constrictor\'s system flies its own set',
    arriveAt(LOW, 1, LOW), CONSTRICTOR_BLUEPRINT_SET);
  check('...and the world is built with it',
    s.world.roster === specsForSet(CONSTRICTOR_BLUEPRINT_SET));
  check('...but only at the system she was sent to',
    ordinary(LOW).includes(arriveAt(LOW, 1, HIGH)));

  eq('the plans pick the low-tech Thargoid set at a low-tech system',
    arriveAt(LOW, 3, null), THARGOID_BLUEPRINT_SET_LOW_TECH);
  eq('...and the high-tech one at a high-tech system',
    arriveAt(HIGH, 3, null), THARGOID_BLUEPRINT_SET_HIGH_TECH);

  // --- witch-space --------------------------------------------------------

  /** Mis-jump out of `index`, which is where a mis-jump leaves you. */
  const misjumpFrom = (index: number, stage: number, target: number | null): string => {
    arriveAt(index, stage, target);
    withoutSaving(() => g.enterWitchspace());
    return s.session.blueprintSet;
  };

  eq('limbo out of a low-tech system flies the low-tech Thargoid set',
    misjumpFrom(LOW, 0, null), THARGOID_BLUEPRINT_SET_LOW_TECH);
  eq('...and out of a high-tech one the other',
    misjumpFrom(HIGH, 0, null), THARGOID_BLUEPRINT_SET_HIGH_TECH);
  check('...and the sky in limbo is built with it',
    s.world.roster === specsForSet(THARGOID_BLUEPRINT_SET_HIGH_TECH));

  // The whole point of the override, and the one claim that is about the
  // reception rather than the letter: 21 of the 23 sets file no Thargoid at all,
  // so before this the ambush was flying the full roster as a fallback.
  check('the set limbo flies is one that actually files a Thargoid',
    !emptyBandsForSet(s.session.blueprintSet).includes('thargoid'));

  eq('limbo outranks the hunt — the Constrictor waits in a system, not between two',
    misjumpFrom(LOW, 1, LOW), THARGOID_BLUEPRINT_SET_LOW_TECH);

  // --- the ambush did not move ---------------------------------------------
  //
  // Measured on 2026-08-13 with the set held at C and again at D, before M4 and
  // after it: three Thargoids at the same three places. `blueprintSetFor` never
  // reads the number behind an override, so `chooseBlueprintSet` draws nothing
  // to fill it — and a draw that crept in would move all nine figures, because
  // the ambush count and every bearing come off the next values of this stream.
  {
    arriveAt(LOW, 0, null);
    seedWorld(1234);
    withoutSaving(() => g.enterWitchspace());
    const at = s.world.npcs.filter((n) => n.role === 'thargoid').map((n) => {
      const p = n.object.position;
      return `${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}`;
    }).join(' | ');
    eq('the Thargoid ambush is where it was before the override existed', at,
      '4436.236,-3103.037,2410.991 | -3674.563,82.134,-631.382'
      + ' | -507.527,1007.387,3776.152');
  }

  // --- and it survives a reload (invariants 3 and 12) -----------------------
  {
    const inLimbo = s.session.blueprintSet;
    const snap = withoutSaving(() => g.captureSnapshot()).value;
    arriveAt(HIGH, 0, null); // somewhere else entirely, out of limbo
    withoutSaving(() => g.restoreSnapshot(snap));
    check('a save taken in limbo comes back to limbo\'s own set',
      s.session.witchspace && s.session.blueprintSet === inLimbo
      && s.world.roster === specsForSet(inLimbo));
  }
}
