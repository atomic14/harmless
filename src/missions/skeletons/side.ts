// The eight side jobs, one per verb, so every verb the machine knows is a
// job a player can take (docs/TODO/190 M4).
//
// Each is a LOCAL job. The patron is whoever runs the station she stands at.
// About a third of the jobs are on any one world's board (offers.ts). Each
// has a `failed` branch, a deadline, and a fee from `SIDE_JOB_PAY`. The
// rescue is the scientist of docs/TODO/190: a pod shot before the scoop
// turns the leg into a delivery at a lower fee. The words are plain, and a
// dossier (item 191) replaces them on screen when one exists.

import { NARCOTICS } from '../../constants/commodities.ts';
import {
  RESCUE_SALVAGE_PAY, SCAN_SECONDS, SIDE_JOB_DAYS, SIDE_JOB_PAY, SIDE_JOB_RANGE,
  SMUGGLE_TONNES,
} from '../../constants/missions.ts';
import { SOURCE_DESIGN } from '../../game/ship-specs.ts';
import { shipDesignIdOf } from '../../game/ship-identity.ts';
import type { Branch, Skeleton } from '../model.ts';

const FAIL: Branch = { on: 'failed', to: 'fail' };
const LOCAL = { kind: 'side', anchor: 'local', patron: { kind: 'local' } } as const;
const AWAY = { kind: 'band', ...SIDE_JOB_RANGE } as const;

export const SIDE_HUNT: Skeleton = {
  ...LOCAL, id: 'side-hunt', hail: 'THE STATION HAS A BOUNTY POSTED',
  pitch: 'A KRAIT HAS BEEN TAKING SHIPS ON THE LANE. THE STATION WANTS IT GONE.',
  offer: {},
  legs: [{
    id: 'hunt', verb: { kind: 'hunt', ship: shipDesignIdOf(SOURCE_DESIGN.krait), canEscape: true },
    place: AWAY, line: 'BOUNTY: DESTROY THE KRAIT — LAST SEEN AT {TARGET}', deadlineDays: SIDE_JOB_DAYS,
    next: [
      { on: 'targetDestroyed', to: 'complete', settle: { pay: SIDE_JOB_PAY.hunt, say: 'KRAIT DESTROYED — {PAY} FROM THE STATION' } },
      { on: 'targetEscaped', to: 'fail' },
      FAIL,
    ],
  }],
  complete: { pay: 0, standing: 1 },
  fail: { pay: 0, standing: -1 },
};

export const SIDE_DELIVER: Skeleton = {
  ...LOCAL, id: 'side-deliver', hail: 'THE STATION HAS A PACKET FOR A NEIGHBOUR',
  pitch: 'A SEALED PACKET FOR A STATION ONE JUMP OUT. NO QUESTIONS, NO HOLD SPACE.',
  offer: {},
  legs: [{
    id: 'run', verb: { kind: 'deliver' }, place: AWAY,
    line: 'DELIVERY: TAKE THE PACKET TO {TARGET}', deadlineDays: SIDE_JOB_DAYS,
    next: [
      { on: 'success', to: 'complete', settle: { pay: SIDE_JOB_PAY.deliver, say: 'PACKET DELIVERED — {PAY}' } },
      FAIL,
    ],
  }],
  complete: { pay: 0, standing: 1 },
  fail: { pay: 0, standing: -1 },
};

export const SIDE_RECOVER: Skeleton = {
  ...LOCAL, id: 'side-recover', hail: 'THE STATION LOST SOMETHING',
  pitch: 'A CANISTER WENT ADRIFT ONE JUMP OUT. SCOOP IT AND BRING IT BACK.',
  offer: {},
  legs: [
    {
      id: 'find', verb: { kind: 'recover', item: 'station-canister' }, place: AWAY,
      line: 'RECOVERY: SCOOP THE CANISTER ADRIFT AT {TARGET}', deadlineDays: SIDE_JOB_DAYS,
      next: [
        { on: 'success', to: 'home', settle: { pay: 0, say: 'CANISTER ABOARD — BRING IT HOME' } },
        { on: 'targetDestroyed', to: 'fail' },
        FAIL,
      ],
    },
    {
      id: 'home', verb: { kind: 'deliver' }, place: { kind: 'origin' },
      line: 'RECOVERY: BRING THE CANISTER BACK TO {TARGET}', deadlineDays: SIDE_JOB_DAYS,
      next: [
        { on: 'success', to: 'complete', settle: { pay: SIDE_JOB_PAY.recover, say: 'CANISTER RETURNED — {PAY}' } },
        FAIL,
      ],
    },
  ],
  complete: { pay: 0, standing: 1 },
  fail: { pay: 0, standing: -1 },
};

export const SIDE_RESCUE: Skeleton = {
  ...LOCAL, id: 'side-rescue', hail: 'THE STATION HAS A PILOT ADRIFT',
  pitch: 'A SURVEY PILOT IS IN A POD ONE JUMP OUT. BRING HER IN ALIVE.',
  offer: {},
  legs: [
    {
      id: 'pod', verb: { kind: 'rescue' }, place: AWAY,
      line: 'RESCUE: SCOOP THE POD ADRIFT AT {TARGET} AND DOCK', deadlineDays: SIDE_JOB_DAYS,
      next: [
        { on: { survivor: 'landed' }, to: 'complete', settle: { pay: SIDE_JOB_PAY.rescue, say: 'PILOT LANDED — {PAY}' } },
        { on: { survivor: 'sold' }, to: 'fail', settle: { pay: 0, standing: -2 } },
        // The pod is lost, and the survey data reached the ship before it
        // was. The job goes on as a delivery, at a lower fee.
        { on: 'targetDestroyed', to: 'data', settle: { pay: 0, say: 'POD LOST — THE SURVEY DATA CAME ACROSS FIRST' } },
        FAIL,
      ],
    },
    {
      id: 'data', verb: { kind: 'deliver' }, place: { kind: 'origin' },
      line: 'RESCUE: TAKE THE SURVEY DATA BACK TO {TARGET}', deadlineDays: SIDE_JOB_DAYS,
      next: [
        { on: 'success', to: 'complete', settle: { pay: RESCUE_SALVAGE_PAY, say: 'SURVEY DATA DELIVERED — {PAY}' } },
        FAIL,
      ],
    },
  ],
  complete: { pay: 0, standing: 1 },
  fail: { pay: 0, standing: -1 },
};

export const SIDE_AMBUSH: Skeleton = {
  ...LOCAL, id: 'side-ambush', hail: 'THE STATION NEEDS A LANE CLEARED',
  pitch: 'PIRATES HOLD THE LANE TO A NEIGHBOUR. FLY IT, FIGHT THROUGH, AND DOCK THERE.',
  offer: {},
  legs: [{
    id: 'lane', verb: { kind: 'ambush' }, place: AWAY,
    line: 'LANE: FLY TO {TARGET} THROUGH WHATEVER WAITS, AND DOCK', deadlineDays: SIDE_JOB_DAYS,
    next: [
      { on: 'success', to: 'complete', settle: { pay: SIDE_JOB_PAY.ambush, say: 'LANE CLEARED — {PAY}' } },
      FAIL,
    ],
  }],
  complete: { pay: 0, standing: 1 },
  fail: { pay: 0, standing: -1 },
};

export const SIDE_SMUGGLE: Skeleton = {
  ...LOCAL, id: 'side-smuggle', hail: 'SOMEBODY AT THE STATION HAS A QUIET JOB',
  pitch: 'THREE TONNES OF NARCOTICS TO A NEIGHBOUR, PAST THE PATROLS. YOU ARE PAID AT THE FAR END.',
  offer: {},
  legs: [{
    id: 'run', verb: { kind: 'smuggle', commodity: NARCOTICS, tonnes: SMUGGLE_TONNES }, place: AWAY,
    line: 'SMUGGLE: LAND THE NARCOTICS AT {TARGET} UNSCANNED', deadlineDays: SIDE_JOB_DAYS,
    next: [
      { on: 'success', to: 'complete', settle: { pay: SIDE_JOB_PAY.smuggle, say: 'GOODS LANDED — {PAY}' } },
      FAIL,
    ],
  }],
  complete: { pay: 0, standing: 1, deed: { disrepute: 10 } },
  fail: { pay: 0, standing: -1 },
};

export const SIDE_ESCORT: Skeleton = {
  ...LOCAL, id: 'side-escort', hail: 'A TRADER AT THE STATION WANTS COVER',
  pitch: 'A PYTHON IS LEAVING FOR A NEIGHBOUR AND WANTS A GUN BESIDE HER. SEE HER INTO STATION RANGE.',
  offer: {},
  legs: [{
    id: 'cover', verb: { kind: 'escort', ship: shipDesignIdOf(SOURCE_DESIGN.python) }, place: AWAY,
    line: 'ESCORT: SEE THE PYTHON INTO STATION RANGE AT {TARGET}', deadlineDays: SIDE_JOB_DAYS,
    next: [
      { on: 'success', to: 'complete', settle: { pay: SIDE_JOB_PAY.escort, say: 'PYTHON SAFE — {PAY}' } },
      { on: 'targetDestroyed', to: 'fail' },
      { on: 'targetEscaped', to: 'fail' },
      FAIL,
    ],
  }],
  complete: { pay: 0, standing: 1 },
  fail: { pay: 0, standing: -1 },
};

export const SIDE_SCAN: Skeleton = {
  ...LOCAL, id: 'side-scan', hail: 'THE STATION WANTS A SHIP WATCHED',
  pitch: 'AN ANACONDA IS WORKING A NEIGHBOUR. HOLD IT ON YOUR SCANNER FOR TWENTY SECONDS. DO NOT FIRE.',
  offer: {},
  legs: [{
    id: 'watch', verb: { kind: 'scan', ship: shipDesignIdOf(SOURCE_DESIGN.anaconda), seconds: SCAN_SECONDS },
    place: AWAY, line: 'SCAN: HOLD THE ANACONDA AT {TARGET} ON YOUR SCANNER', deadlineDays: SIDE_JOB_DAYS,
    next: [
      { on: 'success', to: 'complete', settle: { pay: SIDE_JOB_PAY.scan, say: 'SCAN COMPLETE — {PAY}' } },
      { on: 'targetDestroyed', to: 'fail', settle: { pay: 0, standing: -2 } },
      { on: 'targetEscaped', to: 'fail' },
      FAIL,
    ],
  }],
  complete: { pay: 0, standing: 1 },
  fail: { pay: 0, standing: -1 },
};

export const SIDE_JOBS: readonly Skeleton[] = [
  SIDE_HUNT, SIDE_DELIVER, SIDE_RECOVER, SIDE_RESCUE,
  SIDE_AMBUSH, SIDE_SMUGGLE, SIDE_ESCORT, SIDE_SCAN,
];
