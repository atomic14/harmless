// Is this system high tech? — one bit, and two things read it.
//
// The released game asked this question once and spent the answer twice. It
// picked the dodecahedral "Dodo" station over the Coriolis, and it set bit 0 of
// the blueprint-set number, which is which ships the system flies (docs/TODO/138
// and `game/blueprint-set.ts`). Harmless had the first reader from long before
// the released catalogue arrived. This is where the rule stopped being written
// out at the reader.
//
// The threshold itself is `DODO_TECH_LEVEL` in `constants/station.ts`, and it is
// stated in SHOWN one-based units. The raw `techLevel` a system carries is
// zero-based, so the conversion lives here and nowhere else.

import { DODO_TECH_LEVEL } from '../constants/station.ts';

/**
 * True where a system rates the Dodo, and where the blueprint number gets its
 * low bit.
 *
 * @param techLevel the system's RAW zero-based level, as `galaxy.ts` computes it
 */
export function isHighTechSystem(techLevel: number): boolean {
  return techLevel + 1 >= DODO_TECH_LEVEL;
}
