// Arc two: THE ENVOY'S CONVOY, from a faction's envoy at Rabedira.
//
// Theme. Rabedira's factions are at each other's throats, and one envoy
// has a truce paper that the others would rather see lost. Carry the paper
// to the neighbour who brokers it. Then ride beside the envoy's Boa as it
// leaves for the meeting near Vetitice, where the next patron waits.
//
// The recovery leg is `salvage`. A Boa lost on the way leaves the truce
// strongbox adrift in the same region. A commander who scoops it still
// delivers the paper, at the recovery fee rather than the escort's.

import { ARC_HANDOVER_JUMPS, ARC_LEG_DAYS, ARC_PAY, SIDE_JOB_RANGE } from '../../../constants/missions.ts';
import { SOURCE_DESIGN } from '../../../game/ship-specs.ts';
import { shipDesignIdOf } from '../../../game/ship-identity.ts';
import type { Skeleton } from '../../model.ts';

const TOWARD = { kind: 'handover', toward: 'arc-vetitice', ...ARC_HANDOVER_JUMPS } as const;

export const ARC_RABEDIRA: Skeleton = {
  id: 'arc-rabedira',
  kind: 'arc',
  anchor: 'fixed',
  patron: { kind: 'world', seedSlot: 6 },
  hail: 'AN ENVOY AT RABEDIRA ASKS FOR YOU',
  pitch: 'A TRUCE PAPER MUST REACH A NEIGHBOUR, AND THEN THE ENVOY MUST REACH THE MEETING ALIVE.',
  offer: { done: ['arc-lave'] },
  legs: [
    {
      id: 'paper', verb: { kind: 'deliver' }, place: { kind: 'band', ...SIDE_JOB_RANGE },
      line: 'ENVOY: TAKE THE TRUCE PAPER TO {TARGET}', deadlineDays: ARC_LEG_DAYS,
      next: [
        { on: 'success', to: 'convoy', settle: { pay: ARC_PAY.deliver, say: 'PAPER DELIVERED — {PAY}. NOW THE ENVOY\'S BOA LEAVES FOR {TARGET}.' } },
        { on: 'failed', to: 'fail' },
      ],
    },
    {
      id: 'convoy', verb: { kind: 'escort', ship: shipDesignIdOf(SOURCE_DESIGN.boa) }, place: TOWARD,
      line: 'ENVOY: SEE THE BOA INTO STATION RANGE AT {TARGET}', deadlineDays: ARC_LEG_DAYS,
      next: [
        { on: 'success', to: 'complete', settle: { pay: ARC_PAY.escort, say: 'THE ENVOY IS SAFE — {PAY} FROM RABEDIRA' } },
        { on: 'targetDestroyed', to: 'salvage', settle: { pay: 0, say: 'THE BOA IS LOST. THE STRONGBOX IS ADRIFT NEAR {TARGET}.' } },
        { on: 'targetEscaped', to: 'complete', settle: { pay: 0, say: 'THE BOA JUMPED WITHOUT YOU. THE ENVOY PAYS NOTHING.' } },
        { on: 'failed', to: 'fail' },
      ],
    },
    {
      id: 'salvage', verb: { kind: 'recover', item: 'truce-strongbox' }, place: TOWARD,
      line: 'ENVOY: SCOOP THE STRONGBOX ADRIFT AT {TARGET}', deadlineDays: ARC_LEG_DAYS,
      next: [
        { on: 'success', to: 'complete', settle: { pay: ARC_PAY.recover, say: 'STRONGBOX RECOVERED — {PAY}. THE TRUCE HOLDS.' } },
        { on: 'targetDestroyed', to: 'fail' },
        { on: 'failed', to: 'fail' },
      ],
    },
  ],
  complete: { pay: 0, standing: 2, lead: 'arc-vetitice' },
  fail: { pay: 0, standing: -1, lead: 'arc-vetitice' },
};
