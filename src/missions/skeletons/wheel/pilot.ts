// The Dark Wheel's third trial: the pilot (docs/TODO/219 M3).
//
// One of theirs is adrift in a pod in witchspace, where the Thargoids wait.
// The way there is an armed mis-jump. Scoop the pod among them, jump out,
// and land the pilot alive at any station. A pod shot, or a pilot sold, is a
// failed trial, and the Wheel does not sell its own.

import { ARC_LEG_DAYS, WHEEL_PAY, WHEEL_WHISPER_RUNG } from '../../../constants/missions.ts';
import type { Skeleton } from '../../model.ts';

export const WHEEL_PILOT: Skeleton = {
  id: 'wheel-pilot',
  kind: 'arc',
  anchor: 'local',
  patron: { kind: 'wheel' },
  hail: 'THE NOTE, A THIRD TIME. IT ASKS FOR ONE OF ITS OWN.',
  pitch: 'ONE OF OURS IS ADRIFT IN A POD WHERE NO CHART REACHES. ARM THE MIS-JUMP, FIND THE POD AMONG THE THARGOIDS, AND BRING THE PILOT HOME ALIVE.',
  offer: { minRating: WHEEL_WHISPER_RUNG, flags: ['wheel.trusted'] },
  cap: 2,
  legs: [
    {
      id: 'pod',
      verb: { kind: 'rescue' },
      place: { kind: 'witchspace' },
      line: 'THE WHEEL: SCOOP THE POD ADRIFT IN {TARGET}, AND LAND THE PILOT ALIVE',
      deadlineDays: ARC_LEG_DAYS,
      next: [
        { on: { survivor: 'landed' }, to: 'complete', settle: { pay: WHEEL_PAY.pilot, setFlags: ['wheel.proven'], say: 'THE PILOT WALKS. {PAY}, AND THE WHEEL REMEMBERS.' } },
        { on: { survivor: 'sold' }, to: 'fail', settle: { pay: 0, say: 'YOU SOLD ONE OF OURS. THE WHEEL DOES NOT SELL ITS OWN.' } },
        { on: 'targetDestroyed', to: 'fail', settle: { pay: 0, say: 'THE POD IS GONE. THE WHEEL WANTED THE PILOT ALIVE.' } },
        { on: 'failed', to: 'fail' },
      ],
    },
  ],
  complete: { pay: 0, standing: 1 },
  fail: { pay: 0, standing: -1 },
};
