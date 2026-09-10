// Arc three: THE QUOTA RUN, from the planning director at Vetitice.
//
// Theme. The collective's quarter depends on one shipment, and pirates hold
// the lane it must cross. Fly the lane and dock to prove it open. Bring in
// the surveyor whose pod is adrift beyond it, because she holds the route.
// Then carry the shipment's manifest to the buyer near Xeer, where the next
// patron waits.
//
// The recovery leg is `route`. A pod shot before the scoop costs the
// director's good opinion and the rescue fee. The surveyor's route came
// across before she did (docs/TODO/190's scientist), and a commander who
// brings it back to Vetitice still carries the manifest afterwards.

import { ARC_HANDOVER_JUMPS, ARC_LEG_DAYS, ARC_PAY, SIDE_JOB_RANGE } from '../../../constants/missions.ts';
import type { Skeleton } from '../../model.ts';
import { LANE_PIRATES } from '../lane.ts';

export const ARC_VETITICE: Skeleton = {
  id: 'arc-vetitice',
  kind: 'arc',
  anchor: 'fixed',
  patron: { kind: 'world', seedSlot: 100 },
  hail: 'THE PLANNING DIRECTOR AT VETITICE HAS A QUOTA TO MEET',
  pitch: 'PIRATES HOLD THE LANE THE COLLECTIVE\'S SHIPMENT MUST CROSS. CLEAR IT, BRING IN THE SURVEYOR, AND CARRY THE MANIFEST.',
  offer: { done: ['arc-rabedira'] },
  legs: [
    {
      id: 'lane', verb: { kind: 'ambush' }, place: { kind: 'band', ...SIDE_JOB_RANGE }, spawn: [...LANE_PIRATES],
      line: 'DIRECTOR: FLY THE LANE TO {TARGET} THROUGH WHATEVER WAITS, AND DOCK', deadlineDays: ARC_LEG_DAYS,
      next: [
        { on: 'success', to: 'pod', settle: { pay: ARC_PAY.ambush, say: 'LANE OPEN — {PAY}. THE SURVEYOR\'S POD IS ADRIFT AT {TARGET}.' } },
        { on: 'failed', to: 'fail' },
      ],
    },
    {
      id: 'pod', verb: { kind: 'rescue' }, place: { kind: 'band', ...SIDE_JOB_RANGE },
      line: 'DIRECTOR: SCOOP THE SURVEYOR\'S POD AT {TARGET} AND DOCK', deadlineDays: ARC_LEG_DAYS,
      next: [
        { on: { survivor: 'landed' }, to: 'manifest', settle: { pay: ARC_PAY.rescue, say: 'SURVEYOR LANDED — {PAY}. THE MANIFEST GOES TO {TARGET}.' } },
        { on: { survivor: 'sold' }, to: 'fail', settle: { pay: 0, standing: -3 } },
        { on: 'targetDestroyed', to: 'route', settle: { pay: 0, standing: -1, say: 'THE POD IS LOST. HER ROUTE CAME ACROSS FIRST. BRING IT TO {TARGET}.' } },
        { on: 'failed', to: 'fail' },
      ],
    },
    {
      id: 'route', verb: { kind: 'deliver' }, place: { kind: 'origin' },
      line: 'DIRECTOR: BRING THE SURVEYOR\'S ROUTE BACK TO {TARGET}', deadlineDays: ARC_LEG_DAYS,
      next: [
        { on: 'success', to: 'manifest', settle: { pay: ARC_PAY.deliver, say: 'ROUTE DELIVERED — {PAY}. THE MANIFEST GOES TO {TARGET}.' } },
        { on: 'failed', to: 'fail' },
      ],
    },
    {
      id: 'manifest', verb: { kind: 'deliver' },
      place: { kind: 'handover', toward: 'arc-xeer', ...ARC_HANDOVER_JUMPS },
      line: 'DIRECTOR: DELIVER THE MANIFEST TO {TARGET}', deadlineDays: ARC_LEG_DAYS,
      next: [
        { on: 'success', to: 'complete', settle: { pay: ARC_PAY.deliver, say: 'MANIFEST DELIVERED — {PAY} FROM VETITICE' } },
        { on: 'failed', to: 'fail' },
      ],
    },
  ],
  complete: { pay: 0, standing: 2, lead: 'arc-xeer' },
  fail: { pay: 0, standing: -1, lead: 'arc-xeer' },
};
