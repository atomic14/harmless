// Arc four: THE HARVEST WATCH, from the port administrator at Xeer.
//
// Theme. An Anaconda is landing counterfeit grain certificates on Xeer's
// harvest, and the administrator wants proof before she wants blood. Hold
// the Anaconda on the scanner. Then run down the Fer-de-Lance that carries
// the certificates, near Edle, where the last patron waits.
//
// The recovery is `trail`. A Fer-de-Lance that jumps away leaves a trail a
// station can read. A commander who reports it at the handover world still
// completes the arc, at the courier's fee rather than the bounty.

import { ARC_HANDOVER_JUMPS, ARC_LEG_DAYS, ARC_PAY, SCAN_SECONDS, SIDE_JOB_RANGE } from '../../../constants/missions.ts';
import { SOURCE_DESIGN } from '../../../game/ship-specs.ts';
import { shipDesignIdOf } from '../../../game/ship-identity.ts';
import type { Skeleton } from '../../model.ts';

const TOWARD = { kind: 'handover', toward: 'arc-edle', ...ARC_HANDOVER_JUMPS } as const;

export const ARC_XEER: Skeleton = {
  id: 'arc-xeer',
  kind: 'arc',
  anchor: 'fixed',
  patron: { kind: 'world', seedSlot: 150 },
  hail: 'THE PORT ADMINISTRATOR AT XEER WANTS PROOF',
  pitch: 'AN ANACONDA IS FORGING THE HARVEST. WATCH IT, THEN CATCH THE SHIP THAT CARRIES THE PAPERS.',
  offer: { done: ['arc-vetitice'] },
  legs: [
    {
      id: 'watch', verb: { kind: 'scan', ship: shipDesignIdOf(SOURCE_DESIGN.anaconda), seconds: SCAN_SECONDS },
      place: { kind: 'band', ...SIDE_JOB_RANGE },
      line: 'ADMINISTRATOR: HOLD THE ANACONDA AT {TARGET} ON YOUR SCANNER', deadlineDays: ARC_LEG_DAYS,
      next: [
        { on: 'success', to: 'chase', settle: { pay: ARC_PAY.scan, say: 'PROOF TAKEN — {PAY}. THE COURIER RUNS NEAR {TARGET}.' } },
        { on: 'targetDestroyed', to: 'chase', settle: { pay: 0, standing: -2, say: 'SHE WANTED PROOF, NOT A WRECK. THE COURIER RUNS NEAR {TARGET}.' } },
        { on: 'targetEscaped', to: 'chase', settle: { pay: 0, say: 'THE ANACONDA JUMPED. THE COURIER RUNS NEAR {TARGET}.' } },
        { on: 'failed', to: 'fail' },
      ],
    },
    {
      id: 'chase', verb: { kind: 'hunt', ship: shipDesignIdOf(SOURCE_DESIGN.ferDeLance), canEscape: true }, place: TOWARD,
      line: 'ADMINISTRATOR: DESTROY THE FER-DE-LANCE — LAST SEEN AT {TARGET}', deadlineDays: ARC_LEG_DAYS,
      next: [
        { on: 'targetDestroyed', to: 'complete', settle: { pay: ARC_PAY.hunt, say: 'COURIER DESTROYED — {PAY} FROM XEER' } },
        { on: 'targetEscaped', to: 'trail', settle: { pay: 0, say: 'THE COURIER JUMPED. REPORT ITS TRAIL AT {TARGET}.' } },
        { on: 'targetFled', to: 'trail', settle: { pay: 0, say: 'THE COURIER FLED. REPORT ITS TRAIL AT {TARGET}.' } },
        { on: 'failed', to: 'fail' },
      ],
    },
    {
      id: 'trail', verb: { kind: 'deliver' }, place: TOWARD,
      line: 'ADMINISTRATOR: REPORT THE COURIER\'S TRAIL AT {TARGET}', deadlineDays: ARC_LEG_DAYS,
      next: [
        { on: 'success', to: 'complete', settle: { pay: ARC_PAY.deliver, say: 'TRAIL REPORTED — {PAY} FROM XEER' } },
        { on: 'failed', to: 'fail' },
      ],
    },
  ],
  complete: { pay: 0, standing: 2, lead: 'arc-edle' },
  fail: { pay: 0, standing: -1, lead: 'arc-edle' },
};
