// The Dark Wheel's first trial: the mark (docs/TODO/219 M1).
//
// The whisper is the hail. Somebody watched the commander's last fight, and
// a note waits with no sender. The job is a pilot: a Fer-de-Lance that works
// the lanes with two Asps. The Wheel wants the pilot down, and the gang is
// what stands in the way. A leader that got away is a failed trial, and the
// Wheel gives one more chance (`cap`), then none.

import { ARC_LEG_DAYS, SIDE_JOB_RANGE, WHEEL_PAY, WHEEL_WHISPER_RUNG } from '../../../constants/missions.ts';
import { SOURCE_DESIGN } from '../../../game/ship-specs.ts';
import { shipDesignIdOf } from '../../../game/ship-identity.ts';
import type { Skeleton } from '../../model.ts';

const AWAY = { kind: 'band', ...SIDE_JOB_RANGE } as const;

export const WHEEL_MARK: Skeleton = {
  id: 'wheel-mark',
  kind: 'arc',
  anchor: 'local',
  patron: { kind: 'wheel' },
  hail: 'A NOTE WAITS FOR YOU. NO SENDER, NO NAME.',
  pitch: 'SOMEBODY WATCHED YOUR LAST FIGHT. A FER-DE-LANCE WORKS THE LANES WITH TWO ASPS. BRING ITS PILOT DOWN, AND WE WILL TALK AGAIN.',
  offer: { minRating: WHEEL_WHISPER_RUNG },
  cap: 2,
  legs: [
    {
      id: 'mark',
      verb: {
        kind: 'hunt', ship: shipDesignIdOf(SOURCE_DESIGN.ferDeLance), canEscape: true,
        gang: [shipDesignIdOf(SOURCE_DESIGN.asp), shipDesignIdOf(SOURCE_DESIGN.asp)],
      },
      place: AWAY,
      line: 'THE WHEEL: BRING DOWN THE FER-DE-LANCE AND ITS TWO ASPS NEAR {TARGET}',
      deadlineDays: ARC_LEG_DAYS,
      next: [
        { on: 'targetDestroyed', to: 'complete', settle: { pay: WHEEL_PAY.mark, setFlags: ['wheel.marked'], say: 'THE MARK IS DOWN. {PAY}, AND A WORD: WE WILL FIND YOU AGAIN.' } },
        { on: 'targetFled', to: 'fail', settle: { pay: 0, say: 'THE PILOT GOT AWAY. THE WHEEL WANTED THE PILOT, NOT THE GANG.' } },
        { on: 'targetEscaped', to: 'fail', settle: { pay: 0, say: 'THE PILOT JUMPED. THE WHEEL WANTED THE PILOT, NOT THE GANG.' } },
        { on: 'failed', to: 'fail' },
      ],
    },
  ],
  complete: { pay: 0, standing: 1 },
  fail: { pay: 0, standing: -1 },
};
