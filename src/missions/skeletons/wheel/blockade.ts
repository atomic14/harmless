// The Dark Wheel's second trial: the blockade (docs/TODO/219 M2).
//
// The Wheel asks for a clean record, and then it asks the commander to keep
// it. The job is a parcel of narcotics to a world one jump out. Three
// Vipers wait at the far end. A scan on the way reads the hold and fails
// the trial. The Wheel does not use a pilot the police know. One more chance,
// as the mark gives, and then none.

import { NARCOTICS } from '../../../constants/commodities.ts';
import { ARC_LEG_DAYS, SIDE_JOB_RANGE, SMUGGLE_TONNES, WHEEL_PAY, WHEEL_WHISPER_RUNG } from '../../../constants/missions.ts';
import { SOURCE_DESIGN } from '../../../game/ship-specs.ts';
import { shipDesignIdOf } from '../../../game/ship-identity.ts';
import type { Skeleton, TaggedShip } from '../../model.ts';

const AWAY = { kind: 'band', ...SIDE_JOB_RANGE } as const;

/** Three Vipers at the far end. They are the law, and they read holds. */
const viper = shipDesignIdOf(SOURCE_DESIGN.viper);
const BLOCKADE: readonly TaggedShip[] = [
  { ship: viper, tag: 'blockade#viper-1', job: 'police' },
  { ship: viper, tag: 'blockade#viper-2', job: 'police' },
  { ship: viper, tag: 'blockade#viper-3', job: 'police' },
];

export const WHEEL_BLOCKADE: Skeleton = {
  id: 'wheel-blockade',
  kind: 'arc',
  anchor: 'local',
  patron: { kind: 'wheel' },
  hail: 'THE NOTE AGAIN. IT KNOWS WHO YOU ARE NOW.',
  pitch: 'A PARCEL, ONE JUMP OUT, PAST A PATROL THAT READS HOLDS. KEEP YOUR RECORD CLEAN AND THE PARCEL ABOARD, AND YOU ARE ONE OF US.',
  offer: { minRating: WHEEL_WHISPER_RUNG, flags: ['wheel.marked'], legalStatus: 'clean' },
  cap: 2,
  legs: [
    {
      id: 'run',
      verb: { kind: 'smuggle', commodity: NARCOTICS, tonnes: SMUGGLE_TONNES },
      place: AWAY,
      spawn: [...BLOCKADE],
      line: 'THE WHEEL: LAND THE PARCEL AT {TARGET} WITHOUT A SCAN',
      deadlineDays: ARC_LEG_DAYS,
      next: [
        { on: 'success', to: 'complete', settle: { pay: WHEEL_PAY.blockade, setFlags: ['wheel.trusted'], say: 'THE PARCEL IS DOWN AND NOBODY READ YOUR HOLD. {PAY}. YOU ARE TRUSTED.' } },
        { on: 'failed', to: 'fail', settle: { pay: 0, say: 'THE HOLD WAS READ, OR THE PARCEL WAS NOT ABOARD. THE WHEEL DOES NOT USE A PILOT THE POLICE KNOW.' } },
      ],
    },
  ],
  complete: { pay: 0, standing: 1 },
  fail: { pay: 0, standing: -1 },
};
