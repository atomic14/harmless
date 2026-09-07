// Arc one: THE GRUB LEDGER, from the governor of Lave.
//
// Theme. Somebody skimmed the tree grub export, and the ledger that proves
// it went adrift in a canister when the courier's ship broke up. The
// governor wants the ledger back and the courier caught. Recover the
// canister. If it is lost, scan the courier's partner instead, to learn
// where the courier runs. Then hunt the courier down near Rabedira, where
// the next patron waits.
//
// The recovery leg is `witness`. A canister shot before the scoop turns the
// first leg into a scan rather than a failure (docs/TODO/190, failure rule
// 2). A courier who jumps away still completes the arc, at no fee, because
// the lead matters more than the bounty.

import { ARC_HANDOVER_JUMPS, ARC_LEG_DAYS, ARC_PAY, SIDE_JOB_RANGE } from '../../../constants/missions.ts';
import { SOURCE_DESIGN } from '../../../game/ship-specs.ts';
import { shipDesignIdOf } from '../../../game/ship-identity.ts';
import type { Skeleton } from '../../model.ts';

const COBRA = shipDesignIdOf(SOURCE_DESIGN.cobraMk3);

export const ARC_LAVE: Skeleton = {
  id: 'arc-lave',
  kind: 'arc',
  anchor: 'fixed',
  patron: { kind: 'world', seedSlot: 7 },
  hail: 'THE GOVERNOR OF LAVE HAS A JOB FOR YOU',
  pitch: 'THE GRUB EXPORT LEDGER WENT ADRIFT WITH A SMUGGLER. THE GOVERNOR WANTS IT BACK, AND THE SMUGGLER CAUGHT.',
  offer: {},
  legs: [
    {
      id: 'ledger', verb: { kind: 'recover', item: 'grub-ledger' }, place: { kind: 'band', ...SIDE_JOB_RANGE },
      line: 'GOVERNOR: SCOOP THE LEDGER CANISTER ADRIFT AT {TARGET}', deadlineDays: ARC_LEG_DAYS,
      next: [
        { on: 'success', to: 'runner', settle: { pay: ARC_PAY.recover, say: 'LEDGER ABOARD — {PAY}. NOW THE SMUGGLER.' } },
        { on: 'targetDestroyed', to: 'witness', settle: { pay: 0, say: 'THE LEDGER IS GONE. FIND THE PARTNER WHO KNOWS THE ROUTE.' } },
        { on: 'failed', to: 'fail' },
      ],
    },
    {
      id: 'witness', verb: { kind: 'scan', ship: COBRA, seconds: 20 }, place: { kind: 'band', ...SIDE_JOB_RANGE },
      line: 'GOVERNOR: HOLD THE PARTNER\'S COBRA AT {TARGET} ON YOUR SCANNER', deadlineDays: ARC_LEG_DAYS,
      next: [
        { on: 'success', to: 'runner', settle: { pay: ARC_PAY.scan, say: 'SCAN COMPLETE — {PAY}. THE SMUGGLER RUNS NEAR {TARGET}.' } },
        { on: 'targetDestroyed', to: 'runner', settle: { pay: 0, standing: -1, say: 'THE PARTNER IS DEAD. THE GOVERNOR IS NOT PLEASED.' } },
        { on: 'targetEscaped', to: 'runner', settle: { pay: 0, say: 'THE PARTNER JUMPED. THE SMUGGLER RUNS NEAR {TARGET}.' } },
        { on: 'failed', to: 'fail' },
      ],
    },
    {
      id: 'runner', verb: { kind: 'hunt', ship: COBRA, canEscape: true },
      place: { kind: 'handover', toward: 'arc-rabedira', ...ARC_HANDOVER_JUMPS },
      line: 'GOVERNOR: DESTROY THE SMUGGLER\'S COBRA — LAST SEEN AT {TARGET}', deadlineDays: ARC_LEG_DAYS,
      next: [
        { on: 'targetDestroyed', to: 'complete', settle: { pay: ARC_PAY.hunt, say: 'SMUGGLER DESTROYED — {PAY} FROM LAVE' } },
        { on: 'targetEscaped', to: 'complete', settle: { pay: 0, say: 'THE SMUGGLER GOT AWAY. THE GOVERNOR PAYS NOTHING.' } },
        { on: 'targetFled', to: 'complete', settle: { pay: 0, say: 'THE SMUGGLER FLED. THE GOVERNOR PAYS NOTHING.' } },
        { on: 'failed', to: 'fail' },
      ],
    },
  ],
  complete: { pay: 0, standing: 2, lead: 'arc-rabedira' },
  fail: { pay: 0, standing: -1, lead: 'arc-rabedira' },
};
