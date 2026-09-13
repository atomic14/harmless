// The Dark Wheel's door (docs/TODO/219 M4).
//
// The last trial, at Competent. The Wheel names the place: witchspace, one
// more time. A Thargoid mothership waits there, tagged for the leg, with
// the trap's own around it. Clear it, and the door opens. The settlement
// grants the cloaking device, which no shop sells. It marks the commander
// as one of the Wheel. The words speak of Raxxla, and say no more.
//
// The mothership cannot escape, and the leg has no other way out but the
// deadline: one more chance after that, as every trial gives.

import { ARC_LEG_DAYS, WHEEL_DOOR_RUNG } from '../../../constants/missions.ts';
import { SOURCE_DESIGN } from '../../../game/ship-specs.ts';
import { shipDesignIdOf } from '../../../game/ship-identity.ts';
import type { Skeleton } from '../../model.ts';

export const WHEEL_DOOR: Skeleton = {
  id: 'wheel-door',
  kind: 'arc',
  anchor: 'local',
  patron: { kind: 'wheel' },
  hail: 'THE LAST NOTE. IT NAMES A DOOR.',
  pitch: 'YOU HAVE DONE ENOUGH TO BE ASKED. THERE IS A DOOR WHERE NO CHART REACHES, AND SOMETHING GUARDS IT. ARM THE MIS-JUMP. CLEAR THE GUARD. SOME CALL WHAT IS BEHIND IT RAXXLA.',
  offer: { minRating: WHEEL_DOOR_RUNG, flags: ['wheel.proven'] },
  cap: 2,
  legs: [
    {
      id: 'door',
      verb: { kind: 'hunt', ship: shipDesignIdOf(SOURCE_DESIGN.thargoid), canEscape: false, job: 'thargoid' },
      place: { kind: 'witchspace' },
      line: 'THE WHEEL: CLEAR THE GUARD AT THE DOOR, IN {TARGET}',
      deadlineDays: ARC_LEG_DAYS,
      next: [
        { on: 'targetDestroyed', to: 'complete', settle: { pay: 0, setFlags: ['wheel.member'], grant: 'cloak', say: 'THE DOOR IS OPEN. WHAT FITS YOUR HULL NOW, NO SHOP SELLS. RAXXLA IS NOT A PLACE. IT IS THIS.' } },
        { on: 'failed', to: 'fail' },
      ],
    },
  ],
  complete: { pay: 0, standing: 1 },
  fail: { pay: 0, standing: -1 },
};
