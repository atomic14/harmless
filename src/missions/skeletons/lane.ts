// The pirates a job keeps company with: on a lane, at a jump-in, and beside
// a target (docs/TODO/203 M2, docs/TODO/214 M1).
//
// The job Clear the Lane promises pirates on the way to the target world. So
// does the first leg of the Vetitice arc. Neither spawned any before this file,
// so the player flew an ordinary lane and could not tell what the job was
// about. Both legs name `LANE_PIRATES`, so the lane is the same fight from
// either patron.
//
// docs/TODO/214 M1 adds the rest. Chris, 2026-09-13: *"there are pirates
// waiting for you when you jump in"*. A hunt's target flies with a wingman.
// A delivery meets a pair at the far end, because somebody wants the packet.
// A canister adrift has a Krait circling it. The words say nothing of any
// of them, and that is the surprise. A spawn list is outside the dossier
// hash, so no dossier changes.
//
// Every one of these is scenery with a gun. The tags answer nothing in the
// machine, and a kill among them settles no branch. The flight probe under
// docs/reviews/missions-2026-09-12 measures what they cost a fresh commander.

import { SOURCE_DESIGN } from '../../game/ship-specs.ts';
import { shipDesignIdOf } from '../../game/ship-identity.ts';
import type { ShipId, TaggedShip } from '../model.ts';

const krait = shipDesignIdOf(SOURCE_DESIGN.krait);
const mamba = shipDesignIdOf(SOURCE_DESIGN.mamba);
const sidewinder = shipDesignIdOf(SOURCE_DESIGN.sidewinder);

/**
 * Three light hulls, flown as pirates. A Krait pair and a Mamba is a fight a
 * Cobra with pulse lasers can win. It is still a fight, which a lone
 * Sidewinder is not.
 */
export const LANE_PIRATES: readonly TaggedShip[] = [
  { ship: krait, tag: 'lane#krait-1', job: 'hunt' },
  { ship: krait, tag: 'lane#krait-2', job: 'hunt' },
  { ship: mamba, tag: 'lane#mamba', job: 'hunt' },
];

/** Two Sidewinders at the far end of a delivery: somebody wants the packet. */
export const PAIR: readonly TaggedShip[] = [
  { ship: sidewinder, tag: 'pair#sidewinder-1', job: 'hunt' },
  { ship: sidewinder, tag: 'pair#sidewinder-2', job: 'hunt' },
];

/** One Krait circling a canister adrift. */
export const LONE_KRAIT: readonly TaggedShip[] = [
  { ship: krait, tag: 'lone#krait', job: 'hunt' },
];

/** A wingman of the target's own design, so a hunt is two of its kind. */
export function wingmanOf(ship: ShipId, leg: string): readonly TaggedShip[] {
  return [{ ship, tag: `wing#${leg}`, job: 'hunt' }];
}
