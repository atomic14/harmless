// The Navy mission, as a skeleton: find the Constrictor, kill it, carry the
// plans home.
//
// This is the 1984 mission that `game/missions.ts` ran as five numbered
// stages, written as three legs (docs/TODO/190 M1). The numbers are the same
// constants. The hunt pays the bounty when the target dies. The courier leg
// pays the fee at the delivery world. Both final outcomes pay nothing, so the
// two payments land at the same two moments they always did.
//
// Two things the old machine implied are stated here. The Constrictor's own
// world flies set G, and the courier run raises the mis-jump chance and puts
// the Thargoids in force everywhere. Both were stage numbers in
// `missionBlueprintOverride` and `witchspaceChance`; now each is a fact on the
// leg it belongs to.
//
// The report leg has a standing order of its own. Stage 2 printed nothing,
// and a commander who took a job before she reported had no row to say so.
// Invariant 16 wants every order on a screen.

import {
  CONSTRICTOR_BOUNTY, COURIER_PAYMENT, MISSION_COURIER_RANGE, MISSION_HUNT_RANGE,
  MISSION_KILL_THRESHOLD,
} from '../../constants/missions.ts';
import { CONSTRICTOR_SPEC } from '../../game/ship-specs.ts';
import type { Skeleton } from '../model.ts';

export const CONSTRICTOR: Skeleton = {
  id: 'constrictor',
  kind: 'arc',
  anchor: 'relative',
  patron: { kind: 'navy' },
  hail: 'INCOMING NAVY TRANSMISSION',
  offer: { minKills: MISSION_KILL_THRESHOLD, galaxy: 1 },
  legs: [
    {
      id: 'hunt',
      verb: { kind: 'hunt', ship: CONSTRICTOR_SPEC.designId, canEscape: false },
      place: { kind: 'band', ...MISSION_HUNT_RANGE },
      override: { set: 'constrictor', where: 'target' },
      line: 'NAVY MISSION: DESTROY THE CONSTRICTOR — LAST SEEN AT {TARGET}',
      next: [
        {
          on: 'targetDestroyed', to: 'report',
          settle: { pay: CONSTRICTOR_BOUNTY, say: 'CONSTRICTOR DESTROYED — {PAY} NAVY BOUNTY' },
        },
        { on: 'failed', to: 'fail' },
      ],
    },
    {
      id: 'report',
      verb: { kind: 'deliver' },
      place: { kind: 'anywhere' },
      line: 'NAVY MISSION: REPORT TO ANY STATION FOR ORDERS',
      next: [
        {
          on: 'success', to: 'courier',
          settle: { pay: 0, say: 'NAVY: COURIER RUN — EXPECT THARGOID INTERFERENCE' },
        },
        { on: 'failed', to: 'fail' },
      ],
    },
    {
      id: 'courier',
      verb: { kind: 'deliver' },
      place: { kind: 'band', ...MISSION_COURIER_RANGE },
      override: { set: 'thargoid', where: 'everywhere' },
      carryingPlans: true,
      line: 'NAVY MISSION: DELIVER THE PLANS TO {TARGET}',
      next: [
        {
          on: 'success', to: 'complete',
          settle: { pay: COURIER_PAYMENT, say: 'PLANS DELIVERED — {PAY}, RIGHT ON COMMANDER' },
        },
        { on: 'failed', to: 'fail' },
      ],
    },
  ],
  complete: { pay: 0 },
  fail: { pay: 0 },
};
