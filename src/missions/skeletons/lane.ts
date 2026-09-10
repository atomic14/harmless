// The pirates on a lane the player is sent to clear (docs/TODO/203 M2).
//
// Clear the Lane and the first leg of the Vetitice arc both promise pirates
// on the way to the target world. Neither spawned any before this file, so
// the player flew an ordinary lane and could not tell what the job was about.
// Both legs name this list, so the lane is the same fight from either patron.
//
// Three light hulls, flown as pirates. A Krait pair and a Mamba is a fight a
// Cobra with pulse lasers can win. It is still a fight, which a lone
// Sidewinder is not. The tags answer nothing in the machine. A lane pirate is
// scenery with a gun, and a kill among them settles no branch.

import { SOURCE_DESIGN } from '../../game/ship-specs.ts';
import { shipDesignIdOf } from '../../game/ship-identity.ts';
import type { TaggedShip } from '../model.ts';

export const LANE_PIRATES: readonly TaggedShip[] = [
  { ship: shipDesignIdOf(SOURCE_DESIGN.krait), tag: 'lane#krait-1', job: 'hunt' },
  { ship: shipDesignIdOf(SOURCE_DESIGN.krait), tag: 'lane#krait-2', job: 'hunt' },
  { ship: shipDesignIdOf(SOURCE_DESIGN.mamba), tag: 'lane#mamba', job: 'hunt' },
];
