// Arc five: THE COLONEL'S ORDERS, from a colonel of the state guard at Edle.
//
// Theme. The last patron of the tour trusts nobody, and says so. Carry a
// manifest he will not send by wire. Guard the transporter that carries
// what the manifest names. Then purge the Asp that reads the
// state's traffic. There is no next patron, and the log tells the end of
// the tour.
//
// The recovery leg is `wreck`. A transporter lost on the way costs the
// colonel's regard and the escort fee. Its cargo canister is adrift where
// it died. A commander who scoops it still goes on to the purge, because
// the Asp is the reason the transporter was lost.

import { ARC_LEG_DAYS, ARC_PAY, SIDE_JOB_RANGE } from '../../../constants/missions.ts';
import { SOURCE_DESIGN } from '../../../game/ship-specs.ts';
import { shipDesignIdOf } from '../../../game/ship-identity.ts';
import type { Skeleton } from '../../model.ts';

const AWAY = { kind: 'band', ...SIDE_JOB_RANGE } as const;

export const ARC_EDLE: Skeleton = {
  id: 'arc-edle',
  kind: 'arc',
  anchor: 'fixed',
  patron: { kind: 'world', seedSlot: 162 },
  hail: 'A COLONEL OF THE STATE GUARD AT EDLE HAS ORDERS FOR YOU',
  pitch: 'A MANIFEST TO CARRY, A TRANSPORTER TO GUARD, AND AN ASP TO PURGE. THE STATE PAYS.',
  offer: { done: ['arc-xeer'] },
  legs: [
    {
      id: 'manifest', verb: { kind: 'deliver' }, place: AWAY,
      line: 'COLONEL: TAKE THE MANIFEST TO {TARGET}', deadlineDays: ARC_LEG_DAYS,
      next: [
        { on: 'success', to: 'guard', settle: { pay: ARC_PAY.deliver, say: 'MANIFEST DELIVERED — {PAY}. THE TRANSPORTER LEAVES FOR {TARGET}.' } },
        { on: 'failed', to: 'fail' },
      ],
    },
    {
      id: 'guard', verb: { kind: 'escort', ship: shipDesignIdOf(SOURCE_DESIGN.transporter) }, place: AWAY,
      line: 'COLONEL: SEE THE TRANSPORTER INTO STATION RANGE AT {TARGET}', deadlineDays: ARC_LEG_DAYS,
      next: [
        { on: 'success', to: 'purge', settle: { pay: ARC_PAY.escort, say: 'TRANSPORTER SAFE — {PAY}. NOW THE ASP, NEAR {TARGET}.' } },
        { on: 'targetDestroyed', to: 'wreck', settle: { pay: 0, standing: -1, say: 'THE TRANSPORTER IS LOST. ITS CARGO IS ADRIFT AT {TARGET}. SCOOP IT.' } },
        { on: 'targetEscaped', to: 'purge', settle: { pay: 0, say: 'THE TRANSPORTER JUMPED WITHOUT YOU. THE ASP RUNS NEAR {TARGET}.' } },
        { on: 'failed', to: 'fail' },
      ],
    },
    {
      id: 'wreck', verb: { kind: 'recover', item: 'state-cargo' }, place: { kind: 'here' },
      line: 'COLONEL: SCOOP THE TRANSPORTER\'S CARGO ADRIFT AT {TARGET}', deadlineDays: ARC_LEG_DAYS,
      next: [
        { on: 'success', to: 'purge', settle: { pay: ARC_PAY.recover, say: 'CARGO RECOVERED — {PAY}. NOW THE ASP, NEAR {TARGET}.' } },
        { on: 'targetDestroyed', to: 'purge', settle: { pay: 0, say: 'THE CARGO IS GONE TOO. NOW THE ASP, NEAR {TARGET}.' } },
        { on: 'failed', to: 'fail' },
      ],
    },
    {
      id: 'purge', verb: { kind: 'hunt', ship: shipDesignIdOf(SOURCE_DESIGN.asp), canEscape: true }, place: AWAY,
      line: 'COLONEL: DESTROY THE ASP — LAST SEEN AT {TARGET}', deadlineDays: ARC_LEG_DAYS,
      next: [
        { on: 'targetDestroyed', to: 'complete', settle: { pay: ARC_PAY.hunt, say: 'ASP DESTROYED — {PAY} FROM EDLE. THE TOUR IS DONE.' } },
        { on: 'targetEscaped', to: 'complete', settle: { pay: 0, say: 'THE ASP GOT AWAY. THE COLONEL PAYS NOTHING, AND THE TOUR IS DONE.' } },
        { on: 'targetFled', to: 'complete', settle: { pay: 0, say: 'THE ASP FLED. THE COLONEL PAYS NOTHING, AND THE TOUR IS DONE.' } },
        { on: 'failed', to: 'fail' },
      ],
    },
  ],
  complete: { pay: 0, standing: 2 },
  fail: { pay: 0, standing: -1 },
};
